"""Pydantic schemas for teacher attendance management and student leave letters."""

from datetime import datetime
from pydantic import BaseModel, Field


# ----------------- Attendance Schemas -----------------


class AttendanceItem(BaseModel):
    student_id: int
    status: str = Field(..., pattern="^(present|absent|late)$")
    remarks: str | None = None


class MarkAttendanceRequest(BaseModel):
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")  # YYYY-MM-DD
    subject: str = "Machine Learning"
    records: list[AttendanceItem]


class AttendanceRecordOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    date: str
    subject: str
    status: str
    remarks: str | None = None
    updated_at: datetime | None = None


class AttendanceSummary(BaseModel):
    date: str
    subject: str
    total_enrolled: int
    total_marked: int
    present_count: int
    absent_count: int
    late_count: int
    attendance_rate: float
    records: list[AttendanceRecordOut]


# ----------------- Leave Letter Schemas -----------------


class SubmitLeaveLetterRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    reason: str = Field(..., min_length=5)
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


class ReviewLeaveLetterRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    teacher_remarks: str | None = None


class LeaveLetterOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    subject: str
    reason: str
    start_date: str
    end_date: str
    status: str  # pending, approved, rejected
    teacher_remarks: str | None = None
    reviewed_by_id: int | None = None
    reviewed_by_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

