"""Deterministic Unicode script-based language identification and resolution."""

from __future__ import annotations

import re

# Unicode ranges for target languages
_KANNADA_PATTERN = re.compile(r"[\u0C80-\u0CFF]")
_DEVANAGARI_PATTERN = re.compile(r"[\u0900-\u097F]")
_LATIN_PATTERN = re.compile(r"[A-Za-z]")


def detect_script_language(text: str) -> str | None:
    """Detect language based on Unicode script frequency in text.

    Returns:
        'kn' for Kannada script
        'hi' for Devanagari (Hindi) script
        'en' for Latin script
        None if no recognizable characters found
    """
    if not text or not text.strip():
        return None

    kannada_count = len(_KANNADA_PATTERN.findall(text))
    devanagari_count = len(_DEVANAGARI_PATTERN.findall(text))
    latin_count = len(_LATIN_PATTERN.findall(text))

    if kannada_count > 0 and kannada_count >= devanagari_count:
        return "kn"
    if devanagari_count > 0 and devanagari_count > kannada_count:
        return "hi"
    if latin_count > 0:
        return "en"

    return None


def resolve_effective_language(text: str, requested_language: str | None = None) -> str:
    """Resolve the effective language for LLM prompt and speech generation.

    Rules:
    1. If the text itself contains unambiguous Kannada script, honor Kannada ('kn').
    2. If the text itself contains unambiguous Devanagari script, honor Hindi ('hi').
    3. If requested_language is explicitly 'hi' or 'kn', honor it.
    4. If requested_language is 'auto' or None, use script detection, fallback to 'en'.
    5. If requested_language is 'en' and no Indic script is present, use 'en'.
    """
    clean_req = (requested_language or "en").lower().strip()
    script_lang = detect_script_language(text)

    # When typed text explicitly contains native script, prioritize that script
    # to protect users who type in Kannada/Hindi without manually toggling the language selector.
    if script_lang in ("kn", "hi"):
        return script_lang

    if clean_req.startswith("kn"):
        return "kn"
    if clean_req.startswith("hi"):
        return "hi"
    if clean_req in ("auto", "none", "", "all"):
        return script_lang or "en"

    return "en"

