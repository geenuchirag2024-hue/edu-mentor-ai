"""Preprocess recorded WAV audio before speech-to-text."""

from __future__ import annotations

import io
import struct
import wave


def preprocess_wav(audio_bytes: bytes, silence_threshold: int = 500) -> bytes:
    """Normalize volume and trim leading/trailing silence."""
    try:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            framerate = wf.getframerate()
            frames = wf.readframes(wf.getnframes())
    except wave.Error:
        return audio_bytes

    if sample_width != 2:
        return audio_bytes

    samples = list(struct.unpack(f"<{len(frames) // 2}h", frames))
    if not samples:
        return audio_bytes

    # Normalize peak volume to ~80% of max
    peak = max(abs(s) for s in samples) or 1
    target = int(32767 * 0.8)
    gain = min(target / peak, 4.0)  # cap gain to avoid amplifying noise too much
    samples = [max(-32768, min(32767, int(s * gain))) for s in samples]

    # Trim silence from start/end
    start = 0
    end = len(samples)
    for i, s in enumerate(samples):
        if abs(s) > silence_threshold:
            start = i
            break
    for i in range(len(samples) - 1, -1, -1):
        if abs(samples[i]) > silence_threshold:
            end = i + 1
            break

    trimmed = samples[start:end]
    if len(trimmed) < framerate // 4:  # keep at least 0.25s
        trimmed = samples

    out = io.BytesIO()
    with wave.open(out, "wb") as wf:
        wf.setnchannels(n_channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(framerate)
        wf.writeframes(struct.pack(f"<{len(trimmed)}h", *trimmed))
    return out.getvalue()


def looks_like_hallucination(text: str) -> bool:
    """Detect common Whisper hallucination patterns (repeated phrases)."""
    if not text:
        return False
    lower = text.lower().strip()
    # Known phantom phrases Whisper invents on silence/noise
    phantom_phrases = [
        "thank you for watching",
        "thanks for watching",
        "subscribe",
        "i'm dr. lee",
        "im dr lee",
        "see you in the next video",
    ]
    for phrase in phantom_phrases:
        if phrase in lower:
            return True
    # Repeated same clause 3+ times
    parts = [p.strip() for p in lower.replace(".", "|").split("|") if p.strip()]
    if len(parts) >= 3 and len(set(parts)) == 1:
        return True
    words = lower.split()
    if len(words) >= 6:
        for win in (3, 4, 5):
            for i in range(len(words) - win * 2 + 1):
                chunk = " ".join(words[i : i + win])
                rest = " ".join(words[i + win : i + win * 2])
                if chunk == rest:
                    return True
    return False
