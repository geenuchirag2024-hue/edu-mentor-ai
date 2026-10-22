#!/usr/bin/env python3
"""Multi-subject knowledge ingestion script for Machine Learning, DBMS, and Deep Learning."""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import get_settings
from backend.rag.chunking import chunk_text
from backend.rag.embeddings import get_embeddings
from backend.rag.ingestion import extract_text_from_file
from backend.rag.vector_store import get_vector_store


def infer_subject(file_path: Path) -> str:
    """Infer course subject from filename or content keywords."""
    name = file_path.name.lower()
    if "dbms" in name or "database" in name or "sql" in name:
        return "DBMS"
    if "deep_learning" in name or "deep" in name or "neural" in name or "transformer" in name:
        return "Deep Learning"
    return "Machine Learning"


def ingest_file(
    file_path: Path,
    settings,
    embedder,
    store,
    processed_dir: Path,
    override_subject: str | None = None,
) -> int:
    """Ingest a single PDF or TXT file into the vector store idempotently."""
    pages = extract_text_from_file(file_path)
    if not pages:
        print(f"  [SKIPPED] No text extracted from {file_path.name}")
        return 0

    subject = override_subject or infer_subject(file_path)
    all_chunks: list[str] = []
    metadata: list[dict] = []

    for page in pages:
        text = str(page.get("text") or "").strip()
        if not text:
            continue
        chunks = chunk_text(
            text,
            chunk_size=settings.rag_chunk_size,
            overlap=settings.rag_chunk_overlap,
        )
        for idx, chunk in enumerate(chunks):
            chunk_clean = chunk.strip()
            if not chunk_clean:
                continue
            all_chunks.append(chunk_clean)
            chunk_id = f"{file_path.stem}_p{page.get('page', 1)}_c{idx}"
            metadata.append({
                "chunk_id": chunk_id,
                "id": chunk_id,
                "subject": subject,
                "source": file_path.name,
                "source_file": file_path.name,
                "page": page.get("page", 1),
                "chunk_index": len(all_chunks) - 1,
                "topic": file_path.stem.replace("_", " ").title(),
            })

    if not all_chunks:
        print(f"  [SKIPPED] No valid chunks generated for {file_path.name}")
        return 0

    vectors = embedder.embed(all_chunks)
    count = store.upsert_chunks(all_chunks, vectors, metadata)

    out_file = processed_dir / f"{file_path.stem}.json"
    out_file.write_text(
        json.dumps(
            [{"id": m["chunk_id"], "subject": m["subject"], "text": c, "source": m["source"]}
             for c, m in zip(all_chunks, metadata)],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"  [OK] Ingested {count} chunks from {file_path.name} -> Subject: {subject}")
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

    files = sorted(list(raw_dir.glob("*.pdf")) + list(raw_dir.glob("*.txt")))
    for file_path in files:
        if file_path.name.startswith("."):
            continue
        print(f"Processing {file_path.name}...")
        total += ingest_file(file_path, settings, embedder, store, processed_dir)

    print(f"\nDone. Total chunks indexed: {total}")
    return total


if __name__ == "__main__":
    ingest()

