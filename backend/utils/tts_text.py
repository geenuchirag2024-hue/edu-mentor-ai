"""Prepare text for natural speech synthesis (strip emojis, expand abbreviations)."""

from __future__ import annotations

import re

# Common abbreviations → spoken form
ABBREVIATIONS: dict[str, str] = {
    r"\bsqft\b": "square feet",
    r"\bsq\.?\s*ft\.?\b": "square feet",
    r"\bml\b": "machine learning",
    r"\bai\b": "A I",
    r"\bapi\b": "A P I",
    r"\bcpu\b": "C P U",
    r"\bgpu\b": "G P U",
    r"\bram\b": "ram",
    r"\betc\b": "etcetera",
    r"\be\.g\.\b": "for example",
    r"\bi\.e\.\b": "that is",
    r"\bvs\b": "versus",
    r"\bok\b": "okay",
}

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U00002600-\U000026FF"
    "\U00002700-\U000027BF"
    "]+",
    flags=re.UNICODE,
)

THINK_BLOCK = re.compile(r"<think>.*?</think>", flags=re.IGNORECASE | re.DOTALL)
MAX_SPEECH_CHARS = 720


def prepare_text_for_speech(text: str) -> str:
    """Return text suitable for TTS — no emojis, expanded abbreviations."""
    spoken = THINK_BLOCK.sub(" ", text)
    spoken = re.sub(r"</?think>", " ", spoken, flags=re.IGNORECASE)
    spoken = EMOJI_PATTERN.sub("", spoken)
    spoken = re.sub(r"[*_#`~\[\]]", "", spoken)
    spoken = re.sub(r"</?[^>]+>", " ", spoken)

    for pattern, replacement in ABBREVIATIONS.items():
        spoken = re.sub(pattern, replacement, spoken, flags=re.IGNORECASE)

    spoken = re.sub(r"\s+", " ", spoken).strip()
    if len(spoken) > MAX_SPEECH_CHARS:
        clipped = spoken[:MAX_SPEECH_CHARS]
        end = max(clipped.rfind("."), clipped.rfind("?"), clipped.rfind("!"))
        spoken = clipped[: end + 1] if end >= 80 else clipped
    return spoken
