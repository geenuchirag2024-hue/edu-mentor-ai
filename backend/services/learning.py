"""Personalized learning profile: topics, XP, streaks, adaptive difficulty."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from pathlib import Path
from threading import Lock

from backend.config import PROJECT_ROOT

logger = logging.getLogger(__name__)

PROFILE_PATH = PROJECT_ROOT / "data" / "learner_profiles.json"

TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "Machine Learning": ("machine learning", "supervised", "unsupervised", "ml model"),
    "Python": ("python", "pandas", "numpy", "list comprehension"),
    "Neural Networks": ("neural network", "backprop", "perceptron", "activation"),
    "Deep Learning": ("deep learning", "cnn", "rnn", "lstm", "transformer", "cnn"),
    "Decision Trees": ("decision tree", "entropy", "information gain", "id3", "gini"),
    "Gradient Descent": ("gradient descent", "optimizer", "learning rate", "sgd"),
    "Overfitting": ("overfitting", "underfitting", "regularization", "dropout"),
    "Evaluation": ("precision", "recall", "f1", "confusion matrix", "roc", "auc"),
    "Feature Engineering": ("feature engineering", "normalization", "one-hot", "scaling"),
}

XP_CORRECT = 10
XP_QUIZ_COMPLETE = 50
XP_DAILY = 20
XP_INTERVIEW = 80
XP_PER_LEVEL = 1000

BADGE_LABELS = {
    "first_quiz": "First Quiz",
    "streak_7": "7-Day Streak",
    "ml_master": "ML Master",
    "questions_100": "100 Questions",
    "interview_ready": "Interview Ready",
}


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def detect_topics(*texts: str) -> list[str]:
    blob = " ".join(t.lower() for t in texts if t)
    found: list[str] = []
    for topic, keywords in TOPIC_KEYWORDS.items():
        if any(k in blob for k in keywords):
            found.append(topic)
    return found or ["Machine Learning"]


def _empty_topic() -> dict:
    return {
        "correct": 0,
        "incorrect": 0,
        "studied": 0,
        "last_studied": None,
    }


class LearningStore:
    """JSON-backed learner profiles (works without PostgreSQL)."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._profiles: dict[str, dict] = {}
        self._load()

    def _load(self) -> None:
        if PROFILE_PATH.exists():
            try:
                self._profiles = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                logger.warning("Corrupt learner profile file — starting fresh")
                self._profiles = {}

    def _save(self) -> None:
        PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROFILE_PATH.write_text(
            json.dumps(self._profiles, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _blank(self, learner_id: str) -> dict:
        return {
            "learner_id": learner_id,
            "xp": 0,
            "level": 1,
            "streak_days": 0,
            "last_active_date": None,
            "difficulty": "medium",
            "consecutive_correct": 0,
            "consecutive_wrong": 0,
            "topics": {},
            "badges": [],
            "quizzes_completed": 0,
            "questions_answered": 0,
            "interviews_completed": 0,
            "interview_scores": [],
        }

    def _ensure_locked(self, learner_id: str) -> dict:
        if learner_id not in self._profiles:
            self._profiles[learner_id] = self._blank(learner_id)
        self._touch_locked(self._profiles[learner_id])
        return self._profiles[learner_id]

    def get_or_create(self, learner_id: str) -> dict:
        with self._lock:
            profile = self._ensure_locked(learner_id)
            self._save()
            return json.loads(json.dumps(profile))

    def _touch_locked(self, profile: dict) -> None:
        today = _utc_today()
        last = profile.get("last_active_date")
        if last == today:
            return
        if last:
            try:
                delta = date.fromisoformat(today) - date.fromisoformat(last)
                if delta.days == 1:
                    profile["streak_days"] = int(profile.get("streak_days") or 0) + 1
                elif delta.days > 1:
                    profile["streak_days"] = 1
            except ValueError:
                profile["streak_days"] = 1
        else:
            profile["streak_days"] = 1
        profile["last_active_date"] = today
        self._add_xp_locked(profile, XP_DAILY)
        self._refresh_badges_locked(profile)

    def _add_xp_locked(self, profile: dict, amount: int) -> None:
        profile["xp"] = int(profile.get("xp") or 0) + amount
        profile["level"] = 1 + profile["xp"] // XP_PER_LEVEL

    def _topic_locked(self, profile: dict, topic: str) -> dict:
        topics = profile.setdefault("topics", {})
        if topic not in topics:
            topics[topic] = _empty_topic()
        return topics[topic]

    def _refresh_badges_locked(self, profile: dict) -> None:
        badges: list[str] = list(profile.get("badges") or [])

        def earn(badge: str) -> None:
            if badge not in badges:
                badges.append(badge)

        if int(profile.get("quizzes_completed") or 0) >= 1:
            earn("first_quiz")
        if int(profile.get("streak_days") or 0) >= 7:
            earn("streak_7")
        if int(profile.get("questions_answered") or 0) >= 100:
            earn("questions_100")
        for stats in (profile.get("topics") or {}).values():
            total = int(stats.get("correct") or 0) + int(stats.get("incorrect") or 0)
            if total >= 10 and (stats["correct"] / total) >= 0.9:
                earn("ml_master")
                break
        scores = profile.get("interview_scores") or []
        if scores and (sum(scores) / len(scores)) >= 7:
            earn("interview_ready")
        if int(profile.get("interviews_completed") or 0) >= 1 and scores:
            if scores[-1] >= 7:
                earn("interview_ready")
        profile["badges"] = badges

    def record_study(self, learner_id: str, *texts: str) -> dict:
        topics = detect_topics(*texts)
        with self._lock:
            profile = self._ensure_locked(learner_id)
            for topic in topics:
                stats = self._topic_locked(profile, topic)
                stats["studied"] = int(stats.get("studied") or 0) + 1
                stats["last_studied"] = datetime.now(timezone.utc).isoformat()
            self._save()
            return json.loads(json.dumps(profile))

    def record_answers(
        self,
        learner_id: str,
        results: list[tuple[str, bool]],
        *,
        quiz_complete: bool = False,
    ) -> dict:
        with self._lock:
            profile = self._ensure_locked(learner_id)
            for topic, correct in results:
                stats = self._topic_locked(profile, topic)
                if correct:
                    stats["correct"] = int(stats.get("correct") or 0) + 1
                    profile["consecutive_correct"] = int(profile.get("consecutive_correct") or 0) + 1
                    profile["consecutive_wrong"] = 0
                    self._add_xp_locked(profile, XP_CORRECT)
                else:
                    stats["incorrect"] = int(stats.get("incorrect") or 0) + 1
                    profile["consecutive_wrong"] = int(profile.get("consecutive_wrong") or 0) + 1
                    profile["consecutive_correct"] = 0
                stats["last_studied"] = datetime.now(timezone.utc).isoformat()
                profile["questions_answered"] = int(profile.get("questions_answered") or 0) + 1
            if quiz_complete:
                profile["quizzes_completed"] = int(profile.get("quizzes_completed") or 0) + 1
                self._add_xp_locked(profile, XP_QUIZ_COMPLETE)
            self._adapt_difficulty_locked(profile)
            self._refresh_badges_locked(profile)
            self._save()
            return json.loads(json.dumps(profile))

    def record_interview(self, learner_id: str, score_out_of_10: float) -> dict:
        with self._lock:
            profile = self._ensure_locked(learner_id)
            profile["interviews_completed"] = int(profile.get("interviews_completed") or 0) + 1
            scores = list(profile.get("interview_scores") or [])
            scores.append(round(float(score_out_of_10), 1))
            profile["interview_scores"] = scores[-20:]
            self._add_xp_locked(profile, XP_INTERVIEW)
            self._refresh_badges_locked(profile)
            self._save()
            return json.loads(json.dumps(profile))

    def _adapt_difficulty_locked(self, profile: dict) -> None:
        order = ["easy", "medium", "hard"]
        current = profile.get("difficulty") or "medium"
        if current not in order:
            current = "medium"
        idx = order.index(current)
        if int(profile.get("consecutive_correct") or 0) >= 3:
            idx = min(idx + 1, len(order) - 1)
            profile["consecutive_correct"] = 0
        elif int(profile.get("consecutive_wrong") or 0) >= 3:
            idx = max(idx - 1, 0)
            profile["consecutive_wrong"] = 0
        profile["difficulty"] = order[idx]

    def dashboard(self, learner_id: str) -> dict:
        profile = self.get_or_create(learner_id)
        topic_rows = []
        for name, stats in (profile.get("topics") or {}).items():
            total = int(stats.get("correct") or 0) + int(stats.get("incorrect") or 0)
            accuracy = round((stats["correct"] / total) * 100, 1) if total else None
            # Blend quiz accuracy with study volume into a 0–100 mastery bar
            studied = int(stats.get("studied") or 0)
            if accuracy is None:
                mastery = min(100, studied * 8)
            else:
                mastery = round(0.75 * accuracy + 0.25 * min(100, studied * 10), 1)
            topic_rows.append(
                {
                    "name": name,
                    "correct": stats.get("correct", 0),
                    "incorrect": stats.get("incorrect", 0),
                    "studied": studied,
                    "accuracy": accuracy,
                    "mastery": mastery,
                    "last_studied": stats.get("last_studied"),
                }
            )
        topic_rows.sort(key=lambda r: r["mastery"], reverse=True)

        strong = next((t for t in topic_rows if (t["accuracy"] or 0) >= 80 and (t["correct"] + t["incorrect"]) >= 3), None)
        weak = sorted(
            [t for t in topic_rows if t["accuracy"] is not None],
            key=lambda t: t["accuracy"] or 100,
        )
        weak_topic = weak[0] if weak else None

        total_q = int(profile.get("questions_answered") or 0)
        total_correct = sum(int(t["correct"]) for t in topic_rows)
        overall_accuracy = round((total_correct / total_q) * 100, 1) if total_q else 0

        xp = int(profile.get("xp") or 0)
        level = int(profile.get("level") or 1)
        into_level = xp % XP_PER_LEVEL

        return {
            "learner_id": learner_id,
            "xp": xp,
            "level": level,
            "xp_into_level": into_level,
            "xp_per_level": XP_PER_LEVEL,
            "streak_days": int(profile.get("streak_days") or 0),
            "difficulty": profile.get("difficulty") or "medium",
            "questions_answered": total_q,
            "quizzes_completed": int(profile.get("quizzes_completed") or 0),
            "quiz_accuracy": overall_accuracy,
            "topics": topic_rows,
            "strongest_topic": strong["name"] if strong else (topic_rows[0]["name"] if topic_rows else None),
            "needs_improvement": weak_topic["name"] if weak_topic else None,
            "badges": [
                {"id": b, "label": BADGE_LABELS.get(b, b.replace("_", " ").title())}
                for b in profile.get("badges") or []
            ],
            "interviews_completed": int(profile.get("interviews_completed") or 0),
        }

    def coaching_context(self, learner_id: str | None) -> str:
        if not learner_id:
            return ""
        dash = self.dashboard(learner_id)
        weak = dash.get("needs_improvement")
        strong = dash.get("strongest_topic")
        difficulty = dash.get("difficulty")
        parts = [
            f"Student difficulty preference: {difficulty}.",
        ]
        if weak:
            parts.append(
                f"Weak topic: {weak}. Use simpler examples and check understanding."
            )
        if strong:
            parts.append(f"Strong topic: {strong}. You may go slightly deeper here.")
        return " ".join(parts)


learning_store = LearningStore()
