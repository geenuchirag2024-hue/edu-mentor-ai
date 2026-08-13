from unittest.mock import patch

from backend.services.assistant_pipeline import process_text_query, process_voice_query


def test_process_text_query():
    with patch("backend.services.assistant_pipeline.get_vector_store") as mock_store:
        mock_store.return_value.is_available = False
        result = process_text_query("What is machine learning?")
    assert "answer" in result
    assert "session_id" in result


def test_process_voice_query_empty():
    with patch("backend.services.assistant_pipeline.get_stt") as mock_stt:
        mock_stt.return_value.transcribe.return_value = ""
        result = process_voice_query(b"")
    assert "I didn't catch that" in result["answer"]
    assert result["transcript"] == ""
