"""Orchestrates STT → RAG/LLM → TTS voice assistant pipeline."""

from __future__ import annotations

from collections.abc import Iterator

from backend.models.llm import get_llm
from backend.rag.retriever import retrieve_context
from backend.rag.vector_store import get_vector_store
from backend.services.conversation import conversation_store
from backend.services.prompts import build_tutor_messages, is_greeting
from backend.utils.audio import audio_to_base64
from backend.voice.stt import get_stt
from backend.voice.tts import get_tts


def prepare_text_query(
    message: str, session_id: str | None = None, for_voice: bool = False
) -> tuple[str, list[dict[str, str]], list[str]]:
    """Build session id, LLM messages, and sources without updating history."""
    sid = conversation_store.get_or_create_session(session_id)
    history = conversation_store.get_history(sid)

    if get_vector_store().is_available and not is_greeting(message):
        context, sources = retrieve_context(message)
        messages = build_tutor_messages(
            message, history=history, context=context or None, for_voice=for_voice
        )
        return sid, messages, sources

    messages = build_tutor_messages(message, history=history, for_voice=for_voice)
    return sid, messages, []


def finalize_text_query(sid: str, message: str, answer: str) -> None:
    conversation_store.append(sid, "user", message)
    conversation_store.append(sid, "assistant", answer)


def stream_text_query(
    message: str, session_id: str | None = None, for_voice: bool = False
) -> tuple[str, Iterator[str], list[str]]:
    """Return session id, token stream, and sources for SSE chat."""
    sid, messages, sources = prepare_text_query(message, session_id, for_voice=for_voice)
    tokens = get_llm().generate_stream(messages, for_voice=for_voice)
    return sid, tokens, sources


def process_text_query(message: str, session_id: str | None = None, for_voice: bool = False) -> dict:
    sid, messages, sources = prepare_text_query(message, session_id, for_voice=for_voice)
    answer = get_llm().generate(messages, for_voice=for_voice)
    finalize_text_query(sid, message, answer)
    return {"answer": answer, "session_id": sid, "sources": sources}


def process_voice_query(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    session_id: str | None = None,
) -> dict:
    transcript = get_stt().transcribe(audio_bytes, filename=filename)

    if not transcript.strip():
        fallback = "I didn't catch that. Could you please repeat your question?"
        audio = get_tts().synthesize(fallback)
        sid = conversation_store.get_or_create_session(session_id)
        return {
            "transcript": "",
            "answer": fallback,
            "audio_base64": audio_to_base64(audio),
            "session_id": sid,
            "sources": [],
        }

    result = process_text_query(transcript, session_id=session_id, for_voice=True)
    audio = get_tts().synthesize(result["answer"])

    return {
        "transcript": transcript,
        "answer": result["answer"],
        "audio_base64": audio_to_base64(audio),
        "session_id": result["session_id"],
        "sources": result["sources"],
    }
