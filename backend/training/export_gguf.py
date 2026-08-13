"""Export merged LoRA adapter to GGUF for llama.cpp inference."""

from __future__ import annotations

from pathlib import Path

from backend.config import PROJECT_ROOT


def export_gguf(
    adapter_dir: Path | None = None,
    output_path: Path | None = None,
    base_model: str = "Qwen/Qwen2.5-1.5B-Instruct",
) -> str:
    adapter_dir = adapter_dir or PROJECT_ROOT / "data/training/lora_adapter"
    output_path = output_path or PROJECT_ROOT / "data/models/qwen3-ml-tutor.gguf"

    if not adapter_dir.exists():
        raise FileNotFoundError(f"LoRA adapter not found at {adapter_dir}")

    try:
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError as exc:
        raise ImportError("Install: pip install peft transformers") from exc

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    base = AutoModelForCausalLM.from_pretrained(base_model, trust_remote_code=True)
    model = PeftModel.from_pretrained(base, str(adapter_dir))
    merged = model.merge_and_unload()

    merged_dir = PROJECT_ROOT / "data/training/merged_model"
    merged_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(str(merged_dir))
    tokenizer.save_pretrained(str(merged_dir))

    # GGUF conversion requires llama.cpp convert script — documented in README
    readme = merged_dir / "EXPORT_README.txt"
    readme.write_text(
        "Merged model saved. Convert to GGUF using llama.cpp:\n"
        "python convert_hf_to_gguf.py merged_model --outfile qwen3-ml-tutor.gguf\n"
        f"Then set LLM_MODEL_PATH={output_path}\n",
        encoding="utf-8",
    )
    return str(merged_dir)
