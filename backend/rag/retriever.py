"""Retrieval logic for RAG with subject filtering and source attribution."""

from __future__ import annotations

from backend.config import get_settings
from backend.rag.embeddings import get_embeddings
from backend.rag.vector_store import get_vector_store


def retrieve_context(query: str, subject: str | None = None) -> tuple[str, list[str]]:
    """Retrieve grounded context for query, filtering by subject where appropriate."""
    settings = get_settings()
    store = get_vector_store()

    if not store.is_available:
        return "", []

    query_vector = get_embeddings().embed_query(query)
    hits = store.search(query_vector, top_k=settings.rag_top_k, subject=subject)

    if not hits:
        return "", []

    filtered = [h for h in hits if h["score"] >= settings.rag_score_threshold]
    if not filtered:
        # Only fallback if top hit has positive semantic relevance
        filtered = [h for h in hits[:2] if h.get("score", 0) > 0.20]

    if not filtered:
        return "", []

    context_parts = []
    sources = []
    seen_labels = set()

    for hit in filtered:
        source_label = (
            hit.get("source") or hit.get("source_file") or hit.get("topic") or "course material"
        )
        page = hit.get("page")
        subj = hit.get("subject")
        prefix = f"[{subj}] " if subj else ""
        label = f"{prefix}{source_label}" + (f" (p.{page})" if page else "")
        if label not in seen_labels:
            sources.append(label)
            seen_labels.add(label)
        context_parts.append(f"[{label}]\n{hit['text']}")

    return "\n\n".join(context_parts), sources

