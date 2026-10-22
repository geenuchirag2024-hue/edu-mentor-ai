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
            try:
                raw = json.loads(STORE_PATH.read_text(encoding="utf-8"))
                # Ensure backwards-compatibility for existing records without subject
                for rec in raw:
                    if "subject" not in rec:
                        rec["subject"] = "Machine Learning"
                    if "source" not in rec and "source_file" in rec:
                        rec["source"] = rec["source_file"]
                    if "chunk_id" not in rec and "id" in rec:
                        rec["chunk_id"] = rec["id"]
                self._records = raw
                logger.info("Loaded %d chunks from local store", len(self._records))
            except Exception as exc:
                logger.error("Failed loading local vector store: %s", exc)
                self._records = []

    def _save(self) -> None:
        STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        STORE_PATH.write_text(json.dumps(self._records, ensure_ascii=False), encoding="utf-8")

    def delete_by_source(self, source_file: str) -> int:
        """Remove existing chunks for a source file to prevent duplicate indexing."""
        if not source_file:
            return 0
        initial_len = len(self._records)
        self._records = [
            r for r in self._records
            if r.get("source_file") != source_file and r.get("source") != source_file
        ]
        removed = initial_len - len(self._records)
        if removed > 0:
            self._save()
            logger.info("Removed %d existing chunks for %s", removed, source_file)
        return removed

    def upsert_chunks(
        self,
        chunks: list[str],
        vectors: list[list[float]],
        metadata: list[dict],
    ) -> int:
        if not chunks:
            return 0

        # Avoid duplicate indexing: prune prior entries for documents in this batch
        incoming_sources = {
            m.get("source_file") or m.get("source")
            for m in metadata
            if (m.get("source_file") or m.get("source"))
        }
        for src in incoming_sources:
            if src:
                self._records = [
                    r for r in self._records
                    if r.get("source_file") != src and r.get("source") != src
                ]

        for i, (chunk, vector, meta) in enumerate(zip(chunks, vectors, metadata)):
            cid = meta.get("chunk_id") or meta.get("id") or str(uuid.uuid4())
            src = meta.get("source_file") or meta.get("source") or "document"
            subj = meta.get("subject") or "Machine Learning"
            rec = {
                "id": cid,
                "chunk_id": cid,
                "text": chunk,
                "vector": vector,
                "subject": subj,
                "source": src,
                "source_file": src,
                "topic": meta.get("topic", ""),
                "page": meta.get("page", 1),
                "chunk_index": meta.get("chunk_index", i),
            }
            # Include any other caller-supplied metadata
            for k, v in meta.items():
                if k not in rec:
                    rec[k] = v
            self._records.append(rec)

        self._save()
        return len(chunks)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 4,
        subject: str | None = None,
    ) -> list[dict]:
        if not self._records:
            return []

        # Filter by subject if specified and matching records exist
        candidates = self._records
        if subject and subject.strip():
            target_subj = subject.strip().lower()
            subject_matches = [
                r for r in self._records
                if r.get("subject", "").strip().lower() == target_subj
            ]
            if subject_matches:
                candidates = subject_matches

        q = np.array(query_vector, dtype=np.float32)
        norm_q = float(np.linalg.norm(q))
        if norm_q > 0:
            q = q / (norm_q + 1e-9)

        scored = []
        for rec in candidates:
            v = np.array(rec["vector"], dtype=np.float32)
            norm_v = float(np.linalg.norm(v))
            if norm_v > 0:
                v = v / (norm_v + 1e-9)
            score = float(np.dot(q, v))
            scored.append({
                "text": rec["text"],
                "score": score,
                "source": rec.get("source") or rec.get("source_file", ""),
                "source_file": rec.get("source_file") or rec.get("source", ""),
                "topic": rec.get("topic", ""),
                "page": rec.get("page"),
                "subject": rec.get("subject", "Machine Learning"),
                "chunk_id": rec.get("chunk_id") or rec.get("id", ""),
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

