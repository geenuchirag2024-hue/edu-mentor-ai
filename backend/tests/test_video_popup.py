"""Tests for automatic related-video recommendation, registry, matcher, and HTTP 206 media streaming."""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.video_matcher import (
    load_video_registry,
    find_related_video,
    normalize_text,
    get_registered_video_by_id,
)
from backend.main import app


# ---------------------------------------------------------------------------
# 1. Video Registry & Matcher Unit Tests
# ---------------------------------------------------------------------------


def test_video_registry_loaded():
    """Video registry loads all 3 foundational educational videos."""
    videos = load_video_registry()
    assert len(videos) >= 3
    ids = {v["id"] for v in videos}
    assert "supervised-learning" in ids
    assert "unsupervised-learning" in ids
    assert "reinforcement-learning" in ids

    for v in videos:
        assert "title" in v
        assert "topic" in v
        assert "subject" in v
        assert "video_filename" in v
        assert "video_url" in v
        assert "thumbnail_url" in v
        assert "duration_seconds" in v
        assert v["duration_seconds"] > 0


def test_normalize_text():
    """Text normalization handles punctuation, hyphens, and casing."""
    assert normalize_text("Supervised-Learning!") == "supervised learning"
    assert normalize_text("What is AI/ML?") == "what is ai ml"


@pytest.mark.parametrize(
    "query,expected_id",
    [
        ("What is supervised learning?", "supervised-learning"),
        ("Explain supervised learning with labeled data and cats vs dogs", "supervised-learning"),
        ("What is regression and classification in machine learning?", "supervised-learning"),
        ("What is unsupervised learning?", "unsupervised-learning"),
        ("Tell me about clustering and finding natural groups without labels", "unsupervised-learning"),
        ("Can you explain reinforcement learning?", "reinforcement-learning"),
        ("How does a robot learn through trial and error with rewards in a maze?", "reinforcement-learning"),
    ],
)
def test_find_related_video_positive_matches(query, expected_id):
    """Related questions accurately trigger the corresponding registered educational video."""
    video = find_related_video(query, subject="Machine Learning")
    assert video is not None, f"Expected match for query: '{query}'"
    assert video["id"] == expected_id
    assert video["video_url"].startswith("/api/media/videos/")
    assert video["thumbnail_url"].startswith("/api/media/thumbnails/")


@pytest.mark.parametrize(
    "query",
    [
        ("What is the weather in Bangalore today?"),
        ("How do I make chocolate chip cookies?"),
        ("Can you solve a quadratic equation 2x^2 + 5x - 3 = 0?"),
        ("What is an SQL JOIN and index in DBMS?"),
        ("Who wrote the play Hamlet?"),
    ],
)
def test_find_related_video_unrelated_returns_none(query):
    """Unrelated questions never trigger a false-positive video popup."""
    video = find_related_video(query, subject="Machine Learning")
    assert video is None, f"Query '{query}' should not have matched any video"


def test_find_related_video_generic_words_filtered():
    """Questions containing only generic stop-words without distinctive topics return None."""
    generic_query = "Can you explain the model and data and concept for learning?"
    video = find_related_video(generic_query, subject="Machine Learning")
    assert video is None


def test_get_registered_video_by_id():
    """Lookup by ID retrieves the correct video record."""
    v = get_registered_video_by_id("supervised-learning")
    assert v is not None
    assert v["title"] == "Supervised Learning Explained"

    assert get_registered_video_by_id("nonexistent-video-xyz") is None


# ---------------------------------------------------------------------------
# 2. HTTP Media Streaming & Range Request Tests (/api/media/...)
# ---------------------------------------------------------------------------


def test_api_media_registry_endpoint(client: TestClient):
    """GET /api/media/registry returns list of active videos with safe URLs."""
    res = client.get("/api/media/registry")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 3
    ids = [item["id"] for item in data]
    assert "supervised-learning" in ids


def test_api_media_video_full_stream(client: TestClient):
    """GET /api/media/videos/{filename} without Range header returns full content."""
    res = client.get("/api/media/videos/supervised_learning.mp4")
    assert res.status_code == 200
    assert res.headers.get("accept-ranges") == "bytes"
    assert res.headers.get("content-type") == "video/mp4"
    assert int(res.headers.get("content-length", 0)) > 100000


def test_api_media_video_range_request(client: TestClient):
    """GET /api/media/videos/{filename} with Range header returns HTTP 206 Partial Content."""
    headers = {"Range": "bytes=0-1023"}
    res = client.get("/api/media/videos/supervised_learning.mp4", headers=headers)
    assert res.status_code == 206
    assert res.headers.get("content-type") == "video/mp4"
    assert res.headers.get("content-range", "").startswith("bytes 0-1023/")
    assert len(res.content) == 1024


def test_api_media_video_range_middle(client: TestClient):
    """Range requests from arbitrary offsets work smoothly for video seeking."""
    headers = {"Range": "bytes=5000-9999"}
    res = client.get("/api/media/videos/supervised_learning.mp4", headers=headers)
    assert res.status_code == 206
    assert res.headers.get("content-range", "").startswith("bytes 5000-9999/")
    assert len(res.content) == 5000


def test_api_media_video_range_unsatisfiable(client: TestClient):
    """Out-of-bounds byte ranges return HTTP 416 Range Not Satisfiable."""
    headers = {"Range": "bytes=999999999-999999999"}
    res = client.get("/api/media/videos/supervised_learning.mp4", headers=headers)
    assert res.status_code == 416


def test_api_media_video_not_found(client: TestClient):
    """Non-existent video file returns 404."""
    res = client.get("/api/media/videos/does_not_exist_xyz.mp4")
    assert res.status_code == 404


def test_api_media_video_path_traversal_blocked(client: TestClient):
    """Path traversal attacks are blocked with 400."""
    res = client.get("/api/media/videos/..%2Fmain.py")
    assert res.status_code in (400, 404)


def test_api_media_thumbnail_endpoint(client: TestClient):
    """GET /api/media/thumbnails/{filename} returns the poster image with correct content type."""
    res = client.get("/api/media/thumbnails/supervised_learning.jpg")
    assert res.status_code == 200
    assert res.headers.get("content-type") == "image/jpeg"
    assert len(res.content) > 1000


# ---------------------------------------------------------------------------
# 3. Chat Pipeline Integration Tests (/api/chat & related_video)
# ---------------------------------------------------------------------------


def test_chat_endpoint_includes_related_video(client: TestClient, auth_headers: dict):
    """When a chat question is asked about supervised learning, related_video is attached."""
    with patch(
        "backend.services.assistant_pipeline.query_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipe:
        mock_pipe.return_value = {
            "answer": "Supervised learning uses labeled training data to learn mapping functions.",
            "sources": [],
            "status": "ready",
            "model": "qwen2.5-3b-instruct",
            "cues": {"emotion": "explaining", "gesture": "open_hands"},
            "tutor_mode": "socratic",
            "hint_level": 0,
        }

        payload = {
            "message": "Can you explain supervised learning to me?",
            "subject": "Machine Learning",
            "tutor_mode": "socratic",
            "mentor_id": "mira",
        }
        res = client.post("/api/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert "related_video" in data
        assert data["related_video"] is not None
        assert data["related_video"]["id"] == "supervised-learning"
        assert data["related_video"]["video_url"] == "/api/media/videos/supervised_learning.mp4"


def test_chat_endpoint_no_video_for_unrelated(client: TestClient, auth_headers: dict):
    """When a chat question is unrelated to registered videos, related_video is None."""
    with patch(
        "backend.services.assistant_pipeline.query_pipeline",
        new_callable=AsyncMock,
    ) as mock_pipe:
        mock_pipe.return_value = {
            "answer": "Paris is the capital of France.",
            "sources": [],
            "status": "ready",
            "model": "qwen2.5-3b-instruct",
            "cues": {"emotion": "happy", "gesture": "neutral"},
            "tutor_mode": "socratic",
            "hint_level": 0,
        }

        payload = {
            "message": "What is the capital of France?",
            "subject": "Machine Learning",
            "tutor_mode": "socratic",
            "mentor_id": "mira",
        }
        res = client.post("/api/chat", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()
        assert data.get("related_video") is None

