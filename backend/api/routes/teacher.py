"""Teacher-only management routes."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import require_teacher
from backend.api.schemas.auth import UserOut
from backend.config import PROJECT_ROOT
from backend.db.database import get_db
from backend.db.models import User

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


@router.get("/overview")
async def teacher_overview(
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Teacher overview: student counts, course curriculum stats."""
    # Count registered students from database
    students_count_query = select(func.count(User.id)).where(User.role == "student")
    students_res = await db.execute(students_count_query)
    students_count = students_res.scalar() or 0

    # Count raw course materials
    raw_materials_dir = PROJECT_ROOT / "data" / "ml-content" / "raw"
    materials_count = 0
    if raw_materials_dir.exists():
        materials_count = len(
            [f for f in raw_materials_dir.iterdir() if f.is_file() and not f.name.startswith(".")]
        )

    return {
        "teacher": {
            "id": current_teacher.id,
            "full_name": current_teacher.full_name,
            "email": current_teacher.email,
            "role": current_teacher.role,
        },
        "stats": {
            "enrolled_students": students_count,
            "course_materials_count": materials_count,
            "curriculum_modules": 7,
            "active_quizzes": 3,
        },
    }


@router.get("/students", response_model=list[UserOut])
async def list_students(
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List all registered students."""
    query = select(User).where(User.role == "student").order_by(User.created_at.desc())
    result = await db.execute(query)
    students = result.scalars().all()
    return [UserOut.model_validate(s) for s in students]


@router.get("/materials")
async def list_materials(current_teacher: User = Depends(require_teacher)):
    """List curriculum materials uploaded by faculty."""
    raw_materials_dir = PROJECT_ROOT / "data" / "ml-content" / "raw"
    materials = []
    if raw_materials_dir.exists():
        for f in raw_materials_dir.iterdir():
            if f.is_file() and not f.name.startswith("."):
                materials.append(
                    {
                        "filename": f.name,
                        "size_bytes": f.stat().st_size,
                        "extension": f.suffix.lower(),
                    }
                )
    return {"materials": materials}


@router.post("/content/upload")
async def upload_content(
    file: UploadFile = File(...),
    current_teacher: User = Depends(require_teacher),
):
    """Upload new syllabus or course material (PDF or TXT)."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".pdf", ".txt"):
        raise HTTPException(
            status_code=400, detail="Only PDF and TXT documents are allowed for curriculum"
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    raw_dir = PROJECT_ROOT / "data" / "ml-content" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    target_path = raw_dir / file.filename

    with open(target_path, "wb") as f:
        f.write(data)

    return {
        "status": "success",
        "filename": file.filename,
        "size_bytes": len(data),
        "uploaded_by": current_teacher.email,
        "message": f"Successfully added {file.filename} to course materials repository.",
    }
