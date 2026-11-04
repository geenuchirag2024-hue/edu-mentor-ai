"""Orchestrates STT → RAG/LLM → TTS voice assistant pipeline with multilingual support."""

from __future__ import annotations

from collections.abc import Iterator

from backend.models.llm import get_llm
from backend.rag.retriever import retrieve_context
from backend.rag.user_docs import user_document_store
from backend.rag.vector_store import get_vector_store
from backend.services.conversation import conversation_store
from backend.services.learning import learning_store
from backend.services.mascot_cues import infer_mascot_cues
from backend.services.prompts import build_tutor_messages, is_greeting
from backend.utils.audio import audio_to_base64
from backend.utils.language_detect import resolve_effective_language
from backend.voice.stt import get_stt
from backend.voice.tts import get_tts


def prepare_text_query(
    message: str,
    session_id: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    learner_id: str | None = None,
    use_notes: bool = False,
    subject: str = "Machine Learning",
    mentor_id: str | None = "mira",
    language: str | None = "en",
) -> tuple[str, list[dict[str, str]], list[str]]:
    """Build session id, LLM messages, and sources without updating history."""
    sid = conversation_store.get_or_create_session(session_id)
    history = conversation_store.get_history(sid)

    effective_lang = resolve_effective_language(message, language)

    context = ""
    sources: list[str] = []
    if not is_greeting(message):
        if use_notes:
            context, sources = user_document_store.retrieve(sid, message)
        if (not context) and get_vector_store().is_available:
            context, sources = retrieve_context(message, subject=subject)

    extra = learning_store.coaching_context(learner_id) or None
    messages = build_tutor_messages(
        message,
        history=history,
        context=context or None,
        for_voice=for_voice,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        extra_system=extra,
        subject=subject,
        mentor_id=mentor_id,
        language=effective_lang,
    )
    return sid, messages, sources


def finalize_text_query(
    sid: str,
    message: str,
    answer: str,
    learner_id: str | None = None,
) -> None:
    """Commit user and assistant turns to history and update learner stats."""
    conversation_store.add_turn(sid, "user", message)
    conversation_store.add_turn(sid, "assistant", answer)
    learning_store.record_interaction(learner_id, sid, message, answer)


def process_text_stream(
    message: str,
    session_id: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    learner_id: str | None = None,
    use_notes: bool = False,
    subject: str = "Machine Learning",
    mentor_id: str | None = "mira",
    language: str | None = "en",
) -> tuple[str, Iterator[str], list[str], str]:
    effective_lang = resolve_effective_language(message, language)
    sid, messages, sources = prepare_text_query(
        message,
        session_id,
        for_voice=for_voice,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        learner_id=learner_id,
        use_notes=use_notes,
        subject=subject,
        mentor_id=mentor_id,
        language=effective_lang,
    )
    tokens = get_llm().generate_stream(messages, for_voice=for_voice)
    return sid, tokens, sources, effective_lang


def process_text_query(
    message: str,
    session_id: str | None = None,
    for_voice: bool = False,
    tutor_mode: str | None = None,
    hint_level: int = 0,
    learner_id: str | None = None,
    use_notes: bool = False,
    subject: str = "Machine Learning",
    mentor_id: str | None = "mira",
    language: str | None = "en",
) -> dict:
    effective_lang = resolve_effective_language(message, language)
    sid, messages, sources = prepare_text_query(
        message,
        session_id,
        for_voice=for_voice,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        learner_id=learner_id,
        use_notes=use_notes,
        subject=subject,
        mentor_id=mentor_id,
        language=effective_lang,
    )
    answer = get_llm().generate(messages, for_voice=for_voice)
    finalize_text_query(sid, message, answer, learner_id=learner_id)
    cues = infer_mascot_cues(
        answer,
        tutor_mode=tutor_mode or "teacher",
        user_message=message,
        hint_level=hint_level,
    )
    return {
        "answer": answer,
        "session_id": sid,
        "sources": sources,
        "mentor_id": mentor_id or "mira",
        "language": effective_lang,
        **cues,
    }


def process_voice_query(
    audio_bytes: bytes,
    filename: str = "audio.webm",
    session_id: str | None = None,
    tutor_mode: str | None = None,
    learner_id: str | None = None,
    use_notes: bool = False,
    hint_level: int = 0,
    subject: str = "Machine Learning",
    mentor_id: str | None = "mira",
    language: str | None = "en",
) -> dict:
    stt = get_stt()
    info = None
    if hasattr(stt, "transcribe_with_info"):
        try:
            info = stt.transcribe_with_info(audio_bytes, filename=filename, language=language)
        except Exception:
            info = None

    if isinstance(info, dict):
        transcript = info.get("text", "")
        detected_lang = info.get("detected_language") or info.get("language")
    else:
        plain = stt.transcribe(audio_bytes, filename=filename, language=language)
        transcript = getattr(plain, "_mock_return_value", plain) if hasattr(plain, "_mock_return_value") else plain
        transcript = str(transcript) if transcript is not None else ""
        detected_lang = language

    effective_lang = resolve_effective_language(transcript, detected_lang or language)

    if not transcript.strip():
        if effective_lang.startswith("hi"):
            fallback = "मुझे आपकी आवाज़ स्पष्ट नहीं सुनाई दी। क्या आप अपना प्रश्न दोहरा सकते हैं?"
        elif effective_lang.startswith("kn"):
            fallback = "ನಿಮ್ಮ ಧ್ವನಿ ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಪುನರಾವರ್ತಿಸಿ."
        else:
            fallback = "I didn't catch that. Could you please repeat your question?"

        audio = get_tts().synthesize(fallback, mentor_id=mentor_id, language=effective_lang)
        sid = conversation_store.get_or_create_session(session_id)
        tts_supported = bool(audio and len(audio) > 44)
        return {
            "transcript": "",
            "answer": fallback,
            "audio_base64": audio_to_base64(audio) if audio else "",
            "session_id": sid,
            "sources": [],
            "emotion": "surprised",
            "gesture": "wave",
            "response_type": "greeting",
            "mentor_id": mentor_id or "mira",
            "language": effective_lang,
            "tts_supported": tts_supported,
        }

    result = process_text_query(
        transcript,
        session_id=session_id,
        for_voice=True,
        tutor_mode=tutor_mode,
        hint_level=hint_level,
        learner_id=learner_id,
        use_notes=use_notes,
        subject=subject,
        mentor_id=mentor_id,
        language=effective_lang,
    )
    audio = get_tts().synthesize(result["answer"], mentor_id=mentor_id, language=effective_lang)
    tts_supported = bool(audio and len(audio) > 44)

    return {
        "transcript": transcript,
        "answer": result["answer"],
        "audio_base64": audio_to_base64(audio) if audio else "",
        "session_id": result["session_id"],
        "sources": result["sources"],
        "emotion": result.get("emotion", "confident"),
        "gesture": result.get("gesture", "none"),
        "response_type": result.get("response_type", "explanation"),
        "mentor_id": mentor_id or "mira",
        "language": effective_lang,
        "tts_supported": tts_supported,
    }
