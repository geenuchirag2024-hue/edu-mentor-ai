"""Comprehensive tests for Phase 2: Multi-Subject RAG, Teacher Indexing, and Subject Quizzes."""

from __future__ import annotations

import io
import json
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.rag.chunking import chunk_text, clean_text
from backend.rag.ingestion import extract_text_from_file, extract_text_from_pdf
from backend.rag.local_store import LocalVectorStore
from backend.rag.retriever import retrieve_context
from backend.rag.user_docs import user_document_store
from backend.services.assistant_pipeline import prepare_text_query
from backend.services.quiz import generate_quiz


def test_clean_text_and_chunking():
    """Verify chunking ignores empty documents and produces non-empty chunks with overlap."""
    assert clean_text("   \n\t  ") == ""
    assert chunk_text("") == []
    assert chunk_text("     ") == []

    sample = "word " * 1500
    chunks = chunk_text(sample, chunk_size=300, overlap=50)
    assert len(chunks) > 1
    for c in chunks:
        assert len(c.split()) <= 300
        assert c.strip() != ""


def test_extraction_empty_and_corrupt_files(tmp_path: Path):
    """Verify text extraction handles non-existent, empty, and text files gracefully."""
    # Non-existent file
    missing = tmp_path / "does_not_exist.txt"
    assert extract_text_from_file(missing) == []

    # Empty text file
    empty_txt = tmp_path / "empty.txt"
    empty_txt.write_text("   \n\t  ", encoding="utf-8")
    assert extract_text_from_file(empty_txt) == []

    # Valid text file
    valid_txt = tmp_path / "valid.txt"
    valid_txt.write_text("Sample database transaction ACID properties.", encoding="utf-8")
    pages = extract_text_from_file(valid_txt)
    assert len(pages) == 1
    assert "ACID" in pages[0]["text"]
    assert pages[0]["page"] == 1


def test_extraction_pdf(tmp_path: Path):
    """Verify multi-page PDF creation and extraction."""
    try:
        import fitz
    except ImportError:
        pytest.skip("fitz (PyMuPDF) not installed")

    pdf_path = tmp_path / "test_doc.pdf"
    doc = fitz.open()
    page1 = doc.new_page()
    page1.insert_text((50, 50), "Page 1: Database Normalization 1NF 2NF 3NF")
    page2 = doc.new_page()
    page2.insert_text((50, 50), "Page 2: Deep Learning Backpropagation and Transformers")
    doc.save(str(pdf_path))
    doc.close()

    pages = extract_text_from_pdf(pdf_path)
    assert len(pages) == 2
    assert "Normalization" in pages[0]["text"]
    assert pages[0]["page"] == 1
    assert "Backpropagation" in pages[1]["text"]
    assert pages[1]["page"] == 2


def test_safe_repeatable_ingestion_and_deduplication(tmp_path: Path):
    """Verify upserting the same source file twice replaces previous chunks without duplication."""
    store_file = tmp_path / "test_store.json"

    with patch("backend.rag.local_store.STORE_PATH", store_file):
        store = LocalVectorStore()

        chunks_v1 = ["Chunk 1 from DBMS doc", "Chunk 2 from DBMS doc"]
        vectors_v1 = [[0.1] * 768, [0.2] * 768]
        meta_v1 = [
            {"subject": "DBMS", "source_file": "dbms.txt", "chunk_id": "c1"},
            {"subject": "DBMS", "source_file": "dbms.txt", "chunk_id": "c2"},
        ]

        count1 = store.upsert_chunks(chunks_v1, vectors_v1, meta_v1)
        assert count1 == 2
        assert len(store._records) == 2

        # Re-ingest same document with 3 updated chunks
        chunks_v2 = ["Updated Chunk 1", "Updated Chunk 2", "Updated Chunk 3"]
        vectors_v2 = [[0.3] * 768, [0.4] * 768, [0.5] * 768]
        meta_v2 = [
            {"subject": "DBMS", "source_file": "dbms.txt", "chunk_id": "c1_new"},
            {"subject": "DBMS", "source_file": "dbms.txt", "chunk_id": "c2_new"},
            {"subject": "DBMS", "source_file": "dbms.txt", "chunk_id": "c3_new"},
        ]

        count2 = store.upsert_chunks(chunks_v2, vectors_v2, meta_v2)
        assert count2 == 3
        # Must be exactly 3, not 2 + 3 = 5!
        assert len(store._records) == 3
        assert all(r["source_file"] == "dbms.txt" for r in store._records)
        assert store._records[0]["text"] == "Updated Chunk 1"


def test_chunk_metadata_schema(tmp_path: Path):
    """Verify all required metadata attributes (subject, source, topic, chunk_id) are preserved."""
    store_file = tmp_path / "metadata_test.json"
    with patch("backend.rag.local_store.STORE_PATH", store_file):
        store = LocalVectorStore()
        chunks = ["Deep Learning Transformer Multi-head attention."]
        vectors = [[0.1] * 768]
        meta = [{
            "subject": "Deep Learning",
            "source": "dl_guide.txt",
            "source_file": "dl_guide.txt",
            "topic": "Transformers",
            "page": 1,
            "chunk_id": "dl_guide_p1_c0",
        }]
        store.upsert_chunks(chunks, vectors, meta)

        rec = store._records[0]
        assert rec["subject"] == "Deep Learning"
        assert rec["source"] == "dl_guide.txt"
        assert rec["source_file"] == "dl_guide.txt"
        assert rec["topic"] == "Transformers"
        assert rec["chunk_id"] == "dl_guide_p1_c0"


def test_subject_specific_retrieval(tmp_path: Path):
    """Verify DBMS query prioritizes DBMS chunks and does not let DL or ML chunks dominate."""
    store_file = tmp_path / "multi_subject_store.json"
    with patch("backend.rag.local_store.STORE_PATH", store_file):
        store = LocalVectorStore()

        # Add DBMS chunk with vector [1, 0, 0...]
        v_dbms = [0.0] * 768
        v_dbms[0] = 1.0
        # Add DL chunk with vector [0, 1, 0...]
        v_dl = [0.0] * 768
        v_dl[1] = 1.0

        store.upsert_chunks(
            ["Relational algebra and SQL joins."],
            [v_dbms],
            [{"subject": "DBMS", "source_file": "dbms.txt", "chunk_id": "db1"}],
        )
        store.upsert_chunks(
            ["Convolutional neural networks backprop."],
            [v_dl],
            [{"subject": "Deep Learning", "source_file": "dl.txt", "chunk_id": "dl1"}],
        )

        # Search with subject="DBMS"
        hits_dbms = store.search(v_dbms, top_k=4, subject="DBMS")
        assert len(hits_dbms) == 1
        assert hits_dbms[0]["subject"] == "DBMS"
        assert "Relational algebra" in hits_dbms[0]["text"]

        # Search with subject="Deep Learning"
        hits_dl = store.search(v_dl, top_k=4, subject="Deep Learning")
        assert len(hits_dl) == 1
        assert hits_dl[0]["subject"] == "Deep Learning"
        assert "Convolutional" in hits_dl[0]["text"]


def test_retrieved_context_reaches_assistant_prompt():
    """Verify retrieve_context output is injected into the LLM system prompt."""
    sid, messages, sources = prepare_text_query(
        "Explain primary and foreign keys",
        session_id=None,
        subject="DBMS",
    )
    system_content = messages[0]["content"]
    assert "DBMS" in system_content or "course material" in system_content.lower()


def test_teacher_upload_and_indexing(client, teacher_headers):
    """Verify teacher upload extracts, chunks, embeds, and indexes document under selected subject."""
    content = "A relational database transaction must satisfy Atomicity, Consistency, Isolation, and Durability."
    file_bytes = io.BytesIO(content.encode("utf-8"))

    response = client.post(
        "/api/teacher/content/upload",
        files={"file": ("acid_guide.txt", file_bytes, "text/plain")},
        data={"subject": "DBMS"},
        headers=teacher_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["filename"] == "acid_guide.txt"
    assert data["subject"] == "DBMS"
    assert data["chunks_indexed"] >= 1

    # Verify document now appears in materials list with subject and chunk count
    list_res = client.get("/api/teacher/materials", headers=teacher_headers)
    assert list_res.status_code == 200
    mat_names = [m["filename"] for m in list_res.json()["materials"]]
    assert "acid_guide.txt" in mat_names


def test_student_denial_of_teacher_operations(client, auth_headers):
    """Verify students cannot invoke teacher upload or management operations."""
    content = "Unauthorized upload content"
    file_bytes = io.BytesIO(content.encode("utf-8"))

    response = client.post(
        "/api/teacher/content/upload",
        files={"file": ("hacked.txt", file_bytes, "text/plain")},
        data={"subject": "Machine Learning"},
        headers=auth_headers,
    )
    assert response.status_code == 403

    overview_res = client.get("/api/teacher/overview", headers=auth_headers)
    assert overview_res.status_code == 403


def test_student_notes_remain_isolated():
    """Verify student notes are strictly isolated to the session and not leaked to general RAG."""
    session_id = "private_session_123"
    note_content = "My private personal notes on exam secret tip."
    meta = user_document_store.ingest_text(session_id, "my_notes.txt", note_content)
    assert meta["chunks"] >= 1

    # Retrieved for this session
    ctx, srcs = user_document_store.retrieve(session_id, "exam secret")
    assert "secret tip" in ctx
    assert "my_notes.txt" in srcs

    # Different session cannot retrieve it
    ctx_other, srcs_other = user_document_store.retrieve("other_session_456", "exam secret")
    assert ctx_other == ""
    assert srcs_other == []


def test_subject_specific_quiz_generation():
    """Verify subject-aware quiz generation for DBMS, Deep Learning, and Machine Learning."""
    # DBMS quiz
    q_dbms = generate_quiz(subject="DBMS", topic="Transactions and ACID", n_questions=3)
    assert q_dbms["subject"] == "DBMS"
    assert len(q_dbms["questions"]) == 3
    prompts_dbms = " ".join(q["prompt"] for q in q_dbms["questions"]).lower()
    assert any(term in prompts_dbms for term in ["acid", "transaction", "key", "normal", "join", "database", "locking"])

    # Deep Learning quiz
    q_dl = generate_quiz(subject="Deep Learning", topic="Neural Networks", n_questions=3)
    assert q_dl["subject"] == "Deep Learning"
    assert len(q_dl["questions"]) == 3
    prompts_dl = " ".join(q["prompt"] for q in q_dl["questions"]).lower()
    assert any(term in prompts_dl for term in ["relu", "neuron", "activation", "transformer", "adam", "perceptron", "loss", "lstm"])

    # Machine Learning quiz
    q_ml = generate_quiz(subject="Machine Learning", topic="Decision Trees", n_questions=3)
    assert q_ml["subject"] == "Machine Learning"
    assert len(q_ml["questions"]) == 3


def test_backward_compatibility_chat_and_quiz_requests(client, auth_headers):
    """Verify clients omitting subject default cleanly to Machine Learning."""
    # Chat request without subject
    chat_res = client.post(
        "/api/chat",
        json={"message": "Hello tutor!"},
        headers=auth_headers,
    )
    assert chat_res.status_code == 200
    assert "answer" in chat_res.json()

    # Quiz request without subject
    quiz_res = client.post(
        "/api/tutor/quiz/generate",
        json={"topic": "Decision Trees", "n_questions": 3},
        headers=auth_headers,
    )
    assert quiz_res.status_code == 200
    assert quiz_res.json()["subject"] == "Machine Learning"
