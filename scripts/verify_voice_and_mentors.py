"""Verification suite for Phase 3.1: Mentor Voices, Distinct Models, and Multilingual Support."""

import io
import os
import sys
import wave
from pathlib import Path
from unittest.mock import patch

# Ensure project root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.api.schemas.chat import ChatMessage, ChatRequest, ChatResponse
from backend.api.schemas.voice import (
    SynthesizeRequest,
    SynthesizeResponse,
    TranscribeResponse,
    VoiceQueryResponse,
)
from backend.config import PROJECT_ROOT as ROOT_DIR
from backend.services.assistant_pipeline import (
    prepare_text_query,
    process_text_query,
    process_voice_query,
)
from backend.services.mentor_registry import (
    DEFAULT_MENTOR_ID,
    MENTOR_LANGUAGE_VOICES,
    MENTOR_REGISTRY,
    SUPPORTED_LANGUAGES,
    get_mentor,
    get_mentor_avatar_config,
    get_mentor_prompt,
    get_mentor_voice_config,
    list_mentors,
    normalize_mentor_id,
)
from backend.services.prompts import build_tutor_messages
from backend.voice.stt import STTService, get_stt
from backend.voice.tts import TTSService, get_tts


def test_section_1_centralized_registry():
    print("--- [1/6] Testing Centralized Mentor Voice Registry ---")
    expected = {"mira", "arjun", "tara", "kiran"}
    assert set(MENTOR_REGISTRY.keys()) == expected, f"Expected {expected}, got {set(MENTOR_REGISTRY.keys())}"
    assert DEFAULT_MENTOR_ID == "mira"

    # Verify each mentor has all metadata
    for mid in expected:
        mentor = get_mentor(mid)
        assert mentor["id"] == mid
        assert mentor["name"]
        assert mentor["title"]
        assert mentor["specialty"]
        assert mentor["greeting"]
        assert mentor["system_prompt"]

        voice_cfg = get_mentor_voice_config(mid, "en")
        assert voice_cfg is not None
        assert voice_cfg["tts_engine"] == "piper"
        assert voice_cfg["voice_model"]
        assert voice_cfg["speaking_rate"] > 0
        assert voice_cfg["fallback_voice"] == "en_US-lessac-medium"
        assert voice_cfg["traits"]

        avatar_cfg = get_mentor_avatar_config(mid)
        assert avatar_cfg is not None
        assert avatar_cfg["avatar_type"] in {"animated_mascot", "human_avatar"}

    # Verify distinct models and rates in English
    mira_v = get_mentor_voice_config("mira", "en")
    arjun_v = get_mentor_voice_config("arjun", "en")
    tara_v = get_mentor_voice_config("tara", "en")
    kiran_v = get_mentor_voice_config("kiran", "en")

    assert mira_v["voice_model"] == "en_US-lessac-medium"
    assert arjun_v["voice_model"] == "en_US-ryan-medium"
    assert tara_v["voice_model"] == "en_US-amy-medium"
    assert kiran_v["voice_model"] == "en_US-danny-low"

    assert arjun_v["speaking_rate"] == 0.94
    assert tara_v["speaking_rate"] == 1.04
    assert kiran_v["speaking_rate"] == 0.98

    # Verify fallback for unknown mentor
    fb = get_mentor_voice_config("nonexistent", "en")
    assert fb["voice_model"] == "en_US-lessac-medium"

    print("  -> Centralized registry verified for all 4 mentors.")


def test_section_2_multilingual_voice_mappings():
    print("--- [2/6] Testing Multilingual Voice Configurations ---")
    assert "en" in SUPPORTED_LANGUAGES
    assert "hi" in SUPPORTED_LANGUAGES
    assert "kn" in SUPPORTED_LANGUAGES

    # English voices
    assert MENTOR_LANGUAGE_VOICES["mira"]["en"]["voice_model"] == "en_US-lessac-medium"
    assert MENTOR_LANGUAGE_VOICES["arjun"]["en"]["voice_model"] == "en_US-ryan-medium"
    assert MENTOR_LANGUAGE_VOICES["tara"]["en"]["voice_model"] == "en_US-amy-medium"
    assert MENTOR_LANGUAGE_VOICES["kiran"]["en"]["voice_model"] == "en_US-danny-low"

    # Hindi voices
    assert MENTOR_LANGUAGE_VOICES["mira"]["hi"]["voice_model"] == "hi_IN-priyamvada-medium"
    assert MENTOR_LANGUAGE_VOICES["arjun"]["hi"]["voice_model"] == "hi_IN-rohan-medium"
    assert MENTOR_LANGUAGE_VOICES["tara"]["hi"]["voice_model"] == "hi_IN-priyamvada-medium"
    assert MENTOR_LANGUAGE_VOICES["kiran"]["hi"]["voice_model"] == "hi_IN-pratham-medium"

    tts = TTSService()
    # Test resolution of Hindi models
    mira_hi_path, _, _ = tts.resolve_mentor_voice("mira", language="hi")
    arjun_hi_path, _, _ = tts.resolve_mentor_voice("arjun", language="hi")
    kiran_hi_path, _, _ = tts.resolve_mentor_voice("kiran", language="hi")

    assert "hi_IN-priyamvada-medium" in str(mira_hi_path)
    assert "hi_IN-rohan-medium" in str(arjun_hi_path)
    assert "hi_IN-pratham-medium" in str(kiran_hi_path)

    # Kannada fallback gracefully resolves without exception
    kn_path, kn_cfg, _ = tts.resolve_mentor_voice("mira", language="kn")
    assert kn_path.exists()
    assert kn_cfg is not None

    print("  -> Multilingual mappings and fallbacks verified.")


def test_section_3_models_on_disk():
    print("--- [3/6] Verifying Downloaded Model Files on Disk ---")
    models_dir = ROOT_DIR / "data" / "models" / "piper"
    required_models = [
        "en_US-lessac-medium",
        "en_US-ryan-medium",
        "en_US-amy-medium",
        "en_US-danny-low",
        "hi_IN-priyamvada-medium",
        "hi_IN-rohan-medium",
        "hi_IN-pratham-medium",
    ]

    total_size = 0
    for model_name in required_models:
        folder = models_dir / model_name
        onnx_file = folder / f"{model_name}.onnx"
        json_file = folder / f"{model_name}.onnx.json"
        assert onnx_file.exists(), f"Missing ONNX file: {onnx_file}"
        assert json_file.exists(), f"Missing JSON file: {json_file}"
        size_mb = onnx_file.stat().st_size / (1024 * 1024)
        total_size += size_mb
        assert size_mb > 50, f"Model file {onnx_file} seems incomplete ({size_mb:.2f} MB)"
        print(f"  [OK] {model_name:24s} -> {size_mb:6.2f} MB")

    print(f"  -> All {len(required_models)} models present on disk. Total: {total_size:.2f} MB")


def test_section_4_audio_synthesis_live():
    print("--- [4/6] Testing Live Audio Synthesis for All Mentors ---")
    tts = TTSService()
    test_texts_en = {
        "mira": "Hello! Welcome to Edu-Mentor AI.",
        "arjun": "Let's build reliable scalable database systems.",
        "tara": "Neural networks learn deep analytical representations.",
        "kiran": "Let's write some machine learning algorithms.",
    }

    generated_audios = {}
    for mid, text in test_texts_en.items():
        audio_bytes = tts.synthesize(text, mentor_id=mid, language="en")
        assert len(audio_bytes) > 1000, f"Audio for {mid} is too short ({len(audio_bytes)} bytes)"
        assert audio_bytes[:4] == b"RIFF", f"Audio for {mid} is not valid WAV"
        generated_audios[mid] = audio_bytes
        # Read WAV header
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            frames = wf.getnframes()
            rate = wf.getframerate()
            duration = frames / float(rate)
            print(f"  [Synthesized EN] {mid:6s} -> {len(audio_bytes):7d} bytes ({duration:.2f}s, {rate}Hz)")

    # Assert that all 4 audios are distinct from each other
    audios = list(generated_audios.values())
    for i in range(len(audios)):
        for j in range(i + 1, len(audios)):
            assert audios[i] != audios[j], "Audio waveforms must be distinct between different mentors"

    # Test Hindi synthesis
    hindi_texts = {
        "mira": "नमस्ते! आपका स्वागत है।",
        "arjun": "डेटाबेस सिस्टम की बनावट को समझते हैं।",
        "kiran": "मशीन लर्निंग मॉडल का अभ्यास करते हैं।",
    }
    for mid, text in hindi_texts.items():
        audio_bytes = tts.synthesize(text, mentor_id=mid, language="hi")
        assert len(audio_bytes) > 1000, f"Hindi audio for {mid} too short"
        assert audio_bytes[:4] == b"RIFF"
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            duration = wf.getnframes() / float(wf.getframerate())
            print(f"  [Synthesized HI] {mid:6s} -> {len(audio_bytes):7d} bytes ({duration:.2f}s)")

    print("  -> Live audio synthesis succeeded with distinct audio for all mentors!")


def test_section_5_prompts_and_schemas():
    print("--- [5/6] Testing System Prompts and Multilingual Schemas ---")
    # Schemas
    syn_req = SynthesizeRequest(text="Hello", mentor_id="arjun", language="hi")
    assert syn_req.mentor_id == "arjun"
    assert syn_req.language == "hi"

    chat_req = ChatRequest(message="Hello", mentor_id="tara", language="kn")
    assert chat_req.mentor_id == "tara"
    assert chat_req.language == "kn"

    # Multilingual system prompt instructions
    en_msgs = build_tutor_messages("Explain SQL", mentor_id="arjun", language="en")
    assert "Mentor Arjun" in en_msgs[0]["content"]

    hi_msgs = build_tutor_messages("Explain SQL", mentor_id="arjun", language="hi")
    assert "Hindi" in hi_msgs[0]["content"] or "Devanagari" in hi_msgs[0]["content"]

    kn_msgs = build_tutor_messages("Explain SQL", mentor_id="arjun", language="kn")
    assert "Kannada" in kn_msgs[0]["content"]

    print("  -> Prompts and schemas properly handle mentor and language arguments.")


def test_section_6_assistant_pipeline():
    print("--- [6/6] Testing Assistant Pipeline Voice & Text Flow ---")
    with (
        patch("backend.services.assistant_pipeline.get_stt") as mock_stt,
        patch("backend.services.assistant_pipeline.get_tts") as mock_tts,
        patch("backend.services.assistant_pipeline.get_llm") as mock_llm,
        patch("backend.services.assistant_pipeline.get_vector_store") as mock_store,
    ):
        mock_stt.return_value.transcribe.return_value = "Explain gradient descent"
        mock_llm.return_value.generate.return_value = "Gradient descent is an optimization algorithm."
        mock_tts.return_value.synthesize.return_value = b"RIFFdummywavdataforassert"
        mock_store.return_value.is_available = False

        res = process_voice_query(
            b"mock-audio-bytes",
            mentor_id="kiran",
            language="hi",
            subject="Machine Learning",
        )

        assert res["mentor_id"] == "kiran"
        assert res["language"] == "hi"
        assert res["transcript"] == "Explain gradient descent"
        assert "audio_base64" in res

        mock_tts.return_value.synthesize.assert_called_with(
            "Gradient descent is an optimization algorithm.",
            mentor_id="kiran",
            language="hi",
        )

    print("  -> Assistant pipeline successfully propagates mentor and language to TTS.")


def main():
    print("=================================================================")
    print(" Edu-Mentor AI V3: Comprehensive Voice & Mentor Verification Suite")
    print("=================================================================")
    try:
        test_section_1_centralized_registry()
        test_section_2_multilingual_voice_mappings()
        test_section_3_models_on_disk()
        test_section_4_audio_synthesis_live()
        test_section_5_prompts_and_schemas()
        test_section_6_assistant_pipeline()
        print("=================================================================")
        print(" [SUCCESS] ALL 6 VERIFICATION TEST SECTIONS PASSED PERFECTLY!")
        print("=================================================================")
    except Exception as exc:
        print(f"\n[FAILURE] Test error: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
