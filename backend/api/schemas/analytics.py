from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeacherOverviewAnalytics(BaseModel):
    total_active_students: int
    total_study_hours: float
    total_questions_asked: int
    avg_ai_response_time_ms: int
    total_resources_published: int


class StudentActivitySummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    student_id: int
    full_name: str
    email: str
    total_study_seconds: int
    sessions_count: int
    questions_count: int
    avg_response_latency_ms: int
    last_active: datetime | None = None


class StudentQueryLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_name: str
    subject: str
    question: str
    answer: str
    sources: list[int] = []
    retrieval_latency_ms: int
    generation_latency_ms: int
    total_latency_ms: int
    status: str
    created_at: datetime


class LatencyStats(BaseModel):
    avg_ms: int
    median_ms: int
    p95_ms: int
    min_ms: int
    max_ms: int
    failed_count: int
    total_queries: int


class StudySessionPingRequest(BaseModel):
    session_uuid: str


class StudySessionPingResponse(BaseModel):
    session_uuid: str
    active_duration_seconds: int
    status: str

