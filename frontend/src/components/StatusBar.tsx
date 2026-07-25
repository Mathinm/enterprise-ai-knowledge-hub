"use client";

import React from "react";
import { Database, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { HealthStatus } from "@/lib/api";

interface StatusBarProps {
  health: HealthStatus | null;
  loading: boolean;
}

export default function StatusBar({ health, loading }: StatusBarProps) {
  return (
    <footer className="h-8 bg-[#0F172A] border-t border-[#334155] flex items-center px-6 gap-4 text-xs text-[#94A3B8] shrink-0">
      {loading ? (
        <span className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Connecting to ChromaDB…
        </span>
      ) : health ? (
        <>
          <span className="flex items-center gap-1.5">
            <Database className="w-3 h-3" />
            {health.chromadb === "connected" ? (
              <CheckCircle className="w-3 h-3 text-[#22C55E]" />
            ) : (
              <AlertCircle className="w-3 h-3 text-[#EF4444]" />
            )}
            ChromaDB {health.chromadb === "connected" ? "Connected" : "Error"}
          </span>

          <span className="text-[#334155]">•</span>
          <span>{health.total_documents} Document{health.total_documents !== 1 ? "s" : ""}</span>

          <span className="text-[#334155]">•</span>
          <span>{health.total_chunks} Chunk{health.total_chunks !== 1 ? "s" : ""}</span>

          <span className="text-[#334155]">•</span>
          <span className="hidden sm:inline">
            {health.generation_model} / {health.embedding_model}
          </span>
        </>
      ) : (
        <span className="flex items-center gap-1.5 text-[#EF4444]">
          <AlertCircle className="w-3 h-3" />
          Backend Unavailable — Start the FastAPI server on port 8000
        </span>
      )}
    </footer>
  );
}
