"""Tutor APIs: quiz, interview, progress, and notes upload."""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from backend.api.schemas.tutor import (
    InterviewAnswerRequest,
    InterviewStartRequest,
    NotesAskRequest,
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizGradeRequest,
    QuizHintRequest,
)
from backend.models.llm import get_llm
from backend.rag.user_docs import user_document_store
from backend.services.interview import answer_interview, start_interview
from backend.services.learning import learning_store
from backend.services.prompts import build_tutor_messages
from backend.services.quiz import generate_quiz, grade_quiz, quiz_hint

router = APIRouter(prefix="/api/tutor", tags=["tutor"])


@router.post("/quiz/generate", response_model=QuizGenerateResponse)
async def quiz_generate(request: QuizGenerateRequest):
    result = await asyncio.to_thread(
        generate_quiz,
        subject=request.subject,
        topic=request.topic,
        difficulty=request.difficulty,
        n_questions=request.n_questions,
        learner_id=request.learner_id,
    )
    return result


@router.post("/quiz/grade")
async def quiz_grade(request: QuizGradeRequest):
    try:
        return await asyncio.to_thread(
            grade_quiz, request.quiz_id, request.answers, request.learner_id
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/quiz/hint")
async def quiz_hint_route(request: QuizHintRequest):
    try:
        return await asyncio.to_thread(quiz_hint, request.quiz_id, request.question_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/interview/start")
async def interview_start(request: InterviewStartRequest):
    return await asyncio.to_thread(
        start_interview,
        topic=request.topic,
        learner_id=request.learner_id,
        n_questions=request.n_questions,
    )


@router.post("/interview/answer")
async def interview_answer(request: InterviewAnswerRequest):
    try:
        return await asyncio.to_thread(
            answer_interview, request.interview_id, request.answer
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/progress")
async def progress(learner_id: str = Query(..., min_length=1)):
    return learning_store.dashboard(learner_id)


@router.post("/notes/upload")
async def notes_upload(
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    learner_id: str | None = Form(default=None),
):
    sid = session_id or str(uuid.uuid4())
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        meta = await asyncio.to_thread(
            user_document_store.ingest_bytes,
            sid,
            file.filename or "notes.txt",
            data,
            file.content_type or "",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if learner_id:
        learning_store.record_study(learner_id, file.filename or "notes")
    return meta


@router.get("/notes")
async def notes_list(session_id: str = Query(...)):
    return {"session_id": session_id, "documents": user_document_store.list_docs(session_id)}


@router.post("/notes/ask")
async def notes_ask(request: NotesAskRequest):
    context, sources = user_document_store.retrieve(request.session_id, request.question)
    if not context:
        raise HTTPException(
            status_code=400,
            detail="No notes uploaded for this session. Upload a PDF or text file first.",
        )
    coaching = learning_store.coaching_context(request.learner_id)
    extra = (
        "Answer using the student's uploaded notes. Quote or paraphrase the notes. "
        "If the notes do not cover the question, say so and give a short general explanation."
    )
    if coaching:
        extra += f"\n{coaching}"

    def _run() -> str:
        messages = build_tutor_messages(
            request.question,
            context=context,
            tutor_mode="teacher",
            extra_system=extra,
        )
        return get_llm().generate(messages)

    answer = await asyncio.to_thread(_run)
    if request.learner_id:
        learning_store.record_study(request.learner_id, request.question, answer)
    return {
        "answer": answer,
        "session_id": request.session_id,
        "sources": sources,
        "emotion": "confident",
        "gesture": "point",
        "response_type": "explanation",
    }
