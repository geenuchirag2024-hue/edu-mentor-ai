"""RAG pipeline: retrieve context and generate answer."""

from backend.models.llm import get_llm
from backend.rag.retriever import retrieve_context
from backend.services.prompts import build_tutor_messages, is_greeting


def generate_rag_answer(
    question: str,
    history: list[dict[str, str]] | None = None,
    for_voice: bool = False,
) -> tuple[str, list[str]]:
    if is_greeting(question):
        messages = build_tutor_messages(question, history=history, for_voice=for_voice)
        answer = get_llm().generate(messages, for_voice=for_voice)
        return answer, []

    context, sources = retrieve_context(question)
    messages = build_tutor_messages(
        question, history=history, context=context or None, for_voice=for_voice
    )
    answer = get_llm().generate(messages, for_voice=for_voice)
    return answer, sources
