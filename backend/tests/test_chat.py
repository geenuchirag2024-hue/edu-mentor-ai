from unittest.mock import patch

from fastapi.testclient import TestClient


def test_health(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_chat_endpoint_unauthorized(client: TestClient):
    response = client.post(
        "/api/chat",
        json={"message": "What is overfitting?"},
    )
    assert response.status_code == 401


def test_chat_endpoint_authenticated(client: TestClient, auth_headers: dict):
    with patch("backend.services.assistant_pipeline.get_vector_store") as mock_store:
        mock_store.return_value.is_available = False
        response = client.post(
            "/api/chat",
            json={"message": "What is overfitting?"},
            headers=auth_headers,
        )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "session_id" in data
    assert len(data["answer"]) > 0


def test_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
