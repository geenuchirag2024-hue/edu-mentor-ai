"""Speech-to-text using faster-whisper."""

from __future__ import annotations

import logging
import tempfile
from functools import lru_cache
from pathlib import Path

from backend.config import get_settings

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
        suffix = Path(filename).suffix or ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        logger.info("STT input: %d bytes, model=%s", len(audio_bytes), self.settings.whisper_model)

        try:
            segments, info = self._model.transcribe(
                tmp_path,
                beam_size=1,
                language="en",
                vad_filter=True,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            logger.info("STT result: '%s' (lang=%s)", text, getattr(info, "language", "?"))
            return text
        except Exception as exc:
            logger.error("STT failed: %s", exc)
            return ""
        finally:
            Path(tmp_path).unlink(missing_ok=True)


@lru_cache
def get_stt() -> STTService:
    return STTService()
