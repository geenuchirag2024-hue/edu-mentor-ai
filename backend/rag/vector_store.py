"""Vector store — Qdrant when available, local JSON fallback otherwise."""

from __future__ import annotations

import logging
import uuid
from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from backend.config import get_settings
from backend.rag.local_store import LocalVectorStore

logger = logging.getLogger(__name__)


class QdrantVectorStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client: QdrantClient | None = None
        self._available = False

    def _connect(self) -> None:
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
        for chunk, vector, meta in zip(chunks, vectors, metadata):
            points.append(
                qmodels.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={"text": chunk, **meta},
                )
            )

        self._client.upsert(collection_name=self.settings.qdrant_collection, points=points)
        return len(points)

    def search(self, query_vector: list[float], top_k: int = 4) -> list[dict]:
        self._connect()
        if not self._available or not self._client:
            return []

        results = self._client.search(
            collection_name=self.settings.qdrant_collection,
            query_vector=query_vector,
            limit=top_k,
        )
        return [
            {
                "text": hit.payload.get("text", ""),
                "score": hit.score,
                "source": hit.payload.get("source_file", ""),
                "topic": hit.payload.get("topic", ""),
                "page": hit.payload.get("page"),
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

    def search(self, query_vector: list[float], top_k: int = 4) -> list[dict]:
        if self._use_local:
            return self._local.search(query_vector, top_k=top_k)
        return self._qdrant.search(query_vector, top_k=top_k)


@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore()
