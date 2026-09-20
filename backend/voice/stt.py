"""Speech-to-text using faster-whisper."""

from __future__ import annotations

import logging
import os
import tempfile
from functools import lru_cache
from pathlib import Path

from backend.config import get_settings
from backend.utils.audio_preprocess import looks_like_hallucination, preprocess_wav

logger = logging.getLogger(__name__)


class STTService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None

    def _load(self) -> None:
        if self._model is not None:
            return
        from faster_whisper import WhisperModel

        self._model = WhisperModel(
            self.settings.whisper_model,
            device="cpu",
            compute_type="int8",
        )
        logger.info("Loaded Whisper model: %s", self.settings.whisper_model)

    def transcribe(self, audio_bytes: bytes, filename: str = "audio.wav") -> str:
        if not audio_bytes:
            return ""

        self._load()
        audio_bytes = preprocess_wav(audio_bytes)
        suffix = Path(filename).suffix or ".wav"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        Path(tmp_path).write_bytes(audio_bytes)

        logger.info("STT input: %d bytes, model=%s", len(audio_bytes), self.settings.whisper_model)

        try:
            text = self._transcribe_file(tmp_path, vad_filter=False)
            if looks_like_hallucination(text):
                logger.info("STT hallucination filtered: '%s'", text)
                return ""
            logger.info("STT result: '%s'", text)
            return text
        except Exception as exc:
            logger.error("STT failed: %s", exc)
            return ""
        finally:
            Path(tmp_path).unlink(missing_ok=True)

    def _transcribe_file(self, path: str, vad_filter: bool) -> str:
        segments, info = self._model.transcribe(
            path,
            beam_size=1,
            language="en",
            vad_filter=vad_filter,
            condition_on_previous_text=False,
            without_timestamps=True,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        logger.info("STT lang=%s vad=%s", getattr(info, "language", "?"), vad_filter)
        return text


@lru_cache
def get_stt() -> STTService:
    return STTService()
