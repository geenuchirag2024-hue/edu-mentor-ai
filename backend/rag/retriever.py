"""Retrieval logic for RAG."""

from backend.config import get_settings
from backend.rag.embeddings import get_embeddings
from backend.rag.vector_store import get_vector_store


def retrieve_context(query: str) -> tuple[str, list[str]]:
    settings = get_settings()
    store = get_vector_store()

    if not store.is_available:
        return "", []

    query_vector = get_embeddings().embed_query(query)
    hits = store.search(query_vector, top_k=settings.rag_top_k)

    filtered = [h for h in hits if h["score"] >= settings.rag_score_threshold]
    if not filtered:
        filtered = hits[:2]

    context_parts = []
    sources = []
    for hit in filtered:
        source_label = hit.get("source") or hit.get("topic") or "course material"
        page = hit.get("page")
        label = f"{source_label}" + (f" (p.{page})" if page else "")
        sources.append(label)
        context_parts.append(f"[{label}]\n{hit['text']}")

    return "\n\n".join(context_parts), sources
