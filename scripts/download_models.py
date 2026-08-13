#!/usr/bin/env python3
"""Download all AI models required by Edu Mentor AI."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

MODELS_DIR = PROJECT_ROOT / "data" / "models"
PIPER_DIR = MODELS_DIR / "piper" / "en_US-lessac-medium"

# Qwen3-4B-Instruct Q4_K_M — good default for 8-16GB RAM dev machines
DEFAULT_QWEN_REPO = "DhruvalLabs/Qwen3-4B-Instruct-2507-GGUF"
DEFAULT_QWEN_FILE = "Qwen3-4B-Instruct-2507-Q4_K_M.gguf"

PIPER_BASE_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium"
)


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


def download_piper() -> bool:
    try:
        import urllib.request

        PIPER_DIR.mkdir(parents=True, exist_ok=True)
        files = {
            "en_US-lessac-medium.onnx": f"{PIPER_BASE_URL}/en_US-lessac-medium.onnx",
            "en_US-lessac-medium.onnx.json": f"{PIPER_BASE_URL}/en_US-lessac-medium.onnx.json",
        }
        for name, url in files.items():
            dest = PIPER_DIR / name
            if dest.exists() and dest.stat().st_size > 1000:
                print(f"  [skip] Piper {name} exists")
                continue
            print(f"  Downloading Piper {name}...")
            urllib.request.urlretrieve(url, dest)
            print(f"  [ok] {dest}")
        return True
    except Exception as exc:
        print(f"  [fail] Piper: {exc}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Download Edu Mentor AI models")
    parser.add_argument("--qwen-repo", default=DEFAULT_QWEN_REPO)
    parser.add_argument("--qwen-file", default=DEFAULT_QWEN_FILE)
    parser.add_argument("--skip-qwen", action="store_true")
    parser.add_argument("--whisper", default="base")
    args = parser.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    results: dict[str, bool] = {}

    print("\n=== Edu Mentor AI — Model Download ===\n")

    if not args.skip_qwen:
        print("[1/4] Qwen 3 GGUF")
        results["qwen"] = download_qwen(
            args.qwen_repo,
            args.qwen_file,
            MODELS_DIR / "qwen3.gguf",
        )
    else:
        results["qwen"] = True

    print("\n[2/4] Embeddings (bge-base-en-v1.5)")
    results["embeddings"] = warmup_embeddings()

    print(f"\n[3/4] Speech-to-text (faster-whisper {args.whisper})")
    results["whisper"] = warmup_whisper(args.whisper)

    print("\n[4/4] Text-to-speech (Piper)")
    results["piper"] = download_piper()

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
