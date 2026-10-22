"""Document text extraction for PDF and TXT with robust error handling."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(pdf_path: Path) -> list[dict[str, str | int]]:
    """Extract page-by-page text from PDF file using PyMuPDF. Ignores empty pages."""
    try:
        import fitz
    except ImportError:
        logger.error("fitz (PyMuPDF) is not installed.")
        return []

    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:
        logger.error("Failed to open PDF %s: %s", pdf_path, exc)
        return []

    pages: list[dict[str, str | int]] = []
    try:
        for page_num in range(len(doc)):
            try:
                page = doc[page_num]
                text = page.get_text("text").strip()
                if text:
                    pages.append({"page": page_num + 1, "text": text})
            except Exception as page_exc:
                logger.warning("Failed extracting page %d of %s: %s", page_num + 1, pdf_path, page_exc)
    finally:
        doc.close()

    return pages


def extract_text_from_file(file_path: Path) -> list[dict[str, str | int]]:
    """Extract text from supported files (.pdf, .txt). Returns list of page dicts."""
    if not file_path.exists():
        logger.warning("File does not exist: %s", file_path)
        return []

    ext = file_path.suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext in (".txt", ".md"):
        try:
            text = file_path.read_text(encoding="utf-8", errors="replace").strip()
            if text:
                return [{"page": 1, "text": text}]
            return []
        except Exception as exc:
            logger.error("Failed reading text file %s: %s", file_path, exc)
            return []
    else:
        logger.warning("Unsupported file extension %s for %s", ext, file_path)
        return []

