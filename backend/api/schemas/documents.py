from datetime import datetime
from pydantic import BaseModel, ConfigDict


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doc_uuid: str
    filename: str
    file_size: int
    page_count: int
    chunk_count: int
    status: str
    error_message: str | None = None
    subject: str
    created_at: datetime
    updated_at: datetime


class DocumentUploadResponse(BaseModel):
    document: DocumentOut
    message: str
    reused: bool = False


class DocumentAskRequest(BaseModel):
    question: str
    language: str = "en"


class DocumentAskResponse(BaseModel):
    answer: str
    document_id: int
    filename: str
    sources: list[int]
    sources_text: str
    retrieval_latency_ms: int
    generation_latency_ms: int
    total_latency_ms: int


class DocumentMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    sources: list[int] = []
    created_at: datetime


class DocumentHistoryResponse(BaseModel):
    document_id: int
    filename: str
    messages: list[DocumentMessageOut]

