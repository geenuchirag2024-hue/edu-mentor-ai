"""Teacher Resources and Notes Distribution routes for Edu-Mentor AI V3.

Provides:
- Teacher-uploaded notes persistence
- Automatic student notifications on publication
- Searchable and filterable student resource library
- Secure authenticated file downloads
- Resource publishing toggling
"""

from __future__ import annotations

import logging
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_teacher
from backend.api.schemas.resources import (
    ResourceUpdate,
    ResourceUploadResponse,
    TeacherResourceOut,
)
from backend.config import PROJECT_ROOT
from backend.db.database import get_db
from backend.db.models import StudentActivity, StudentNotification, TeacherResource, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/resources", tags=["resources"])

TEACHER_STORAGE_DIR = PROJECT_ROOT / "data" / "teacher_resources"
TEACHER_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=ResourceUploadResponse)
async def upload_teacher_resource(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(default=""),
    subject: str = Form(default="General"),
    is_published: bool = Form(default=True),
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Teacher uploads notes or lecture PDFs for students."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".pdf", ".txt", ".docx", ".pptx", ".md"):
        raise HTTPException(
            status_code=400,
            detail="Supported formats: .pdf, .txt, .docx, .pptx, .md",
        )

    data = await file.read()
    if not data or len(data.strip()) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50MB maximum size limit.")

    # Save to disk securely
    safe_disk_name = f"{uuid.uuid4().hex[:10]}_{Path(file.filename).name.replace(' ', '_')}"
    target_path = TEACHER_STORAGE_DIR / safe_disk_name
    target_path.write_bytes(data)

    resource = TeacherResource(
        teacher_id=current_teacher.id,
        title=title.strip() or Path(file.filename).stem,
        description=description.strip() or None,
        subject=subject.strip() or "General",
        original_filename=Path(file.filename).name,
        file_path=str(target_path),
        file_size=len(data),
        mime_type=file.content_type or "application/octet-stream",
        is_published=is_published,
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    # Broadcast notification to all enrolled students if published
    notifications_count = 0
    if is_published:
        students_query = select(User.id).where(User.role == "student")
        res = await db.execute(students_query)
        student_ids = res.scalars().all()

        notifications = [
            StudentNotification(
                user_id=sid,
                resource_id=resource.id,
                title="New Study Material Available",
                message=f"Prof. {current_teacher.full_name} uploaded '{resource.title}' for {resource.subject}.",
                is_read=False,
            )
            for sid in student_ids
        ]
        if notifications:
            db.add_all(notifications)
            await db.commit()
            notifications_count = len(notifications)

    res_out = TeacherResourceOut(
        id=resource.id,
        teacher_id=resource.teacher_id,
        teacher_name=current_teacher.full_name,
        title=resource.title,
        description=resource.description,
        subject=resource.subject,
        original_filename=resource.original_filename,
        file_size=resource.file_size,
        mime_type=resource.mime_type,
        is_published=resource.is_published,
        created_at=resource.created_at,
    )

    return ResourceUploadResponse(
        resource=res_out,
        message=f"Resource '{resource.title}' uploaded successfully.",
        notifications_sent=notifications_count,
    )


@router.get("", response_model=list[TeacherResourceOut])
async def list_resources(
    subject: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List study materials available to students and faculty.
    Students only see published materials; teachers see all of their own materials.
    """
    query = select(TeacherResource, User.full_name).join(
        User, TeacherResource.teacher_id == User.id
    )

    if current_user.role == "student":
        query = query.where(TeacherResource.is_published.is_(True))
    elif current_user.role == "teacher":
        # Teachers see published materials plus their own drafts
        query = query.where(
            (TeacherResource.is_published.is_(True)) | (TeacherResource.teacher_id == current_user.id)
        )

    if subject and subject.strip() and subject.lower() != "all":
        query = query.where(TeacherResource.subject.ilike(f"%{subject.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            (TeacherResource.title.ilike(term))
            | (TeacherResource.original_filename.ilike(term))
            | (TeacherResource.subject.ilike(term))
        )

    query = query.order_by(TeacherResource.created_at.desc())
    res = await db.execute(query)
    rows = res.all()

    result = []
    for r, t_name in rows:
        result.append(
            TeacherResourceOut(
                id=r.id,
                teacher_id=r.teacher_id,
                teacher_name=t_name,
                title=r.title,
                description=r.description,
                subject=r.subject,
                original_filename=r.original_filename,
                file_size=r.file_size,
                mime_type=r.mime_type,
                is_published=r.is_published,
                created_at=r.created_at,
            )
        )
    return result


@router.get("/{resource_id}/download")
async def download_resource(
    resource_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Secure download endpoint for teacher study materials.
    Verifies user authentication, publication status, and logs download activity.
    """
    resource = await db.get(TeacherResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    if current_user.role == "student" and not resource.is_published:
        raise HTTPException(status_code=403, detail="This material is not currently published.")

    file_path = Path(resource.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Resource file not found on server.")

    # Record student download activity
    if current_user.role == "student":
        activity = StudentActivity(
            user_id=current_user.id,
            event_type="teacher_notes_downloaded",
            document_id=resource.id,
            metadata_json=f'{{"title": "{resource.title}", "filename": "{resource.original_filename}"}}',
        )
        db.add(activity)
        await db.commit()

    return FileResponse(
        path=str(file_path),
        filename=resource.original_filename,
        media_type=resource.mime_type,
    )


@router.patch("/{resource_id}", response_model=TeacherResourceOut)
async def update_resource(
    resource_id: int,
    update_data: ResourceUpdate,
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Update title, description, subject or publish status of a resource."""
    resource = await db.get(TeacherResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    if resource.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="You can only manage resources you uploaded.")

    if update_data.title is not None:
        resource.title = update_data.title.strip()
    if update_data.description is not None:
        resource.description = update_data.description.strip()
    if update_data.subject is not None:
        resource.subject = update_data.subject.strip()
    if update_data.is_published is not None:
        resource.is_published = update_data.is_published

    await db.commit()
    await db.refresh(resource)

    return TeacherResourceOut(
        id=resource.id,
        teacher_id=resource.teacher_id,
        teacher_name=current_teacher.full_name,
        title=resource.title,
        description=resource.description,
        subject=resource.subject,
        original_filename=resource.original_filename,
        file_size=resource.file_size,
        mime_type=resource.mime_type,
        is_published=resource.is_published,
        created_at=resource.created_at,
    )


@router.delete("/{resource_id}")
async def delete_resource(
    resource_id: int,
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Delete a teacher resource and clean up disk storage."""
    resource = await db.get(TeacherResource, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found.")

    if resource.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="You can only delete resources you uploaded.")

    # Remove file
    Path(resource.file_path).unlink(missing_ok=True)

    await db.delete(resource)
    await db.commit()
    return {"status": "success", "message": f"Resource '{resource.title}' deleted successfully."}

