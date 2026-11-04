"""Automatic video matching service for Edu-Mentor AI.

Loads registered educational videos, performs robust keyword and semantic matching,
verifies local media file existence, and returns formatted video metadata for student UI.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any

from backend.config import PROJECT_ROOT

logger = logging.getLogger(__name__)

# Registry and media paths
REGISTRY_PATH = PROJECT_ROOT / "backend" / "video_registry.json"
VIDEOS_DIR = PROJECT_ROOT / "backend" / "media" / "videos"
THUMBNAILS_DIR = PROJECT_ROOT / "backend" / "media" / "thumbnails"

# Cache structure
_REGISTRY_CACHE: list[dict[str, Any]] = []
_REGISTRY_MTIME: float = 0.0
_EMBEDDINGS_CACHE: dict[str, list[float]] = {}

# Common generic stop words that must NEVER trigger a video match on their own
GENERIC_STOP_WORDS = {
    "what", "is", "explain", "how", "does", "the", "a", "an", "in", "to", "of",
    "and", "or", "for", "with", "tell", "me", "about", "can", "you", "model",
    "learning", "data", "machine", "ai", "algorithm", "system", "please",
    "concept", "define", "give", "example", "mean", "meaning", "notes", "tutor",
    "help", "understand", "study", "class", "lecture", "unit", "chapter"
}


def normalize_text(text: str) -> str:
    """Normalize text by lowercasing, replacing hyphens/underscores with spaces,
    and stripping punctuation."""
    if not text:
        return ""
    text = text.lower()
    # Replace hyphens, underscores, slashes with space
    text = re.sub(r"[\-_\/\\]+", " ", text)
    # Strip any characters that are not alphanumeric or space
    text = re.sub(r"[^\w\s]", "", text)
    # Collapse multiple whitespaces
    return " ".join(text.split())


def load_registry(force_reload: bool = False) -> list[dict[str, Any]]:
    """Load video registry from backend/video_registry.json with mtime caching."""
    global _REGISTRY_CACHE, _REGISTRY_MTIME
    if not REGISTRY_PATH.exists():
        logger.warning("Video registry file not found at: %s", REGISTRY_PATH)
        return []

    try:
        current_mtime = REGISTRY_PATH.stat().st_mtime
        if not force_reload and _REGISTRY_CACHE and current_mtime == _REGISTRY_MTIME:
            return _REGISTRY_CACHE

        raw_data = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw_data, list):
            logger.warning("Invalid registry format: expected list of video records.")
            return []

        _REGISTRY_CACHE = [v for v in raw_data if isinstance(v, dict)]
        _REGISTRY_MTIME = current_mtime
        return _REGISTRY_CACHE
    except Exception as exc:
        logger.error("Error reading video registry: %s", exc)
        return _REGISTRY_CACHE or []


def verify_video_file_exists(video: dict[str, Any]) -> bool:
    """Ensure the underlying MP4 file exists and has nonzero size."""
    filename = video.get("video_filename")
    if not filename:
        url = video.get("video_url", "")
        filename = url.split("/")[-1] if "/" in url else url

    if not filename:
        return False

    candidate_paths = [
        VIDEOS_DIR / filename,
        PROJECT_ROOT / "backend" / "media" / "videos" / filename,
        Path("backend/media/videos") / filename,
    ]
    return any(p.exists() and p.stat().st_size > 0 for p in candidate_paths)


def score_video_match(
    normalized_query: str,
    query_tokens: set[str],
    video: dict[str, Any],
    subject: str | None = None,
) -> float:
    """Score a registered video against a normalized user query."""
    if not video.get("active", True):
        return 0.0

    score = 0.0
    v_topic = normalize_text(video.get("topic", ""))
    v_subject = normalize_text(video.get("subject", ""))
    keywords = [normalize_text(k) for k in video.get("keywords", []) if k]

    # Subject alignment bonus
    if subject and normalize_text(subject) == v_subject:
        score += 1.0

    # 1. Exact Topic Match (Highest priority)
    if v_topic and v_topic in normalized_query:
        score += 20.0

    # 2. Multiword keyword phrase match
    for kw in keywords:
        if not kw:
            continue
        words = kw.split()
        if len(words) > 1:
            # Multi-word phrase matching
            if kw in normalized_query:
                score += 15.0
            elif all(w in query_tokens for w in words):
                score += 10.0
        else:
            # Single distinctive keyword (skip if generic)
            if kw not in GENERIC_STOP_WORDS and kw in query_tokens:
                score += 8.0

    # 3. Topic token match (non-generic words)
    topic_tokens = set(v_topic.split()) - GENERIC_STOP_WORDS
    matched_topic_tokens = topic_tokens.intersection(query_tokens)
    if matched_topic_tokens:
        score += 6.0 * len(matched_topic_tokens)

    return score


def _semantic_similarity_match(
    query: str,
    candidates: list[dict[str, Any]],
    min_similarity: float = 0.78,
) -> dict[str, Any] | None:
    """Optional semantic fallback for paraphrased questions using FastEmbed."""
    try:
        from backend.rag.embeddings import get_embeddings
        import numpy as np

        embedder = get_embeddings()
        q_vec = embedder.embed_query(query)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return None

        best_video = None
        best_sim = -1.0
        second_sim = -1.0

        for video in candidates:
            vid = str(video.get("id"))
            if vid not in _EMBEDDINGS_CACHE:
                # Precompute composite semantic representation
                topic = video.get("topic", "")
                desc = video.get("description", "")
                kws = ", ".join(video.get("keywords", []))
                text_rep = f"{topic}. {desc} Keywords: {kws}"
                _EMBEDDINGS_CACHE[vid] = embedder.embed_query(text_rep)

            v_vec = _EMBEDDINGS_CACHE[vid]
            v_norm = np.linalg.norm(v_vec)
            if v_norm == 0:
                continue

            sim = float(np.dot(q_vec, v_vec) / (q_norm * v_norm))
            if sim > best_sim:
                second_sim = best_sim
                best_sim = sim
                best_video = video
            elif sim > second_sim:
                second_sim = sim

        # Require high similarity threshold and clear winner margin to prevent false positives
        if best_video and best_sim >= min_similarity and (best_sim - second_sim >= 0.04):
            logger.info(
                "Semantic video match found for '%s': %s (similarity: %.3f)",
                query,
                best_video.get("id"),
                best_sim,
            )
            return best_video
    except Exception as exc:
        logger.debug("Semantic video matching skipped: %s", exc)

    return None


def find_related_video(
    question: str,
    subject: str | None = None,
) -> dict[str, Any] | None:
    """Find the best matching educational video for a student's question.

    Returns safe public metadata dictionary or None if no match meets threshold.
    """
    if not question or not question.strip():
        return None

    videos = load_registry()
    if not videos:
        return None

    # Filter to active videos whose files exist on disk
    active_videos = [v for v in videos if v.get("active", True) and verify_video_file_exists(v)]
    if not active_videos:
        return None

    normalized_q = normalize_text(question)
    q_tokens = set(normalized_q.split())

    # Discard questions that only contain generic words
    informative_tokens = q_tokens - GENERIC_STOP_WORDS
    if not informative_tokens:
        return None

    # Score each active video
    scored_candidates: list[tuple[float, dict[str, Any]]] = []
    for video in active_videos:
        score = score_video_match(normalized_q, q_tokens, video, subject)
        if score >= 8.0:
            scored_candidates.append((score, video))

    # Deterministic highest score
    if scored_candidates:
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        best_score, best_video = scored_candidates[0]
        logger.info(
            "Keyword video match for '%s': %s (score: %.1f)",
            question,
            best_video.get("id"),
            best_score,
        )
        return format_public_video_response(best_video)

    # Fallback: semantic matching for paraphrased questions
    semantic_match = _semantic_similarity_match(question, active_videos)
    if semantic_match:
        return format_public_video_response(semantic_match)

    return None


def format_public_video_response(video: dict[str, Any]) -> dict[str, Any]:
    """Format safe public video object for API responses."""
    return {
        "id": video.get("id", ""),
        "title": video.get("title", ""),
        "topic": video.get("topic", ""),
        "subject": video.get("subject", "Machine Learning"),
        "description": video.get("description", ""),
        "video_url": video.get("video_url", ""),
        "thumbnail_url": video.get("thumbnail_url"),
        "duration_seconds": video.get("duration_seconds"),
    }


def get_registered_video_by_id(video_id: str) -> dict[str, Any] | None:
    """Retrieve full video record by ID from registry."""
    for v in load_registry():
        if v.get("id") == video_id:
            return v
    return None


load_video_registry = load_registry


