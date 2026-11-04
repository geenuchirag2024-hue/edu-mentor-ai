"""FastAPI routes for safe educational media streaming and video registry.

Supports:
- HTTP 206 Partial Content range requests for seamless HTML5 <video> seeking
- Path traversal protection and allowlist validation
- Video thumbnail serving with browser caching
- Public video registry listing
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, StreamingResponse

from backend.config import PROJECT_ROOT
from backend.video_matcher import load_registry, format_public_video_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["media"])

VIDEOS_DIR = (PROJECT_ROOT / "backend" / "media" / "videos").resolve()
THUMBNAILS_DIR = (PROJECT_ROOT / "backend" / "media" / "thumbnails").resolve()

# Strict filename safety pattern: alphanumeric with underscores, dashes, and exact extension
SAFE_VIDEO_RE = re.compile(r"^[a-zA-Z0-9_\-]+\.mp4$")
SAFE_THUMB_RE = re.compile(r"^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$")


@router.get("/registry")
async def get_video_registry() -> list[dict[str, Any]]:
    """List all registered and active educational videos."""
    videos = load_registry()
    return [format_public_video_response(v) for v in videos if v.get("active", True)]


@router.get("/videos/{filename}")
async def stream_video(filename: str, request: Request) -> Response:
    """Stream educational video with HTTP byte-range support for browser playback."""
    if not SAFE_VIDEO_RE.match(filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid video filename.")

    file_path = (VIDEOS_DIR / filename).resolve()
    # Verify path is safely contained inside VIDEOS_DIR
    try:
        file_path.relative_to(VIDEOS_DIR)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if not file_path.is_file() or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found.")

    file_size = file_path.stat().st_size
    range_header = request.headers.get("range")

    # If no Range header, stream whole file with Accept-Ranges
    if not range_header:
        return FileResponse(
            file_path,
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "public, max-age=86400",
            },
        )

    # Parse Range: bytes=start-end
    match = re.match(r"bytes=(\d+)-(\d*)", range_header.strip())
    if not match:
        return Response(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    start = int(match.group(1))
    end_str = match.group(2)
    end = int(end_str) if end_str else file_size - 1

    if start >= file_size or end >= file_size or start > end:
        return Response(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{file_size}"},
        )

    chunk_length = end - start + 1

    def iterfile():
        with open(file_path, "rb") as f:
            f.seek(start)
            bytes_left = chunk_length
            while bytes_left > 0:
                chunk = f.read(min(128 * 1024, bytes_left))
                if not chunk:
                    break
                bytes_left -= len(chunk)
                yield chunk

    return StreamingResponse(
        iterfile(),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type="video/mp4",
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(chunk_length),
            "Cache-Control": "public, max-age=86400",
        },
    )


@router.get("/thumbnails/{filename}")
async def get_thumbnail(filename: str) -> FileResponse:
    """Serve video thumbnail with browser caching."""
    if not SAFE_THUMB_RE.match(filename):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid thumbnail filename.")

    file_path = (THUMBNAILS_DIR / filename).resolve()
    try:
        file_path.relative_to(THUMBNAILS_DIR)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    if not file_path.is_file() or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thumbnail not found.")

    ext = file_path.suffix.lower()
    media_type = "image/jpeg" if ext in (".jpg", ".jpeg") else f"image/{ext[1:]}"

    return FileResponse(
        file_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=604800"},
    )

