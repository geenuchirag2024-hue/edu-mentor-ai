# Fine-Tune Evaluation

Compare base Qwen + RAG vs fine-tuned `qwen3-ml-tutor.gguf` on the benchmark in `docs/rag_evaluation.md`.

## Steps
1. Run benchmark with `LLM_MODEL_PATH=./data/models/qwen3.gguf`
2. Train LoRA: `bash scripts/run_finetune.sh`
3. Export GGUF and set `LLM_MODEL_PATH=./data/models/qwen3-ml-tutor.gguf`
4. Re-run benchmark and compare citation accuracy + tutor tone
