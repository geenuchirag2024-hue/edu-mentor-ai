from unittest.mock import patch

from backend.services.assistant_pipeline import process_text_query, process_voice_query


def test_process_text_query():
    with patch("backend.services.assistant_pipeline.get_vector_store") as mock_store, \
         patch("backend.services.assistant_pipeline.get_llm") as mock_llm:
        mock_store.return_value.is_available = False
        mock_llm.return_value.generate.return_value = "Mocked answer on ML"
        result = process_text_query("What is machine learning?")
    assert "answer" in result
    assert "session_id" in result
    assert result["answer"] == "Mocked answer on ML"


def test_process_voice_query_empty():
    with patch("backend.services.assistant_pipeline.get_stt") as mock_stt, \
         patch("backend.services.assistant_pipeline.get_tts") as mock_tts:
        mock_stt.return_value.transcribe_with_info.return_value = {"text": "", "status": "empty_audio"}
        mock_tts.return_value.synthesize.return_value = b"silent"
        result = process_voice_query(b"")
    assert "I didn't catch that" in result["answer"]
    assert result["transcript"] == ""


def test_process_voice_query_success():
    with (
        patch("backend.services.assistant_pipeline.get_stt") as mock_stt,
        patch("backend.services.assistant_pipeline.get_tts") as mock_tts,
        patch("backend.services.assistant_pipeline.process_text_query") as mock_text,
    ):
        mock_stt.return_value.transcribe_with_info.return_value = {
            "text": "What is machine learning?",
            "language": "en",
            "detected_language": "en",
            "language_probability": 0.99,
            "status": "success",
        }
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
