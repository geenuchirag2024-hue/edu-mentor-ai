#!/usr/bin/env python3
"""Smoke test: verify models load and produce output."""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def main() -> int:
    print("Testing LLM...")
    from backend.models.llm import get_llm
    from backend.services.prompts import build_tutor_messages

    answer = get_llm().generate(build_tutor_messages("What is machine learning?"))
    print(f"  LLM answer ({len(answer)} chars): {answer[:120]}...")

    print("Testing TTS...")
    from backend.voice.tts import get_tts

    audio = get_tts().synthesize("Hello, I am Edu Mentor.")
    print(f"  TTS audio: {len(audio)} bytes")

    print("Testing embeddings...")
    from backend.rag.embeddings import get_embeddings

    vec = get_embeddings().embed_query("test query")
    print(f"  Embedding dim: {len(vec)}")

    print("\nSmoke test complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
