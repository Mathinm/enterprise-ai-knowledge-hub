"""
config.py - Central configuration for the Enterprise AI Knowledge Hub backend.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
CHROMA_DB_PATH = str(BASE_DIR / "chroma_db")
UPLOAD_DIR = str(BASE_DIR / "uploads")

# ─── Google Gemini ─────────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_GENERATION_MODEL = "gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"

# ─── ChromaDB ─────────────────────────────────────────────────────────────────
CHROMA_COLLECTION_NAME = "enterprise_rag"

# ─── RAG Default Hyperparameters ──────────────────────────────────────────────
DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 200
DEFAULT_TOP_K = 6
DEFAULT_SIMILARITY_THRESHOLD = 0.25   # Minimum relevance score threshold (0.0 to 1.0)
CONVERSATION_WINDOW_SIZE = 6          # Number of (user, assistant) turns to keep

# ─── Allowed Upload Formats ───────────────────────────────────────────────────
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".html"}

# ─── CORS Origins ─────────────────────────────────────────────────────────────
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
