#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
pip install -q peft transformers datasets bitsandbytes accelerate
python -c "from backend.training.finetune_lora import run_lora_training; print(run_lora_training())"
