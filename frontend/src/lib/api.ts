const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  ingested_at: string;
  status: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface QuerySource {
  filename: string;
  chunk_id: string;
  chunk_index: number;
  doc_id: string;
  relevance_score: number;
  text_preview: string;
}

export interface QueryResponse {
  answer: string;
  sources: QuerySource[];
  retrieved_chunks: number;
  model: string;
  answer_source?: "documents" | "general_knowledge" | "greeting";
}

export interface HealthStatus {
  status: string;
  chromadb: string;
  gemini_api_key_configured: boolean;
  collection: string;
  total_documents: number;
  total_chunks: number;
  generation_model: string;
  embedding_model: string;
}

export interface Settings {
  chunk_size: number;
  chunk_overlap: number;
  top_k: number;
  similarity_threshold: number;
  generation_model: string;
  embedding_model: string;
}

export interface UploadResult {
  status: string;
  doc_id: string;
  filename: string;
  chunks_created: number;
  file_size: number;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request<HealthStatus>("/health"),

  getDocuments: () => request<Document[]>("/documents"),

  deleteDocument: (id: string) =>
    request<{ status: string; doc_id: string; chunks_removed: number }>(
      `/documents/${id}`,
      { method: "DELETE" }
    ),

  uploadDocument: async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Upload error ${res.status}`);
    }
    return res.json();
  },

  query: (
    question: string,
    conversation_history: ConversationTurn[] = [],
    source_filter?: string
  ) =>
    request<QueryResponse>("/query", {
      method: "POST",
      body: JSON.stringify({ question, conversation_history, source_filter }),
    }),

  getSettings: () => request<Settings>("/settings"),

  updateSettings: (settings: Partial<Settings>) =>
    request<Settings>("/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
};
