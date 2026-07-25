"""
vectorstore.py - ChromaDB interface using Google Gemini text-embedding-004.
"""
import logging
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings
from google import genai
from google.genai import types as genai_types

from config import (
    CHROMA_DB_PATH,
    CHROMA_COLLECTION_NAME,
    GEMINI_API_KEY,
    GEMINI_EMBEDDING_MODEL,
)

logger = logging.getLogger(__name__)


EMBEDDING_FALLBACK_MODELS = [
    GEMINI_EMBEDDING_MODEL,
    "gemini-embedding-001",
    "text-embedding-004",
    "models/gemini-embedding-001",
    "models/text-embedding-004",
]

def _embed_text_with_fallback(client: genai.Client, text: str, task_type: str) -> List[float]:
    last_err = None
    for model_name in EMBEDDING_FALLBACK_MODELS:
        try:
            res = client.models.embed_content(
                model=model_name,
                contents=text,
                config=genai_types.EmbedContentConfig(task_type=task_type),
            )
            return res.embeddings[0].values
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"All Gemini embedding models failed. Last error: {last_err}")


class GeminiEmbeddingFunction(chromadb.EmbeddingFunction):
    """
    Custom ChromaDB EmbeddingFunction that calls the Gemini
    embedding API with model fallback.
    """

    def __call__(self, input: chromadb.Documents) -> chromadb.Embeddings:
        client = genai.Client(api_key=GEMINI_API_KEY)
        embeddings = []
        for text in input:
            vec = _embed_text_with_fallback(client, text, "RETRIEVAL_DOCUMENT")
            embeddings.append(vec)
        return embeddings


class VectorStore:
    """Manages the ChromaDB collection for the RAG pipeline."""

    def __init__(self) -> None:
        self._client = chromadb.PersistentClient(
            path=CHROMA_DB_PATH,
            settings=Settings(anonymized_telemetry=False),
        )
        self._embedding_fn = GeminiEmbeddingFunction()
        self._collection = self._client.get_or_create_collection(
            name=CHROMA_COLLECTION_NAME,
            embedding_function=self._embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB initialised. Collection '%s' has %d documents.",
            CHROMA_COLLECTION_NAME,
            self._collection.count(),
        )

    # ─── Write ────────────────────────────────────────────────────────────────

    def add_chunks(self, chunks: List[Dict[str, Any]]) -> None:
        """Index a list of chunk dicts produced by document_processor."""
        ids = [c["id"] for c in chunks]
        documents = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        # ChromaDB batch limit ~5000; split if necessary
        BATCH = 500
        for i in range(0, len(ids), BATCH):
            self._collection.add(
                ids=ids[i : i + BATCH],
                documents=documents[i : i + BATCH],
                metadatas=metadatas[i : i + BATCH],
            )
        logger.info("Indexed %d chunks.", len(ids))

    def delete_document(self, doc_id: str) -> int:
        """Delete all chunks belonging to a document. Returns chunks removed."""
        results = self._collection.get(where={"doc_id": doc_id})
        chunk_ids = results.get("ids", [])
        if chunk_ids:
            self._collection.delete(ids=chunk_ids)
            logger.info("Deleted %d chunks for doc_id='%s'.", len(chunk_ids), doc_id)
        return len(chunk_ids)

    # ─── Query ────────────────────────────────────────────────────────────────

    def query(
        self,
        query_text: str,
        top_k: int = 6,
        similarity_threshold: float = 0.0,
        where: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        """
        Similarity search using Gemini embeddings.
        Returns list of {text, metadata, relevance_score} sorted by relevance,
        filtering out results below similarity_threshold.
        """
        client = genai.Client(api_key=GEMINI_API_KEY)
        query_embedding = _embed_text_with_fallback(client, query_text, "RETRIEVAL_QUERY")

        kwargs: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": min(top_k, self._collection.count() or 1),
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            kwargs["where"] = where

        results = self._collection.query(**kwargs)

        retrieved: List[Dict[str, Any]] = []
        if not results["ids"] or not results["ids"][0]:
            return retrieved

        for doc, meta, dist in zip(
            results["documents"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            # Cosine distance → similarity score (0–1)
            relevance_score = round(1.0 - dist, 4)
            if relevance_score >= similarity_threshold:
                retrieved.append(
                    {
                        "text": doc,
                        "metadata": meta,
                        "relevance_score": relevance_score,
                    }
                )
        # Sort highest relevance first
        retrieved.sort(key=lambda x: x["relevance_score"], reverse=True)
        return retrieved

    # ─── Stats ────────────────────────────────────────────────────────────────

    def count_chunks(self) -> int:
        return self._collection.count()

    def list_documents(self) -> List[Dict[str, Any]]:
        """
        Return one metadata record per unique doc_id (the first chunk's metadata).
        """
        total = self._collection.count()
        if total == 0:
            return []

        all_items = self._collection.get(include=["metadatas"])
        seen: Dict[str, Dict] = {}
        chunk_counts: Dict[str, int] = {}

        for meta in all_items["metadatas"]:
            doc_id = meta.get("doc_id", "unknown")
            chunk_counts[doc_id] = chunk_counts.get(doc_id, 0) + 1
            if doc_id not in seen:
                seen[doc_id] = meta

        docs = []
        for doc_id, meta in seen.items():
            docs.append(
                {
                    "id": doc_id,
                    "filename": meta.get("filename", ""),
                    "file_type": meta.get("file_type", ""),
                    "file_size": meta.get("file_size", 0),
                    "chunk_count": chunk_counts.get(doc_id, 0),
                    "ingested_at": meta.get("ingested_at", ""),
                    "status": "indexed",
                }
            )
        # Sort newest first
        docs.sort(key=lambda d: d["ingested_at"], reverse=True)
        return docs

    def is_healthy(self) -> bool:
        try:
            self._collection.count()
            return True
        except Exception:
            return False


# ─── Singleton ────────────────────────────────────────────────────────────────
_vector_store: Optional[VectorStore] = None


def get_vector_store() -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
