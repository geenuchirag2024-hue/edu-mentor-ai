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


def test_process_voice_query_success():
    with (
        patch("backend.services.assistant_pipeline.get_stt") as mock_stt,
        patch("backend.services.assistant_pipeline.get_tts") as mock_tts,
        patch("backend.services.assistant_pipeline.process_text_query") as mock_text,
    ):
        mock_stt.return_value.transcribe.return_value = "What is machine learning?"
        mock_text.return_value = {
            "answer": "Machine learning is a field of AI.",
            "session_id": "test-session",
            "sources": [],
            "emotion": "confident",
            "gesture": "explain",
            "response_type": "explanation",
        }
        mock_tts.return_value.synthesize.return_value = b"fake-audio"

        result = process_voice_query(b"valid-audio-bytes", filename="recording.webm")

    assert result["transcript"] == "What is machine learning?"
    assert result["answer"] == "Machine learning is a field of AI."
    assert "audio_base64" in result
    mock_stt.return_value.transcribe.assert_called_once_with(
        b"valid-audio-bytes", filename="recording.webm"
    )
