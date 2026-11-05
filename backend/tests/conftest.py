"""Shared test configuration, database fixtures, and authentication helpers."""

import asyncio
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.api.routes.auth import create_access_token, hash_password
from backend.db.database import Base, get_db
from backend.db.models import User
from backend.main import app

from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.config import PROJECT_ROOT

_TEST_DB_FILE = PROJECT_ROOT / "data" / "test_suite.db"
_SYNC_DB_URL = f"sqlite:///{_TEST_DB_FILE.as_posix()}"
_ASYNC_DB_URL = f"sqlite+aiosqlite:///{_TEST_DB_FILE.as_posix()}"

sync_engine = create_engine(_SYNC_DB_URL, connect_args={"check_same_thread": False})
test_engine = create_async_engine(_ASYNC_DB_URL, connect_args={"check_same_thread": False}, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_test_db():
    """Reset schema before every test and seed student and teacher users."""
    Base.metadata.drop_all(sync_engine)
    Base.metadata.create_all(sync_engine)

    with Session(sync_engine) as session:
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
        session.commit()
    sync_engine.dispose()
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
