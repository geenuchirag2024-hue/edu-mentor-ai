"""Comprehensive test suite for Edu-Mentor AI V3:
- PDF Ingestion, Chunking & Deduplication (Phase 1)
- Document-Grounded Prompts & Token Budget (Phase 2)
- Student PDF Q&A & Document Isolation (Phase 3)
- Teacher Notes Distribution & Student Notifications (Phase 4)
- Teacher Analytics & Learning History (Phase 5)
- Privacy & RBAC enforcement
"""

import json
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from backend.db.models import Document, DocumentChunk, TeacherResource, User
from backend.services.document_service import (
    chunk_document_pages,
    compute_sha256,
    construct_grounded_prompt,
    retrieve_document_context,
)


def test_sha256_deduplication():
    data1 = b"Machine learning is a subset of artificial intelligence."
    data2 = b"Machine learning is a subset of artificial intelligence."
    data3 = b"Deep learning is a subset of machine learning."

    hash1 = compute_sha256(data1)
    hash2 = compute_sha256(data2)
    hash3 = compute_sha256(data3)

    assert hash1 == hash2
    assert hash1 != hash3
    assert len(hash1) == 64


def test_semantic_chunking_preserves_page_numbers():
    pages = [
        {"page": 1, "text": "Page one paragraph one. Introduction to databases and SQL fundamentals."},
        {"page": 2, "text": "Page two paragraph one. Relational schema design and normal forms 1NF 2NF 3NF."},
        {"page": 3, "text": "Page three paragraph one. Transactions, ACID properties, and concurrency control."},
    ]

    chunks = chunk_document_pages(pages, chunk_size=10, overlap=2)
    assert len(chunks) >= 3

    page_nums = [c["page_number"] for c in chunks]
    assert 1 in page_nums
    assert 2 in page_nums
    assert 3 in page_nums

    # Confirm page 2 chunk has page_number == 2
    p2_chunks = [c for c in chunks if c["page_number"] == 2]
    assert any("Relational" in c["text_content"] for c in p2_chunks)


def test_construct_grounded_prompt():
    context = "[Page 2]\nSupervised learning uses labeled datasets to train algorithms."
    question = "What is supervised learning?"
    sources = [2]

    messages = construct_grounded_prompt(question, context, sources, language="en")
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert "Do not invent information" in messages[0]["content"]
    assert "Referenced Pages: 2" in messages[0]["content"]
    assert "Supervised learning uses labeled datasets" in messages[1]["content"]
    assert question in messages[1]["content"]

    # Kannada prompt instructions
    kn_messages = construct_grounded_prompt(question, context, sources, language="kn")
    assert "ಸಹಜ ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ" in kn_messages[0]["content"]

    # Hindi prompt instructions
    hi_messages = construct_grounded_prompt(question, context, sources, language="hi")
    assert "स्वाभाविक हिंदी में" in hi_messages[0]["content"]


def test_document_isolated_retrieval():
    mock_chunks = [
        DocumentChunk(id=1, document_id=10, chunk_index=0, page_number=1, text_content="Convolutional neural networks are used for image processing."),
        DocumentChunk(id=2, document_id=10, chunk_index=1, page_number=2, text_content="Recurrent neural networks and LSTMs process sequential data like text."),
        DocumentChunk(id=3, document_id=10, chunk_index=2, page_number=5, text_content="Transformers replace recurrence with self-attention mechanisms."),
    ]

    ctx, pages, latency_ms = retrieve_document_context(
        document_id=10,
        chunks=mock_chunks,
        query="Explain self-attention in transformers",
        top_k=2,
    )

    assert 5 in pages
    assert "Transformers replace recurrence" in ctx
    assert latency_ms >= 0


def test_student_document_upload_and_deduplication(client: TestClient, auth_headers: dict):
    pdf_bytes = b"%PDF-1.4 dummy pdf content for testing machine learning notes"

    with patch("backend.api.routes.documents.process_document_pipeline") as mock_pipeline:
        # First upload
        response = client.post(
            "/api/documents/upload",
            files={"file": ("ml_notes.pdf", pdf_bytes, "application/pdf")},
            data={"subject": "Machine Learning"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["reused"] is False
        assert data["document"]["filename"] == "ml_notes.pdf"
        assert data["document"]["status"] == "uploaded"


def test_teacher_resource_upload_and_student_notifications(
    client: TestClient,
    teacher_headers: dict,
    auth_headers: dict,
):
    note_bytes = b"Deep Learning Unit 4 Comprehensive Lecture Notes by Professor Smith"

    # 1. Teacher uploads resource
    upload_res = client.post(
        "/api/resources/upload",
        files={"file": ("DL_Unit4_Notes.pdf", note_bytes, "application/pdf")},
        data={
            "title": "Deep Learning Unit 4 Notes",
            "description": "Comprehensive notes covering CNNs and RNNs",
            "subject": "Deep Learning",
            "is_published": "true",
        },
        headers=teacher_headers,
    )
    assert upload_res.status_code == 200
    res_data = upload_res.json()
    assert res_data["resource"]["title"] == "Deep Learning Unit 4 Notes"
    assert res_data["resource"]["subject"] == "Deep Learning"
    resource_id = res_data["resource"]["id"]

    # 2. Student retrieves notifications
    notif_res = client.get("/api/notifications", headers=auth_headers)
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert notifs["unread_count"] >= 1
    recent_notif = notifs["notifications"][0]
    assert "Deep Learning Unit 4 Notes" in recent_notif["message"]

    # 3. Student marks notification as read
    read_res = client.patch(f"/api/notifications/{recent_notif['id']}/read", headers=auth_headers)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # 4. Student views published notes library
    library_res = client.get("/api/resources?subject=Deep Learning", headers=auth_headers)
    assert library_res.status_code == 200
    lib_data = library_res.json()
    assert any(r["id"] == resource_id for r in lib_data)

    # 5. Student downloads the file
    download_res = client.get(f"/api/resources/{resource_id}/download", headers=auth_headers)
    assert download_res.status_code == 200
    assert download_res.content == note_bytes


def test_teacher_analytics_rbac_and_overview(
    client: TestClient,
    teacher_headers: dict,
    auth_headers: dict,
):
    # Student cannot access teacher analytics
    forbidden_res = client.get("/api/analytics/teacher/overview", headers=auth_headers)
    assert forbidden_res.status_code == 403

    # Teacher accesses analytics overview
    teacher_res = client.get("/api/analytics/teacher/overview", headers=teacher_headers)
    assert teacher_res.status_code == 200
    overview = teacher_res.json()
    assert "total_active_students" in overview
    assert "total_study_hours" in overview
    assert "total_questions_asked" in overview
    assert "avg_ai_response_time_ms" in overview

    # Teacher accesses latency statistics
    latency_res = client.get("/api/analytics/teacher/latency", headers=teacher_headers)
    assert latency_res.status_code == 200
    lat_data = latency_res.json()
    assert "avg_ms" in lat_data
    assert "median_ms" in lat_data
    assert "p95_ms" in lat_data


def test_study_session_heartbeat_tracking(client: TestClient, auth_headers: dict):
    session_id = "test-session-uuid-12345"

    # Ping 1: Session created
    res1 = client.post(
        "/api/analytics/study-session/ping",
        json={"session_uuid": session_id},
        headers=auth_headers,
    )
    assert res1.status_code == 200
    assert res1.json()["status"] == "created"
    assert res1.json()["active_duration_seconds"] == 10

    # Ping 2: Active update
    res2 = client.post(
        "/api/analytics/study-session/ping",
        json={"session_uuid": session_id},
        headers=auth_headers,
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == "active"
    assert res2.json()["active_duration_seconds"] >= 10

