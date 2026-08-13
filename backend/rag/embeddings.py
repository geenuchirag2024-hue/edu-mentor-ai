"""Embedding generation using fastembed (ONNX, no PyTorch required)."""

from __future__ import annotations

import logging
from functools import lru_cache

from backend.config import get_settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None

    def _load(self) -> None:
        if self._model is not None:
            return
        from fastembed import TextEmbedding

        self._model = TextEmbedding(model_name=self.settings.embedding_model)
        logger.info("Loaded embedding model: %s", self.settings.embedding_model)

    def embed(self, texts: list[str]) -> list[list[float]]:
        self._load()
        return [vec.tolist() for vec in self._model.embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return self.embed([text])[0]


@lru_cache
def get_embeddings() -> EmbeddingService:
    return EmbeddingService()
