"""Text-to-speech using Piper."""

from __future__ import annotations

import io
import logging
import wave
from functools import lru_cache
from pathlib import Path

from backend.config import get_settings
from backend.utils.tts_text import prepare_text_for_speech

logger = logging.getLogger(__name__)


class TTSService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._voice = None

    def _voice_path(self) -> Path:
        voice_dir = Path(self.settings.piper_model_dir) / self.settings.piper_voice
        onnx = voice_dir / f"{self.settings.piper_voice}.onnx"
        if not onnx.exists():
            onnx = voice_dir / "model.onnx"
        return onnx

    def _load(self) -> None:
        if self._voice is not None:
            return

        onnx_path = self._voice_path()
        if not onnx_path.exists():
            logger.warning(
                "Piper voice not found at %s — using silent WAV fallback. "
                "Run scripts/download_models.py.",
                onnx_path,
            )
            self._voice = None
            return

        try:
            from piper import PiperVoice

            self._voice = PiperVoice.load(str(onnx_path))
            logger.info("Loaded Piper voice from %s", onnx_path)
        except Exception as exc:
            logger.warning("Failed to load Piper: %s", exc)
            self._voice = None

    def synthesize(self, text: str) -> bytes:
        self._load()
        speech_text = prepare_text_for_speech(text)

        if not speech_text.strip():
            return self._silent_wav()

        if self._voice is None:
            return self._silent_wav(duration_ms=max(500, len(speech_text) * 30))

        audio_buffer = io.BytesIO()
        with wave.open(audio_buffer, "wb") as wav_file:
            self._voice.synthesize_wav(speech_text, wav_file)

        return audio_buffer.getvalue()

    @staticmethod
    def _silent_wav(duration_ms: int = 500, sample_rate: int = 22050) -> bytes:
        num_samples = int(sample_rate * duration_ms / 1000)
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(sample_rate)
            wav.writeframes(b"\x00\x00" * num_samples)
        return buffer.getvalue()


@lru_cache
def get_tts() -> TTSService:
    return TTSService()
