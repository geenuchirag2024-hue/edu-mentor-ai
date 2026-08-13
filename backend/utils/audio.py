"""Audio utility helpers."""

import base64


def audio_to_base64(audio_bytes: bytes) -> str:
    return base64.b64encode(audio_bytes).decode("utf-8")


def base64_to_audio(data: str) -> bytes:
    return base64.b64decode(data)
