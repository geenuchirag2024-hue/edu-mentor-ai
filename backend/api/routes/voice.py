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
from backend.services.mentor_registry import get_mentor_voice_config
from backend.utils.audio import audio_to_base64
from backend.voice.stt import get_stt
from backend.voice.tts import get_tts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["voice"])


@router.post("/voice/transcribe", response_model=TranscribeResponse)
async def transcribe(
    audio: UploadFile = File(...),
    language: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
):
    try:
        audio_bytes = await audio.read()
        logger.info(
            "transcribe endpoint: received %d bytes, filename=%s, lang=%s, user=%s",
            len(audio_bytes),
            audio.filename,
            language,
            current_user.email,
        )
        info = await asyncio.to_thread(
            get_stt().transcribe_with_info,
            audio_bytes,
            audio.filename or "audio.webm",
            language=language,
        )
        return TranscribeResponse(
            text=info.get("text", ""),
            language=info.get("language") or language,
            detected_language=info.get("detected_language"),
            language_probability=info.get("language_probability"),
            status=info.get("status", "success"),
            message=info.get("message"),
        )
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
        clean_lang = (request.language or "en").lower().strip()
        voice_cfg = get_mentor_voice_config(request.mentor_id, language=clean_lang)
        tts_supported = bool(voice_cfg.get("is_supported", True))

        audio = await asyncio.to_thread(
            get_tts().synthesize,
            request.text,
            request.mentor_id,
            request.language,
        )
        return SynthesizeResponse(
            audio_base64=audio_to_base64(audio) if audio else "",
            mentor_id=request.mentor_id or "mira",
            language=request.language or "en",
            tts_supported=tts_supported,
            status="success" if audio else ("tts_unsupported" if not tts_supported else "silent_fallback"),
        )
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
    subject: str = Form(default="Machine Learning"),
    mentor_id: str = Form(default="mira"),
    language: str = Form(default="en"),
    current_user: User = Depends(get_current_user),
):
    try:
        authenticated_learner_id = f"user_{current_user.id}"
        audio_bytes = await audio.read()
        logger.info(
            "voice_query endpoint: received %d bytes, filename=%s, user=%s, mentor=%s, subject=%s, lang=%s",
            len(audio_bytes),
            audio.filename,
            current_user.email,
            mentor_id,
            subject,
            language,
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
            subject,
            mentor_id,
            language,
        )
        return VoiceQueryResponse(**result)
    except Exception as exc:
        logger.exception("voice-query failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Voice assistant failed. Try typing your question, or record a shorter clip.",
        ) from exc
