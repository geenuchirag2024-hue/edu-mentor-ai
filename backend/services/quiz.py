"""AI quiz generation, evaluation, hints, and adaptive difficulty."""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

from backend.models.llm import get_llm
from backend.services.learning import detect_topics, learning_store

_QUIZ_SESSIONS: dict[str, dict[str, Any]] = {}


MOCK_BANK: dict[str, list[dict]] = {
    "decision trees": [
        {
            "type": "mcq",
            "prompt": "What does entropy measure in a decision tree?",
            "options": [
                "The depth of the tree",
                "Impurity or unpredictability of a set of labels",
                "The learning rate of the split",
                "The number of features used",
            ],
            "answer": "Impurity or unpredictability of a set of labels",
            "explanation": "Entropy is high when class labels are mixed and low when a node is pure.",
            "subtopic": "Entropy",
        },
        {
            "type": "mcq",
            "prompt": "Information gain is defined as:",
            "options": [
                "Entropy after the split minus entropy before",
                "Entropy before the split minus the weighted entropy after",
                "Gini index times the number of samples",
                "The height of the left subtree",
            ],
            "answer": "Entropy before the split minus the weighted entropy after",
            "explanation": "We choose the split that reduces uncertainty the most — that reduction is information gain.",
            "subtopic": "Information Gain",
        },
        {
            "type": "true_false",
            "prompt": "ID3 prefers features that maximize information gain.",
            "options": ["True", "False"],
            "answer": "True",
            "explanation": "ID3 greedily splits on the feature with the highest information gain.",
            "subtopic": "ID3",
        },
        {
            "type": "short",
            "prompt": "Name one reason a decision tree might overfit.",
            "options": [],
            "answer": "growing too deep / too many splits / no pruning",
            "explanation": "Very deep trees memorize training noise. Pruning, depth limits, or more data help.",
            "subtopic": "Overfitting",
        },
    ],
    "machine learning": [
        {
            "type": "mcq",
            "prompt": "What is the main goal of supervised learning?",
            "options": [
                "Find hidden clusters in unlabeled data",
                "Learn a mapping from inputs to known labels",
                "Maximize random exploration",
                "Compress images without labels",
            ],
            "answer": "Learn a mapping from inputs to known labels",
            "explanation": "Supervised models train on input–label pairs to predict labels for new inputs.",
            "subtopic": "Supervised Learning",
        },
        {
            "type": "mcq",
            "prompt": "Overfitting means the model:",
            "options": [
                "Performs well on new data but poorly on training data",
                "Fits training data too closely and generalizes poorly",
                "Has too few parameters",
                "Always uses regularization",
            ],
            "answer": "Fits training data too closely and generalizes poorly",
            "explanation": "Like memorizing exam answers instead of understanding the subject.",
            "subtopic": "Overfitting",
        },
        {
            "type": "true_false",
            "prompt": "Gradient descent updates parameters in the direction that increases the loss.",
            "options": ["True", "False"],
            "answer": "False",
            "explanation": "We move against the gradient so the loss decreases.",
            "subtopic": "Gradient Descent",
        },
        {
            "type": "short",
            "prompt": "Give one way to reduce overfitting.",
            "options": [],
            "answer": "more data / regularization / simpler model / dropout / cross-validation",
            "explanation": "More data, regularization, simpler models, or dropout all reduce overfitting.",
            "subtopic": "Regularization",
        },
    ],
    "neural networks": [
        {
            "type": "mcq",
            "prompt": "Backpropagation is used to:",
            "options": [
                "Initialize weights randomly",
                "Compute gradients of the loss with respect to weights",
                "Choose the learning rate",
                "Normalize input features",
            ],
            "answer": "Compute gradients of the loss with respect to weights",
            "explanation": "Backprop applies the chain rule so we can update every weight with gradient descent.",
            "subtopic": "Backpropagation",
        },
        {
            "type": "true_false",
            "prompt": "An activation function introduces non-linearity into a neural network.",
            "options": ["True", "False"],
            "answer": "True",
            "explanation": "Without non-linear activations, stacked layers collapse into one linear map.",
            "subtopic": "Activations",
        },
        {
            "type": "mcq",
            "prompt": "The vanishing gradient problem is most associated with:",
            "options": [
                "ReLU in the first layer only",
                "Saturated sigmoids/tanhs in deep networks",
                "Too much training data",
                "Using too large a batch size always",
            ],
            "answer": "Saturated sigmoids/tanhs in deep networks",
            "explanation": "Gradients shrink as they pass through saturated activations, stalling early-layer learning.",
            "subtopic": "Vanishing Gradients",
        },
        {
            "type": "short",
            "prompt": "What does a loss function measure?",
            "options": [],
            "answer": "how far predictions are from true labels / error",
            "explanation": "Loss quantifies prediction error so optimization knows what to minimize.",
            "subtopic": "Loss Functions",
        },
    ],
}


def _parse_json_payload(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("No JSON object in model output")
    return json.loads(cleaned[start : end + 1])


def _bank_questions(topic: str, n: int) -> list[dict]:
    key = topic.lower().strip()
    pool: list[dict] = []
    for name, qs in MOCK_BANK.items():
        if name in key or key in name:
            pool.extend(qs)
    if not pool:
        pool = MOCK_BANK["machine learning"]
    out = []
    for i, q in enumerate(pool[:n]):
        item = dict(q)
        item["id"] = f"q{i + 1}"
        out.append(item)
    while len(out) < n:
        extra = dict(pool[len(out) % len(pool)])
        extra["id"] = f"q{len(out) + 1}"
        out.append(extra)
    return out[:n]


def _normalize_questions(raw: list, n: int) -> list[dict]:
    questions = []
    for i, q in enumerate(raw[:n]):
        qtype = str(q.get("type") or "mcq").lower()
        if qtype not in {"mcq", "true_false", "short"}:
            qtype = "mcq"
        options = q.get("options") or []
        if qtype == "true_false" and not options:
            options = ["True", "False"]
        questions.append(
            {
                "id": str(q.get("id") or f"q{i + 1}"),
                "type": qtype,
                "prompt": str(q.get("prompt") or q.get("question") or "").strip(),
                "options": [str(o) for o in options],
                "answer": str(q.get("answer") or q.get("correct") or "").strip(),
                "explanation": str(q.get("explanation") or "").strip(),
                "subtopic": str(q.get("subtopic") or "General").strip(),
            }
        )
    return [q for q in questions if q["prompt"]]


def generate_quiz(
    *,
    subject: str = "Machine Learning",
    topic: str = "Machine Learning",
    difficulty: str | None = None,
    n_questions: int = 5,
    learner_id: str | None = None,
) -> dict:
    n_questions = max(3, min(int(n_questions), 12))
    if learner_id:
        profile = learning_store.get_or_create(learner_id)
        difficulty = difficulty or profile.get("difficulty") or "medium"
    difficulty = (difficulty or "medium").lower()
    if difficulty not in {"easy", "medium", "hard"}:
        difficulty = "medium"

    prompt = f"""Generate a {difficulty} quiz as JSON only (no markdown).
Subject: {subject}
Topic: {topic}
Number of questions: {n_questions}

Schema:
{{
  "questions": [
    {{
      "id": "q1",
      "type": "mcq",
      "prompt": "question text",
      "options": ["A", "B", "C", "D"],
      "answer": "the correct option text",
      "explanation": "one sentence",
      "subtopic": "short tag"
    }}
  ]
}}
Mix mcq, true_false, and one short answer. Keep language simple for students."""

    questions: list[dict] = []
    try:
        raw = get_llm().generate(
            [
                {
                    "role": "system",
                    "content": "You output valid JSON quizzes for an ML tutor. No extra commentary.",
                },
                {"role": "user", "content": prompt},
            ]
        )
        payload = _parse_json_payload(raw)
        questions = _normalize_questions(payload.get("questions") or [], n_questions)
    except Exception:
        questions = []

    if len(questions) < 3:
        questions = _bank_questions(topic, n_questions)
        for q in questions:
            q["id"] = q.get("id") or str(uuid.uuid4())[:8]

    quiz_id = str(uuid.uuid4())
    public_questions = [
        {k: v for k, v in q.items() if k not in {"answer", "explanation"}}
        for q in questions
    ]
    _QUIZ_SESSIONS[quiz_id] = {
        "quiz_id": quiz_id,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty,
        "learner_id": learner_id,
        "questions": questions,
        "hint_counts": {q["id"]: 0 for q in questions},
    }
    return {
        "quiz_id": quiz_id,
        "subject": subject,
        "topic": topic,
        "difficulty": difficulty,
        "questions": public_questions,
    }


def _answers_match(expected: str, given: str, qtype: str) -> bool:
    a = expected.strip().lower()
    b = given.strip().lower()
    if not b:
        return False
    if qtype == "true_false":
        truthy = {"true", "t", "yes", "1"}
        falsy = {"false", "f", "no", "0"}
        if a in truthy:
            return b in truthy
        if a in falsy:
            return b in falsy
    if a == b:
        return True
    if a in b or b in a:
        return len(b) >= 3
    # short answers: any keyword overlap
    a_parts = {p for p in re.split(r"[/,]| or ", a) if p.strip()}
    return any(p.strip() in b for p in a_parts if len(p.strip()) > 2)


def grade_quiz(quiz_id: str, answers: dict[str, str], learner_id: str | None = None) -> dict:
    session = _QUIZ_SESSIONS.get(quiz_id)
    if not session:
        raise KeyError("Unknown quiz_id")

    details = []
    correct_n = 0
    weak: dict[str, int] = {}
    results: list[tuple[str, bool]] = []
    topic = session["topic"]

    for q in session["questions"]:
        given = answers.get(q["id"], "")
        ok = _answers_match(q["answer"], given, q["type"])
        if ok:
            correct_n += 1
        else:
            weak[q["subtopic"]] = weak.get(q["subtopic"], 0) + 1
        results.append((q.get("subtopic") or topic, ok))
        details.append(
            {
                "id": q["id"],
                "prompt": q["prompt"],
                "type": q["type"],
                "given": given,
                "correct_answer": q["answer"],
                "is_correct": ok,
                "explanation": q["explanation"],
                "subtopic": q["subtopic"],
            }
        )

    total = len(session["questions"]) or 1
    accuracy = round(100 * correct_n / total, 1)
    weak_areas = [k for k, _ in sorted(weak.items(), key=lambda kv: -kv[1])]

    lid = learner_id or session.get("learner_id")
    mascot_line = (
        f"Good job! You scored {correct_n}/{total}. Let's review {weak_areas[0]} next."
        if weak_areas
        else f"Excellent! {correct_n}/{total} — you really understand {topic}."
    )
    if lid:
        tagged = [(detect_topics(topic, sub)[0], ok) for sub, ok in results]
        learning_store.record_answers(lid, tagged, quiz_complete=True)

    return {
        "quiz_id": quiz_id,
        "score": correct_n,
        "total": total,
        "accuracy": accuracy,
        "weak_areas": weak_areas,
        "details": details,
        "mascot_message": mascot_line,
        "emotion": "happy" if accuracy >= 70 else "sad",
        "gesture": "celebrate" if accuracy >= 70 else "nod",
        "difficulty": session["difficulty"],
    }


def quiz_hint(quiz_id: str, question_id: str) -> dict:
    session = _QUIZ_SESSIONS.get(quiz_id)
    if not session:
        raise KeyError("Unknown quiz_id")
    question = next((q for q in session["questions"] if q["id"] == question_id), None)
    if not question:
        raise KeyError("Unknown question_id")

    counts: dict[str, int] = session["hint_counts"]
    counts[question_id] = int(counts.get(question_id) or 0) + 1
    level = min(counts[question_id], 3)

    if level >= 3:
        hint = f"Solution: {question['answer']}. {question['explanation']}"
        reveal = True
    elif level == 2:
        hint = f"Think about {question['subtopic']}. {question['explanation'][:80]}..."
        reveal = False
    else:
        hint = f"Hint: focus on the idea of {question['subtopic']} before picking an option."
        reveal = False

    try:
        if level < 3:
            raw = get_llm().generate(
                [
                    {
                        "role": "system",
                        "content": "Give a short student hint. Do not reveal the exact answer.",
                    },
                    {
                        "role": "user",
                        "content": f"Question: {question['prompt']}\nHint level {level}. One or two sentences.",
                    },
                ]
            )
            if raw.strip():
                hint = raw.strip()
    except Exception:
        pass

    return {
        "question_id": question_id,
        "hint_level": level,
        "hint": hint,
        "revealed": reveal,
        "emotion": "thinking",
        "gesture": "point",
    }
