"""Generate Q&A pairs from processed ML chunks for fine-tuning."""

from __future__ import annotations

import json
from pathlib import Path

from backend.config import PROJECT_ROOT
from backend.models.llm import get_llm
from backend.services.prompts import build_tutor_messages


def generate_qa_from_chunk(chunk: str, num_pairs: int = 2) -> list[dict[str, str]]:
    prompt = (
        f"Based on this ML course content, generate {num_pairs} question-answer pairs "
        f"as JSON array with keys 'question' and 'answer'. Content:\n\n{chunk}"
    )
    messages = build_tutor_messages(prompt)
    raw = get_llm().generate(messages)

    try:
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            pairs = json.loads(raw[start:end])
            return [{"question": p["question"], "answer": p["answer"]} for p in pairs]
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    return [{"question": "What does this section cover?", "answer": chunk[:500]}]


def build_dataset(processed_dir: Path | None = None, output_path: Path | None = None) -> int:
    processed_dir = processed_dir or PROJECT_ROOT / "data/ml-content/processed"
    output_path = output_path or PROJECT_ROOT / "data/training/qa_pairs.jsonl"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with output_path.open("w", encoding="utf-8") as out:
        for json_file in processed_dir.glob("*.json"):
            chunks = json.loads(json_file.read_text(encoding="utf-8"))
            for chunk in chunks:
                for pair in generate_qa_from_chunk(chunk):
                    out.write(json.dumps(pair, ensure_ascii=False) + "\n")
                    count += 1
    return count
