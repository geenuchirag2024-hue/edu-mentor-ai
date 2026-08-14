from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    tutor_mode: str = "teacher"
    hint_level: int = Field(default=0, ge=0, le=3)
    learner_id: str | None = None
    use_notes: bool = False


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    sources: list[str] = Field(default_factory=list)
    emotion: str = "confident"
    gesture: str = "point"
    response_type: str = "explanation"
