"""Shared test configuration, database fixtures, and authentication helpers."""

import asyncio
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.api.routes.auth import create_access_token, hash_password
from backend.db.database import Base, get_db
from backend.db.models import User
from backend.main import app

# Shared in-memory test database
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    echo=False,
)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_test_db():
    """Reset schema before every test and seed student and teacher users."""
    async def _init():
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

        async with TestSessionLocal() as session:
            student = User(
                id=1,
                full_name="Default Student",
                email="student.default@example.com",
                password_hash=hash_password("StudentPassword123"),
                role="student",
            )
            teacher = User(
                id=2,
                full_name="Professor Smith",
                email="teacher.smith@example.com",
                password_hash=hash_password("TeacherPassword123"),
                role="teacher",
            )
            session.add_all([student, teacher])
            await session.commit()

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(asyncio.run, _init()).result()
    else:
        asyncio.run(_init())
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def student_token():
    return create_access_token("1", role="student")


@pytest.fixture
def teacher_token():
    return create_access_token("2", role="teacher")


@pytest.fixture
def auth_headers(student_token):
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def teacher_headers(teacher_token):
    return {"Authorization": f"Bearer {teacher_token}"}
