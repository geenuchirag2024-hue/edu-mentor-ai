"""Direct test runner for password reset functionality with mock lifespan."""

from contextlib import asynccontextmanager
import hashlib
import os
import secrets
import sys
from datetime import datetime, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Mock lifespan to avoid postgres socket connection timeout in tests
@asynccontextmanager
async def noop_lifespan(app):
    yield

from backend.main import app
app.router.lifespan_context = noop_lifespan

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from backend.api.routes.auth import hash_password, verify_password
from backend.db.database import Base, get_db
from backend.db.models import PasswordResetToken, User

def main():
    print("==========================================================")
    print(" Running Password Reset & Security Verification Tests     ")
    print("==========================================================")

    test_db_path = PROJECT_ROOT / "data" / "test_password_reset.db"
    test_db_path.unlink(missing_ok=True)

    # SQLite sync engine for test db
    sync_engine = create_engine(f"sqlite:///{test_db_path}")
    Base.metadata.create_all(sync_engine)
    SyncSession = sessionmaker(bind=sync_engine)

    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    async_test_engine = create_async_engine(f"sqlite+aiosqlite:///{test_db_path}")
    AsyncTestSession = async_sessionmaker(async_test_engine, expire_on_commit=False)

    async def override_get_db():
        async with AsyncTestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app, raise_server_exceptions=True)

    # Test 1: Unknown email non-enumeration
    print("[1/5] Testing unknown email non-enumeration...")
    res = client.post("/api/auth/forgot-password", json={"email": "nobody_exists_12345@example.com"})
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert "If an account exists" in res.json()["message"]
    print("  -> Unknown email returned safe generic response without leaking account existence.")

    # Test 2: Student flow
    print("[2/5] Testing Student password reset flow and role preservation...")
    with SyncSession() as session:
        student = User(
            full_name="Alice Student",
            email="alice.student@example.com",
            password_hash=hash_password("OriginalStudent123"),
            role="student",
        )
        session.add(student)
        session.commit()
        student_id = student.id

    res = client.post("/api/auth/forgot-password", json={"email": "alice.student@example.com"})
    assert res.status_code == 200
    dev_link = res.json().get("reset_link_dev")
    assert dev_link is not None, "Expected dev link in development mode"
    token = dev_link.split("token=")[-1]

    # Validate token
    val_res = client.post("/api/auth/validate-reset-token", json={"token": token})
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is True

    # Reset password
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "NewStudentPassword456!"},
    )
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True

    # Verify student role preserved & password updated
    with SyncSession() as session:
        updated = session.execute(select(User).where(User.id == student_id)).scalar_one()
        assert updated.role == "student", f"Role changed to {updated.role}!"
        assert verify_password("NewStudentPassword456!", updated.password_hash) is True
        assert verify_password("OriginalStudent123", updated.password_hash) is False
    print("  -> Student password reset succeeded. Role 'student' strictly preserved.")

    # Test 3: Token reuse prevention (single-use)
    print("[3/5] Testing token single-use enforcement...")
    reuse_res = client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "AnotherAttempt789!"},
    )
    assert reuse_res.status_code == 400
    assert "already used" in reuse_res.json()["detail"].lower()
    print("  -> Reused token rejected with HTTP 400 as expected.")

    # Test 4: Teacher flow
    print("[4/5] Testing Teacher password reset flow and role preservation...")
    with SyncSession() as session:
        teacher = User(
            full_name="Bob Teacher",
            email="bob.teacher@example.com",
            password_hash=hash_password("OriginalTeacher123"),
            role="teacher",
        )
        session.add(teacher)
        session.commit()
        teacher_id = teacher.id

    t_res = client.post("/api/auth/forgot-password", json={"email": "bob.teacher@example.com"})
    assert t_res.status_code == 200
    t_token = t_res.json()["reset_link_dev"].split("token=")[-1]

    t_reset = client.post(
        "/api/auth/reset-password",
        json={"token": t_token, "new_password": "NewTeacherPassword456!"},
    )
    assert t_reset.status_code == 200

    with SyncSession() as session:
        updated_teacher = session.execute(select(User).where(User.id == teacher_id)).scalar_one()
        assert updated_teacher.role == "teacher", f"Role changed to {updated_teacher.role}!"
        assert verify_password("NewTeacherPassword456!", updated_teacher.password_hash) is True
    print("  -> Teacher password reset succeeded. Role 'teacher' strictly preserved.")

    # Test 5: Expired token
    print("[5/5] Testing expired token rejection...")
    with SyncSession() as session:
        expired_token = "expired_raw_token_test_12345678"
        token_hash = hashlib.sha256(expired_token.encode("utf-8")).hexdigest()
        expired_rec = PasswordResetToken(
            user_id=student_id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() - timedelta(minutes=5),
            is_used=False,
        )
        session.add(expired_rec)
        session.commit()

    val_exp = client.post("/api/auth/validate-reset-token", json={"token": expired_token})
    assert val_exp.json()["valid"] is False
    assert "expired" in val_exp.json()["message"].lower()

    reset_exp = client.post(
        "/api/auth/reset-password",
        json={"token": expired_token, "new_password": "ValidNewPassword123!"},
    )
    assert reset_exp.status_code == 400
    assert "expired" in reset_exp.json()["detail"].lower()
    print("  -> Expired token rejected with HTTP 400 as expected.")

    # Dispose engines so Windows releases the file lock before unlinking
    sync_engine.dispose()
    try:
        async_test_engine.sync_engine.dispose()
    except Exception:
        pass
    try:
        test_db_path.unlink(missing_ok=True)
    except Exception:
        pass

    print("==========================================================")
    print(" [SUCCESS] ALL 5 PASSWORD RESET SECURITY TESTS PASSED!   ")
    print("==========================================================")

if __name__ == "__main__":
    main()
