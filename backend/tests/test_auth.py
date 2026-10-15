import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.db.database import Base, get_db
from backend.main import app

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    import asyncio

    async def _init():
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init())
    yield


def test_auth_registration_and_login_flow():
    test_email = "test.student@example.com"
    test_password = "SecurePassword@123"
    test_name = "Alex Johnson"

    # 1. Register a new user
    reg_res = client.post(
        "/api/auth/register",
        json={
            "full_name": test_name,
            "email": test_email,
            "password": test_password,
        },
    )
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert "user" in reg_data
    assert reg_data["user"]["full_name"] == test_name
    assert reg_data["user"]["email"] == test_email.lower()
    assert "password" not in reg_data["user"]
    assert "password_hash" not in reg_data["user"]

    token = reg_data["access_token"]

    # 2. Duplicate registration attempt should be rejected with 400
    dup_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Another Name",
            "email": test_email.upper(),  # test case insensitivity
            "password": "AnotherPassword123",
        },
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

    # 3. Successful login with registered credentials
    login_res = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": test_password,
        },
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == test_email.lower()
    assert "password_hash" not in login_data["user"]

    # 4. Failed login with incorrect password should be rejected with 401
    bad_pw_res = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": "WrongPassword!456",
        },
    )
    assert bad_pw_res.status_code == 401
    assert "invalid" in bad_pw_res.json()["detail"].lower()

    # 5. Failed login with non-existent email should be rejected with 401
    unknown_email_res = client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent.user.12345@example.com",
            "password": test_password,
        },
    )
    assert unknown_email_res.status_code == 401
    assert "invalid" in unknown_email_res.json()["detail"].lower()

    # 6. Authenticated /api/auth/me request
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["full_name"] == test_name
    assert me_data["email"] == test_email.lower()
    assert "password_hash" not in me_data

    # 7. Unauthenticated /api/auth/me request should be rejected with 401
    unauth_me = client.get("/api/auth/me")
    assert unauth_me.status_code == 401
