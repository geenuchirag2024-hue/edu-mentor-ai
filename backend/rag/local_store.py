"""Local JSON vector store fallback when Qdrant/Docker is unavailable."""

from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path

import numpy as np

from backend.config import PROJECT_ROOT

logger = logging.getLogger(__name__)

STORE_PATH = PROJECT_ROOT / "data/embeddings/local_rag.json"


class LocalVectorStore:
    def __init__(self) -> None:
        self._records: list[dict] = []
        self._load()

    @property
    def is_available(self) -> bool:
        return True

    def _load(self) -> None:
        if STORE_PATH.exists():
            self._records = json.loads(STORE_PATH.read_text(encoding="utf-8"))
            logger.info("Loaded %d chunks from local store", len(self._records))

    def _save(self) -> None:
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STORE_PATH.write_text(json.dumps(self._records, ensure_ascii=False), encoding="utf-8")

    def upsert_chunks(
        self,
        chunks: list[str],
        vectors: list[list[float]],
        metadata: list[dict],
    ) -> int:
        for chunk, vector, meta in zip(chunks, vectors, metadata):
            self._records.append({
                "id": str(uuid.uuid4()),
                "text": chunk,
                "vector": vector,
                **meta,
            })
        self._save()
        return len(chunks)

    def search(self, query_vector: list[float], top_k: int = 4) -> list[dict]:
        if not self._records:
            return []

        q = np.array(query_vector, dtype=np.float32)
        q = q / (np.linalg.norm(q) + 1e-9)

        scored = []
        for rec in self._records:
            v = np.array(rec["vector"], dtype=np.float32)
            v = v / (np.linalg.norm(v) + 1e-9)
            score = float(np.dot(q, v))
            scored.append({
                "text": rec["text"],
                "score": score,
                "source": rec.get("source_file", ""),
                "topic": rec.get("topic", ""),
                "page": rec.get("page"),
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]
