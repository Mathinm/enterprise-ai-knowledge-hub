"""
document_processor.py - Multi-format document ingestion and chunking.
Supports: PDF, DOCX, TXT, Markdown, HTML
"""
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Any

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter  # type: ignore

logger = logging.getLogger(__name__)


# ─── Individual loaders ───────────────────────────────────────────────────────

def _load_pdf(file_path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(file_path))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    return "\n\n".join(pages)


def _load_docx(file_path: Path) -> str:
    from docx import Document
    doc = Document(str(file_path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def _load_txt_md(file_path: Path) -> str:
    encodings = ["utf-8", "latin-1", "cp1252"]
    for enc in encodings:
        try:
            return file_path.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Unable to decode {file_path.name} with any supported encoding.")


def _load_html(file_path: Path) -> str:
    from bs4 import BeautifulSoup
    html = _load_txt_md(file_path)
    soup = BeautifulSoup(html, "html.parser")
    # Remove script and style tags
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    # Collapse blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ─── Main processor ───────────────────────────────────────────────────────────

LOADERS = {
    ".pdf":  _load_pdf,
    ".docx": _load_docx,
    ".txt":  _load_txt_md,
    ".md":   _load_txt_md,
    ".html": _load_html,
}


def load_document(file_path: Path) -> str:
    """Load raw text from a document file based on its extension."""
    suffix = file_path.suffix.lower()
    loader = LOADERS.get(suffix)
    if loader is None:
        raise ValueError(f"Unsupported file type: {suffix}")
    return loader(file_path)


def chunk_document(
    text: str,
    filename: str,
    file_size: int,
    doc_id: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
) -> List[Dict[str, Any]]:
    """
    Split raw text into overlapping chunks with rich metadata.
    Returns a list of dicts: {id, text, metadata}.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    raw_chunks: List[str] = splitter.split_text(text)

    ext = Path(filename).suffix.lower().lstrip(".")
    now = datetime.now(timezone.utc).isoformat()

    chunks = []
    for idx, chunk_text in enumerate(raw_chunks):
        chunk_id = f"{doc_id}_chunk_{idx}"
        chunks.append({
            "id": chunk_id,
            "text": chunk_text,
            "metadata": {
                "doc_id": doc_id,
                "filename": filename,
                "file_type": ext,
                "file_size": file_size,
                "chunk_index": idx,
                "total_chunks": len(raw_chunks),
                "char_count": len(chunk_text),
                "ingested_at": now,
            },
        })
    return chunks


def process_file(
    file_path: Path,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    doc_id: str | None = None,
) -> tuple[str, List[Dict[str, Any]]]:
    """
    Full ingestion pipeline for a single file.
    Returns (doc_id, list_of_chunks).
    """
    if doc_id is None:
        doc_id = str(uuid.uuid4())

    logger.info("Loading document: %s", file_path.name)
    text = load_document(file_path)
    if not text.strip():
        raise ValueError(f"Document '{file_path.name}' is empty after extraction.")

    file_size = file_path.stat().st_size
    chunks = chunk_document(
        text=text,
        filename=file_path.name,
        file_size=file_size,
        doc_id=doc_id,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    logger.info("Produced %d chunks from '%s'", len(chunks), file_path.name)
    return doc_id, chunks
