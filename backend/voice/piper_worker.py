"""Standalone Piper process so a native crash cannot kill the API server.

Protocol (stdin/stdout, binary):
  request:  uint32 BE length + UTF-8 text
  response: uint32 BE length + WAV bytes  (length 0 = failure)
"""

from __future__ import annotations

import io
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
    out = io.BytesIO()
    with wave.open(out, "wb") as dest:
        dest.setparams(params)
        dest.writeframes(b"".join(frames))
    return out.getvalue()


def _synthesize_one(voice, text: str) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)
    return buf.getvalue()


def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("usage: piper_worker.py <voice.onnx>\n")
        return 2

    os.environ.setdefault("ORT_LOG_SEVERITY_LEVEL", "3")
    model_path = Path(sys.argv[1])
    from piper import PiperVoice

    voice = PiperVoice.load(str(model_path))
    stdin = sys.stdin.buffer
    stdout = sys.stdout.buffer
    stdout.write(b"RDY\n")
    stdout.flush()

    while True:
        header = _read_exact(stdin, 4)
        if len(header) < 4:
            return 0
        (nbytes,) = struct.unpack(">I", header)
        raw = _read_exact(stdin, nbytes)
        if len(raw) < nbytes:
            return 1
        text = raw.decode("utf-8", errors="replace")
        wav = b""
        try:
            pieces = []
            for chunk in _chunk_text(text):
                pieces.append(_synthesize_one(voice, chunk))
            wav = _concat_wav(pieces)
        except Exception as exc:
            sys.stderr.write(f"piper synthesize failed: {exc}\n")
            wav = b""
        stdout.write(struct.pack(">I", len(wav)))
        if wav:
            stdout.write(wav)
        stdout.flush()


if __name__ == "__main__":
    raise SystemExit(main())
