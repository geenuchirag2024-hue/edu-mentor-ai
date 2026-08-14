"""Orchestrates STT → RAG/LLM → TTS voice assistant pipeline."""

from __future__ import annotations

from collections.abc import Iterator

from backend.models.llm import get_llm
from backend.rag.retriever import retrieve_context
from backend.rag.user_docs import user_document_store
from backend.rag.vector_store import get_vector_store
from backend.services.conversation import conversation_store
from backend.services.learning import learning_store
from backend.services.mascot_cues import infer_mascot_cues
from backend.services.prompts import build_tutor_messages, is_greeting
from backend.utils.audio import audio_to_base64
from backend.voice.stt import get_stt
from backend.voice.tts import get_tts


def prepare_text_query(
    message: str,
    session_id: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    learner_id: str | None = None,
    use_notes: bool = False,
) -> tuple[str, list[dict[str, str]], list[str]]:
    """Build session id, LLM messages, and sources without updating history."""
    sid = conversation_store.get_or_create_session(session_id)
    history = conversation_store.get_history(sid)

    context = ""
    sources: list[str] = []
    if not is_greeting(message):
        if use_notes:
            context, sources = user_document_store.retrieve(sid, message)
        if (not context) and get_vector_store().is_available:
            context, sources = retrieve_context(message)

    extra = learning_store.coaching_context(learner_id) or None
    messages = build_tutor_messages(
        message,
        history=history,
        context=context or None,
        for_voice=for_voice,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        extra_system=extra,
    )
    return sid, messages, sources


def finalize_text_query(
    sid: str,
    message: str,
    answer: str,
    learner_id: str | None = None,
) -> None:
    conversation_store.append(sid, "user", message)
    conversation_store.append(sid, "assistant", answer)
    if learner_id:
        learning_store.record_study(learner_id, message, answer)


def stream_text_query(
    message: str,
    session_id: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    learner_id: str | None = None,
    use_notes: bool = False,
) -> tuple[str, Iterator[str], list[str]]:
    """Return session id, token stream, and sources for SSE chat."""
    sid, messages, sources = prepare_text_query(
        message,
        session_id,
        for_voice=for_voice,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        learner_id=learner_id,
        use_notes=use_notes,
    )
    tokens = get_llm().generate_stream(messages, for_voice=for_voice)
    return sid, tokens, sources


def process_text_query(
    message: str,
    session_id: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    learner_id: str | None = None,
    use_notes: bool = False,
) -> dict:
    sid, messages, sources = prepare_text_query(
        message,
        session_id,
        for_voice=for_voice,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        learner_id=learner_id,
        use_notes=use_notes,
    )
    answer = get_llm().generate(messages, for_voice=for_voice)
    finalize_text_query(sid, message, answer, learner_id=learner_id)
    cues = infer_mascot_cues(
        answer,
        tutor_mode=tutor_mode or "teacher",
        user_message=message,
        hint_level=hint_level,
    )
    return {
        "answer": answer,
        "session_id": sid,
        "sources": sources,
        **cues,
    }


def process_voice_query(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    session_id: str | None = None,
    tutor_mode: str | None = None,
    learner_id: str | None = None,
    use_notes: bool = False,
    hint_level: int = 0,
) -> dict:
    transcript = get_stt().transcribe(audio_bytes, filename=filename)

    if not transcript.strip():
        fallback = "I didn't catch that. Could you please repeat your question?"
        audio = get_tts().synthesize(fallback)
        sid = conversation_store.get_or_create_session(session_id)
        return {
            "transcript": "",
            "answer": fallback,
            "audio_base64": audio_to_base64(audio),
            "session_id": sid,
            "sources": [],
            "emotion": "surprised",
            "gesture": "wave",
            "response_type": "greeting",
        }

    result = process_text_query(
        transcript,
        session_id=session_id,
        for_voice=True,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        learner_id=learner_id,
        use_notes=use_notes,
    )
    audio = get_tts().synthesize(result["answer"])

    return {
        "transcript": transcript,
        "answer": result["answer"],
        "audio_base64": audio_to_base64(audio),
        "session_id": result["session_id"],
        "sources": result["sources"],
        "emotion": result.get("emotion", "confident"),
        "gesture": result.get("gesture", "none"),
        "response_type": result.get("response_type", "explanation"),
    }
