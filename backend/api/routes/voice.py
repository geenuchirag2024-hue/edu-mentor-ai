import asyncio
import base64

from fastapi import APIRouter, File, Form, UploadFile

from backend.api.schemas.voice import (
    SynthesizeRequest,
    SynthesizeResponse,
    TranscribeResponse,
    VoiceQueryResponse,
)
from backend.services.assistant_pipeline import process_voice_query
from backend.utils.audio import audio_to_base64
from backend.voice.stt import get_stt
from backend.voice.tts import get_tts

router = APIRouter(prefix="/api", tags=["voice"])


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    text = await asyncio.to_thread(
        get_stt().transcribe, audio_bytes, audio.filename or "audio.webm"
    )
    return TranscribeResponse(text=text)


@router.post("/voice/synthesize", response_model=SynthesizeResponse)
async def synthesize(request: SynthesizeRequest):
    audio = await asyncio.to_thread(get_tts().synthesize, request.text)
    return SynthesizeResponse(audio_base64=audio_to_base64(audio))


@router.post("/assistant/voice-query", response_model=VoiceQueryResponse)
async def voice_query(
    audio: UploadFile = File(...),
    session_id: str | None = Form(default=None),
):
    audio_bytes = await audio.read()
    result = await asyncio.to_thread(
        process_voice_query,
        audio_bytes,
        audio.filename or "audio.webm",
        session_id,
    )
    return VoiceQueryResponse(**result)
