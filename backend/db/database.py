import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import PROJECT_ROOT, get_settings


class Base(DeclarativeBase):
    pass


def _async_url(url: str) -> str:
    if os.environ.get("TESTING") == "1" or os.environ.get("PYTEST_CURRENT_TEST"):
        test_db = PROJECT_ROOT / "data" / "test_suite.db"
        return f"sqlite+aiosqlite:///{test_db.as_posix()}"
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


settings = get_settings()
engine = create_async_engine(_async_url(settings.database_url), echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
