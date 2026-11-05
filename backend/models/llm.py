"""LLM wrapper using llama-cpp-python with GPU offloading and fallback support."""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.config import get_settings

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._model = None
        self._mock_mode = False
        self._gen_lock = threading.Lock()

    def _resolve_model_path(self) -> Path | None:
        primary = Path(self.settings.llm_model_path)
        if primary.exists() and primary.stat().st_size > 1_000_000:
            return primary

        fallback = Path(self.settings.llm_fallback_model_path)
        if fallback.exists() and fallback.stat().st_size > 1_000_000:
            logger.info("Primary LLM (%s) not found; using fallback model (%s)", primary, fallback)
            return fallback

        return None

    def _load(self) -> None:
        if self._model is not None or self._mock_mode:
            return

        model_path = self._resolve_model_path()
        if not model_path:
            logger.warning(
                "No LLM model found at %s or %s — using mock responses. "
                "Run scripts/download_models.py to download Qwen GGUF.",
                self.settings.llm_model_path,
                self.settings.llm_fallback_model_path,
            )
            self._mock_mode = True
            return

        try:
            from llama_cpp import Llama, llama_supports_gpu_offload

            supports_gpu = llama_supports_gpu_offload()
            requested_gpu_layers = self.settings.llm_n_gpu_layers

            if supports_gpu and requested_gpu_layers != 0:
                n_gpu_layers = requested_gpu_layers
                logger.info(
                    "CUDA GPU offloading supported: offloading %d layers to GPU",
                    n_gpu_layers,
                )
            else:
                n_gpu_layers = 0
                import os
                threads = getattr(self.settings, "llm_n_threads", 8) or 8
                if threads <= 0:
                    threads = min(os.cpu_count() or 4, 8)
                logger.info(
                    "Using CPU inference (threads=%d, batch=%d, context=%d)",
                    threads,
                    self.settings.llm_n_batch,
                    self.settings.llm_context_length,
                )

            self._model = Llama(
                model_path=str(model_path),
                n_ctx=self.settings.llm_context_length,
                # pyrefly: ignore[unbound-name]
                n_threads=threads,
                n_batch=self.settings.llm_n_batch,
                n_gpu_layers=n_gpu_layers,
                verbose=False,
            )
            logger.info("Loaded LLM from %s (n_gpu_layers=%d)", model_path, n_gpu_layers)
        except Exception as exc:
            logger.warning("Failed to load LLM: %s — using mock mode", exc)
            self._mock_mode = True

    def _max_tokens(self, for_voice: bool) -> int:
        if for_voice:
            return self.settings.llm_max_tokens_voice
        return self.settings.llm_max_tokens

    def _prepare_messages_for_context(
        self, messages: list[dict[str, str]], max_tokens: int
    ) -> list[dict[str, str]]:
        """Ensure input prompt tokens strictly fit within the context window (n_ctx - max_tokens - 64).
        Prevents 'Requested tokens exceed context window' crashes.
        """
        n_ctx = getattr(self.settings, "llm_context_length", 8192)
        available_prompt_budget = max(512, n_ctx - max_tokens - 64)

        def estimate_tokens(text: str) -> int:
            return max(1, len(text) // 3)

        total_est = sum(estimate_tokens(m.get("content", "")) for m in messages)
        if total_est <= available_prompt_budget:
            return messages

        logger.warning(
            "Prompt token estimate (%d) exceeds budget (%d). Truncating context safely.",
            total_est,
            available_prompt_budget,
        )

        system_msgs = [m for m in messages if m.get("role") == "system"]
        non_system = [m for m in messages if m.get("role") != "system"]

        sys_cost = sum(estimate_tokens(m.get("content", "")) for m in system_msgs)
        remaining_budget = max(256, available_prompt_budget - sys_cost)

        if non_system:
            last_msg = dict(non_system[-1])
            last_cost = estimate_tokens(last_msg.get("content", ""))
            if last_cost > remaining_budget:
                allowed_chars = remaining_budget * 3
                content = last_msg.get("content", "")
                last_msg["content"] = content[: allowed_chars - 120] + "\n\n[... Context truncated to fit context budget ...]\n"
                return system_msgs + [last_msg]

            fitted_non_system: list[dict[str, str]] = []
            cur_cost = 0
            for m in reversed(non_system):
                cost = estimate_tokens(m.get("content", ""))
                if cur_cost + cost <= remaining_budget:
                    fitted_non_system.insert(0, m)
                    cur_cost += cost
                else:
                    break
            return system_msgs + fitted_non_system if fitted_non_system else system_msgs + [non_system[-1]]

        return messages

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
        safe_messages = self._prepare_messages_for_context(messages, max_tokens)
        with self._gen_lock:
            try:
                stream: Any = self._model.create_chat_completion(
                    messages=safe_messages,  # type: ignore[arg-type]
                    max_tokens=max_tokens,
                    temperature=0.6,
                    stream=True,
                )
            except Exception as exc:
                err_msg = str(exc).lower()
                if "context" in err_msg or "exceed" in err_msg or "token" in err_msg:
                    logger.warning(
                        "Llama-cpp context limit reached (%s). Applying emergency context compression.",
                        exc,
                    )
                    emergency_messages = [m for m in safe_messages if m.get("role") == "system"]
                    last_m = safe_messages[-1]
                    emergency_messages.append({
                        "role": last_m.get("role", "user"),
                        "content": last_m.get("content", "")[:1200] + "\n[Answer concisely]",
                    })
                    stream = self._model.create_chat_completion(
                        messages=emergency_messages,  # type: ignore[arg-type]
                        max_tokens=max_tokens,
                        temperature=0.6,
                        stream=True,
                    )
                else:
                    raise

            def _tokens() -> Iterator[str]:
                for chunk in stream:
                    delta = chunk["choices"][0].get("delta", {}) if isinstance(chunk, dict) else {}
                    content = delta.get("content") if isinstance(delta, dict) else None
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
