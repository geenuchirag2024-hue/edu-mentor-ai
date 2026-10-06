"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    cors_origins: str = (
        "http://localhost:3000,http://localhost:3001,"
        "http://127.0.0.1:3000,http://127.0.0.1:3001,"
        "https://edu-mentor-ai-sable.vercel.app,"
        "https://edu-mentor-ai-git-main-chethanchiragk.vercel.app,"
        "https://edu-mentor-lr3lcbzog-chethanchiragk.vercel.app"
    )

    llm_model_path: str = str(PROJECT_ROOT / "data/models/qwen3.gguf")
    llm_context_length: int = 1536
    llm_max_tokens: int = 192
    llm_max_tokens_voice: int = 128
    llm_n_threads: int = 4
    llm_n_batch: int = 512

    embedding_model: str = "BAAI/bge-base-en-v1.5"

    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_collection: str = "ml_content"

    database_url: str = (
        "postgresql://edu_mentor:edu_mentor_dev@localhost:5432/edu_mentor_ai"
    )

    whisper_model: str = "base"
    piper_voice: str = "en_US-lessac-medium"
    piper_model_dir: str = str(PROJECT_ROOT / "data/models/piper")

    jwt_secret: str = "change-me-in-production"
    jwt_expiry_hours: int = 24

    rag_chunk_size: int = 600
    rag_chunk_overlap: int = 80
    rag_top_k: int = 2
    rag_score_threshold: float = 0.65

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
