"""Pydantic models for tutor, quiz, interview, notes, and progress APIs."""

from typing import Literal

from pydantic import BaseModel, Field

TutorMode = Literal["teacher", "doubt_solver", "quiz_master", "interviewer"]


class QuizGenerateRequest(BaseModel):
    subject: str = "Machine Learning"
    topic: str = "Machine Learning"
    difficulty: Literal["easy", "medium", "hard"] | None = None
    n_questions: int = Field(default=5, ge=3, le=12)
    learner_id: str | None = None


class QuizQuestionPublic(BaseModel):
    id: str
    type: str
    prompt: str
    options: list[str] = Field(default_factory=list)
    explanation: str | None = None
    subtopic: str | None = None


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    subject: str
    topic: str
    difficulty: str
    questions: list[QuizQuestionPublic]


class QuizGradeRequest(BaseModel):
    quiz_id: str
    answers: dict[str, str]
    learner_id: str | None = None


class QuizHintRequest(BaseModel):
    quiz_id: str
    question_id: str


class InterviewStartRequest(BaseModel):
    topic: str = "Machine Learning"
    n_questions: int = Field(default=5, ge=3, le=8)
    learner_id: str | None = None


class InterviewAnswerRequest(BaseModel):
    interview_id: str
    answer: str


class NotesAskRequest(BaseModel):
    session_id: str
    question: str
    learner_id: str | None = None
