"""Per-session notes/PDF store for the document tutor."""

from __future__ import annotations

import logging
import uuid
from pathlib import Path
from threading import Lock

from backend.rag.chunking import chunk_text
from backend.rag.ingestion import extract_text_from_pdf

logger = logging.getLogger(__name__)


class UserDocumentStore:
    """In-memory notes RAG. Falls back to keyword search if embeddings fail."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._chunks: dict[str, list[dict]] = {}
        self._docs: dict[str, list[dict]] = {}

    def ingest_bytes(
        self,
        session_id: str,
        filename: str,
        data: bytes,
        content_type: str = "",
    ) -> dict:
        text = self._extract(filename, data, content_type)
        if not text.strip():
            raise ValueError("No text could be extracted from that file.")
        return self.ingest_text(session_id, filename, text)

    def ingest_text(self, session_id: str, filename: str, text: str) -> dict:
        chunks = chunk_text(text, chunk_size=400, overlap=60)
        if not chunks:
            raise ValueError("The document was empty after cleaning.")

        vectors: list[list[float] | None] = [None] * len(chunks)
        used_embeddings = False
        try:
            from backend.rag.embeddings import get_embeddings

            vectors = get_embeddings().embed(chunks)
            used_embeddings = True
        except Exception as exc:
            logger.warning("Notes embeddings unavailable (%s) — using keyword search", exc)

        doc_id = str(uuid.uuid4())
        records = []
        for i, chunk in enumerate(chunks):
            records.append(
                {
                    "id": str(uuid.uuid4()),
                    "doc_id": doc_id,
                    "filename": filename,
                    "text": chunk,
                    "vector": vectors[i],
                }
            )
        with self._lock:
            self._chunks.setdefault(session_id, []).extend(records)
            self._docs.setdefault(session_id, []).append(
                {
                    "doc_id": doc_id,
                    "filename": filename,
                    "chunks": len(chunks),
                    "used_embeddings": used_embeddings,
                }
            )
        return {
            "doc_id": doc_id,
            "filename": filename,
            "chunks": len(chunks),
            "session_id": session_id,
            "used_embeddings": used_embeddings,
        }

    def list_docs(self, session_id: str) -> list[dict]:
        with self._lock:
            return list(self._docs.get(session_id, []))

    def retrieve(self, session_id: str, query: str, top_k: int = 4) -> tuple[str, list[str]]:
        with self._lock:
            records = list(self._chunks.get(session_id, []))
        if not records:
            return "", []

        scored: list[tuple[float, dict]] = []
        if records[0].get("vector") is not None:
            try:
                import numpy as np

                from backend.rag.embeddings import get_embeddings

                q = np.array(get_embeddings().embed_query(query), dtype="float32")
                q = q / (float(np.linalg.norm(q)) + 1e-9)
                for rec in records:
                    v = np.array(rec["vector"], dtype="float32")
                    v = v / (float(np.linalg.norm(v)) + 1e-9)
                    scored.append((float(q @ v), rec))
            except Exception:
                scored = []

        if not scored:
            q_words = set(query.lower().split())
            for rec in records:
                words = set(rec["text"].lower().split())
                score = len(q_words & words) / max(len(q_words), 1)
                scored.append((score, rec))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:top_k]
        sources: list[str] = []
        parts: list[str] = []
        seen: set[str] = set()
        for score, rec in top:
            if score <= 0:
                continue
            label = rec["filename"]
            if label not in seen:
                sources.append(label)
                seen.add(label)
            parts.append(f"[{label}]\n{rec['text']}")
        return "\n\n".join(parts), sources

    @staticmethod
    def _extract(filename: str, data: bytes, content_type: str) -> str:
        lower = filename.lower()
        if lower.endswith(".pdf") or "pdf" in (content_type or ""):
            tmp = Path.cwd() / f".notes-upload-{uuid.uuid4().hex}.pdf"
            try:
                tmp.write_bytes(data)
                pages = extract_text_from_pdf(tmp)
                return "\n\n".join(str(p["text"]) for p in pages)
            finally:
                tmp.unlink(missing_ok=True)
        return data.decode("utf-8", errors="ignore")


user_document_store = UserDocumentStore()
