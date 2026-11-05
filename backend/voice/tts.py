"""Text-to-speech using Piper with multi-mentor voice assignment, caching, and fallbacks."""

from __future__ import annotations

import io
import json
import logging
import os
import struct
import subprocess
import sys
import threading
import wave
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.config import get_settings
from backend.services.mentor_registry import get_mentor_voice_config, normalize_mentor_id
from backend.utils.tts_text import prepare_text_for_speech

logger = logging.getLogger(__name__)

_WORKER_SCRIPT = Path(__file__).resolve().parent / "piper_worker.py"
_CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class TTSService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._workers: dict[str, subprocess.Popen[bytes]] = {}
        self._lock = threading.Lock()
        self._reported_fallbacks: set[str] = set()
        self._audio_cache: dict[tuple[str, str, str, str, str], bytes] = {}
        self._cache_lock = threading.Lock()
        self._max_cache_items = 250

    def resolve_mentor_voice(
        self,
        mentor_id: str | None = None,
        language: str | None = "en",
    ) -> tuple[Path, dict[str, Any], bool]:
        """Resolve model path and voice config for a mentor and language.

        Returns:
            (model_path, voice_config, is_actual_target_model)
        """
        clean_id = normalize_mentor_id(mentor_id)
        clean_lang = (language or "en").lower().strip()
        if clean_lang.startswith("hi"):
            clean_lang = "hi"
        elif clean_lang.startswith("kn"):
            clean_lang = "kn"
        else:
            clean_lang = "en"

        voice_cfg = get_mentor_voice_config(clean_id, language=clean_lang)

        # Kannada uses dedicated local engine interface
        if clean_lang == "kn":
            from backend.voice.kannada_tts import get_kannada_tts
            kannada_engine = get_kannada_tts()
            if kannada_engine.is_available() and kannada_engine.model_path:
                return kannada_engine.model_path, voice_cfg, True
            return Path(""), voice_cfg, False

        target_model = voice_cfg.get("voice_model", self.settings.piper_voice)
        fallback_model = voice_cfg.get("fallback_voice", "en_US-lessac-medium")

        base_dir = Path(self.settings.piper_model_dir)

        # 1. Check target model
        target_path = base_dir / target_model / f"{target_model}.onnx" if target_model else Path("")
        if target_path and not target_path.exists():
            alt_path = base_dir / target_model / "model.onnx"
            if alt_path.exists():
                target_path = alt_path

        if target_path and target_path.exists():
            return target_path, voice_cfg, True

        # 2. Check fallback model
        if not fallback_model:
            return Path(""), voice_cfg, False

        fallback_path = base_dir / fallback_model / f"{fallback_model}.onnx"
        if not fallback_path.exists():
            alt_fallback = base_dir / fallback_model / "model.onnx"
            if alt_fallback.exists():
                fallback_path = alt_fallback

        cache_key = f"{clean_id}:{clean_lang}"
        if cache_key not in self._reported_fallbacks and clean_id != "mira":
            self._reported_fallbacks.add(cache_key)
            logger.info(
                "[TTS] Mentor '%s' (lang=%s) configured voice '%s' not installed at %s. "
                "Using fallback '%s' with mentor voice parameter tuning.",
                clean_id,
                clean_lang,
                target_model,
                target_path,
                fallback_model,
            )

        return fallback_path, voice_cfg, False

    def _load(self) -> None:
        """Preload the default voice model at startup."""
        onnx_path, _, _ = self.resolve_mentor_voice("mira")
        if not onnx_path.exists():
            logger.warning(
                "Piper voice not found at %s — using silent WAV fallback. "
                "Run scripts/download_models.py.",
                onnx_path,
            )
            return
        with self._lock:
            self._ensure_worker(onnx_path)

    def _ensure_worker(self, onnx_path: Path) -> subprocess.Popen[bytes]:
        key = str(onnx_path.resolve())
        existing = self._workers.get(key)
        if existing is not None and existing.poll() is None:
            return existing

        self._stop_worker(key)
        logger.info("Starting Piper worker from %s", onnx_path)
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env.setdefault("ORT_LOG_SEVERITY_LEVEL", "3")
        proc = subprocess.Popen(
            [sys.executable, str(_WORKER_SCRIPT), str(onnx_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(Path(__file__).resolve().parents[2]),
            env=env,
            bufsize=0,
            creationflags=_CREATE_NO_WINDOW,
        )
        if proc.stderr is not None:
            t = threading.Thread(
                target=self._drain_stderr,
                args=(proc.stderr,),
                daemon=True,
            )
            t.start()
        self._wait_ready(proc)
        self._workers[key] = proc
        return proc

    @staticmethod
    def _wait_ready(proc: subprocess.Popen[bytes]) -> None:
        if proc.stdout is None:
            raise RuntimeError("Piper worker has no stdout")
        buf = b""
        while b"READY\n" not in buf and b"RDY\n" not in buf:
            chunk = proc.stdout.read(1)
            if not chunk:
                raise RuntimeError("Piper worker exited before becoming ready")
            buf += chunk
            if len(buf) > 8192:
                raise RuntimeError("Piper worker sent unexpected stdout before ready")

    def _stop_worker(self, key: str) -> None:
        proc = self._workers.pop(key, None)
        if proc is None:
            return
        try:
            proc.kill()
            proc.wait(timeout=3)
        except Exception:
            pass

    @staticmethod
    def _drain_stderr(stream) -> None:
        try:
            for line in iter(stream.readline, b""):
                text = line.decode("utf-8", errors="replace").strip()
                if text:
                    logger.warning("piper worker: %s", text)
        except Exception:
            return

    def _read_exact(self, stream, n: int, timeout: float) -> bytes:
        chunks: list[bytes] = []
        error: list[BaseException] = []

        def _read() -> None:
            try:
                buf = bytearray()
                while len(buf) < n:
                    piece = stream.read(n - len(buf))
                    if not piece:
                        break
                    buf.extend(piece)
                chunks.append(bytes(buf))
            except BaseException as exc:  # noqa: BLE001
                error.append(exc)

        worker = threading.Thread(target=_read, daemon=True)
        worker.start()
        worker.join(timeout)
        if worker.is_alive():
            raise TimeoutError(f"Piper worker timed out after {timeout:.0f}s")
        if error:
            raise error[0]
        return chunks[0] if chunks else b""

    def _ask_worker(self, onnx_path: Path, payload_str: str) -> bytes:
        key = str(onnx_path.resolve())
        payload = payload_str.encode("utf-8")
        last_error: Exception | None = None
        for attempt in range(2):
            proc = self._ensure_worker(onnx_path)
            if proc is None or proc.stdin is None or proc.stdout is None:
                raise RuntimeError("Piper worker failed to start")
            try:
                proc.stdin.write(struct.pack(">I", len(payload)))
                proc.stdin.write(payload)
                proc.stdin.flush()
                header = self._read_exact(proc.stdout, 4, timeout=45)
                if len(header) < 4:
                    raise RuntimeError("Piper worker closed the pipe")
                (nbytes,) = struct.unpack(">I", header)
                if nbytes > 12_000_000:
                    raise RuntimeError("Piper worker returned an invalid WAV size")
                wav = self._read_exact(proc.stdout, nbytes, timeout=45) if nbytes else b""
                if nbytes and len(wav) < nbytes:
                    raise RuntimeError("Piper worker returned a truncated WAV")
                return wav
            except Exception as exc:
                last_error = exc
                logger.warning("Piper worker attempt %s failed: %s", attempt + 1, exc)
                self._stop_worker(key)
        raise RuntimeError(str(last_error) if last_error else "Piper worker failed")

    def synthesize(
        self,
        text: str,
        mentor_id: str | None = None,
        language: str | None = "en",
    ) -> bytes:
        """Synthesize speech audio with distinct mentor voices, multilingual resolution, and caching."""
        speech_text = prepare_text_for_speech(text)
        if not speech_text.strip():
            return self._silent_wav()

        clean_id = normalize_mentor_id(mentor_id)
        clean_lang = (language or "en").lower().strip()
        if clean_lang.startswith("hi"):
            clean_lang = "hi"
        elif clean_lang.startswith("kn"):
            clean_lang = "kn"
        else:
            clean_lang = "en"

        # Dedicated Kannada offline engine routing
        if clean_lang == "kn":
            from backend.voice.kannada_tts import get_kannada_tts
            kannada_engine = get_kannada_tts()
            if kannada_engine.is_available():
                return kannada_engine.synthesize(speech_text)
            logger.info(
                "[TTS] Kannada language requested but no local Kannada model installed in %s. "
                "Returning empty audio while preserving exact Kannada text response.",
                kannada_engine.model_dir,
            )
            return b""

        onnx_path, voice_cfg, _ = self.resolve_mentor_voice(clean_id, language=clean_lang)

        # Explicitly enforce rule: Never read non-English (e.g. Kannada) text with an English voice
        if not voice_cfg.get("is_supported", True):
            logger.info(
                "[TTS] Language '%s' is not supported by installed Piper TTS models. "
                "Skipping audio generation to avoid playing incompatible English voice on non-English text. "
                "Exact text response is preserved.",
                clean_lang,
            )
            return b""

        if not onnx_path.exists():
            return self._silent_wav(duration_ms=max(500, len(speech_text) * 30))

        engine = voice_cfg.get("tts_engine", "piper")
        target_model = voice_cfg.get("voice_model", "en_US-lessac-medium")
        cache_key = (speech_text, clean_id, clean_lang, engine, target_model)

        with self._cache_lock:
            cached = self._audio_cache.get(cache_key)
            if cached:
                return cached

        payload_obj = {
            "text": speech_text,
            "length_scale": voice_cfg.get("speaking_rate", 1.0),
            "noise_scale": voice_cfg.get("noise_scale"),
            "noise_w": voice_cfg.get("noise_w"),
        }
        payload_str = json.dumps(payload_obj)

        with self._lock:
            try:
                wav = self._ask_worker(onnx_path, payload_str)
            except Exception as exc:
                logger.error("Piper synthesize failed for mentor %s (lang=%s): %s", mentor_id, language, exc)
                return self._silent_wav(duration_ms=max(500, min(len(speech_text) * 30, 8000)))

        if not wav or len(wav) < 44:
            return self._silent_wav(duration_ms=max(500, min(len(speech_text) * 30, 8000)))

        with self._cache_lock:
            if len(self._audio_cache) >= self._max_cache_items:
                oldest = next(iter(self._audio_cache))
                del self._audio_cache[oldest]
            self._audio_cache[cache_key] = wav

        return wav

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
