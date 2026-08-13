#!/usr/bin/env bash
# Run project scripts with the correct virtualenv and env vars.
set -euo pipefail
cd "$(dirname "$0")/.."
export KMP_DUPLICATE_LIB_OK=TRUE
export PYTHONPATH=.

if [ ! -d ".venv" ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
  .venv/bin/pip install -r backend/requirements.txt
fi

exec .venv/bin/python "$@"
