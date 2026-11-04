"""Standalone Piper process so a native crash cannot kill the API server.

Protocol (stdin/stdout, binary):
  request:  uint32 BE length + UTF-8 bytes (either plain text or JSON payload)
  response: uint32 BE length + WAV bytes  (length 0 = failure)

Supports optional JSON payload with synthesis tuning:
  {"text": "...", "length_scale": 0.95, "noise_scale": 0.65, "noise_w": 0.8, "speaker_id": 0}
"""

from __future__ import annotations

import io
import json
import os
import struct
import sys
import wave
from pathlib import Path


def _read_exact(stream, n: int) -> bytes:
    buf = bytearray()
    while len(buf) < n:
        chunk = stream.read(n - len(buf))
        if not chunk:
            return bytes(buf)
        buf.extend(chunk)
    return bytes(buf)


def _chunk_text(text: str, max_chars: int = 280) -> list[str]:
    text = " ".join(text.split()).strip()
    if not text:
        return []
    parts: list[str] = []
    buf: list[str] = []
    size = 0
    for piece in text.replace("!", ".").replace("?", ".").split("."):
        sentence = piece.strip()
        if not sentence:
            continue
        sentence += "."
        if size + len(sentence) + 1 > max_chars and buf:
            parts.append(" ".join(buf))
            buf = [sentence]
            size = len(sentence)
        else:
            buf.append(sentence)
            size += len(sentence) + 1
    if buf:
        parts.append(" ".join(buf))
    return parts or [text[:max_chars]]


def _concat_wav(chunks: list[bytes]) -> bytes:
    if not chunks:
        return b""
    if len(chunks) == 1:
        return chunks[0]
    frames: list[bytes] = []
    params = None
    for data in chunks:
        with wave.open(io.BytesIO(data), "rb") as src:
            if params is None:
                params = src.getparams()
            frames.append(src.readframes(src.getnframes()))
    if params is None:
        return b""
    out = io.BytesIO()
    with wave.open(out, "wb") as dest:
        dest.setparams(params)
        dest.writeframes(b"".join(frames))
    return out.getvalue()


def _synthesize_one(voice, text: str, syn_config=None) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file, syn_config=syn_config)
    return buf.getvalue()


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: piper_worker.py <voice.onnx>\n")
        return 2

    os.environ.setdefault("ORT_LOG_SEVERITY_LEVEL", "3")
    model_path = Path(sys.argv[1])
    # pyrefly: ignore[missing-import]
    from piper import PiperVoice
    # pyrefly: ignore[missing-import]
    from piper.config import SynthesisConfig

    voice = PiperVoice.load(str(model_path))
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    stdout.write(b"READY\n")
    stdout.flush()

    while True:
        header = _read_exact(stdin, 4)
        if len(header) < 4:
            return 0
        (nbytes,) = struct.unpack(">I", header)
        raw = _read_exact(stdin, nbytes)
        if len(raw) < nbytes:
            return 1

        text = ""
        syn_config = None
        decoded = raw.decode("utf-8", errors="replace").strip()

        if decoded.startswith("{") and decoded.endswith("}"):
            try:
                data = json.loads(decoded)
                text = str(data.get("text", "")).strip()
                length_scale = data.get("length_scale")
                noise_scale = data.get("noise_scale")
                noise_w_scale = data.get("noise_w")
                speaker_id = data.get("speaker_id")
                syn_config = SynthesisConfig(
                    length_scale=float(length_scale) if length_scale is not None else None,
                    noise_scale=float(noise_scale) if noise_scale is not None else None,
                    noise_w_scale=float(noise_w_scale) if noise_w_scale is not None else None,
                    speaker_id=int(speaker_id) if speaker_id is not None else None,
                )
            except Exception:
                text = decoded
        else:
            text = decoded

        chunks = _chunk_text(text)
        if not chunks:
            stdout.write(struct.pack(">I", 0))
            stdout.flush()
            continue

        try:
            parts = [_synthesize_one(voice, c, syn_config=syn_config) for c in chunks]
            wav = _concat_wav(parts)
            stdout.write(struct.pack(">I", len(wav)))
            stdout.write(wav)
            stdout.flush()
        except Exception as exc:
            sys.stderr.write(f"synthesize error: {exc}\n")
            stdout.write(struct.pack(">I", 0))
            stdout.flush()


if __name__ == "__main__":
    sys.exit(main())
