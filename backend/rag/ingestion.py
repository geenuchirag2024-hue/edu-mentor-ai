"""PDF text extraction using PyMuPDF."""

from pathlib import Path

import fitz


def extract_text_from_pdf(pdf_path: Path) -> list[dict[str, str | int]]:
    doc = fitz.open(pdf_path)
    pages: list[dict[str, str | int]] = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").strip()
        if text:
            pages.append({"page": page_num + 1, "text": text})
    doc.close()
    return pages
