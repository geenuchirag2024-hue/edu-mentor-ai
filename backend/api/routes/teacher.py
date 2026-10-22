"""Teacher-only management routes."""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
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

