"""Technical interview mode: ask, evaluate, follow up."""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

from backend.models.llm import get_llm
from backend.services.learning import learning_store
from backend.services.mascot_cues import infer_mascot_cues

_INTERVIEWS: dict[str, dict[str, Any]] = {}

MOCK_QUESTIONS = [
    {
        "prompt": "What is a REST API, and what does each of GET, POST, PUT, and DELETE typically mean?",
        "rubric": "Should mention resources, HTTP verbs, and stateless client-server communication.",
        "topic": "REST API",
    },
    {
        "prompt": "Explain overfitting and one technique you would use to detect it.",
        "rubric": "Training vs test gap; hold-out set, cross-validation, or learning curves.",
        "topic": "Overfitting",
    },
    {
        "prompt": "What is the bias-variance tradeoff?",
        "rubric": "Bias as underfitting, variance as sensitivity to data; tradeoff with model complexity.",
        "topic": "Bias-Variance",
    },
    {
        "prompt": "How does gradient descent update model parameters?",
        "rubric": "Compute gradient of loss, step opposite the gradient, learning rate.",
        "topic": "Gradient Descent",
    },
    {
        "prompt": "Tell me the difference between supervised and unsupervised learning, with one example of each.",
        "rubric": "Labeled vs unlabeled; classification/regression vs clustering/dimensionality reduction.",
        "topic": "Learning Types",
    },
]


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no json")
    return json.loads(cleaned[start : end + 1])


def start_interview(
    *,
    topic: str = "Machine Learning",
    learner_id: str | None = None,
    n_questions: int = 5,
) -> dict:
    n_questions = max(3, min(int(n_questions), 8))
    interview_id = str(uuid.uuid4())
    first = MOCK_QUESTIONS[0]
    try:
        raw = get_llm().generate(
            [
                {
                    "role": "system",
                    "content": "You are a technical interviewer. Output JSON only.",
                },
                {
                    "role": "user",
                    "content": (
                        f"Ask the first interview question on {topic} for a student. "
                        'JSON: {"prompt": "...", "rubric": "what a good answer includes"}'
                    ),
                },
            ]
        )
        parsed = _parse_json(raw)
        if parsed.get("prompt"):
            first = {
                "prompt": parsed["prompt"],
                "rubric": parsed.get("rubric") or "Clear, correct, with an example.",
                "topic": topic,
            }
    except Exception:
        pass

    _INTERVIEWS[interview_id] = {
        "interview_id": interview_id,
        "topic": topic,
        "learner_id": learner_id,
        "n_questions": n_questions,
        "index": 0,
        "turns": [],
        "current": first,
        "finished": False,
        "_recorded": False,
    }
    cues = infer_mascot_cues(first["prompt"], tutor_mode="interviewer")
    return {
        "interview_id": interview_id,
        "topic": topic,
        "question_number": 1,
        "total": n_questions,
        "prompt": first["prompt"],
        "finished": False,
        **cues,
    }


def _heuristic_score(answer: str, rubric: str) -> tuple[float, str]:
    words = answer.split()
    if len(words) < 8:
        return 4.0, "Try to explain the idea in a few complete sentences, then add an example."
    hits = sum(1 for w in rubric.lower().split() if w in answer.lower())
    score = min(9.5, 5 + hits * 0.4 + min(2, len(words) / 40))
    feedback = (
        "Solid structure. Add a short example to make the answer interview-ready."
        if score < 8
        else "Clear and complete — that would land well in an interview."
    )
    return round(score, 1), feedback


def answer_interview(interview_id: str, answer: str) -> dict:
    session = _INTERVIEWS.get(interview_id)
    if not session:
        raise KeyError("Unknown interview_id")
    if session["finished"]:
        return summary(interview_id)

    current = session["current"]
    score, feedback = _heuristic_score(answer, current.get("rubric") or "")
    strengths: list[str] = []
    improvements: list[str] = []

    try:
        raw = get_llm().generate(
            [
                {
                    "role": "system",
                    "content": (
                        "Evaluate a technical interview answer. JSON only: "
                        '{"score": 0-10, "feedback": "...", "strengths": [], "improvements": []}'
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question: {current['prompt']}\nRubric: {current.get('rubric')}\n"
                        f"Student answer: {answer}"
                    ),
                },
            ]
        )
        parsed = _parse_json(raw)
        score = float(parsed.get("score", score))
        feedback = str(parsed.get("feedback") or feedback)
        strengths = [str(s) for s in (parsed.get("strengths") or [])][:3]
        improvements = [str(s) for s in (parsed.get("improvements") or [])][:3]
    except Exception:
        pass

    session["turns"].append(
        {
            "prompt": current["prompt"],
            "answer": answer,
            "score": score,
            "feedback": feedback,
            "topic": current.get("topic"),
        }
    )
    session["index"] += 1
    finished = session["index"] >= session["n_questions"]
    session["finished"] = finished

    next_prompt = None
    if not finished:
        nxt = MOCK_QUESTIONS[session["index"] % len(MOCK_QUESTIONS)]
        try:
            raw = get_llm().generate(
                [
                    {
                        "role": "system",
                        "content": 'Ask one follow-up interview question. JSON: {"prompt": "...", "rubric": "..."}',
                    },
                    {
                        "role": "user",
                        "content": (
                            f"Topic: {session['topic']}. Previous question: {current['prompt']}. "
                            "Ask a different follow-up."
                        ),
                    },
                ]
            )
            parsed = _parse_json(raw)
            if parsed.get("prompt"):
                nxt = {
                    "prompt": parsed["prompt"],
                    "rubric": parsed.get("rubric") or nxt["rubric"],
                    "topic": session["topic"],
                }
        except Exception:
            pass
        session["current"] = nxt
        next_prompt = nxt["prompt"]

    cues = infer_mascot_cues(
        feedback,
        tutor_mode="interviewer",
        correct=score >= 7,
    )
    payload = {
        "interview_id": interview_id,
        "question_number": session["index"],
        "total": session["n_questions"],
        "score": score,
        "feedback": feedback,
        "strengths": strengths,
        "improvements": improvements,
        "finished": finished,
        "next_prompt": next_prompt,
        **cues,
    }
    if finished:
        payload.update(summary(interview_id))
        payload["finished"] = True
    return payload


def summary(interview_id: str) -> dict:
    session = _INTERVIEWS.get(interview_id)
    if not session:
        raise KeyError("Unknown interview_id")
    turns = session["turns"]
    avg = round(sum(t["score"] for t in turns) / len(turns), 1) if turns else 0.0
    lid = session.get("learner_id")
    if lid and session["finished"] and not session.get("_recorded"):
        learning_store.record_interview(lid, avg)
        session["_recorded"] = True

    mascot = (
        f"Interview complete. Average score {avg}/10. "
        + (
            "You are close to interview-ready — polish examples."
            if avg < 8
            else "Strong performance. Nice work!"
        )
    )
    return {
        "interview_id": interview_id,
        "finished": True,
        "average_score": avg,
        "turns": turns,
        "mascot_message": mascot,
        "emotion": "happy" if avg >= 7 else "thinking",
        "gesture": "celebrate" if avg >= 7 else "nod",
    }
