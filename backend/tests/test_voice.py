from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


def test_transcribe_unauthorized(client: TestClient):
    response = client.post(
        "/api/voice/transcribe",
        files={"audio": ("test.webm", b"", "audio/webm")},
    )
    assert response.status_code == 401


def test_transcribe_empty_audio(client: TestClient, auth_headers: dict):
    with patch("backend.api.routes.voice.get_stt") as mock_stt:
        mock_stt.return_value.transcribe.return_value = ""
        response = client.post(
            "/api/voice/transcribe",
            files={"audio": ("test.webm", b"", "audio/webm")},
            headers=auth_headers,
        )
    assert response.status_code == 200
    assert response.json()["text"] == ""


def test_synthesize(client: TestClient, auth_headers: dict):
    with patch("backend.api.routes.voice.get_tts") as mock_tts:
        mock_tts.return_value.synthesize.return_value = b"fake-audio"
        response = client.post(
            "/api/voice/synthesize",
            json={"text": "Hello"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    assert "audio_base64" in response.json()


def test_voice_query_no_speech(client: TestClient, auth_headers: dict):
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
            headers=auth_headers,
        )
    assert response.status_code == 200
    assert "answer" in response.json()
    assert response.json()["transcript"] == ""


def test_voice_query_success(client: TestClient, auth_headers: dict):
    with patch("backend.api.routes.voice.process_voice_query") as mock_process:
        mock_process.return_value = {
            "transcript": "What is machine learning?",
            "answer": "Machine learning is a field of computer science.",
            "audio_base64": "dGVzdA==",
            "session_id": "test-session",
            "sources": [],
            "emotion": "confident",
            "gesture": "explain",
            "response_type": "explanation",
        }
        response = client.post(
            "/api/assistant/voice-query",
            files={"audio": ("recording.webm", b"speech-data", "audio/webm")},
            data={"session_id": "test-session", "tutor_mode": "teacher"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert data["transcript"] == "What is machine learning?"
    assert "Machine learning is a field" in data["answer"]


def test_stt_transcribe_empty_and_invalid():
    from backend.voice.stt import get_stt

    stt = get_stt()
    # Empty audio bytes should return empty transcript safely
    assert stt.transcribe(b"") == ""
    # Invalid audio bytes should return empty transcript safely without crashing
    assert stt.transcribe(b"not-a-valid-audio-stream", filename="corrupt.wav") == ""


def test_stt_transcribe_valid_audio():
    from backend.voice.stt import get_stt

    stt = get_stt()
    with patch.object(stt, "_transcribe_file", return_value="What is machine learning?"):
        result = stt.transcribe(b"RIFFdummydata", filename="recording.wav")
    assert result == "What is machine learning?"
