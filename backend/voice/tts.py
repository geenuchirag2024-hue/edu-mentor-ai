"""Text-to-speech using Piper in a child process (avoids native crashes)."""

from __future__ import annotations

import io
import logging
import os
import struct
import subprocess
import sys
import threading
import wave
from functools import lru_cache
from pathlib import Path

from backend.config import get_settings
from backend.utils.tts_text import prepare_text_for_speech

logger = logging.getLogger(__name__)

_WORKER_SCRIPT = Path(__file__).resolve().parent / "piper_worker.py"
_CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


class TTSService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._voice = None
        self._proc: subprocess.Popen[bytes] | None = None
        self._lock = threading.Lock()
        self._stderr_thread: threading.Thread | None = None

    def _voice_path(self) -> Path:
        voice_dir = Path(self.settings.piper_model_dir) / self.settings.piper_voice
        onnx = voice_dir / f"{self.settings.piper_voice}.onnx"
        if not onnx.exists():
            onnx = voice_dir / "model.onnx"
        return onnx

    def _load(self) -> None:
        onnx_path = self._voice_path()
        if not onnx_path.exists():
            logger.warning(
                "Piper voice not found at %s — using silent WAV fallback. "
                "Run scripts/download_models.py.",
                onnx_path,
            )
            return
        with self._lock:
            self._ensure_worker(onnx_path)

    def _ensure_worker(self, onnx_path: Path) -> None:
        if self._proc is not None and self._proc.poll() is None:
            return
        self._stop_worker()
        logger.info("Starting Piper worker from %s", onnx_path)
        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"
        env.setdefault("ORT_LOG_SEVERITY_LEVEL", "3")
        self._proc = subprocess.Popen(
            [sys.executable, str(_WORKER_SCRIPT), str(onnx_path)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(Path(__file__).resolve().parents[2]),
            env=env,
            bufsize=0,
            creationflags=_CREATE_NO_WINDOW,
        )
        if self._proc.stderr is not None:
            self._stderr_thread = threading.Thread(
                target=self._drain_stderr,
                args=(self._proc.stderr,),
                daemon=True,
            )
            self._stderr_thread.start()
        self._wait_ready(self._proc)

    @staticmethod
    def _wait_ready(proc: subprocess.Popen[bytes]) -> None:
        if proc.stdout is None:
            raise RuntimeError("Piper worker has no stdout")
        buf = b""
        while b"RDY\n" not in buf:
            chunk = proc.stdout.read(1)
            if not chunk:
                raise RuntimeError("Piper worker exited before becoming ready")
            buf += chunk
            if len(buf) > 8192:
                raise RuntimeError("Piper worker sent unexpected stdout before ready")

    def _stop_worker(self) -> None:
        proc = self._proc
        self._proc = None
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

    def _ask_worker(self, text: str) -> bytes:
        onnx_path = self._voice_path()
        payload = text.encode("utf-8")
        last_error: Exception | None = None
        for attempt in range(2):
            self._ensure_worker(onnx_path)
            proc = self._proc
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
                self._stop_worker()
        raise RuntimeError(str(last_error) if last_error else "Piper worker failed")

    def synthesize(self, text: str) -> bytes:
        speech_text = prepare_text_for_speech(text)
        if not speech_text.strip():
            return self._silent_wav()

        onnx_path = self._voice_path()
        if not onnx_path.exists():
            return self._silent_wav(duration_ms=max(500, len(speech_text) * 30))

        with self._lock:
            try:
                wav = self._ask_worker(speech_text)
            except Exception as exc:
                logger.error("Piper synthesize failed: %s", exc)
                return self._silent_wav(duration_ms=max(500, min(len(speech_text) * 30, 8000)))

        if not wav or len(wav) < 44:
            return self._silent_wav(duration_ms=max(500, min(len(speech_text) * 30, 8000)))
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
