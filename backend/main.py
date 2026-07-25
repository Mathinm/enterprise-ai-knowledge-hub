"""
main.py - FastAPI application entry point for the Enterprise AI Knowledge Hub.

Endpoints:
  POST   /upload                  - Ingest a document
  GET    /documents               - List all indexed documents
  DELETE /documents/{doc_id}      - Remove a document from the store
  POST   /query                   - RAG query with conversational memory
  GET    /health                  - Service + ChromaDB health
  GET    /settings                - Current RAG settings
  POST   /settings                - Update RAG settings
"""
import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import (
    ALLOWED_EXTENSIONS,
    CHROMA_COLLECTION_NAME,
    CORS_ORIGINS,
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_TOP_K,
    DEFAULT_SIMILARITY_THRESHOLD,
    GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL,
    GEMINI_GENERATION_MODEL,
    UPLOAD_DIR,
)
from document_processor import process_file
from vectorstore import VectorStore, get_vector_store
from rag_engine import RAGEngine, get_rag_engine

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Enterprise AI Knowledge Hub API",
    description="RAG pipeline powered by Google Gemini & ChromaDB",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory settings state ─────────────────────────────────────────────────
_settings: Dict[str, Any] = {
    "chunk_size": DEFAULT_CHUNK_SIZE,
    "chunk_overlap": DEFAULT_CHUNK_OVERLAP,
    "top_k": DEFAULT_TOP_K,
    "similarity_threshold": DEFAULT_SIMILARITY_THRESHOLD,
}

# ─── Dependency helpers ───────────────────────────────────────────────────────

def dep_vector_store() -> VectorStore:
    return get_vector_store()


def dep_rag_engine(vs: VectorStore = Depends(dep_vector_store)) -> RAGEngine:
    return get_rag_engine(vs)


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class ConversationTurn(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    conversation_history: Optional[List[ConversationTurn]] = None
    source_filter: Optional[str] = None


class QuerySource(BaseModel):
    filename: str
    chunk_id: str
    chunk_index: int
    doc_id: str
    relevance_score: float
    text_preview: str


class QueryResponse(BaseModel):
    answer: str
    sources: List[QuerySource]
    retrieved_chunks: int
    model: str
    answer_source: str = "documents"


class SettingsModel(BaseModel):
    chunk_size: int = Field(1000, ge=250, le=2000)
    chunk_overlap: int = Field(200, ge=0, le=500)
    top_k: int = Field(6, ge=1, le=20)
    similarity_threshold: float = Field(0.25, ge=0.0, le=1.0)


class DocumentInfo(BaseModel):
    id: str
    filename: str
    file_type: str
    file_size: int
    chunk_count: int
    ingested_at: str
    status: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health(vs: VectorStore = Depends(dep_vector_store)):
    """Service health check."""
    db_ok = vs.is_healthy()
    total_chunks = vs.count_chunks()
    total_docs = len(vs.list_documents())
    api_key_set = bool(GEMINI_API_KEY)
    return {
        "status": "ok" if (db_ok and api_key_set) else "degraded",
        "chromadb": "connected" if db_ok else "error",
        "gemini_api_key_configured": api_key_set,
        "collection": CHROMA_COLLECTION_NAME,
        "total_documents": total_docs,
        "total_chunks": total_chunks,
        "generation_model": GEMINI_GENERATION_MODEL,
        "embedding_model": GEMINI_EMBEDDING_MODEL,
    }


@app.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    vs: VectorStore = Depends(dep_vector_store),
):
    """
    Ingest a document into the RAG pipeline.
    Steps: Save → Load → Chunk → Embed → Store in ChromaDB.
    """
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server.",
        )

    # Save uploaded file to temp location
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    doc_id = str(uuid.uuid4())
    save_path = Path(UPLOAD_DIR) / f"{doc_id}{suffix}"

    try:
        with save_path.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Process (load + chunk)
    try:
        _, chunks = process_file(
            file_path=save_path,
            chunk_size=_settings["chunk_size"],
            chunk_overlap=_settings["chunk_overlap"],
            doc_id=doc_id,
        )
    except ValueError as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Document processing error: {e}")

    # Patch filename in metadata to the original upload name
    original_name = file.filename
    for chunk in chunks:
        chunk["metadata"]["filename"] = original_name

    # Embed + index
    try:
        vs.add_chunks(chunks)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Embedding/indexing error: {e}")

    return {
        "status": "success",
        "doc_id": doc_id,
        "filename": original_name,
        "chunks_created": len(chunks),
        "file_size": save_path.stat().st_size,
    }


@app.get("/documents", response_model=List[DocumentInfo])
async def list_documents(vs: VectorStore = Depends(dep_vector_store)):
    """List all indexed documents with metadata."""
    return vs.list_documents()


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, vs: VectorStore = Depends(dep_vector_store)):
    """Remove a document and all its chunks from ChromaDB."""
    deleted = vs.delete_document(doc_id)
    if deleted == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No document found with id '{doc_id}'.",
        )
    # Clean up saved file if it exists
    for path in Path(UPLOAD_DIR).glob(f"{doc_id}.*"):
        path.unlink(missing_ok=True)
    return {"status": "deleted", "doc_id": doc_id, "chunks_removed": deleted}


@app.post("/query", response_model=QueryResponse)
async def query(
    body: QueryRequest,
    engine: RAGEngine = Depends(dep_rag_engine),
    vs: VectorStore = Depends(dep_vector_store),
):
    """Run a RAG query and return answer with source citations."""
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not configured on the server.",
        )

    history = (
        [{"role": t.role, "content": t.content} for t in body.conversation_history]
        if body.conversation_history
        else []
    )

    try:
        result = engine.query(
            question=body.question,
            conversation_history=history,
            top_k=_settings["top_k"],
            similarity_threshold=_settings["similarity_threshold"],
            source_filter=body.source_filter or None,
        )
    except Exception as e:
        logger.error("RAG query failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Query error: {e}")

    return result


@app.get("/settings")
async def get_settings():
    """Return current RAG hyperparameter settings."""
    return {
        **_settings,
        "generation_model": GEMINI_GENERATION_MODEL,
        "embedding_model": GEMINI_EMBEDDING_MODEL,
    }


@app.post("/settings")
async def update_settings(body: SettingsModel):
    """Update RAG hyperparameters (chunk size, overlap, top_k, similarity_threshold)."""
    _settings["chunk_size"] = body.chunk_size
    _settings["chunk_overlap"] = body.chunk_overlap
    _settings["top_k"] = body.top_k
    _settings["similarity_threshold"] = body.similarity_threshold
    logger.info("Settings updated: %s", _settings)
    return {"status": "updated", **_settings}
