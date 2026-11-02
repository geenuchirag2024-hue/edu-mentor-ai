from pydantic import BaseModel


class TranscribeResponse(BaseModel):
    text: str
    language: str | None = None


class SynthesizeRequest(BaseModel):
    text: str
    mentor_id: str | None = "mira"
    language: str | None = "en"


class SynthesizeResponse(BaseModel):
    audio_base64: str
    content_type: str = "audio/wav"
    mentor_id: str = "mira"
    language: str = "en"


class VoiceQueryResponse(BaseModel):
    transcript: str
    answer: str
    audio_base64: str
    session_id: str
    sources: list[str] = []
    emotion: str = "confident"
    gesture: str = "point"
    response_type: str = "explanation"
    mentor_id: str = "mira"
    language: str = "en"
