"""Teacher-only management routes."""

from __future__ import annotations

from datetime import datetime, timezone
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_teacher
from backend.api.schemas.auth import UserOut
from backend.api.schemas.teacher import (
    AttendanceRecordOut,
    AttendanceSummary,
    LeaveLetterOut,
    MarkAttendanceRequest,
    ReviewLeaveLetterRequest,
    SubmitLeaveLetterRequest,
)
from backend.config import PROJECT_ROOT
from backend.db.database import get_db
from backend.db.models import AttendanceRecord, LeaveLetter, User

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
    """List curriculum materials uploaded by faculty with subject and indexing info."""
    raw_materials_dir = PROJECT_ROOT / "data" / "ml-content" / "raw"
    materials = []
    if raw_materials_dir.exists():
        for f in sorted(raw_materials_dir.iterdir()):
            if f.is_file() and not f.name.startswith("."):
                name = f.name.lower()
                if "dbms" in name or "database" in name or "sql" in name:
                    subj = "DBMS"
                elif "deep_learning" in name or "deep" in name or "neural" in name:
                    subj = "Deep Learning"
                else:
                    subj = "Machine Learning"

                # Check if processed chunks exist
                proc_file = PROJECT_ROOT / "data" / "ml-content" / "processed" / f"{f.stem}.json"
                chunks_count = 0
                if proc_file.exists():
                    try:
                        import json
                        chunks_count = len(json.loads(proc_file.read_text(encoding="utf-8")))
                    except Exception:
                        chunks_count = 0

                materials.append(
                    {
                        "filename": f.name,
                        "subject": subj,
                        "size_bytes": f.stat().st_size,
                        "extension": f.suffix.lower(),
                        "chunks_count": chunks_count,
                    }
                )
    return {"materials": materials}


@router.post("/content/upload")
async def upload_content(
    file: UploadFile = File(...),
    subject: str = Form(default="Machine Learning"),
    current_teacher: User = Depends(require_teacher),
):
    """Upload and index new course material (PDF or TXT) into the RAG vector store."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".pdf", ".txt"):
        raise HTTPException(
            status_code=400, detail="Only PDF and TXT documents are allowed for curriculum"
        )

    data = await file.read()
    if not data or len(data.strip()) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    MAX_SIZE = 15 * 1024 * 1024  # 15 MB
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowable limit of 15MB")

    # Sanitize filename
    safe_filename = Path(file.filename).name.replace(" ", "_")
    raw_dir = PROJECT_ROOT / "data" / "ml-content" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    target_path = raw_dir / safe_filename

    # Save to disk
    with open(target_path, "wb") as f:
        f.write(data)

    # Text extraction
    from backend.rag.ingestion import extract_text_from_file
    pages = extract_text_from_file(target_path)
    if not pages:
        # Clean up file on extraction failure so un-indexable artifacts don't linger
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="No readable text could be extracted from this document. Cannot index empty document.",
        )

    # Chunking
    from backend.config import get_settings
    from backend.rag.chunking import chunk_text
    settings = get_settings()

    all_chunks: list[str] = []
    metadata: list[dict] = []
    clean_subj = subject.strip() if subject and subject.strip() in ("Machine Learning", "DBMS", "Deep Learning") else "Machine Learning"

    for page in pages:
        p_text = str(page.get("text") or "").strip()
        if not p_text:
            continue
        chunks = chunk_text(p_text, chunk_size=settings.rag_chunk_size, overlap=settings.rag_chunk_overlap)
        for idx, chunk in enumerate(chunks):
            chunk_clean = chunk.strip()
            if not chunk_clean:
                continue
            all_chunks.append(chunk_clean)
            cid = f"{target_path.stem}_p{page.get('page', 1)}_c{idx}"
            metadata.append({
                "chunk_id": cid,
                "id": cid,
                "subject": clean_subj,
                "source": safe_filename,
                "source_file": safe_filename,
                "topic": target_path.stem.replace("_", " ").title(),
                "page": page.get("page", 1),
                "chunk_index": len(all_chunks) - 1,
            })

    if not all_chunks:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail="Document text was insufficient to generate semantic chunks for indexing.",
        )

    # Embeddings & Vector Indexing
    from backend.rag.embeddings import get_embeddings
    from backend.rag.vector_store import get_vector_store

    store = get_vector_store()
    if not store.is_available:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Course vector store is unavailable. Document could not be indexed.",
        )

    try:
        embedder = get_embeddings()
        vectors = embedder.embed(all_chunks)
        indexed_count = store.upsert_chunks(all_chunks, vectors, metadata)
    except Exception as exc:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate embeddings and index document: {exc}",
        ) from exc

    if indexed_count == 0:
        target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Indexing failed: zero chunks were committed to the vector store.",
        )

    # Save processed record
    processed_dir = PROJECT_ROOT / "data" / "ml-content" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)
    out_file = processed_dir / f"{target_path.stem}.json"
    import json
    out_file.write_text(
        json.dumps(
            [{"id": m["chunk_id"], "subject": m["subject"], "text": c, "source": m["source"]}
             for c, m in zip(all_chunks, metadata)],
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    return {
        "status": "success",
        "filename": safe_filename,
        "subject": clean_subj,
        "size_bytes": len(data),
        "chunks_indexed": indexed_count,
        "uploaded_by": current_teacher.email,
        "message": f"Successfully indexed {indexed_count} chunks for '{safe_filename}' under {clean_subj}.",
    }


# =========================================================================
# Attendance Management
# =========================================================================


@router.get("/attendance", response_model=AttendanceSummary)
async def get_attendance(
    date: str,
    subject: str = "Machine Learning",
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve attendance roster for a specific date and subject."""
    students_query = select(User).where(User.role == "student").order_by(User.full_name)
    students_res = await db.execute(students_query)
    students = students_res.scalars().all()

    att_query = select(AttendanceRecord).where(
        AttendanceRecord.date == date,
        AttendanceRecord.subject == subject,
    )
    att_res = await db.execute(att_query)
    existing_records = {rec.student_id: rec for rec in att_res.scalars().all()}

    records_out: list[AttendanceRecordOut] = []
    present_cnt = 0
    absent_cnt = 0
    late_cnt = 0

    for s in students:
        rec = existing_records.get(s.id)
        if rec:
            status_val = rec.status
            rec_id = rec.id
            remarks_val = rec.remarks
            updated_at = rec.updated_at
        else:
            status_val = "present"
            rec_id = 0
            remarks_val = None
            updated_at = None

        if status_val == "present":
            present_cnt += 1
        elif status_val == "late":
            late_cnt += 1
        elif status_val == "absent":
            absent_cnt += 1

        records_out.append(
            AttendanceRecordOut(
                id=rec_id,
                student_id=s.id,
                student_name=s.full_name,
                student_email=s.email,
                date=date,
                subject=subject,
                status=status_val,
                remarks=remarks_val,
                updated_at=updated_at,
            )
        )

    total_enrolled = len(students)
    rate = round((present_cnt + (late_cnt * 0.5)) / total_enrolled * 100, 1) if total_enrolled > 0 else 0.0

    return AttendanceSummary(
        date=date,
        subject=subject,
        total_enrolled=total_enrolled,
        total_marked=len(existing_records),
        present_count=present_cnt,
        absent_count=absent_cnt,
        late_count=late_cnt,
        attendance_rate=rate,
        records=records_out,
    )


@router.post("/attendance", response_model=AttendanceSummary)
async def mark_attendance(
    req: MarkAttendanceRequest,
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Save or update attendance records for students on a given date."""
    for item in req.records:
        stmt = select(AttendanceRecord).where(
            AttendanceRecord.student_id == item.student_id,
            AttendanceRecord.date == req.date,
            AttendanceRecord.subject == req.subject,
        )
        res = await db.execute(stmt)
        record = res.scalar_one_or_none()
        if record:
            record.status = item.status
            record.remarks = item.remarks
            record.teacher_id = current_teacher.id
        else:
            new_record = AttendanceRecord(
                student_id=item.student_id,
                teacher_id=current_teacher.id,
                date=req.date,
                subject=req.subject,
                status=item.status,
                remarks=item.remarks,
            )
            db.add(new_record)

    await db.commit()
    return await get_attendance(date=req.date, subject=req.subject, current_teacher=current_teacher, db=db)


# =========================================================================
# Leave Letters Workflow
# =========================================================================


@router.get("/leave-letters", response_model=list[LeaveLetterOut])
async def list_leave_letters(
    status: str | None = None,
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """List student leave letters with optional status filtering."""
    query = select(LeaveLetter).order_by(LeaveLetter.created_at.desc())
    if status and status in ("pending", "approved", "rejected"):
        query = query.where(LeaveLetter.status == status)
    res = await db.execute(query)
    letters = res.scalars().all()

    out: list[LeaveLetterOut] = []
    for l in letters:
        student_res = await db.execute(select(User).where(User.id == l.student_id))
        student = student_res.scalar_one_or_none()
        reviewer_name = None
        if l.reviewed_by_id:
            rev_res = await db.execute(select(User).where(User.id == l.reviewed_by_id))
            rev = rev_res.scalar_one_or_none()
            reviewer_name = rev.full_name if rev else None

        out.append(
            LeaveLetterOut(
                id=l.id,
                student_id=l.student_id,
                student_name=student.full_name if student else "Unknown Student",
                student_email=student.email if student else "",
                subject=l.subject,
                reason=l.reason,
                start_date=l.start_date,
                end_date=l.end_date,
                status=l.status,
                teacher_remarks=l.teacher_remarks,
                reviewed_by_id=l.reviewed_by_id,
                reviewed_by_name=reviewer_name,
                reviewed_at=l.reviewed_at,
                created_at=l.created_at,
            )
        )
    return out


@router.post("/leave-letters/{leave_id}/review", response_model=LeaveLetterOut)
async def review_leave_letter(
    leave_id: int,
    req: ReviewLeaveLetterRequest,
    current_teacher: User = Depends(require_teacher),
    db: AsyncSession = Depends(get_db),
):
    """Teacher review (approval or rejection) of student leave request."""
    stmt = select(LeaveLetter).where(LeaveLetter.id == leave_id)
    res = await db.execute(stmt)
    letter = res.scalar_one_or_none()
    if not letter:
        raise HTTPException(status_code=404, detail="Leave letter not found")

    letter.status = req.status
    letter.teacher_remarks = req.teacher_remarks
    letter.reviewed_by_id = current_teacher.id
    letter.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(letter)

    student_res = await db.execute(select(User).where(User.id == letter.student_id))
    student = student_res.scalar_one_or_none()

    return LeaveLetterOut(
        id=letter.id,
        student_id=letter.student_id,
        student_name=student.full_name if student else "Unknown Student",
        student_email=student.email if student else "",
        subject=letter.subject,
        reason=letter.reason,
        start_date=letter.start_date,
        end_date=letter.end_date,
        status=letter.status,
        teacher_remarks=letter.teacher_remarks,
        reviewed_by_id=letter.reviewed_by_id,
        reviewed_by_name=current_teacher.full_name,
        reviewed_at=letter.reviewed_at,
        created_at=letter.created_at,
    )


@router.post("/leave-letters/submit", response_model=LeaveLetterOut)
async def submit_leave_letter(
    req: SubmitLeaveLetterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Student submission of a leave letter request."""
    letter = LeaveLetter(
        student_id=current_user.id,
        subject=req.subject,
        reason=req.reason,
        start_date=req.start_date,
        end_date=req.end_date,
        status="pending",
    )
    db.add(letter)
    await db.commit()
    await db.refresh(letter)

    return LeaveLetterOut(
        id=letter.id,
        student_id=letter.student_id,
        student_name=current_user.full_name,
        student_email=current_user.email,
        subject=letter.subject,
        reason=letter.reason,
        start_date=letter.start_date,
        end_date=letter.end_date,
        status=letter.status,
        teacher_remarks=None,
        reviewed_by_id=None,
        reviewed_by_name=None,
        reviewed_at=None,
        created_at=letter.created_at,
    )


@router.get("/leave-letters/my", response_model=list[LeaveLetterOut])
async def list_my_leave_letters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve leave letters submitted by the currently logged-in student."""
    query = select(LeaveLetter).where(LeaveLetter.student_id == current_user.id).order_by(LeaveLetter.created_at.desc())
    res = await db.execute(query)
    letters = res.scalars().all()
    return [
        LeaveLetterOut(
            id=l.id,
            student_id=l.student_id,
            student_name=current_user.full_name,
            student_email=current_user.email,
            subject=l.subject,
            reason=l.reason,
            start_date=l.start_date,
            end_date=l.end_date,
            status=l.status,
            teacher_remarks=l.teacher_remarks,
            reviewed_by_id=l.reviewed_by_id,
            reviewed_by_name=None,
            reviewed_at=l.reviewed_at,
            created_at=l.created_at,
        )
        for l in letters
    ]


