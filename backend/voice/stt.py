"""Speech-to-text using faster-whisper with multilingual language support (EN, HI, KN)."""

from __future__ import annotations

import logging
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any

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
        try:
            from faster_whisper import WhisperModel  # type: ignore
        except ImportError:
            WhisperModel = None

        if WhisperModel is None:
            raise RuntimeError("faster-whisper is not installed")

        try:
            import ctranslate2
            if ctranslate2.get_cuda_device_count() > 0:
                self._model = WhisperModel(
                    self.settings.whisper_model,
                    device="cuda",
                    compute_type="float16",
                )
                logger.info("Loaded Faster-Whisper on CUDA GPU: %s", self.settings.whisper_model)
                return
        except Exception as exc:
            logger.warning("CUDA initialization for Faster-Whisper failed (%s); using CPU fallback.", exc)

        self._model = WhisperModel(
            self.settings.whisper_model,
            device="cpu",
            compute_type="int8",
        )
        logger.info("Loaded Faster-Whisper multilingual model on CPU: %s", self.settings.whisper_model)

    def _transcribe_file(self, tmp_path: str, language: str | None = None) -> Any:
        self._load()
        assert self._model is not None

        initial_prompt = None
        if language == "kn":
            initial_prompt = "ಕನ್ನಡ ಮಾತುಕತೆ, ಯಂತ್ರ ಕಲಿಕೆ, ದತ್ತಸಂಚಯ, ಪ್ರಶ್ನೆಗಳು ಮತ್ತು ವಿವರಣೆಗಳು."
        elif language == "hi":
            initial_prompt = "नमस्ते, यह मशीन लर्निंग और कंप्यूटर साइंस की कक्षा है।"

        try:
            segments, info = self._model.transcribe(
                tmp_path,
                beam_size=3 if language else 1,
                language=language,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=400),
                initial_prompt=initial_prompt,
                condition_on_previous_text=False,
                without_timestamps=True,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            detected_lang = getattr(info, "language", None)
            prob = getattr(info, "language_probability", 0.0)
            return text, detected_lang, prob
        except Exception as exc:
            logger.warning("VAD transcribe failed (%s); retrying standard pass", exc)
            segments, info = self._model.transcribe(
                tmp_path,
                beam_size=1,
                language=language,
                vad_filter=False,
                condition_on_previous_text=False,
                without_timestamps=True,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            detected_lang = getattr(info, "language", None)
            prob = getattr(info, "language_probability", 0.0)
            return text, detected_lang, prob

    def transcribe(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> str:
        """Backward-compatible transcription returning plain recognized text."""
        info = self.transcribe_with_info(audio_bytes, filename=filename, language=language)
        return info.get("text", "")

    def transcribe_with_info(
        self,
        audio_bytes: bytes,
        filename: str = "audio.wav",
        language: str | None = None,
    ) -> dict[str, Any]:
        """Perform multilingual transcription, returning text, detected language, and status."""
        if not audio_bytes or len(audio_bytes) < 12:
            return {
                "text": "",
                "language": language or "en",
                "detected_language": None,
                "language_probability": 0.0,
                "status": "empty_audio",
                "message": "Recording was empty or too short. Please speak clearly.",
            }

        self._load()
        audio_bytes = preprocess_wav(audio_bytes)
        suffix = Path(filename).suffix or ".wav"
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        os.close(fd)
        Path(tmp_path).write_bytes(audio_bytes)

        logger.info(
            "STT input: %d bytes, model=%s, requested_lang=%s",
            len(audio_bytes),
            self.settings.whisper_model,
            language,
        )

        try:
            lang = language.lower().strip() if language else None
            if not lang or lang in ("auto", "none"):
                lang = None
            elif lang.startswith("hi"):
                lang = "hi"
            elif lang.startswith("kn"):
                lang = "kn"
            elif lang.startswith("en"):
                lang = "en"

            res = self._transcribe_file(tmp_path, language=lang)
            if isinstance(res, tuple):
                text = res[0]
                detected_lang = res[1] if len(res) > 1 else (lang or "en")
                prob = res[2] if len(res) > 2 else 1.0
            else:
                text = str(res)
                detected_lang = lang or "en"
                prob = 1.0

            if looks_like_hallucination(text):
                logger.info("STT hallucination filtered: '%s'", text)
                return {
                    "text": "",
                    "language": lang or detected_lang or "en",
                    "detected_language": detected_lang,
                    "language_probability": prob,
                    "status": "filtered_hallucination",
                    "message": "Speech was unclear or background noise was detected.",
                }

            if not text:
                return {
                    "text": "",
                    "language": lang or detected_lang or "en",
                    "detected_language": detected_lang,
                    "language_probability": prob,
                    "status": "no_speech_detected",
                    "message": "No speech detected in audio recording.",
                }

            logger.info("STT recognized (%s -> %s): '%s'", lang, detected_lang, text)
            return {
                "text": text,
                "language": lang or detected_lang or "en",
                "detected_language": detected_lang,
                "language_probability": prob,
                "status": "success",
                "message": "Transcription successful.",
            }
        except Exception as exc:
            logger.error("STT failed: %s", exc)
            return {
                "text": "",
                "language": language or "en",
                "detected_language": None,
                "language_probability": 0.0,
                "status": "error",
                "message": f"Transcription error: {exc}",
            }
        finally:
            Path(tmp_path).unlink(missing_ok=True)


@lru_cache
def get_stt() -> STTService:
    return STTService()
