"use client";

import React from "react";
import { FileText, ChevronRight, Activity } from "lucide-react";
import type { QuerySource } from "@/lib/api";

interface RightPanelProps {
  sources: QuerySource[];
}

export default function RightPanel({ sources }: RightPanelProps) {
  return (
    <aside className="w-72 shrink-0 hidden xl:flex flex-col bg-[#111827] border-l border-[#334155] overflow-hidden">
      <div className="p-4 border-b border-[#334155]">
        <h3 className="text-sm font-semibold text-[#F8FAFC] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#3B82F6]" />
          Context Panel
        </h3>
      </div>

      {/* Sources */}
      <div className="flex-1 overflow-y-auto p-4">
        {sources.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-[#334155] mx-auto mb-3" />
            <p className="text-xs text-[#94A3B8]">
              Retrieved document chunks will appear here after each query.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">
              Retrieved Sources ({sources.length})
            </p>
            {sources.map((src, i) => (
              <div
                key={src.chunk_id}
                className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 hover:border-[#3B82F6]/40 transition-colors"
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="w-5 h-5 rounded-md bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs font-medium text-[#F8FAFC] leading-tight break-all">
                    {src.filename}
                  </p>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#94A3B8]">
                    Chunk #{src.chunk_index}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      src.relevance_score > 0.8
                        ? "bg-green-500/15 text-[#22C55E]"
                        : src.relevance_score > 0.6
                        ? "bg-blue-500/15 text-[#3B82F6]"
                        : "bg-yellow-500/15 text-[#F59E0B]"
                    }`}
                  >
                    {(src.relevance_score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed line-clamp-4">
                  {src.text_preview}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                  <span className="truncate font-mono">{src.chunk_id.slice(-12)}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline Status */}
      <div className="border-t border-[#334155] p-4">
        <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-3 font-medium">
          Pipeline
        </p>
        <div className="space-y-2">
          {[
            { label: "Embedding", model: "text-embedding-004", color: "bg-[#8B5CF6]" },
            { label: "Generation", model: "gemini-1.5-flash", color: "bg-[#3B82F6]" },
            { label: "Vector DB", model: "ChromaDB", color: "bg-[#22C55E]" },
          ].map(({ label, model, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
              <span className="text-[11px] text-[#94A3B8]">
                {label}:{" "}
                <span className="text-[#F8FAFC] font-medium">{model}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
