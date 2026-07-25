import logging
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types as genai_types

from config import (
    GEMINI_API_KEY,
    GEMINI_GENERATION_MODEL,
    CONVERSATION_WINDOW_SIZE,
    DEFAULT_TOP_K,
    DEFAULT_SIMILARITY_THRESHOLD,
)
from vectorstore import VectorStore

logger = logging.getLogger(__name__)

# ─── Prompt Template ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Enterprise AI Knowledge Hub Assistant.

YOUR CORE ROLE:
You answer user questions using the provided enterprise document CONTEXT. If the question is conversational or general knowledge, adapt your behavior according to the rules below.

BEHAVIOR RULES:

1. GROUNDED IN DOCUMENTS (When relevant CONTEXT is provided):
- Base your primary answer on the CONTEXT provided below.
- Synthesize information across multiple context chunks into one single, coherent response.
- Use **bold headers** and bullet points or numbered lists for readability.
- Do NOT make up facts, dates, or policies not present in the context.

2. GENERAL KNOWLEDGE FALLBACK (When CONTEXT is empty or does NOT contain the answer):
- If no relevant context is provided OR if the provided context does not contain the answer, answer the question helpfully using your general knowledge.
- You MUST start your response with this exact note on its own line:
> **Note**: *This response is based on general knowledge because no relevant information was found in your uploaded enterprise documents.*
- Do NOT include or fake document citations when relying on general knowledge.

3. NO FILLER PREAMBLE:
- Provide a direct, structured answer without conversational filler (unless answering a casual greeting).
"""


GREETING_PATTERNS = [
    r"^(hi|hello|hey|heya|hola|greetings|good\s+(morning|afternoon|evening|day))\b",
    r"^(how\s+are\s+you|how\s+it\s+going|what['\s]*s\s+up|howdy)\b",
    r"^(who\s+are\s+you|what\s+can\s+you\s+do|what\s+is\s+this|help|what\s+are\s+your\s+capabilities)\b",
    r"^(thanks|thank\s+you|thx|cheers|bye|goodbye|see\s+ya)\b",
]

def _is_greeting(text: str) -> bool:
    """Detect if a user message is a casual greeting or small talk."""
    clean = text.strip().lower()
    clean_no_punct = re.sub(r"[^\w\s]", "", clean).strip()

    if clean_no_punct in {
        "hi", "hello", "hey", "heya", "greetings", "good morning",
        "good afternoon", "good evening", "how are you", "whats up",
        "what can you do", "who are you", "help", "thanks", "thank you",
        "bye", "goodbye"
    }:
        return True

    for pattern in GREETING_PATTERNS:
        if re.search(pattern, clean_no_punct):
            if len(clean_no_punct.split()) <= 6:
                return True
    return False


def _build_context_block(chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved chunks into a readable context block."""
    if not chunks:
        return "No relevant context found in uploaded documents."
    lines = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk["metadata"]
        score = chunk["relevance_score"]
        lines.append(
            f"--- Context Chunk {i} | Source: {meta.get('filename', 'unknown')} "
            f"| Relevance: {score:.2%} ---"
        )
        lines.append(chunk["text"])
        lines.append("")
    return "\n".join(lines)


def _build_history_text(history: List[Dict[str, str]]) -> str:
    """Convert sliding-window conversation history to a formatted string."""
    if not history:
        return ""
    lines = ["\n--- Previous Conversation ---"]
    for turn in history:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        lines.append(f"{role.capitalize()}: {content}")
    lines.append("--- End of Previous Conversation ---\n")
    return "\n".join(lines)


def _compile_sources(retrieved_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format cited sources list."""
    sources = []
    seen_chunk_ids = set()
    for chunk in retrieved_chunks:
        meta = chunk["metadata"]
        chunk_id = meta.get("doc_id", "") + f"_chunk_{meta.get('chunk_index', 0)}"
        if chunk_id not in seen_chunk_ids:
            seen_chunk_ids.add(chunk_id)
            sources.append(
                {
                    "filename": meta.get("filename", "unknown"),
                    "chunk_id": chunk_id,
                    "chunk_index": meta.get("chunk_index", 0),
                    "doc_id": meta.get("doc_id", ""),
                    "relevance_score": chunk["relevance_score"],
                    "text_preview": chunk["text"][:300] + (
                        "..." if len(chunk["text"]) > 300 else ""
                    ),
                }
            )
    return sources


# ─── RAG Engine ───────────────────────────────────────────────────────────────

GENERATION_FALLBACK_MODELS = [
    GEMINI_GENERATION_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-flash-latest",
]

def _generate_with_fallback(client: genai.Client, full_prompt: str) -> tuple[str, str]:
    last_err = None
    for model_name in GENERATION_FALLBACK_MODELS:
        try:
            res = client.models.generate_content(
                model=model_name,
                contents=full_prompt,
                config=genai_types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.2,
                ),
            )
            return res.text.strip(), model_name
        except Exception as e:
            last_err = e
            continue
    raise RuntimeError(f"All Gemini generation models failed. Last error: {last_err}")


class RAGEngine:
    def __init__(self, vector_store: VectorStore) -> None:
        self._vs = vector_store
        self._client = genai.Client(api_key=GEMINI_API_KEY)

    def query(
        self,
        question: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = DEFAULT_TOP_K,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        source_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute a query with 3 behavior paths:
        1. Greeting / small talk -> skip retrieval, respond with warm greeting (answer_source="greeting")
        2. Grounded document answer -> retrieve chunks above threshold & cite sources (answer_source="documents")
        3. General knowledge fallback -> answer question with general knowledge note & no citations (answer_source="general_knowledge")
        """
        # ── 1. Greeting Check ─────────────────────────────────────────────────
        if _is_greeting(question):
            logger.info("Greeting detected for: '%s'. Skipping retrieval.", question)
            greeting_prompt = (
                f"The user said: '{question}'. Respond warmly, introduce yourself as the Enterprise AI Knowledge Hub assistant, "
                "and briefly explain that you can answer questions about their uploaded enterprise documents."
            )
            answer_text, used_model = _generate_with_fallback(self._client, greeting_prompt)
            return {
                "answer": answer_text,
                "sources": [],
                "retrieved_chunks": 0,
                "model": used_model,
                "answer_source": "greeting",
            }

        # ── 2. Vector Retrieval ───────────────────────────────────────────────
        where_filter: Optional[Dict] = None
        if source_filter:
            where_filter = {"filename": source_filter}

        retrieved_chunks = self._vs.query(
            query_text=question,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
            where=where_filter,
        )

        # Sliding window conversation history
        window = []
        if conversation_history:
            window = conversation_history[-(CONVERSATION_WINDOW_SIZE * 2):]
        history_text = _build_history_text(window)

        # ── 3. Case A: Zero Chunks Above Threshold (General Knowledge) ────────
        if not retrieved_chunks:
            logger.info("Zero chunks retrieved above threshold %.2f for question: '%s'. Using General Knowledge fallback.", similarity_threshold, question)
            context_block = "No relevant context found in uploaded enterprise documents."
            full_prompt = (
                f"{history_text}"
                f"CONTEXT:\n{context_block}\n\n"
                f"USER QUESTION: {question}\n\n"
                "Provide a helpful answer using general knowledge following Rule 2 (GENERAL KNOWLEDGE FALLBACK).\n"
                "ANSWER:"
            )
            answer_text, used_model = _generate_with_fallback(self._client, full_prompt)
            
            gk_note_prefix = "> **Note**: *This response is based on general knowledge because no relevant information was found in your uploaded enterprise documents.*"
            if "general knowledge" not in answer_text.lower():
                answer_text = f"{gk_note_prefix}\n\n{answer_text}"

            return {
                "answer": answer_text,
                "sources": [],
                "retrieved_chunks": 0,
                "model": used_model,
                "answer_source": "general_knowledge",
            }

        # ── 4. Case B: Chunks Retrieved (Grounded OR General Knowledge) ───────
        context_block = _build_context_block(retrieved_chunks)
        full_prompt = (
            f"{history_text}"
            f"CONTEXT:\n{context_block}\n\n"
            f"USER QUESTION: {question}\n\n"
            "ANSWER:"
        )

        logger.info(
            "Generating answer for question: '%s...', %d chunks retrieved.",
            question[:80],
            len(retrieved_chunks),
        )
        answer_text, used_model = _generate_with_fallback(self._client, full_prompt)

        # Determine if LLM fell back to general knowledge
        is_general_knowledge = "general knowledge" in answer_text.lower() and "uploaded" in answer_text.lower()

        if is_general_knowledge:
            return {
                "answer": answer_text,
                "sources": [],
                "retrieved_chunks": len(retrieved_chunks),
                "model": used_model,
                "answer_source": "general_knowledge",
            }

        # Grounded in documents
        sources = _compile_sources(retrieved_chunks)
        return {
            "answer": answer_text,
            "sources": sources,
            "retrieved_chunks": len(retrieved_chunks),
            "model": used_model,
            "answer_source": "documents",
        }


# ─── Singleton ────────────────────────────────────────────────────────────────
_rag_engine: Optional[RAGEngine] = None


def get_rag_engine(vector_store: VectorStore) -> RAGEngine:
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = RAGEngine(vector_store)
    return _rag_engine

