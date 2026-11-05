"""Student PDF / Document Tutor routes for Edu-Mentor AI V3.

Provides:
- Fast asynchronous PDF and notes upload with SHA-256 deduplication
- Document processing status polling
- Document-isolated question answering with page citations and monotonic latency tracking
- Per-document conversation history
- Document deletion and retry
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, status, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user
from backend.api.schemas.documents import (
    DocumentAskRequest,
    DocumentAskResponse,
    DocumentHistoryResponse,
    DocumentMessageOut,
    DocumentOut,
    DocumentUploadResponse,
)
from backend.config import PROJECT_ROOT
from backend.db.database import AsyncSessionLocal, get_db
from backend.db.models import Document, DocumentChunk, DocumentMessage, User
from backend.services.document_service import (
    answer_document_question,
    compute_sha256,
    process_document_pipeline,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_BASE_DIR = PROJECT_ROOT / "data" / "user_documents"
UPLOAD_BASE_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    subject: str = Form(default="General"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Asynchronously upload a PDF or text document.
    Returns immediately after saving file and scheduling background extraction & embedding.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    ext = Path(file.filename).suffix.lower()
    if ext not in (".pdf", ".txt", ".md"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Please upload a PDF (.pdf) or text (.txt, .md) file.",
        )

    data = await file.read()
    if not data or len(data.strip()) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File size exceeds the 25MB limit. Please upload a smaller document.",
        )

    content_hash = compute_sha256(data)

    # Deduplication check: Has this exact user already uploaded an identical file that is ready?
    dup_query = select(Document).where(
        Document.user_id == current_user.id,
        Document.content_hash == content_hash,
        Document.status == "ready",
    )
    dup_res = await db.execute(dup_query)
    existing_doc = dup_res.scalars().first()

    if existing_doc:
        return DocumentUploadResponse(
            document=DocumentOut.model_validate(existing_doc),
            message="Document already processed and ready for questions.",
            reused=True,
        )

    # Save to user-specific directory on disk
    user_dir = UPLOAD_BASE_DIR / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex[:8]}_{Path(file.filename).name.replace(' ', '_')}"
    target_path = user_dir / safe_name
    target_path.write_bytes(data)

    # Create Document record in DB with status "uploaded"
    doc = Document(
        user_id=current_user.id,
        filename=Path(file.filename).name,
        content_hash=content_hash,
        file_path=str(target_path),
        file_size=len(data),
        page_count=0,
        chunk_count=0,
        status="uploaded",
        error_message=None,
        subject=subject.strip() or "General",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Schedule background indexing pipeline
    background_tasks.add_task(process_document_pipeline, doc.id, AsyncSessionLocal)

    return DocumentUploadResponse(
        document=DocumentOut.model_validate(doc),
        message="Document uploaded successfully. Processing text and generating embeddings in background.",
        reused=False,
    )


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all documents uploaded by the authenticated student."""
    query = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    res = await db.execute(query)
    docs = res.scalars().all()
    return [DocumentOut.model_validate(d) for d in docs]


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get status and metadata for a specific document."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found.")
    return DocumentOut.model_validate(doc)


@router.post("/{document_id}/ask", response_model=DocumentAskResponse)
async def ask_document(
    document_id: int,
    request: DocumentAskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a question grounded specifically in the target document."""
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = await answer_document_question(
            db=db,
            user_id=current_user.id,
            document_id=document_id,
            question=request.question.strip(),
            language=request.language or "en",
        )
        return DocumentAskResponse(**result)
    except PermissionError as p_err:
        raise HTTPException(status_code=403, detail=str(p_err)) from p_err
    except ValueError as v_err:
        raise HTTPException(status_code=400, detail=str(v_err)) from v_err
    except Exception as exc:
        logger.exception("Error answering document question: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate answer from document: {str(exc)}",
        ) from exc


@router.get("/{document_id}/history", response_model=DocumentHistoryResponse)
async def get_document_history(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve isolated chat history for a specific document."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found.")

    query = (
        select(DocumentMessage)
        .where(DocumentMessage.document_id == document_id, DocumentMessage.user_id == current_user.id)
        .order_by(DocumentMessage.created_at.asc())
    )
    res = await db.execute(query)
    records = res.scalars().all()

    messages_out = []
    for r in records:
        sources_list: list[int] = []
        if r.sources_json:
            try:
                sources_list = json.loads(r.sources_json)
            except Exception:
                sources_list = []
        messages_out.append(
            DocumentMessageOut(
                id=r.id,
                role=r.role,
                content=r.content,
                sources=sources_list,
                created_at=r.created_at,
            )
        )

    return DocumentHistoryResponse(
        document_id=doc.id,
        filename=doc.filename,
        messages=messages_out,
    )


@router.delete("/{document_id}/history")
async def clear_document_history(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clear chat conversation history for a specific document without deleting the document or its index."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found.")

    delete_stmt = (
        delete(DocumentMessage)
        .where(
            DocumentMessage.document_id == document_id,
            DocumentMessage.user_id == current_user.id,
        )
    )
    await db.execute(delete_stmt)
    await db.commit()

    logger.info("Cleared chat history for document %d (user %d)", document_id, current_user.id)
    return {
        "status": "success",
        "message": f"Conversation history for '{doc.filename}' cleared successfully.",
        "document_id": document_id,
    }


@router.delete("/{document_id}")
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a student's document and its associated chunks and chat history."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove file from disk
    file_p = Path(doc.file_path)
    file_p.unlink(missing_ok=True)

    # Remove vector file
    vector_file = PROJECT_ROOT / "data" / "user_documents" / "vectors" / f"{document_id}.json"
    vector_file.unlink(missing_ok=True)

    await db.delete(doc)
    await db.commit()
    return {"status": "success", "message": f"Document '{doc.filename}' deleted successfully."}


@router.post("/{document_id}/retry")
async def retry_document_processing(
    document_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retry indexing a document that previously failed."""
    doc = await db.get(Document, document_id)
    if not doc or doc.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found.")

    doc.status = "uploaded"
    doc.error_message = None
    await db.commit()

    background_tasks.add_task(process_document_pipeline, doc.id, AsyncSessionLocal)
    return {"status": "success", "message": "Document re-processing scheduled."}

