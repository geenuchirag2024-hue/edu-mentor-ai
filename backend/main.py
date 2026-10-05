"""
Edu Mentor AI — FastAPI Backend Entry Point

Run from the project root:
    python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

Or from this file (works from project root or backend/):
    python backend/main.py
    python main.py
"""

from contextlib import asynccontextmanager
import sys
from pathlib import Path

# Allow `python main.py` when the working directory is backend/
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import auth, chat, health, tutor, voice
from backend.config import get_settings

settings = get_settings()


def _preload_models() -> None:
    """Load heavy models at startup so the first user query is faster."""
    print("[Edu Mentor] Preloading AI models (may take 1-2 minutes)...", flush=True)
    try:
        from backend.models.llm import get_llm

        get_llm()._load()
        print("[Edu Mentor] [ok] LLM ready", flush=True)
    except Exception as exc:
        print(f"[Edu Mentor] [fail] LLM preload failed: {exc}", flush=True)

    try:
        from backend.voice.stt import get_stt

        get_stt()._load()
        print("[Edu Mentor] [ok] STT ready", flush=True)
    except Exception as exc:
        print(f"[Edu Mentor] [fail] STT preload failed: {exc}", flush=True)

    try:
        from backend.voice.tts import get_tts

        get_tts()._load()
        print("[Edu Mentor] [ok] TTS ready", flush=True)
    except Exception as exc:
        print(f"[Edu Mentor] [fail] TTS preload failed: {exc}", flush=True)

    try:
        from backend.rag.embeddings import get_embeddings

        get_embeddings()._load()
        print("[Edu Mentor] [ok] Embeddings ready", flush=True)
    except Exception as exc:
        print(f"[Edu Mentor] [fail] Embeddings preload failed: {exc}", flush=True)

    try:
        from backend.rag.vector_store import get_vector_store

        store = get_vector_store()
        print(f"[Edu Mentor] [ok] Vector store ready ({store.backend_name})", flush=True)
    except Exception as exc:
        print(f"[Edu Mentor] [fail] Vector store preload failed: {exc}", flush=True)

    print("[Edu Mentor] All models loaded - ready for requests!", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from backend.db import models  # noqa: F401
        from backend.db.database import Base, engine

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("[Edu Mentor] [ok] Database initialized", flush=True)
    except Exception as exc:
        print(f"[Edu Mentor] [warn] Database init: {exc}", flush=True)

    _preload_models()
    yield


app = FastAPI(
    title="Edu Mentor AI",
    description="AI-driven conversational voice agent for ML education",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
        if settings.app_env == "development"
        else None
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(auth.router)
app.include_router(tutor.router)


@app.get("/")
async def root():
    return {
        "message": "Edu Mentor AI Backend",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import os

    import uvicorn

    os.chdir(_PROJECT_ROOT)
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
