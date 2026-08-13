from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_transcribe_empty_audio():
    with patch("backend.api.routes.voice.get_stt") as mock_stt:
        mock_stt.return_value.transcribe.return_value = ""
        response = client.post(
            "/api/voice/transcribe",
            files={"audio": ("test.webm", b"", "audio/webm")},
        )
    assert response.status_code == 200
    assert response.json()["text"] == ""


def test_synthesize():
    with patch("backend.api.routes.voice.get_tts") as mock_tts:
        mock_tts.return_value.synthesize.return_value = b"fake-audio"
        response = client.post(
            "/api/voice/synthesize",
            json={"text": "Hello"},
        )
    assert response.status_code == 200
    assert "audio_base64" in response.json()


def test_voice_query_no_speech():
    with patch("backend.api.routes.voice.process_voice_query") as mock_process:
        mock_process.return_value = {
            "transcript": "",
            "answer": "I didn't catch that.",
            "audio_base64": "dGVzdA==",
            "session_id": "test-session",
            "sources": [],
        }
        response = client.post(
            "/api/assistant/voice-query",
            files={"audio": ("test.webm", b"silence", "audio/webm")},
        )
    assert response.status_code == 200
    assert "answer" in response.json()
