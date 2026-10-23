"""Tests for Phase 3: Centralized Mentor Registry and Multi-Mentor Support."""

import pytest
from unittest.mock import patch
from backend.services.mentor_registry import (
    DEFAULT_MENTOR_ID,
    MENTOR_REGISTRY,
    get_mentor,
    get_mentor_prompt,
    list_mentors,
    normalize_mentor_id,
)
from backend.services.prompts import ML_TUTOR_SYSTEM_PROMPT, build_tutor_messages
from backend.services.assistant_pipeline import prepare_text_query, process_text_query, process_voice_query


def test_mentor_registry_contains_all_four_mentors():
    """Verify all four mentors exist in the registry with complete schemas."""
    expected_ids = {"mira", "arjun", "tara", "kiran"}
    assert set(MENTOR_REGISTRY.keys()) == expected_ids

    mentors = list_mentors()
    assert len(mentors) == 4
    mentor_ids = {m["id"] for m in mentors}
    assert mentor_ids == expected_ids

    for m in mentors:
        assert m["id"]
        assert m["name"]
        assert m["title"]
        assert m["specialty"]
        assert m["greeting"]
        assert m["avatar"]
        assert m["avatar_type"] in {"animated_mascot", "human_avatar"}
        assert m["description"]


def test_default_mentor_is_mira():
    """Verify Mira is the designated default when mentor_id is omitted or empty."""
    assert DEFAULT_MENTOR_ID == "mira"
    assert normalize_mentor_id(None) == "mira"
    assert normalize_mentor_id("") == "mira"
    assert normalize_mentor_id("   ") == "mira"

    mentor = get_mentor(None)
    assert mentor["id"] == "mira"
    assert mentor["name"] == "Mentor Mira"
    assert "You are Edu Mentor (Mentor Mira)" in mentor["system_prompt"]


def test_invalid_mentor_id_fallback():
    """Verify unknown or invalid mentor IDs safely default to Mira."""
    assert normalize_mentor_id("non_existent_mentor") == "mira"
    assert normalize_mentor_id("robot123") == "mira"
    assert normalize_mentor_id("undefined") == "mira"

    fallback = get_mentor("invalid_mentor_id")
    assert fallback["id"] == "mira"
    assert get_mentor_prompt("invalid_mentor_id") == MENTOR_REGISTRY["mira"]["system_prompt"]


def test_distinct_system_prompts():
    """Verify Arjun, Tara, Kiran, and Mira each have distinct system prompts and philosophies."""
    prompts = {mid: get_mentor_prompt(mid) for mid in ["mira", "arjun", "tara", "kiran"]}
    assert len(set(prompts.values())) == 4, "All 4 system prompts must be mutually distinct"

    # Mira preserves original baseline
    assert "Mentor Mira" in prompts["mira"]

    # Arjun specializes in practical engineering & DBMS
    assert "Arjun" in prompts["arjun"]
    assert "DBMS" in prompts["arjun"] or "systems" in prompts["arjun"]
    assert "SQL" in prompts["arjun"]

    # Tara specializes in neural networks & mathematical intuition
    assert "Tara" in prompts["tara"]
    assert "neural" in prompts["tara"] or "deep learning" in prompts["tara"].lower()
    assert "intuition" in prompts["tara"].lower()

    # Kiran specializes in applied ML and code implementation
    assert "Kiran" in prompts["kiran"]
    assert "Machine Learning" in prompts["kiran"] or "algorithms" in prompts["kiran"]
    assert "practice" in prompts["kiran"].lower() or "implementation" in prompts["kiran"].lower()


def test_build_tutor_messages_with_mentors():
    """Verify build_tutor_messages correctly applies mentor-specific prompts."""
    # Default without mentor_id should use Mira
    default_msgs = build_tutor_messages("What is a database?")
    assert "Mentor Mira" in default_msgs[0]["content"]

    # Explicit Arjun
    arjun_msgs = build_tutor_messages("What is a database?", mentor_id="arjun")
    assert "Mentor Arjun" in arjun_msgs[0]["content"]

    # Explicit Tara
    tara_msgs = build_tutor_messages("What is a Transformer?", mentor_id="tara")
    assert "Mentor Tara" in tara_msgs[0]["content"]

    # Explicit Kiran
    kiran_msgs = build_tutor_messages("Explain random forest", mentor_id="kiran")
    assert "Mentor Kiran" in kiran_msgs[0]["content"]


def test_assistant_pipeline_mentor_propagation():
    """Verify mentor selection reaches the assistant pipeline."""
    with (
        patch("backend.services.assistant_pipeline.get_llm") as mock_llm,
        patch("backend.services.assistant_pipeline.get_vector_store") as mock_store,
    ):
        mock_llm.return_value.generate.return_value = "Here is your practical explanation."
        mock_store.return_value.is_available = False

        res = process_text_query(
            "Explain normalization",
            mentor_id="arjun",
            subject="DBMS",
        )
        assert res["mentor_id"] == "arjun"
        assert res["answer"] == "Here is your practical explanation."

        # Default fallback
        res_default = process_text_query("What is supervised learning?")
        assert res_default["mentor_id"] == "mira"


def test_chat_api_mentor_selection(client, auth_headers):
    """Verify /api/chat endpoint accepts and honors mentor_id."""
    with (
        patch("backend.services.assistant_pipeline.get_llm") as mock_llm,
        patch("backend.services.assistant_pipeline.get_vector_store") as mock_store,
    ):
        mock_llm.return_value.generate.return_value = "Mocked response."
        mock_store.return_value.is_available = False

        # Request with Arjun
        res_arjun = client.post(
            "/api/chat",
            json={
                "message": "Explain B-Trees",
                "subject": "DBMS",
                "mentor_id": "arjun",
            },
            headers=auth_headers,
        )
        assert res_arjun.status_code == 200
        data = res_arjun.json()
        assert data["mentor_id"] == "arjun"

        # Request omitting mentor_id -> Mira
        res_mira = client.post(
            "/api/chat",
            json={"message": "What is machine learning?"},
            headers=auth_headers,
        )
        assert res_mira.status_code == 200
        assert res_mira.json()["mentor_id"] == "mira"


def test_mentors_endpoint(client):
    """Verify /api/mentors and /api/chat/mentors return full mentor directory."""
    res = client.get("/api/mentors")
    assert res.status_code == 200
    mentors = res.json()
    assert len(mentors) == 4
    ids = [m["id"] for m in mentors]
    assert "mira" in ids
    assert "arjun" in ids
    assert "tara" in ids
    assert "kiran" in ids

    # Single mentor detail
    res_tara = client.get("/api/mentors/tara")
    assert res_tara.status_code == 200
    assert res_tara.json()["name"] == "Mentor Tara"

    # Chat router endpoint
    res_chat_mentors = client.get("/api/chat/mentors")
    assert res_chat_mentors.status_code == 200
    assert len(res_chat_mentors.json()) == 4


def test_all_mentors_support_all_subjects():
    """Verify that all four mentors can answer questions across all 3 supported subjects."""
    subjects = ["Machine Learning", "DBMS", "Deep Learning"]
    mentor_ids = ["mira", "arjun", "tara", "kiran"]

    for mid in mentor_ids:
        for subj in subjects:
            sid, msgs, _ = prepare_text_query(
                "Explain the core concept",
                subject=subj,
                mentor_id=mid,
            )
            assert msgs, f"Failed generating messages for {mid} on {subj}"
            system_content = msgs[0]["content"]
            profile = get_mentor(mid)
            assert profile["name"].split()[1] in system_content or profile["id"] in system_content.lower()


def test_voice_query_mentor_support():
    """Verify voice query retains backward compatibility and returns mentor_id."""
    with (
        patch("backend.services.assistant_pipeline.get_stt") as mock_stt,
        patch("backend.services.assistant_pipeline.get_tts") as mock_tts,
        patch("backend.services.assistant_pipeline.get_llm") as mock_llm,
        patch("backend.services.assistant_pipeline.get_vector_store") as mock_store,
    ):
        mock_stt.return_value.transcribe.return_value = "What is backpropagation?"
        mock_llm.return_value.generate.return_value = "Backpropagation is reverse-mode differentiation."
        mock_tts.return_value.synthesize.return_value = b"fake-audio"
        mock_store.return_value.is_available = False

        res = process_voice_query(
            b"fake-audio-bytes",
            mentor_id="tara",
            subject="Deep Learning",
        )
        assert res["mentor_id"] == "tara"
        assert res["transcript"] == "What is backpropagation?"
        assert res["answer"] == "Backpropagation is reverse-mode differentiation."
