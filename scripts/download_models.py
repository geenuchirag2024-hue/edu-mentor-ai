#!/usr/bin/env python3
"""Download AI models required by Edu Mentor AI, with optional mentor voice packs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

MODELS_DIR = PROJECT_ROOT / "data" / "models"
PIPER_DIR = MODELS_DIR / "piper"

# Qwen2.5-3B-Instruct Q4_K_M — excellent multilingual model for Kannada, Hindi & English
DEFAULT_QWEN_REPO = "Qwen/Qwen2.5-3B-Instruct-GGUF"
DEFAULT_QWEN_FILE = "qwen2.5-3b-instruct-q4_k_m.gguf"

# Piper Voice Repositories (Hugging Face rhasspy/piper-voices)
PIPER_VOICE_URLS = {
    "en_US-lessac-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium",  # Mira (default)
    "en_US-ryan-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium",      # Arjun
    "en_US-amy-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium",        # Tara
    "en_US-danny-low": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/danny/low",          # Kiran
    "hi_IN-priyamvada-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/priyamvada/medium",  # Mira/Tara (Hindi)
    "hi_IN-rohan-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/rohan/medium",            # Arjun (Hindi)
    "hi_IN-pratham-medium": "https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/pratham/medium",        # Kiran (Hindi)
}


def download_qwen(repo: str, filename: str, dest: Path) -> bool:
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"  [skip] Qwen already exists: {dest}")
        return True
    try:
        from huggingface_hub import hf_hub_download

        print(f"  Downloading {repo}/{filename} ...")
        cached = hf_hub_download(repo_id=repo, filename=filename)
        import shutil
        shutil.copy(cached, dest)
        print(f"  [ok] Qwen saved to {dest}")
        return True
    except Exception as exc:
        print(f"  [fail] Qwen download: {exc}")
        return False


def warmup_embeddings() -> bool:
    try:
        print("  Loading bge-base-en-v1.5 via fastembed...")
        from fastembed import TextEmbedding

        model = TextEmbedding(model_name="BAAI/bge-base-en-v1.5")
        list(model.embed(["warmup"]))
        print("  [ok] Embeddings model cached")
        return True
    except Exception as exc:
        print(f"  [fail] Embeddings: {exc}")
        return False


def warmup_whisper(model_size: str = "base") -> bool:
    try:
        print(f"  Loading faster-whisper {model_size}...")
        from faster_whisper import WhisperModel

        WhisperModel(model_size, device="cpu", compute_type="int8")
        print("  [ok] Whisper model cached")
        return True
    except Exception as exc:
        print(f"  [fail] Whisper: {exc}")
        return False


def download_piper_voice(voice_name: str) -> bool:
    base_url = PIPER_VOICE_URLS.get(voice_name)
    if not base_url:
        print(f"  [error] Unknown Piper voice: {voice_name}")
        return False

    voice_dir = PIPER_DIR / voice_name
    voice_dir.mkdir(parents=True, exist_ok=True)

    try:
        import urllib.request

        files = {
            f"{voice_name}.onnx": f"{base_url}/{voice_name}.onnx",
            f"{voice_name}.onnx.json": f"{base_url}/{voice_name}.onnx.json",
        }
        for name, url in files.items():
            dest = voice_dir / name
            if dest.exists() and dest.stat().st_size > 1000:
                print(f"  [skip] Piper {name} exists")
                continue
            print(f"  Downloading Piper {name} from {url}...")
            urllib.request.urlretrieve(url, dest)
            print(f"  [ok] Saved {dest}")
        return True
    except Exception as exc:
        print(f"  [fail] Piper {voice_name}: {exc}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Download Edu Mentor AI models")
    parser.add_argument("--qwen-repo", default=DEFAULT_QWEN_REPO)
    parser.add_argument("--qwen-file", default=DEFAULT_QWEN_FILE)
    parser.add_argument("--skip-qwen", action="store_true")
    parser.add_argument("--whisper", default="base")
    parser.add_argument(
        "--all-piper-voices",
        action="store_true",
        help="Download distinct Piper voice models for all 4 mentors (Mira, Arjun, Tara, Kiran)",
    )
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    results: dict[str, bool] = {}

    print("\n=== Edu Mentor AI — Model Download ===\n")

    if not args.skip_qwen:
        print("[1/4] Multilingual Qwen GGUF")
        results["qwen"] = download_qwen(
            args.qwen_repo,
            args.qwen_file,
            MODELS_DIR / "qwen2.5-3b.gguf",
        )
    else:
        results["qwen"] = True

    print("\n[2/4] Embeddings (bge-base-en-v1.5)")
    results["embeddings"] = warmup_embeddings()

    print(f"\n[3/4] Speech-to-text (faster-whisper {args.whisper})")
    results["whisper"] = warmup_whisper(args.whisper)

    print("\n[4/4] Text-to-speech (Piper)")
    results["piper-mira"] = download_piper_voice("en_US-lessac-medium")

    if args.all_piper_voices:
        print("  Downloading additional mentor voices...")
        results["piper-arjun"] = download_piper_voice("en_US-ryan-medium")
        results["piper-tara"] = download_piper_voice("en_US-amy-medium")
        results["piper-kiran"] = download_piper_voice("en_US-danny-low")
        print("  Downloading Hindi multilingual mentor voices...")
        results["piper-hindi-priyamvada"] = download_piper_voice("hi_IN-priyamvada-medium")
        results["piper-hindi-rohan"] = download_piper_voice("hi_IN-rohan-medium")
        results["piper-hindi-pratham"] = download_piper_voice("hi_IN-pratham-medium")

    print("\n=== Summary ===")
    for name, ok in results.items():
        print(f"  {'✓' if ok else '✗'} {name}")

    failed = [k for k, v in results.items() if not v]
    if failed:
        print(f"\nSome downloads failed: {', '.join(failed)}")
        print("The app will use fallbacks where models are missing.")
        return 1
    print("\nAll models ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
