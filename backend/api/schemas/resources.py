from datetime import datetime
from pydantic import BaseModel, ConfigDict


class TeacherResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    teacher_name: str
    title: str
    description: str | None = None
    subject: str
    original_filename: str
    file_size: int
    mime_type: str
    is_published: bool
    created_at: datetime


class ResourceUploadResponse(BaseModel):
    resource: TeacherResourceOut
    message: str
    notifications_sent: int


class ResourceUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    subject: str | None = None
    is_published: bool | None = None


class StudentNotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    resource_id: int | None = None
    title: str
    message: str
    is_read: bool
    created_at: datetime


class NotificationsResponse(BaseModel):
    notifications: list[StudentNotificationOut]
    unread_count: int

