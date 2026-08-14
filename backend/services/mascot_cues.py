"""Infer mascot emotion / gesture from tutor mode and reply text."""

from __future__ import annotations

from typing import Literal

Emotion = Literal[
    "neutral", "happy", "thinking", "surprised", "sad", "confident", "greeting"
]
Gesture = Literal[
    "none", "point", "nod", "shake", "raise_hand", "celebrate", "wave"
]
ResponseType = Literal[
    "explanation", "encouragement", "question", "hint", "evaluation", "greeting"
]


def infer_mascot_cues(
    answer: str,
    *,
    tutor_mode: str = "teacher",
    user_message: str = "",
    correct: bool | None = None,
    hint_level: int = 0,
) -> dict[str, str]:
    text = (answer or "").lower()
    user = (user_message or "").lower().strip()

    if user in {"hi", "hello", "hey", "hiya"} or text.startswith(("hi", "hello", "hey")):
        if len(user.split()) <= 3:
            return {
                "emotion": "greeting",
                "gesture": "wave",
                "response_type": "greeting",
            }

    if correct is True:
        return {
            "emotion": "happy",
            "gesture": "celebrate",
            "response_type": "encouragement",
        }
    if correct is False:
        return {
            "emotion": "sad",
            "gesture": "shake",
            "response_type": "encouragement",
        }

    if hint_level > 0:
        return {
            "emotion": "thinking",
            "gesture": "point",
            "response_type": "hint",
        }

    if tutor_mode == "quiz_master":
        if "?" in answer:
            return {
                "emotion": "confident",
                "gesture": "raise_hand",
                "response_type": "question",
            }
        return {
            "emotion": "confident",
            "gesture": "nod",
            "response_type": "evaluation",
        }

    if tutor_mode == "interviewer":
        return {
            "emotion": "confident",
            "gesture": "nod",
            "response_type": "evaluation" if "score" in text else "question",
        }

    if any(w in text for w in ("great", "excellent", "exactly", "well done", "correct")):
        return {
            "emotion": "happy",
            "gesture": "nod",
            "response_type": "encouragement",
        }
    if any(w in text for w in ("don't worry", "no problem", "let's break", "almost")):
        return {
            "emotion": "sad",
            "gesture": "nod",
            "response_type": "encouragement",
        }
    if "?" in answer and tutor_mode in {"teacher", "doubt_solver"}:
        return {
            "emotion": "thinking",
            "gesture": "raise_hand",
            "response_type": "question",
        }

    return {
        "emotion": "confident",
        "gesture": "point",
        "response_type": "explanation",
    }
