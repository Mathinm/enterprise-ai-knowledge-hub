"use client";

import React from "react";
import { Brain, Search, User } from "lucide-react";

interface HeaderProps {
  health: { status: string; total_documents: number; total_chunks: number } | null;
}

export default function Header({ health }: HeaderProps) {
  return (
    <header className="h-16 bg-[#111827] border-b border-[#334155] flex items-center px-6 gap-4 shrink-0 z-10">
      {/* Logo + Title */}
      <div className="flex items-center gap-3 mr-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div className="hidden sm:block">
          <h1 className="text-sm font-700 text-[#F8FAFC] leading-tight tracking-tight">
            Enterprise AI Hub
          </h1>
          <p className="text-[10px] text-[#94A3B8] leading-tight">
            Knowledge Retrieval Platform
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Search documents…"
          className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-9 pr-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:outline-none focus:border-[#3B82F6] transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* LLM Badge with animated gradient accent & glowing pulsing dot */}
        <div className="relative group flex items-center gap-2 bg-[#1E293B] border border-[#334155] hover:border-[#3B82F6]/50 rounded-xl px-3 py-1.5 transition-all duration-300 shadow-sm hover:shadow-blue-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
          </span>
          <span className="text-xs font-semibold bg-gradient-to-r from-[#F8FAFC] to-[#94A3B8] bg-clip-text text-transparent hidden sm:block">
            Gemini 2.5 Flash
          </span>
        </div>

        {/* Health badge */}
        {health && (
          <div
            className={`hidden lg:flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all duration-300 ${
              health.status === "ok"
                ? "bg-green-500/10 border-green-500/20 text-[#22C55E]"
                : "bg-yellow-500/10 border-yellow-500/20 text-[#F59E0B]"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${health.status === "ok" ? "bg-[#22C55E] animate-pulse" : "bg-[#F59E0B]"}`} />
            {health.status === "ok" ? "Healthy" : "Degraded"}
          </div>
        )}

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] flex items-center justify-center cursor-pointer shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all duration-200">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </header>
  );
}
