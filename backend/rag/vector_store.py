"""Vector store — Qdrant when available, local JSON fallback otherwise."""

from __future__ import annotations

import logging
import uuid
from functools import lru_cache

try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qmodels
    _QDRANT_CLIENT_AVAILABLE = True
except Exception:
    QdrantClient = None
    qmodels = None
    _QDRANT_CLIENT_AVAILABLE = False

from backend.config import get_settings
from backend.rag.local_store import LocalVectorStore

logger = logging.getLogger(__name__)


class QdrantVectorStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: QdrantClient | None = None
        self._available = False

    def _connect(self) -> None:
        if not _QDRANT_CLIENT_AVAILABLE:
            self._available = False
            return
        if self._client is not None:
            return
        try:
            self._client = QdrantClient(
                host=self.settings.qdrant_host,
                port=self.settings.qdrant_port,
            )
            self._client.get_collections()
            self._available = True
            self._ensure_collection()
            logger.info(
                "Connected to Qdrant at %s:%s",
                self.settings.qdrant_host,
                self.settings.qdrant_port,
            )
        except Exception as exc:
            logger.warning("Qdrant unavailable: %s", exc)
            self._available = False

    def _ensure_collection(self) -> None:
        assert self._client is not None
        collections = [c.name for c in self._client.get_collections().collections]
        if self.settings.qdrant_collection not in collections:
            self._client.create_collection(
                collection_name=self.settings.qdrant_collection,
                vectors_config=qmodels.VectorParams(size=768, distance=qmodels.Distance.COSINE),
            )

    @property
    def is_available(self) -> bool:
        self._connect()
        return self._available

    @property
    def backend_name(self) -> str:
        return "qdrant"

    def upsert_chunks(
        self,
        chunks: list[str],
        vectors: list[list[float]],
        metadata: list[dict],
    ) -> int:
        self._connect()
        if not self._available or not self._client:
            return 0

        points = []
        for i, (chunk, vector, meta) in enumerate(zip(chunks, vectors, metadata)):
            cid = meta.get("chunk_id") or meta.get("id") or str(uuid.uuid4())
            # Deterministic UUID for Qdrant point if cid is not a valid UUID string
            try:
                point_id = str(uuid.UUID(str(cid)))
            except ValueError:
                point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(cid)))

            payload = {
                "text": chunk,
                "subject": meta.get("subject", "Machine Learning"),
                "source": meta.get("source") or meta.get("source_file", ""),
                "source_file": meta.get("source_file") or meta.get("source", ""),
                "topic": meta.get("topic", ""),
                "page": meta.get("page", 1),
                "chunk_id": cid,
                "chunk_index": meta.get("chunk_index", i),
            }
            for k, v in meta.items():
                if k not in payload:
                    payload[k] = v

            points.append(
                qmodels.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload,
                )
            )

        self._client.upsert(collection_name=self.settings.qdrant_collection, points=points)
        return len(points)

    def delete_by_source(self, source_file: str) -> int:
        self._connect()
        if not self._available or not self._client or not qmodels:
            return 0
        try:
            self._client.delete(
                collection_name=self.settings.qdrant_collection,
                points_selector=qmodels.FilterSelector(
                    filter=qmodels.Filter(
                        must=[
                            qmodels.FieldCondition(
                                key="source_file",
                                match=qmodels.MatchValue(value=source_file),
                            )
                        ]
                    )
                ),
            )
            return 1
        except Exception as exc:
            logger.warning("Could not delete from Qdrant by source: %s", exc)
            return 0

    def search(
        self,
        query_vector: list[float],
        top_k: int = 4,
        subject: str | None = None,
    ) -> list[dict]:
        self._connect()
        if not self._available or not self._client:
            return []

        query_filter = None
        if subject and qmodels:
            query_filter = qmodels.Filter(
                must=[
                    qmodels.FieldCondition(
                        key="subject",
                        match=qmodels.MatchValue(value=subject),
                    )
                ]
            )

        results = self._client.search(
            collection_name=self.settings.qdrant_collection,
            query_vector=query_vector,
            limit=top_k,
            query_filter=query_filter,
        )
        return [
            {
                "text": hit.payload.get("text", ""),
                "score": hit.score,
                "source": hit.payload.get("source") or hit.payload.get("source_file", ""),
                "source_file": hit.payload.get("source_file") or hit.payload.get("source", ""),
                "topic": hit.payload.get("topic", ""),
                "page": hit.payload.get("page"),
                "subject": hit.payload.get("subject", "Machine Learning"),
                "chunk_id": hit.payload.get("chunk_id", str(hit.id)),
            }
            for hit in results
        ]


class VectorStore:
    """Facade: prefer Qdrant, fall back to local JSON store."""

    def __init__(self) -> None:
        self._qdrant = QdrantVectorStore()
        self._local = LocalVectorStore()
        self._use_local = not self._qdrant.is_available
        if self._use_local:
            logger.warning(
                "Using local vector store (data/embeddings/local_rag.json). "
                "Install Docker and run Qdrant for production RAG."
            )

    @property
    def is_available(self) -> bool:
        return self._qdrant.is_available or self._local.is_available

    @property
    def backend_name(self) -> str:
        return "local" if self._use_local else "qdrant"

    def upsert_chunks(
        self,
        chunks: list[str],
        vectors: list[list[float]],
        metadata: list[dict],
    ) -> int:
        if self._use_local:
            return self._local.upsert_chunks(chunks, vectors, metadata)
        return self._qdrant.upsert_chunks(chunks, vectors, metadata)

    def delete_by_source(self, source_file: str) -> int:
        if self._use_local:
            return self._local.delete_by_source(source_file)
        return self._qdrant.delete_by_source(source_file)

    def search(
        self,
        query_vector: list[float],
        top_k: int = 4,
        subject: str | None = None,
    ) -> list[dict]:
        if self._use_local:
            return self._local.search(query_vector, top_k=top_k, subject=subject)
        return self._qdrant.search(query_vector, top_k=top_k, subject=subject)



@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore()
