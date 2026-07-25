# Enterprise AI Knowledge Hub — Project Report

**Project**: RAG-Powered Enterprise Document Intelligence Platform
**Tech Stack**: Next.js 16 + Tailwind CSS | Python FastAPI | ChromaDB | Google Gemini
**Version**: 1.1.0 | July 2026

---

## 1. Executive Summary

The **Enterprise AI Knowledge Hub** is a Retrieval-Augmented Generation (RAG) application that transforms static enterprise documents into an interactive, queryable knowledge base. Instead of relying solely on a language model's training memory (which can hallucinate and become outdated), the system retrieves grounded evidence directly from uploaded documents and uses Google Gemini to generate precise, citation-backed answers — while still remaining a genuinely useful assistant for greetings and general questions that fall outside the uploaded document set.

**Problem**: Enterprise teams waste hours searching across PDF reports, policy handbooks, onboarding guides, and technical specifications to find specific answers, while general-purpose LLMs risk hallucinating outdated or fabricated policy details.

**Solution**: A unified AI-powered hub where users upload documents once, then ask natural language questions and receive accurate, source-cited answers in seconds — with a clear distinction between answers grounded in company documents and answers drawn from general knowledge.

---

## 2. System Architecture

```
┌───────────────────────────────────────────────────────────┐
│              Frontend — Next.js 16 + Tailwind CSS          │
│   AI Assistant Tab | Documents Tab | Settings Tab           │
│   Right Context Panel | Footer Status Bar                   │
└───────────────────────────┬───────────────────────────────┘
                             │ REST (fetch)
┌───────────────────────────▼───────────────────────────────┐
│                Backend — Python FastAPI (:8000)             │
│   Document Processor → RecursiveCharacterTextSplitter        │
│   RAG Engine (greeting detection, retrieval, generation,      │
│               sliding-window memory, source citation)         │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   ChromaDB Vector Store    │   │   Google Gemini API        │
│  Persistent SQLite + HNSW  │   │  Generation: gemini-2.5-   │
│  cosine similarity index   │   │  flash (fallback chain to  │
│                             │   │  2.0-flash / 1.5-flash /   │
│                             │   │  gemini-flash-latest)      │
│                             │   │  Embedding: gemini-        │
│                             │   │  embedding-001 (fallback   │
│                             │   │  to text-embedding-004)    │
└───────────────────────────┘   └───────────────────────────┘
```

---

## 3. RAG Pipeline Flow

### 3.1 Document Ingestion Pipeline

```
File Upload → Format Detection (PDF / DOCX / TXT / MD / HTML)
  → Text Extraction (PyPDF / python-docx / UTF-8 decode / BeautifulSoup4)
  → RecursiveCharacterTextSplitter (chunk_size=1000, overlap=200)
  → Chunk + Metadata Assembly (doc_id, filename, chunk_index, char_count)
  → Gemini Embedding (gemini-embedding-001, RETRIEVAL_DOCUMENT task)
  → ChromaDB Persistent Store (HNSW cosine index)
  → Indexed — doc_id returned to client
```

### 3.2 Query & Generation Pipeline

```
User Question
  │
  ▼
Is this a greeting / small talk?
  │
  ├── YES → Skip retrieval entirely → Friendly introduction response
  │          (answer_source = "greeting", no citations)
  │
  └── NO  → Embed question (gemini-embedding-001, RETRIEVAL_QUERY task)
             → ChromaDB cosine similarity search (top_k=6)
             → Filter out chunks below similarity_threshold (0.25)
             │
             ├── Zero chunks survive the threshold
             │     → Answer using general knowledge
             │     → Prefixed with a clear "general knowledge" note
             │     → (answer_source = "general_knowledge", no citations)
             │
             └── One or more chunks survive
                   → Assemble grounded context block
                   → Build prompt: SYSTEM + HISTORY + CONTEXT + QUESTION
                   → Gemini generation (with model fallback chain)
                   → Synthesize across all retrieved chunks into one answer
                   → Attach source citations (filename, chunk id, relevance score)
                   → (answer_source = "documents")
```

This three-path design means the assistant never simply refuses a question — it either answers from your documents (with proof), or clearly tells you it's answering from general knowledge instead, rather than leaving the user with a dead end.

---

## 4. Component Descriptions

### 4.1 Backend Components

| Module | Responsibility |
|--------|---------------|
| `main.py` | FastAPI app with 7 REST endpoints, CORS middleware, Pydantic validation |
| `config.py` | Centralised settings: API keys, paths, default hyperparameters (chunk size/overlap, top-k, similarity threshold) |
| `document_processor.py` | Multi-format loaders, RecursiveCharacterTextSplitter, metadata enrichment |
| `vectorstore.py` | ChromaDB singleton, Gemini embedding function with model fallback, similarity-threshold-aware querying, doc_id-based CRUD |
| `rag_engine.py` | Greeting detection, sliding-window memory, grounded prompt assembly, general-knowledge fallback, Gemini generation with model fallback, citation builder |

### 4.2 Frontend Components

| Component | Responsibility |
|-----------|---------------|
| `Header.tsx` | Logo, search bar, Gemini LLM badge, health indicator, user avatar |
| `Sidebar.tsx` | Collapsible 3-tab navigation with active state indicators |
| `AIAssistantTab.tsx` | Full-height chat, typing indicator, expandable source cards with relevance scores, **persistent chat history** (survives tab close/reload via localStorage), "New chat" reset |
| `DocumentsTab.tsx` | Drag-and-drop upload, animated 4-step progress, document card list with delete |
| `SettingsTab.tsx` | Read-only model cards, interactive sliders (chunk size/overlap/top-k), save API call |
| `RightPanel.tsx` | Retrieved source previews, pipeline component status display |
| `StatusBar.tsx` | ChromaDB connection status, live document/chunk counts |
| `lib/api.ts` | Type-safe API client for all 7 backend endpoints |

---

## 5. Advanced RAG Techniques Implemented

### 5.1 Semantic Chunking
Uses `RecursiveCharacterTextSplitter` with separator hierarchy: `\n\n` → `\n` → `. ` → ` ` — preserving paragraph and sentence boundaries.

### 5.2 Task-Typed Embeddings
- **`RETRIEVAL_DOCUMENT`** during indexing — optimises for retrievability
- **`RETRIEVAL_QUERY`** during querying — optimises for query-document matching

This asymmetric approach improves retrieval quality versus generic embeddings.

### 5.3 Cosine Similarity Scoring with Threshold Enforcement
Converts ChromaDB cosine distance to a 0–1 relevance score. Chunks scoring below `DEFAULT_SIMILARITY_THRESHOLD` (0.25) are discarded before ever reaching the LLM — this is what lets the system reliably detect "nothing relevant was found" instead of forcing the model to guess from weak or irrelevant matches. In the UI, retained scores are colour-coded:
- Green: > 80% match
- Blue: 60–80% match
- Amber: < 60% match

### 5.4 Sliding Window Conversational Memory
Last 6 conversation turns (user + assistant) are prepended to each prompt, enabling multi-turn contextual dialogues.

### 5.5 Three-Mode Grounded Prompt Engineering
Rather than a single rigid "answer or refuse" prompt, the system prompt defines three explicit behaviors:
1. **Greeting/small talk** — detected before retrieval runs, answered conversationally, no citations attached
2. **Grounded in documents** — context chunks synthesized into one coherent, cited answer with bold headers/bullets for readability
3. **General knowledge fallback** — when no chunk clears the similarity threshold, the model still answers helpfully using general knowledge, but is required to prefix the response with an explicit note that this wasn't found in the uploaded documents

### 5.6 Model Fallback Resilience
Google frequently deprecates specific Gemini model IDs (e.g. `gemini-1.5-flash` was fully shut down in September 2025). Rather than hardcoding a single model name, both generation (`GENERATION_FALLBACK_MODELS`) and embedding (`EMBEDDING_FALLBACK_MODELS`) calls try a prioritized list of model IDs and fall back automatically if one is unavailable — including `gemini-flash-latest`, a rolling alias Google keeps pointed at its current recommended model. This makes the application resilient to Gemini's fast-moving deprecation cycle without requiring code changes every few months.

### 5.7 Metadata Filtering
Optional `source_filter` parameter restricts retrieval to a specific document filename for precision queries.

### 5.8 Persistent Client-Side Chat History
Chat history is persisted to the browser's `localStorage` (hydrated safely after mount to avoid SSR/hydration mismatches), so closing and reopening the browser tab restores the conversation instead of starting fresh. A "New chat" control clears it on demand.

---

## 6. API Reference

### POST `/upload`
**Request**: `multipart/form-data` with `file`
**Response**: `{ status, doc_id, filename, chunks_created, file_size }`

### POST `/query`
**Request**: `{ question, conversation_history?, source_filter? }`
**Response**: `{ answer, sources[], retrieved_chunks, model, answer_source }`
`answer_source` is one of `"documents"`, `"general_knowledge"`, or `"greeting"`.

### GET `/documents`
**Response**: `[{ id, filename, file_type, file_size, chunk_count, ingested_at, status }]`

### DELETE `/documents/{doc_id}`
**Response**: `{ status, doc_id, chunks_removed }`

### GET/POST `/settings`
**GET Response**: `{ chunk_size, chunk_overlap, top_k, generation_model, embedding_model }`
**POST Body**: `{ chunk_size, chunk_overlap, top_k }`

### GET `/health`
**Response**: `{ status, chromadb, gemini_api_key_configured, total_documents, total_chunks, generation_model, embedding_model }`

---

## 7. Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0F172A` | Page background |
| Surface | `#111827` | Header, sidebar |
| Card | `#1E293B` | All card components |
| Border | `#334155` | Dividers, card borders |
| Accent Blue | `#3B82F6` | Primary interactive elements |
| Accent Purple | `#8B5CF6` | Secondary accents |
| Success | `#22C55E` | Indexed, healthy states |
| Warning | `#F59E0B` | Medium relevance |
| Error | `#EF4444` | Errors, degraded status |
| Text Primary | `#F8FAFC` | Headings, content |
| Text Secondary | `#94A3B8` | Labels, metadata |
| Font | Inter 400/500/600/700 | All typography |

---

## 8. Sample Dataset

| File | Format | Content |
|------|--------|---------|
| `HR_Policy_Handbook_2026.md` | Markdown | Remote work, PTO, parental leave, code of conduct |
| `Cloud_Security_Architecture_Guide.txt` | Plain text | Zero-trust, IAM, encryption, incident response |
| `Q2_2026_Enterprise_Financial_Report.txt` | Plain text | Revenue, costs, headcount, Q3 guidance |
| `Employee_Onboarding_Guide.html` | HTML | 30-60-90 plan, tools, FAQ, company values |
| `Enterprise_SOP_Guide.pdf` | PDF | Deployment SOP, DB backup, incident runbook |

---

## 9. Known Limitations

- Greeting detection uses pattern matching on short messages; a message combining a greeting with a real question (e.g. *"hi, what's the leave policy?"*) may occasionally be misclassified as a greeting and skip retrieval.
- The `is_general_knowledge` detection for grounded-but-off-topic answers relies on the model including specific note text; phrasing drift in model output could occasionally miss this classification.
- Conversational memory is a fixed sliding window (last 6 turns), not full session summarization.
