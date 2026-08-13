#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export KMP_DUPLICATE_LIB_OK=TRUE

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q huggingface-hub fastembed faster-whisper
python scripts/download_models.py "$@"
