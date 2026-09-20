"""LLM wrapper using llama-cpp-python with optional mock fallback."""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from backend.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None
        self._mock_mode = False
        self._gen_lock = threading.Lock()

    def _load(self) -> None:
        if self._model is not None or self._mock_mode:
            return

        model_path = Path(self.settings.llm_model_path)
        if not model_path.exists():
            logger.warning(
                "LLM model not found at %s — using mock responses. "
                "Run scripts/download_models.py to download Qwen GGUF.",
                model_path,
            )
            self._mock_mode = True
            return

        try:
            from llama_cpp import Llama

            self._model = Llama(
                model_path=str(model_path),
                n_ctx=self.settings.llm_context_length,
                n_threads=self.settings.llm_n_threads,
                n_batch=self.settings.llm_n_batch,
                verbose=False,
            )
            logger.info("Loaded LLM from %s", model_path)
        except Exception as exc:
            logger.warning("Failed to load LLM: %s — using mock mode", exc)
            self._mock_mode = True

    def _max_tokens(self, for_voice: bool) -> int:
        if for_voice:
            return self.settings.llm_max_tokens_voice
        return self.settings.llm_max_tokens

    def generate(self, messages: list[dict[str, str]], *, for_voice: bool = False) -> str:
        return "".join(self.generate_stream(messages, for_voice=for_voice))

    def generate_stream(
        self, messages: list[dict[str, str]], *, for_voice: bool = False
    ) -> Iterator[str]:
        self._load()
        max_tokens = self._max_tokens(for_voice)

        if self._mock_mode:
            user_msg = next(
                (m["content"] for m in reversed(messages) if m["role"] == "user"),
                "",
            )
            yield self._mock_response(user_msg)
            return

        assert self._model is not None
        with self._gen_lock:
            stream = self._model.create_chat_completion(
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.6,
                stream=True,
            )

            def _tokens() -> Iterator[str]:
                for chunk in stream:
                    delta = chunk["choices"][0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content

            yield from _strip_think_stream(_tokens())

    @staticmethod
    def _mock_response(question: str) -> str:
        q = question.lower()
        if "overfitting" in q:
            return (
                "Overfitting happens when a model learns the training data too well, "
                "including noise, and performs poorly on new data. "
                "It's like memorizing exam answers instead of understanding concepts. "
                "You can reduce it with more data, regularization, or simpler models."
            )
        if "gradient descent" in q:
            return (
                "Gradient descent is an optimization method that adjusts model parameters "
                "step by step to minimize error. Imagine walking downhill in fog: "
                "you take small steps in the direction that reduces loss fastest."
            )
        if "machine learning" in q or "what is ml" in q:
            return (
                "Machine learning is a field where computers learn patterns from data "
                "instead of being explicitly programmed for every rule. "
                "Common types include supervised, unsupervised, and reinforcement learning."
            )
        return (
            f"Great question about machine learning! You asked: '{question}'. "
            "In general, ML models learn patterns from data to make predictions or decisions. "
            "Download the Qwen model via scripts/download_models.py for richer answers."
        )


def _strip_think_stream(tokens: Iterator[str]) -> Iterator[str]:
    """Drop Qwen <think>...</think> blocks so they are not shown or spoken."""
    buf = ""
    hiding = False
    open_tag, close_tag = "<think>", "</think>"
    for token in tokens:
        buf += token
        while buf:
            lower = buf.lower()
            if hiding:
                idx = lower.find(close_tag)
                if idx == -1:
                    buf = buf[-(len(close_tag) - 1) :]
                    break
                buf = buf[idx + len(close_tag) :]
                hiding = False
                continue
            idx = lower.find(open_tag)
            if idx == -1:
                hold = len(open_tag) - 1
                emit, buf = buf[:-hold], buf[-hold:]
                if emit:
                    yield emit
                break
            if idx:
                yield buf[:idx]
            buf = buf[idx + len(open_tag) :]
            hiding = True
    if hiding:
        return
    if buf:
        yield buf


@lru_cache
def get_llm() -> LLMService:
    return LLMService()
