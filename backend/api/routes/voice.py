import asyncio
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.api.deps import get_current_user
from backend.api.schemas.voice import (
    SynthesizeRequest,
    SynthesizeResponse,
    TranscribeResponse,
    VoiceQueryResponse,
)
from backend.db.models import User
from backend.services.assistant_pipeline import process_voice_query
from backend.utils.audio import audio_to_base64
from backend.voice.stt import get_stt
from backend.voice.tts import get_tts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["voice"])


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    try:
        audio_bytes = await audio.read()
        logger.info(
            "transcribe endpoint: received %d bytes, filename=%s, user=%s",
            len(audio_bytes),
            audio.filename,
            current_user.email,
        )
        text = await asyncio.to_thread(
            get_stt().transcribe, audio_bytes, audio.filename or "audio.webm"
        )
        return TranscribeResponse(text=text)
    except Exception as exc:
        logger.exception("transcribe failed: %s", exc)
        raise HTTPException(
            status_code=503, detail="Speech-to-text failed. Please try again."
        ) from exc


@router.post("/voice/synthesize", response_model=SynthesizeResponse)
async def synthesize(
    request: SynthesizeRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        audio = await asyncio.to_thread(get_tts().synthesize, request.text)
        return SynthesizeResponse(audio_base64=audio_to_base64(audio))
    except Exception as exc:
        logger.exception("synthesize failed: %s", exc)
        raise HTTPException(
            status_code=503, detail="Text-to-speech failed. Please try a shorter reply."
        ) from exc


@router.post("/assistant/voice-query", response_model=VoiceQueryResponse)
async def voice_query(
    audio: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    tutor_mode: str | None = Form(default="teacher"),
    learner_id: str | None = Form(default=None),
    use_notes: bool = Form(default=False),
    hint_level: int = Form(default=0),
    current_user: User = Depends(get_current_user),
):
    try:
        authenticated_learner_id = f"user_{current_user.id}"
        audio_bytes = await audio.read()
        logger.info(
            "voice_query endpoint: received %d bytes, filename=%s, user=%s",
            len(audio_bytes),
            audio.filename,
            current_user.email,
        )
        result = await asyncio.to_thread(
            process_voice_query,
            audio_bytes,
            audio.filename or "audio.webm",
            session_id,
            tutor_mode,
            authenticated_learner_id,
            use_notes,
            hint_level,
        )
        return VoiceQueryResponse(**result)
    except Exception as exc:
        logger.exception("voice-query failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Voice assistant failed. Try typing your question, or record a shorter clip.",
        ) from exc
