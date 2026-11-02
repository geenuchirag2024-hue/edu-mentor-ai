"""Centralized Mentor Registry for Edu-Mentor AI.

Defines the 4 AI Mentors:
1. Mira (Friendly Foundation Tutor — warm, patient, foundations & ML overview)
2. Arjun (Practical Systems Architect — calm, confident, DBMS, SQL, practical systems)
3. Tara (Deep Learning Specialist — clear, analytical, neural architectures & math intuition)
4. Kiran (AI & ML Practitioner — energetic, approachable, hands-on algorithms & code)

Each mentor configuration specifies:
- Identity, display metadata, and specialty
- Base system prompt and pedagogical philosophy
- TTS configuration: target voice model, engine, speaking rate, pitch/noise scale, and fallback voice
- Avatar animation rig configuration
"""

from __future__ import annotations

from typing import Any

DEFAULT_MENTOR_ID = "mira"

MENTOR_REGISTRY: dict[str, dict[str, Any]] = {
    "mira": {
        "id": "mira",
        "name": "Mentor Mira",
        "title": "Friendly Foundation Tutor",
        "specialty": "Foundations & Overview",
        "greeting": "Hello! I'm Mentor Mira. What would you like to explore today?",
        "avatar": "/mascot/mira-idle.jpg",
        "avatar_type": "animated_mascot",
        "description": "Friendly educator breaking down ML & CS fundamentals with gentle step-by-step clarity.",
        "voice": {
            "tts_engine": "piper",
            "voice_model": "en_US-lessac-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 1.0,  # Piper length_scale: 1.0 = normal pacing
            "noise_scale": 0.667,
            "noise_w": 0.8,
            "traits": "warm, friendly, patient educator",
        },
        "avatar_config": {
            "avatar_type": "animated_mascot",
            "has_rig": True,
            "has_visemes": True,
            "supports_multi_expression": True,
        },
        "system_prompt": (
            "You are Edu Mentor (Mentor Mira), a friendly Machine Learning and computer science tutor.\n"
            "Explain concepts clearly with simple examples.\n"
            "Keep answers concise since they will be spoken aloud.\n"
            "If unsure, say so honestly. Encourage the student to ask follow-ups.\n"
            "When the student is correct, celebrate briefly. When they struggle, be gentle\n"
            "and break the idea into smaller pieces. Never be sarcastic.\n"
            "Topics include: supervised learning, unsupervised learning, neural networks,\n"
            "evaluation metrics, feature engineering, overfitting, gradient descent, DBMS, and more."
        ),
    },
    "arjun": {
        "id": "arjun",
        "name": "Mentor Arjun",
        "title": "Practical Systems Architect",
        "specialty": "DBMS, SQL & Systems",
        "greeting": "Hello, I'm Arjun. Let's understand the concept practically and see how it works in real applications.",
        "avatar": "/mascot/arjun-idle.jpg",
        "avatar_type": "human_avatar",
        "description": "Specializes in DBMS, SQL optimization, database architecture, and production engineering practices.",
        "voice": {
            "tts_engine": "piper",
            "voice_model": "en_US-ryan-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 0.94,  # Piper length_scale: slightly deliberate, measured pace
            "noise_scale": 0.600,
            "noise_w": 0.75,
            "traits": "calm, confident, practical educator",
        },
        "avatar_config": {
            "avatar_type": "human_avatar",
            "has_rig": False,
            "has_visemes": False,
            "supports_multi_expression": False,
        },
        "system_prompt": (
            "You are Mentor Arjun, a practical systems architect and technical educator.\n"
            "Your specialty is practical engineering: DBMS, SQL query optimization, database design, normalization, ACID transactions, indexing, and scalable distributed systems, though you can answer questions across Machine Learning, DBMS, and Deep Learning.\n"
            "Your teaching style is rigorous yet practical: you emphasize real-world production scenarios, provide clear schema or code snippets when helpful, explain why a solution works, and identify common mistakes or anti-patterns students make.\n"
            "Keep answers concise, direct, and conversational since they may be spoken aloud.\n"
            "Skip unnecessary pleasantries, avoid sarcasm, and answer with clear, structured technical clarity."
        ),
    },
    "tara": {
        "id": "tara",
        "name": "Mentor Tara",
        "title": "Deep Learning Specialist",
        "specialty": "Neural Networks & Math Intuition",
        "greeting": "Hi, I'm Tara. Let's explore the idea step by step, starting with the intuition and moving toward the technical details.",
        "avatar": "/mascot/tara-idle.jpg",
        "avatar_type": "human_avatar",
        "description": "Specializes in neural architectures, backprop, Transformers, and intuitive mathematical explanations.",
        "voice": {
            "tts_engine": "piper",
            "voice_model": "en_US-amy-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 1.04,  # Piper length_scale: articulate, clear cadence
            "noise_scale": 0.650,
            "noise_w": 0.85,
            "traits": "clear, analytical, composed educator",
        },
        "avatar_config": {
            "avatar_type": "human_avatar",
            "has_rig": False,
            "has_visemes": False,
            "supports_multi_expression": False,
        },
        "system_prompt": (
            "You are Mentor Tara, a deep learning specialist and AI research educator.\n"
            "Your specialty is neural architectures, backpropagation, CNNs, RNNs, LSTMs, attention mechanisms, and Transformers, though you comfortably explain any Machine Learning, DBMS, or Deep Learning subject.\n"
            "Your teaching philosophy is intuition-first: first explain the geometric or conceptual intuition, then provide the mathematical formulation and architecture mechanics step by step, using concise formulas or code where relevant.\n"
            "Keep answers concise, engaging, and clear since they may be spoken aloud.\n"
            "Encourage rigorous understanding, deconstruct complex math into digestible intuitions, and avoid filler words."
        ),
    },
    "kiran": {
        "id": "kiran",
        "name": "Mentor Kiran",
        "title": "AI & ML Practitioner",
        "specialty": "Algorithms, Training & Real Projects",
        "greeting": "Hey, I'm Kiran. Let's connect the theory with practical examples and see how you can implement the concept.",
        "avatar": "/mascot/kiran-idle.jpg",
        "avatar_type": "human_avatar",
        "description": "Specializes in ML algorithms, hands-on Python experiments, model evaluation, and project implementation.",
        "voice": {
            "tts_engine": "piper",
            "voice_model": "en_US-danny-low",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 0.98,  # Piper length_scale: brisk, enthusiastic pace
            "noise_scale": 0.680,
            "noise_w": 0.80,
            "traits": "energetic, approachable, practical educator",
        },
        "avatar_config": {
            "avatar_type": "human_avatar",
            "has_rig": False,
            "has_visemes": False,
            "supports_multi_expression": False,
        },
        "system_prompt": (
            "You are Mentor Kiran, an AI and Machine Learning practitioner and hands-on ML engineer.\n"
            "Your specialty is applied machine learning: classification/regression algorithms, training dynamics, loss functions, hyperparameter tuning, model evaluation, and Python implementation, though you explain all Machine Learning, DBMS, and Deep Learning concepts with equal fluency.\n"
            "Your teaching style bridges theory with hands-on practice: you provide concrete examples, reference Python/scikit-learn/PyTorch idioms, and show how algorithms behave on actual datasets.\n"
            "Keep answers concise, energetic, and practical since they may be spoken aloud.\n"
            "Focus on applied results and how to put the idea into code."
        ),
    },
}


def normalize_mentor_id(mentor_id: str | None) -> str:
    """Normalize mentor ID, defaulting to 'mira' for missing or invalid IDs."""
    if not mentor_id:
        return DEFAULT_MENTOR_ID
    clean = str(mentor_id).lower().strip()
    return clean if clean in MENTOR_REGISTRY else DEFAULT_MENTOR_ID


def get_mentor(mentor_id: str | None) -> dict[str, Any]:
    """Retrieve full mentor configuration, safely falling back to Mira."""
    mid = normalize_mentor_id(mentor_id)
    return MENTOR_REGISTRY[mid]


def get_mentor_prompt(mentor_id: str | None) -> str:
    """Retrieve the base system prompt for a mentor."""
    return get_mentor(mentor_id)["system_prompt"]


def get_mentor_voice_config(mentor_id: str | None, language: str | None = "en") -> dict[str, Any]:
    """Retrieve the centralized TTS voice configuration for a mentor and target language."""
    mid = normalize_mentor_id(mentor_id)
    lang = (language or "en").lower().strip()
    if lang.startswith("hi"):
        clean_lang = "hi"
    elif lang.startswith("kn"):
        clean_lang = "kn"
    else:
        clean_lang = "en"

    mentor_langs = MENTOR_LANGUAGE_VOICES.get(mid, MENTOR_LANGUAGE_VOICES[DEFAULT_MENTOR_ID])
    return mentor_langs.get(clean_lang, mentor_langs["en"])


SUPPORTED_LANGUAGES: dict[str, dict[str, Any]] = {
    "en": {"code": "en", "name": "English", "locale": "en-US", "tts_supported": True},
    "hi": {"code": "hi", "name": "Hindi", "locale": "hi-IN", "tts_supported": True},
    "kn": {
        "code": "kn",
        "name": "Kannada",
        "locale": "kn-IN",
        "tts_supported": False,
        "note": "Piper TTS does not provide a pre-trained Kannada voice model. Text responses and STT speech-to-text fully support Kannada.",
    },
}

MENTOR_LANGUAGE_VOICES: dict[str, dict[str, dict[str, Any]]] = {
    "mira": {
        "en": {
            "tts_engine": "piper",
            "voice_model": "en_US-lessac-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 1.0,
            "noise_scale": 0.667,
            "noise_w": 0.8,
            "traits": "warm, friendly, patient educator",
            "is_supported": True,
        },
        "hi": {
            "tts_engine": "piper",
            "voice_model": "hi_IN-priyamvada-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "hi-IN",
            "speaking_rate": 1.0,
            "noise_scale": 0.667,
            "noise_w": 0.8,
            "traits": "warm, reassuring, patient Hindi educator",
            "is_supported": True,
        },
        "kn": {
            "tts_engine": "piper",
            "voice_model": "en_US-lessac-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "kn-IN",
            "speaking_rate": 1.0,
            "noise_scale": 0.667,
            "noise_w": 0.8,
            "traits": "warm, friendly educator (Kannada text / fallback audio)",
            "is_supported": False,
            "unsupported_reason": "Piper TTS catalog lacks a pre-trained Kannada (kn_IN) model.",
        },
    },
    "arjun": {
        "en": {
            "tts_engine": "piper",
            "voice_model": "en_US-ryan-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 0.94,
            "noise_scale": 0.600,
            "noise_w": 0.75,
            "traits": "mature, calm, confident, professional",
            "is_supported": True,
        },
        "hi": {
            "tts_engine": "piper",
            "voice_model": "hi_IN-rohan-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "hi-IN",
            "speaking_rate": 0.95,
            "noise_scale": 0.600,
            "noise_w": 0.75,
            "traits": "calm, structured, measured Hindi educator",
            "is_supported": True,
        },
        "kn": {
            "tts_engine": "piper",
            "voice_model": "en_US-ryan-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "kn-IN",
            "speaking_rate": 0.94,
            "noise_scale": 0.600,
            "noise_w": 0.75,
            "traits": "calm, practical educator (Kannada text / fallback audio)",
            "is_supported": False,
            "unsupported_reason": "Piper TTS catalog lacks a pre-trained Kannada (kn_IN) model.",
        },
    },
    "tara": {
        "en": {
            "tts_engine": "piper",
            "voice_model": "en_US-amy-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 1.04,
            "noise_scale": 0.650,
            "noise_w": 0.85,
            "traits": "clear, composed, analytical, articulate",
            "is_supported": True,
        },
        "hi": {
            "tts_engine": "piper",
            "voice_model": "hi_IN-priyamvada-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "hi-IN",
            "speaking_rate": 1.05,
            "noise_scale": 0.650,
            "noise_w": 0.85,
            "traits": "analytical, clear, precise Hindi tutor",
            "is_supported": True,
        },
        "kn": {
            "tts_engine": "piper",
            "voice_model": "en_US-amy-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "kn-IN",
            "speaking_rate": 1.04,
            "noise_scale": 0.650,
            "noise_w": 0.85,
            "traits": "clear, composed educator (Kannada text / fallback audio)",
            "is_supported": False,
            "unsupported_reason": "Piper TTS catalog lacks a pre-trained Kannada (kn_IN) model.",
        },
    },
    "kiran": {
        "en": {
            "tts_engine": "piper",
            "voice_model": "en_US-danny-low",
            "fallback_voice": "en_US-lessac-medium",
            "language": "en-US",
            "speaking_rate": 0.98,
            "noise_scale": 0.680,
            "noise_w": 0.80,
            "traits": "energetic, approachable, practical educator",
            "is_supported": True,
        },
        "hi": {
            "tts_engine": "piper",
            "voice_model": "hi_IN-pratham-medium",
            "fallback_voice": "en_US-lessac-medium",
            "language": "hi-IN",
            "speaking_rate": 0.98,
            "noise_scale": 0.680,
            "noise_w": 0.80,
            "traits": "energetic, approachable, hands-on Hindi educator",
            "is_supported": True,
        },
        "kn": {
            "tts_engine": "piper",
            "voice_model": "en_US-danny-low",
            "fallback_voice": "en_US-lessac-medium",
            "language": "kn-IN",
            "speaking_rate": 0.98,
            "noise_scale": 0.680,
            "noise_w": 0.80,
            "traits": "energetic, hands-on educator (Kannada text / fallback audio)",
            "is_supported": False,
            "unsupported_reason": "Piper TTS catalog lacks a pre-trained Kannada (kn_IN) model.",
        },
    },
}


def get_mentor_avatar_config(mentor_id: str | None) -> dict[str, Any]:
    """Retrieve the avatar animation configuration for a mentor."""
    return get_mentor(mentor_id)["avatar_config"]


def list_mentors() -> list[dict[str, Any]]:
    """Return public list of mentors for API/UI discovery including voice & avatar metadata."""
    return [
        {
            "id": m["id"],
            "name": m["name"],
            "title": m["title"],
            "specialty": m["specialty"],
            "greeting": m["greeting"],
            "avatar": m["avatar"],
            "avatar_type": m["avatar_type"],
            "description": m["description"],
            "voice": m.get("voice", {}),
            "multilingual_voices": MENTOR_LANGUAGE_VOICES.get(m["id"], {}),
            "avatar_config": m.get("avatar_config", {}),
        }
        for m in MENTOR_REGISTRY.values()
    ]
