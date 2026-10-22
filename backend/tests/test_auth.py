"""Tests for authentication, registration, role assignment, and role-based access control."""

import pytest
from fastapi.testclient import TestClient


def test_student_registration_default_role(client: TestClient):
    """Registering without role specified defaults to 'student'."""
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Alice Learner",
            "email": "alice.learner@example.com",
            "password": "SecurePassword123",
        },
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "student"
    assert data["user"]["full_name"] == "Alice Learner"
    assert data["user"]["email"] == "alice.learner@example.com"
    assert "password" not in data["user"]
    assert "password_hash" not in data["user"]


def test_student_registration_explicit_role(client: TestClient):
    """Registering with explicit student role succeeds."""
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Bob Student",
            "email": "bob.student@example.com",
            "password": "SecurePassword123",
            "role": "student",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "student"


def test_teacher_registration(client: TestClient):
    """Registering with role 'teacher' sets the user role to teacher."""
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Dr. Sarah Connor",
            "email": "sarah.connor@university.edu",
            "password": "ProfessorPassword123",
            "role": "teacher",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == "teacher"
    assert data["user"]["full_name"] == "Dr. Sarah Connor"


def test_invalid_role_rejection(client: TestClient):
    """Roles other than 'student' and 'teacher' must be rejected with 422."""
    for bad_role in ("admin", "superadmin", "moderator", "guest", "root"):
        res = client.post(
            "/api/auth/register",
            json={
                "full_name": "Malicious User",
                "email": f"hacker_{bad_role}@example.com",
                "password": "Password123",
                "role": bad_role,
            },
        )
        assert res.status_code == 422, f"Expected 422 for role '{bad_role}', got {res.status_code}"


def test_login_and_me_returns_correct_role(client: TestClient):
    """Login and /api/auth/me return the persisted role for both student and teacher."""
    # Test teacher login
    login_res = client.post(
        "/api/auth/login",
        json={
            "email": "teacher.smith@example.com",
            "password": "TeacherPassword123",
        },
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["user"]["role"] == "teacher"
    teacher_token = login_data["access_token"]

    # Verify /api/auth/me for teacher
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {teacher_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "teacher"
    assert me_res.json()["email"] == "teacher.smith@example.com"

    # Test student login
    student_login = client.post(
        "/api/auth/login",
        json={
            "email": "student.default@example.com",
            "password": "StudentPassword123",
        },
    )
    assert student_login.status_code == 200
    assert student_login.json()["user"]["role"] == "student"


def test_unauthorized_api_requests(client: TestClient):
    """Calling protected endpoints without token returns 401."""
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/chat", json={"message": "Hi"}).status_code == 401
    assert client.get("/api/tutor/progress").status_code == 401
    assert client.get("/api/teacher/overview").status_code == 401


def test_student_denial_of_teacher_operations(client: TestClient, auth_headers: dict):
    """Students attempting teacher operations must receive 403 Forbidden."""
    overview_res = client.get("/api/teacher/overview", headers=auth_headers)
    assert overview_res.status_code == 403
    assert "teacher role required" in overview_res.json()["detail"].lower()

    students_res = client.get("/api/teacher/students", headers=auth_headers)
    assert students_res.status_code == 403

    materials_res = client.get("/api/teacher/materials", headers=auth_headers)
    assert materials_res.status_code == 403


def test_teacher_access_to_permitted_operations(client: TestClient, teacher_headers: dict):
    """Teachers accessing teacher operations succeed with 200 OK."""
    overview_res = client.get("/api/teacher/overview", headers=teacher_headers)
    assert overview_res.status_code == 200
    ov_data = overview_res.json()
    assert "stats" in ov_data
    assert "teacher" in ov_data
    assert ov_data["teacher"]["role"] == "teacher"

    students_res = client.get("/api/teacher/students", headers=teacher_headers)
    assert students_res.status_code == 200
    assert isinstance(students_res.json(), list)

    materials_res = client.get("/api/teacher/materials", headers=teacher_headers)
    assert materials_res.status_code == 200
    assert "materials" in materials_res.json()


def test_auth_registration_and_login_flow(client: TestClient):
    """End-to-end registration, duplicate rejection, and login verification."""
    test_email = "test.student.flow@example.com"
    test_password = "SecurePassword@123"
    test_name = "Alex Flow"

    # 1. Register a new student
    reg_res = client.post(
        "/api/auth/register",
        json={
            "full_name": test_name,
            "email": test_email,
            "password": test_password,
            "role": "student",
        },
    )
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    token = reg_data["access_token"]

    # 2. Duplicate registration attempt rejected with 400
    dup_res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Another Name",
            "email": test_email.upper(),
            "password": "AnotherPassword123",
        },
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"].lower()

    # 3. Successful login
    login_res = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_password},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["role"] == "student"

    # 4. Bad password rejected with 401
    bad_pw = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": "WrongPassword!456"},
    )
    assert bad_pw.status_code == 401

    # 5. Protected /api/auth/me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["role"] == "student"
