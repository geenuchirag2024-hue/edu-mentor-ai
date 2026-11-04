"""Comprehensive test suite for Phase 9: Multilingual Chat, STT, TTS and RAG."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.rag.retriever import retrieve_context
from backend.services.assistant_pipeline import prepare_text_query
from backend.services.mentor_registry import get_mentor_voice_config
from backend.utils.language_detect import detect_script_language, resolve_effective_language
from backend.voice.tts import get_tts


def test_script_detection():
    # Kannada
    assert detect_script_language("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?") == "kn"
    assert detect_script_language("ಡೇಟಾಬೇಸ್ ಎಂದರೇನು?") == "kn"
    assert detect_script_language("ನಮಸ್ಕಾರ") == "kn"

    # Hindi / Devanagari
    assert detect_script_language("मशीन लर्निंग क्या है?") == "hi"
    assert detect_script_language("डेटाबेस क्या है?") == "hi"
    assert detect_script_language("नमस्ते") == "hi"

    # English
    assert detect_script_language("What is machine learning?") == "en"
    assert detect_script_language("Explain databases") == "en"


def test_resolve_effective_language_auto_and_overrides():
    # When user types in Kannada script, even if language was defaulted to 'en' or 'auto'
    assert resolve_effective_language("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?", "en") == "kn"
    assert resolve_effective_language("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?", "auto") == "kn"
    assert resolve_effective_language("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?", None) == "kn"

    # When user types in Hindi script, even if language was defaulted to 'en' or 'auto'
    assert resolve_effective_language("मशीन लर्निंग क्या है?", "en") == "hi"
    assert resolve_effective_language("मशीन लर्निंग क्या है?", "auto") == "hi"
    assert resolve_effective_language("मशीन लर्निंग क्या है?", None) == "hi"

    # English
    assert resolve_effective_language("What is machine learning?", "en") == "en"
    assert resolve_effective_language("What is machine learning?", "auto") == "en"

    # Explicit override when text is ASCII or neutral
    assert resolve_effective_language("Hello tutor", "kn") == "kn"
    assert resolve_effective_language("Hello tutor", "hi") == "hi"


def test_typed_chat_does_not_call_whisper(client: TestClient, auth_headers: dict):
    with patch("backend.services.assistant_pipeline.get_stt") as mock_stt, \
         patch("backend.services.assistant_pipeline.get_vector_store") as mock_store, \
         patch("backend.services.assistant_pipeline.get_llm") as mock_llm:

        mock_store.return_value.is_available = False
        mock_llm.return_value.generate.return_value = "ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೆ ಗಣಕಯಂತ್ರಗಳ ಕಲಿಕೆ."

        response = client.post(
            "/api/chat",
            json={"message": "ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?", "language": "kn"},
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["language"] == "kn"
        assert "ಯಂತ್ರ ಕಲಿಕೆ" in data["answer"]
        # Confirm STT/Whisper was NEVER called for typed text
        mock_stt.assert_not_called()


def test_llm_receives_correct_kannada_instruction():
    sid, messages, sources = prepare_text_query("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?", language="kn")
    system_prompt = messages[0]["content"]
    assert "ನೀವು Edu-Mentor AI ಶಿಕ್ಷಣ ಸಹಾಯಕರು" in system_prompt
    assert "ಸಹಜ ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ ಮತ್ತು ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ಉತ್ತರಿಸಿ" in system_prompt
    # User message preserved with Unicode
    assert any("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?" in m["content"] for m in messages if m["role"] == "user")


def test_llm_receives_correct_hindi_instruction():
    sid, messages, sources = prepare_text_query("मशीन लर्निंग क्या है?", language="hi")
    system_prompt = messages[0]["content"]
    assert "आप Edu-Mentor AI शैक्षणिक सहायक हैं" in system_prompt
    assert "स्वाभाविक हिंदी में देवनागरी लिपि में उत्तर दें" in system_prompt
    assert any("मशीन लर्निंग क्या है?" in m["content"] for m in messages if m["role"] == "user")


def test_cross_lingual_rag_retrieval():
    # Kannada ML query matches intro_to_ml.txt
    ctx_kn, sources_kn = retrieve_context("ಯಂತ್ರ ಕಲಿಕೆ ಎಂದರೇನು?", subject="Machine Learning")
    assert any("intro_to_ml.txt" in s or "machine_learning" in s for s in sources_kn)

    # Kannada DBMS query matches dbms_fundamentals.txt
    ctx_db_kn, sources_db_kn = retrieve_context("ಡೇಟಾಬೇಸ್ ಎಂದರೇನು?", subject="DBMS")
    assert any("dbms" in s.lower() for s in sources_db_kn)

    # Hindi ML query matches intro_to_ml.txt
    ctx_hi, sources_hi = retrieve_context("मशीन लर्निंग क्या है?", subject="Machine Learning")
    assert any("intro_to_ml.txt" in s or "machine_learning" in s for s in sources_hi)

    # Hindi DBMS query matches dbms_fundamentals.txt
    ctx_db_hi, sources_db_hi = retrieve_context("डेटाबेस क्या है?", subject="DBMS")
    assert any("dbms" in s.lower() for s in sources_db_hi)


def test_mentor_voice_mapping_and_languages():
    # English distinct voices
    mira_en = get_mentor_voice_config("mira", "en")
    arjun_en = get_mentor_voice_config("arjun", "en")
    tara_en = get_mentor_voice_config("tara", "en")
    kiran_en = get_mentor_voice_config("kiran", "en")

    assert mira_en["voice_model"] == "en_US-lessac-medium"
    assert arjun_en["voice_model"] == "en_US-ryan-medium"
    assert tara_en["voice_model"] == "en_US-amy-medium"
    assert kiran_en["voice_model"] == "en_US-danny-low"

    # Hindi voices
    mira_hi = get_mentor_voice_config("mira", "hi")
    arjun_hi = get_mentor_voice_config("arjun", "hi")
    kiran_hi = get_mentor_voice_config("kiran", "hi")

    assert mira_hi["voice_model"] == "hi_IN-priyamvada-medium"
    assert arjun_hi["voice_model"] == "hi_IN-rohan-medium"
    assert kiran_hi["voice_model"] == "hi_IN-pratham-medium"

    # Kannada: Piper lacks kn_IN model, so is_supported must be False
    mira_kn = get_mentor_voice_config("mira", "kn")
    assert mira_kn["is_supported"] is False
    assert "Piper TTS catalog lacks" in mira_kn["unsupported_reason"]


def test_tts_kannada_returns_empty_and_preserves_text():
    tts = get_tts()
    # Kannada synthesis must return b"" so incompatible English voice is never read
    audio = tts.synthesize("ಯಂತ್ರ ಕಲಿಕೆ ಒಂದು ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆಯ ಭಾಗವಾಗಿದೆ.", mentor_id="mira", language="kn")
    assert audio == b""


def test_tts_hindi_generates_audio():
    tts = get_tts()
    audio = tts.synthesize("नमस्ते! मशीन लर्निंग में आपका स्वागत है।", mentor_id="mira", language="hi")
    # Generates valid WAV header (>= 44 bytes)
    assert len(audio) > 44
    assert audio[:4] == b"RIFF"

