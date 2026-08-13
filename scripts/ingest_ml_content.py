#!/usr/bin/env python3
"""Ingest ML PDFs from data/ml-content/raw into Qdrant."""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import get_settings
from backend.rag.chunking import chunk_text
from backend.rag.embeddings import get_embeddings
from backend.rag.ingestion import extract_text_from_pdf
from backend.rag.vector_store import get_vector_store


def ingest_file(file_path: Path, settings, embedder, store, processed_dir: Path) -> int:
    if file_path.suffix.lower() == ".pdf":
        pages = extract_text_from_pdf(file_path)
    elif file_path.suffix.lower() == ".txt":
        text = file_path.read_text(encoding="utf-8")
        pages = [{"page": 1, "text": text}]
    else:
        return 0

    all_chunks: list[str] = []
    metadata: list[dict] = []

    for page in pages:
        chunks = chunk_text(
            str(page["text"]),
            chunk_size=settings.rag_chunk_size,
            overlap=settings.rag_chunk_overlap,
        )
        for chunk in chunks:
            all_chunks.append(chunk)
            metadata.append({
                "source_file": file_path.name,
                "page": page["page"],
                "topic": file_path.stem.replace("_", " ").title(),
            })

    if not all_chunks:
        print(f"  No text extracted from {file_path.name}")
        return 0

    vectors = embedder.embed(all_chunks)
    count = store.upsert_chunks(all_chunks, vectors, metadata)

    out_file = processed_dir / f"{file_path.stem}.json"
    out_file.write_text(json.dumps(all_chunks, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  Ingested {count} chunks from {file_path.name}")
    return count


def ingest(raw_dir: Path | None = None) -> int:
    settings = get_settings()
    raw_dir = raw_dir or PROJECT_ROOT / "data/ml-content/raw"
    processed_dir = PROJECT_ROOT / "data/ml-content/processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    store = get_vector_store()
    if not store.is_available:
        print("ERROR: No vector store available.")
        return 0

    print(f"Using vector store: {store.backend_name}")

    embedder = get_embeddings()
    total = 0

    for file_path in sorted(list(raw_dir.glob("*.pdf")) + list(raw_dir.glob("*.txt"))):
        print(f"Processing {file_path.name}...")
        total += ingest_file(file_path, settings, embedder, store, processed_dir)

    print(f"\nDone. Total chunks ingested: {total}")
    return total


if __name__ == "__main__":
    ingest()
