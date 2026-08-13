from pydantic import BaseModel


class TranscribeResponse(BaseModel):
    text: str


class SynthesizeRequest(BaseModel):
    text: str


class SynthesizeResponse(BaseModel):
    audio_base64: str
    content_type: str = "audio/wav"


class VoiceQueryResponse(BaseModel):
    transcript: str
    answer: str
    audio_base64: str
    session_id: str
    sources: list[str] = []
