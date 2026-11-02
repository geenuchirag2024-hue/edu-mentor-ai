"""Tests for password recovery, single-use tokens, security, and role preservation."""

import hashlib
import secrets
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from backend.api.routes.auth import hash_password, verify_password
from backend.db.database import AsyncSessionLocal, Base, engine
from backend.db.models import PasswordResetToken, User


@pytest.fixture(autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.mark.asyncio
async def test_forgot_password_unknown_email_no_enumeration(client):
    """Submitting an unknown email returns a generic success message without leaking account state."""
    response = client.post(
        "/api/auth/forgot-password",
        json={"email": "nonexistent_person_12345@example.com"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "If an account exists" in data["message"]
    # Ensure no reset token was created for nonexistent email
    async with AsyncSessionLocal() as session:
        tokens = await session.execute(select(PasswordResetToken))
        assert len(tokens.scalars().all()) == 0


@pytest.mark.asyncio
async def test_student_and_teacher_password_reset_flow(client):
    """Verify complete password recovery flow for both student and teacher accounts."""
    # 1. Seed student and teacher accounts
    async with AsyncSessionLocal() as session:
        student = User(
            full_name="Alice Student",
            email="alice.student@example.com",
            password_hash=hash_password("OriginalStudentPass123"),
            role="student",
        )
        teacher = User(
            full_name="Bob Teacher",
            email="bob.teacher@example.com",
            password_hash=hash_password("OriginalTeacherPass123"),
            role="teacher",
        )
        session.add_all([student, teacher])
        await session.commit()
        student_id = student.id
        teacher_id = teacher.id

    # 2. Student requests password reset
    res = client.post(
        "/api/auth/forgot-password",
        json={"email": "alice.student@example.com"},
    )
    assert res.status_code == 200
    assert "If an account exists" in res.json()["message"]
    dev_link = res.json().get("reset_link_dev")
    assert dev_link is not None
    student_token = dev_link.split("token=")[-1]
    assert len(student_token) > 20

    # Verify token in DB is hashed and single-use
    async with AsyncSessionLocal() as session:
        token_hash = hashlib.sha256(student_token.encode("utf-8")).hexdigest()
        record_res = await session.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
        token_record = record_res.scalar_one_or_none()
        assert token_record is not None
        assert token_record.user_id == student_id
        assert token_record.is_used is False
        assert token_record.expires_at > datetime.utcnow()

    # 3. Validate student token endpoint
    val_res = client.post(
        "/api/auth/validate-reset-token",
        json={"token": student_token},
    )
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is True

    # 4. Reset student password
    reset_res = client.post(
        "/api/auth/reset-password",
        json={
            "token": student_token,
            "new_password": "NewSecureStudentPass456!",
        },
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # 5. Verify database state: password updated, role preserved
    async with AsyncSessionLocal() as session:
        student_res = await session.execute(select(User).where(User.id == student_id))
        updated_student = student_res.scalar_one()
        assert updated_student.role == "student"  # Role must be strictly preserved
        assert verify_password("NewSecureStudentPass456!", updated_student.password_hash) is True
        assert verify_password("OriginalStudentPass123", updated_student.password_hash) is False

        # Token must be marked used
        token_check = await session.execute(
            select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        )
        assert token_check.scalar_one().is_used is True

    # 6. Reusing the same token must be rejected (single-use validation)
    reused_res = client.post(
        "/api/auth/reset-password",
        json={
            "token": student_token,
            "new_password": "AnotherNewPass789!",
        },
    )
    assert reused_res.status_code == 400
    assert "already used" in reused_res.json()["detail"].lower()

    # 7. Teacher password reset & role preservation
    teacher_forgot = client.post(
        "/api/auth/forgot-password",
        json={"email": "bob.teacher@example.com"},
    )
    assert teacher_forgot.status_code == 200
    teacher_dev_link = teacher_forgot.json().get("reset_link_dev")
    teacher_token = teacher_dev_link.split("token=")[-1]

    teacher_reset = client.post(
        "/api/auth/reset-password",
        json={
            "token": teacher_token,
            "new_password": "NewTeacherPass789!",
        },
    )
    assert teacher_reset.status_code == 200

    async with AsyncSessionLocal() as session:
        teacher_res = await session.execute(select(User).where(User.id == teacher_id))
        updated_teacher = teacher_res.scalar_one()
        assert updated_teacher.role == "teacher"  # Role preserved
        assert verify_password("NewTeacherPass789!", updated_teacher.password_hash) is True


@pytest.mark.asyncio
async def test_expired_token_rejection(client):
    """Tokens with past expiration dates are rejected with 400."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    async with AsyncSessionLocal() as session:
        user = User(
            full_name="Charlie Test",
            email="charlie@example.com",
            password_hash=hash_password("OldPass123"),
            role="student",
        )
        session.add(user)
        await session.commit()

        expired_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() - timedelta(minutes=10),  # expired 10 mins ago
            is_used=False,
        )
        session.add(expired_record)
        await session.commit()

    # Validate endpoint should report expired
    val_res = client.post("/api/auth/validate-reset-token", json={"token": raw_token})
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is False
    assert "expired" in val_res.json()["message"].lower()

    # Reset endpoint should reject with 400
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "NewPassword123"},
    )
    assert reset_res.status_code == 400
    assert "expired" in reset_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_short_password_rejection(client):
    """Passwords shorter than 6 characters are rejected."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    async with AsyncSessionLocal() as session:
        user = User(
            full_name="Dana Test",
            email="dana@example.com",
            password_hash=hash_password("OldPass123"),
            role="student",
        )
        session.add(user)
        await session.commit()

        active_record = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=20),
            is_used=False,
        )
        session.add(active_record)
        await session.commit()

    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "123"},  # Too short
    )
    assert reset_res.status_code in (400, 422)

