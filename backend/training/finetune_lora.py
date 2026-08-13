"""LoRA fine-tuning script for Qwen on ML Q&A pairs.

Requires GPU with 16GB+ VRAM. Run via scripts/run_finetune.sh
"""

from __future__ import annotations

import json
from pathlib import Path

from backend.config import PROJECT_ROOT


def load_qa_pairs(path: Path | None = None) -> list[dict[str, str]]:
    path = path or PROJECT_ROOT / "data/training/qa_pairs.jsonl"
    pairs = []
    if not path.exists():
        return pairs
    with path.open(encoding="utf-8") as f:
        for line in f:
            pairs.append(json.loads(line))
    return pairs


def run_lora_training(
    output_dir: Path | None = None,
    base_model: str = "Qwen/Qwen2.5-1.5B-Instruct",
) -> str:
    """Train LoRA adapter. Returns output directory path."""
    output_dir = output_dir or PROJECT_ROOT / "data/training/lora_adapter"
    output_dir.mkdir(parents=True, exist_ok=True)

    pairs = load_qa_pairs()
    if not pairs:
        raise FileNotFoundError(
            "No Q&A pairs found. Run dataset_builder first: "
            "python -m backend.training.dataset_builder"
        )

    try:
        from datasets import Dataset
        from peft import LoraConfig, get_peft_model
        from transformers import AutoModelForCausalLM, AutoTokenizer, TrainingArguments, Trainer
    except ImportError as exc:
        raise ImportError(
            "Install training deps: pip install peft transformers datasets bitsandbytes accelerate"
        ) from exc

    dataset = Dataset.from_list(
        [{"text": f"### Question:\n{p['question']}\n\n### Answer:\n{p['answer']}"} for p in pairs]
    )

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        trust_remote_code=True,
        device_map="auto",
    )

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=512)

    tokenized = dataset.map(tokenize)

    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=3,
        per_device_train_batch_size=2,
        learning_rate=2e-4,
        logging_steps=10,
        save_strategy="epoch",
    )

    trainer = Trainer(model=model, args=training_args, train_dataset=tokenized)
    trainer.train()
    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    return str(output_dir)
