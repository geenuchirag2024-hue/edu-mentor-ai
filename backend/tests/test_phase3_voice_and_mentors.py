"""Unit tests for Phase 3.1: Centralized Mentor Voice Registry, Persona Traits, and TTS Propagation."""

from pathlib import Path
from unittest.mock import MagicMock, patch

from backend.api.schemas.voice import SynthesizeRequest, SynthesizeResponse
from backend.services.assistant_pipeline import prepare_text_query, process_text_query, process_voice_query
from backend.services.mentor_registry import (
    DEFAULT_MENTOR_ID,
    MENTOR_REGISTRY,
    get_mentor,
    get_mentor_avatar_config,
    get_mentor_prompt,
    get_mentor_voice_config,
    list_mentors,
    normalize_mentor_id,
)
from backend.voice.tts import TTSService


def test_centralized_mentor_voice_registry():
    """Verify all four mentors have distinct, fully configured voice and avatar configurations."""
    expected_mentors = {"mira", "arjun", "tara", "kiran"}
    assert set(MENTOR_REGISTRY.keys()) == expected_mentors

    for mentor_id in expected_mentors:
        voice_cfg = get_mentor_voice_config(mentor_id)
        assert voice_cfg is not None
        assert voice_cfg["tts_engine"] == "piper"
        assert voice_cfg["voice_model"]
        assert voice_cfg["fallback_voice"] == "en_US-lessac-medium"
        assert voice_cfg["speaking_rate"] > 0
        assert voice_cfg["traits"]

        avatar_cfg = get_mentor_avatar_config(mentor_id)
        assert avatar_cfg is not None
        assert avatar_cfg["avatar_type"] in {"animated_mascot", "human_avatar"}

    # Distinct voice models and distinct pacing
    mira_voice = get_mentor_voice_config("mira")
    arjun_voice = get_mentor_voice_config("arjun")
    tara_voice = get_mentor_voice_config("tara")
    kiran_voice = get_mentor_voice_config("kiran")

    assert mira_voice["voice_model"] == "en_US-lessac-medium"
    assert arjun_voice["voice_model"] == "en_US-ryan-medium"
    assert tara_voice["voice_model"] == "en_US-amy-medium"
    assert kiran_voice["voice_model"] == "en_US-danny-low"

    assert arjun_voice["speaking_rate"] == 0.94
    assert tara_voice["speaking_rate"] == 1.04
    assert kiran_voice["speaking_rate"] == 0.98


def test_tts_service_mentor_voice_resolution():
    """Verify TTSService resolves each mentor's voice model or falls back gracefully with custom tuning."""
    tts = TTSService()

    # Mira should resolve to en_US-lessac-medium
    mira_path, mira_cfg, _ = tts.resolve_mentor_voice("mira")
    assert "en_US-lessac-medium" in str(mira_path)
    assert mira_cfg["speaking_rate"] == 1.0

    # Arjun should target en_US-ryan-medium; if not downloaded on disk, fall back with 0.94 rate
    arjun_path, arjun_cfg, is_target = tts.resolve_mentor_voice("arjun")
    assert arjun_cfg["voice_model"] == "en_US-ryan-medium"
    assert arjun_cfg["speaking_rate"] == 0.94
    # If ryan is not installed, it falls back to lessac
    assert "en_US-lessac-medium" in str(arjun_path) or "en_US-ryan-medium" in str(arjun_path)

    # Invalid mentor should safely fall back to Mira
    invalid_path, invalid_cfg, _ = tts.resolve_mentor_voice("unknown_robot")
    assert invalid_cfg["voice_model"] == "en_US-lessac-medium"
    assert invalid_cfg["speaking_rate"] == 1.0


def test_synthesize_request_schema():
    """Verify SynthesizeRequest schema supports optional mentor_id with mira default."""
    req_default = SynthesizeRequest(text="Hello student")
    assert req_default.mentor_id == "mira"

    req_arjun = SynthesizeRequest(text="Hello student", mentor_id="arjun")
    assert req_arjun.mentor_id == "arjun"

    req_tara = SynthesizeRequest(text="Neural networks", mentor_id="tara")
    assert req_tara.mentor_id == "tara"


def test_assistant_pipeline_voice_query_mentor_propagation():
    """Verify process_voice_query propagates mentor_id to TTS synthesis."""
    with (
        patch("backend.services.assistant_pipeline.get_stt") as mock_stt,
        patch("backend.services.assistant_pipeline.get_tts") as mock_tts,
        patch("backend.services.assistant_pipeline.get_llm") as mock_llm,
        patch("backend.services.assistant_pipeline.get_vector_store") as mock_store,
    ):
        mock_stt.return_value.transcribe.return_value = "Explain gradient descent"
        mock_llm.return_value.generate.return_value = "Gradient descent steps downhill along the gradient."
        mock_tts.return_value.synthesize.return_value = b"RIFFmockwavdata"
        mock_store.return_value.is_available = False

        res = process_voice_query(
            b"mock-audio-bytes",
            mentor_id="kiran",
            subject="Machine Learning",
        )

        assert res["mentor_id"] == "kiran"
        assert res["language"] == "en"
        assert res["transcript"] == "Explain gradient descent"
        mock_tts.return_value.synthesize.assert_called_with(
            "Gradient descent steps downhill along the gradient.",
            mentor_id="kiran",
            language="en",
        )


def test_multilingual_voice_resolution():
    """Verify TTSService resolves Hindi models and handles Kannada fallback gracefully."""
    tts = TTSService()

    # Hindi resolution
    mira_hi, _, _ = tts.resolve_mentor_voice("mira", language="hi")
    arjun_hi, _, _ = tts.resolve_mentor_voice("arjun", language="hi")
    kiran_hi, _, _ = tts.resolve_mentor_voice("kiran", language="hi")

    assert "hi_IN-priyamvada-medium" in str(mira_hi)
    assert "hi_IN-rohan-medium" in str(arjun_hi)
    assert "hi_IN-pratham-medium" in str(kiran_hi)

    # Kannada fallback: resolves to Hindi or default English cleanly without throwing error
    kannada_path, kannada_cfg, _ = tts.resolve_mentor_voice("mira", language="kn")
    assert kannada_path.exists()
    assert kannada_cfg is not None
