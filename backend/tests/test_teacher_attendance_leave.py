"""Tests for teacher attendance management, student leave letters, and role-based permissions."""

import os
import sys
from pathlib import Path

# Ensure project root is in sys.path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

os.environ["TESTING"] = "1"

import pytest
import httpx
from sqlalchemy import select

from backend.main import app
from backend.api.routes.auth import create_access_token
from backend.tests.conftest import TestSessionLocal
from backend.db.models import User


@pytest.mark.asyncio
async def test_attendance_and_leave_workflow():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async with TestSessionLocal() as db:
            teacher_res = await db.execute(select(User).where(User.role == "teacher").limit(1))
            teacher_obj = teacher_res.scalar_one_or_none()
            student_res = await db.execute(select(User).where(User.role == "student").limit(1))
            student_obj = student_res.scalar_one_or_none()

        assert teacher_obj is not None, "A teacher user must exist in the database"
        assert student_obj is not None, "A student user must exist in the database"

        teacher_token = create_access_token(str(teacher_obj.id), role="teacher")
        student_token = create_access_token(str(student_obj.id), role="student")

        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 1. Teacher retrieves attendance roster
        res = await client.get("/api/teacher/attendance?date=2026-11-04&subject=Machine%20Learning", headers=teacher_headers)
        assert res.status_code == 200, res.text
        att_data = res.json()
        assert "records" in att_data
        assert "total_enrolled" in att_data
        assert att_data["date"] == "2026-11-04"
        assert att_data["subject"] == "Machine Learning"

        # 2. Student attempts to access teacher attendance -> 403 Forbidden
        student_att_res = await client.get("/api/teacher/attendance?date=2026-11-04", headers=student_headers)
        assert student_att_res.status_code == 403

        # 3. Teacher marks attendance
        mark_payload = {
            "date": "2026-11-04",
            "subject": "Machine Learning",
            "records": [
                {"student_id": student_obj.id, "status": "present", "remarks": "Participated actively"},
            ],
        }
        mark_res = await client.post("/api/teacher/attendance", json=mark_payload, headers=teacher_headers)
        assert mark_res.status_code == 200, mark_res.text
        marked_data = mark_res.json()
        assert marked_data["present_count"] >= 1
        assert any(r["student_id"] == student_obj.id and r["status"] == "present" for r in marked_data["records"])

        # 4. Student submits a leave letter
        leave_payload = {
            "subject": "Medical Leave for Fever",
            "reason": "Suffering from viral fever, doctor advised 2 days bed rest.",
            "start_date": "2026-11-05",
            "end_date": "2026-11-06",
        }
        submit_res = await client.post("/api/teacher/leave-letters/submit", json=leave_payload, headers=student_headers)
        assert submit_res.status_code == 200, submit_res.text
        leave_item = submit_res.json()
        assert leave_item["status"] == "pending"
        assert leave_item["subject"] == "Medical Leave for Fever"
        leave_id = leave_item["id"]

        # 5. Teacher lists leave letters and sees the pending letter
        teacher_leaves_res = await client.get("/api/teacher/leave-letters?status=pending", headers=teacher_headers)
        assert teacher_leaves_res.status_code == 200
        pending_leaves = teacher_leaves_res.json()
        assert any(l["id"] == leave_id for l in pending_leaves)

        # 6. Student cannot review or approve a leave letter -> 403 Forbidden
        student_review_res = await client.post(
            f"/api/teacher/leave-letters/{leave_id}/review",
            json={"status": "approved", "teacher_remarks": "Hacked"},
            headers=student_headers,
        )
        assert student_review_res.status_code == 403

        # 7. Teacher reviews and approves the leave letter
        review_payload = {
            "status": "approved",
            "teacher_remarks": "Approved. Get well soon and review Chapter 3 notes.",
        }
        review_res = await client.post(
            f"/api/teacher/leave-letters/{leave_id}/review",
            json=review_payload,
            headers=teacher_headers,
        )
        assert review_res.status_code == 200
        reviewed_item = review_res.json()
        assert reviewed_item["status"] == "approved"
        assert reviewed_item["teacher_remarks"] == "Approved. Get well soon and review Chapter 3 notes."

        # 8. Student checks their submitted leave letters
        my_leaves_res = await client.get("/api/teacher/leave-letters/my", headers=student_headers)
        assert my_leaves_res.status_code == 200
        my_leaves = my_leaves_res.json()
        assert any(l["id"] == leave_id and l["status"] == "approved" for l in my_leaves)


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_attendance_and_leave_workflow())
    print("ALL ATTENDANCE AND LEAVE WORKFLOW TESTS PASSED PERFECTLY!")
