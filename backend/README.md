# Enterprise AI Knowledge Hub — Backend

The backend is a high-performance Python **FastAPI** service that handles multi-format document ingestion, semantic chunking, vector embedding generation via **Google Gemini**, local storage in **ChromaDB**, and grounded RAG answer synthesis.

---

## Technical Stack

- **Framework**: FastAPI + Uvicorn
- **Language**: Python 3.10+
- **Vector Storage**: ChromaDB (local persistent SQLite + HNSW cosine index)
- **AI Models (Google Gemini)**:
  - **Generation**: `gemini-2.5-flash` (with automatic fallback to `gemini-2.0-flash` / `gemini-flash-latest`)
  - **Embeddings**: `gemini-embedding-001` (with automatic fallback to `text-embedding-004`)
- **Document Loaders**: PyPDF, python-docx, BeautifulSoup4, `langchain-text-splitters`

---

## Quick Setup

### 1. Create Virtual Environment & Install Dependencies

```bash
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create `.env` inside the `backend/` directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Run the Server

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs (Swagger): `http://localhost:8000/docs`

---

## API Endpoint Reference

### 1. `GET /health`
Returns service status, ChromaDB connection, and total document/chunk counts.

**Response**:
```json
{
  "status": "ok",
  "chromadb": "connected",
  "gemini_api_key_configured": true,
  "collection": "enterprise_rag",
  "total_documents": 5,
  "total_chunks": 42,
  "generation_model": "gemini-2.5-flash",
  "embedding_model": "gemini-embedding-001"
}
```

---

### 2. `POST /upload`
Uploads and ingests a document (`.pdf`, `.docx`, `.txt`, `.md`, `.html`).

**Request**: `multipart/form-data` with `file` field.

**Response**:
```json
{
  "status": "success",
  "doc_id": "3a8f9c1b-4d2e-4f1a-[#abc]",
  "filename": "HR_Policy_Handbook_2026.md",
  "chunks_created": 8,
  "file_size": 14250
}
```

---

### 3. `GET /documents`
Lists all ingested documents with metadata.

**Response**:
```json
[
  {
    "id": "3a8f9c1b-4d2e-4f1a-[#abc]",
    "filename": "HR_Policy_Handbook_2026.md",
    "file_type": "md",
    "file_size": 14250,
    "chunk_count": 8,
    "ingested_at": "2026-07-25T19:30:00+00:00",
    "status": "indexed"
  }
]
```

---

### 4. `DELETE /documents/{doc_id}`
Deletes a document and all its indexed vector chunks from ChromaDB.

**Response**:
```json
{
  "status": "deleted",
  "doc_id": "3a8f9c1b-4d2e-4f1a-[#abc]",
  "chunks_removed": 8
}
```

---

### 5. `POST /query`
Performs query analysis with 3 behavior paths:
1. **Greetings / Small Talk** (`answer_source: "greeting"`): Skips ChromaDB retrieval, responds with a warm introduction. No citations.
2. **Document Grounded** (`answer_source: "documents"`): Retrieves chunks above similarity threshold, synthesizes answer, and attaches source citations.
3. **General Knowledge Fallback** (`answer_source: "general_knowledge"`): If no relevant chunks are found or documents don't answer the question, provides a helpful general knowledge response prefixed with an explicit disclaimer note. No fake citations attached.

**Request**:
```json
{
  "question": "What is our remote work policy?",
  "conversation_history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello! How can I help?" }
  ],
  "source_filter": null
}
```

**Response**:
```json
{
  "answer": "TechCorp supports a hybrid-first work culture...\n\nSource: HR_Policy_Handbook_2026.md",
  "sources": [
    {
      "filename": "HR_Policy_Handbook_2026.md",
      "chunk_id": "doc_id_chunk_0",
      "chunk_index": 0,
      "doc_id": "3a8f9c1b",
      "relevance_score": 0.8174,
      "text_preview": "TechCorp supports a hybrid-first work culture..."
    }
  ],
  "retrieved_chunks": 6,
  "model": "gemini-2.5-flash",
  "answer_source": "documents"
}
```

---

### 6. `GET /settings`
Returns current RAG hyperparameters.

**Response**:
```json
{
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "top_k": 6,
  "similarity_threshold": 0.25,
  "generation_model": "gemini-2.5-flash",
  "embedding_model": "gemini-embedding-001"
}
```

---

### 7. `POST /settings`
Updates RAG hyperparameters at runtime.

**Request**:
```json
{
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "top_k": 8,
  "similarity_threshold": 0.30
}
```

**Response**:
```json
{
  "status": "updated",
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "top_k": 8,
  "similarity_threshold": 0.3
}
```

---

## Resilient Model-Fallback Architecture

To guarantee zero downtime across regional API updates or deprecated model endpoints, the backend implements automatic fallback mechanisms:

1. **Embedding Fallback (`vectorstore.py`)**:
   `gemini-embedding-001` $\rightarrow$ `text-embedding-004` $\rightarrow$ `models/gemini-embedding-001` $\rightarrow$ `models/text-embedding-004`
2. **Generation Fallback (`rag_engine.py`)**:
   `gemini-2.5-flash` $\rightarrow$ `gemini-2.0-flash` $\rightarrow$ `gemini-1.5-flash` $\rightarrow$ `gemini-flash-latest`

If a model endpoint returns a `404 NOT_FOUND` or version error, the pipeline dynamically fails over to the next candidate model without throwing user-facing errors.

---

## Similarity Threshold Enforcement

In `vectorstore.py`, retrieved chunks are scored for cosine relevance ($1 - \text{distance}$). Chunks with `relevance_score < similarity_threshold` are filtered out before context assembly. If all retrieved chunks fall below the threshold, `VectorStore.query()` returns an empty list `[]`, cleanly triggering the prompt fallback: *"I couldn't find relevant information in the uploaded documents for this question."*
