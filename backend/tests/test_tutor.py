from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.main import app
from backend.services.learning import learning_store
from backend.services.quiz import generate_quiz, grade_quiz

from backend.services.mascot_cues import infer_mascot_cues

client = TestClient(app)


def test_mascot_cues_greeting():
    cues = infer_mascot_cues("Hello! What shall we learn?", user_message="hi")
    assert cues["emotion"] == "greeting"
    assert cues["gesture"] == "wave"


def test_quiz_generate_and_grade():
    with patch("backend.services.quiz.get_llm") as mock_llm:
        mock_llm.return_value.generate.side_effect = RuntimeError("use bank")
        quiz = generate_quiz(
            topic="Decision Trees", n_questions=4, learner_id="test-learner"
        )
    assert quiz["quiz_id"]
    assert len(quiz["questions"]) >= 3
    answers = {q["id"]: "placeholder" for q in quiz["questions"]}
    result = grade_quiz(quiz["quiz_id"], answers, learner_id="test-learner")
    assert result["total"] == len(quiz["questions"])
    assert "accuracy" in result
    assert "mascot_message" in result


def test_progress_endpoint():
    learning_store.get_or_create("dash-user")
    response = client.get("/api/tutor/progress", params={"learner_id": "dash-user"})
    assert response.status_code == 200
    data = response.json()
    assert data["level"] >= 1
    assert "streak_days" in data
    assert "xp" in data


def test_quiz_api_generate():
    with patch("backend.api.routes.tutor.generate_quiz") as mock_gen:
        mock_gen.return_value = {
            "quiz_id": "q-test",
            "subject": "Machine Learning",
            "topic": "Machine Learning",
            "difficulty": "medium",
            "questions": [
                {
                    "id": "q1",
                    "type": "mcq",
                    "prompt": "What is overfitting?",
                    "options": ["A", "B"],
                    "subtopic": "Overfitting",
                }
            ],
        }
        response = client.post(
            "/api/tutor/quiz/generate",
            json={
                "topic": "Machine Learning",
                "n_questions": 4,
                "learner_id": "api-user",
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["quiz_id"]
    assert len(body["questions"]) >= 1
    assert all("answer" not in q for q in body["questions"])


def test_interview_start():
    with patch("backend.api.routes.tutor.start_interview") as mock_start:
        mock_start.return_value = {
            "interview_id": "iv-1",
            "topic": "Machine Learning",
            "question_number": 1,
            "total": 3,
            "prompt": "What is REST?",
            "finished": False,
            "emotion": "confident",
            "gesture": "raise_hand",
            "response_type": "question",
        }
        response = client.post(
            "/api/tutor/interview/start",
            json={
                "topic": "Machine Learning",
                "n_questions": 3,
                "learner_id": "iv-user",
            },
        )
    assert response.status_code == 200
    data = response.json()
    assert data["prompt"]
    assert data["interview_id"]

    with patch("backend.api.routes.tutor.answer_interview") as mock_ans:
        mock_ans.return_value = {
            "interview_id": data["interview_id"],
            "question_number": 1,
            "total": 3,
            "score": 8,
            "feedback": "Good.",
            "strengths": [],
            "improvements": [],
            "finished": False,
            "next_prompt": "What is overfitting?",
            "emotion": "happy",
            "gesture": "nod",
            "response_type": "evaluation",
        }
        second = client.post(
            "/api/tutor/interview/answer",
            json={
                "interview_id": data["interview_id"],
                "answer": "REST is a stateless style using HTTP verbs on resources.",
            },
        )
    assert second.status_code == 200
    assert "score" in second.json()


def test_notes_upload_and_ask():
    with patch("backend.rag.embeddings.get_embeddings") as mock_emb:
        mock_emb.side_effect = RuntimeError("no embeddings in tests")
        files = {
            "file": (
                "notes.txt",
                b"ID3 builds decision trees using information gain and entropy.",
                "text/plain",
            )
        }
        upload = client.post("/api/tutor/notes/upload", files=files)
        assert upload.status_code == 200
        sid = upload.json()["session_id"]

        with patch("backend.api.routes.tutor.get_llm") as mock_llm:
            mock_llm.return_value.generate.return_value = (
                "ID3 uses information gain to choose splits."
            )
            ask = client.post(
                "/api/tutor/notes/ask",
                json={"session_id": sid, "question": "Explain ID3 from my notes."},
            )
        assert ask.status_code == 200
        assert "answer" in ask.json()
