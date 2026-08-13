#!/usr/bin/env bash
# Start backend + frontend for local development
set -euo pipefail
cd "$(dirname "$0")/.."
export KMP_DUPLICATE_LIB_OK=TRUE

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r backend/requirements.txt
else
  source .venv/bin/activate
fi

trap 'kill 0' EXIT
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
(cd frontend && npm run dev) &
wait
