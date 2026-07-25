"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send, Bot, User, ChevronDown, ChevronUp, FileText,
  Loader2, MessageSquare, Sparkles
} from "lucide-react";
import { api, ConversationTurn, QuerySource } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: QuerySource[];
  model?: string;
  retrievedChunks?: number;
  answerSource?: "documents" | "general_knowledge" | "greeting";
  timestamp: Date;
}

const STORAGE_KEY = "enterprise_ai_chat_history";

function loadMessagesFromStorage(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch (err) {
    console.error("Failed to load chat history from localStorage", err);
    return [];
  }
}

interface AIAssistantTabProps {
  onSourcesChange: (sources: QuerySource[]) => void;
}

export default function AIAssistantTab({ onSourcesChange }: AIAssistantTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load saved chat history on mount
  useEffect(() => {
    const savedMessages = loadMessagesFromStorage();
    setMessages(savedMessages);
    setIsHydrated(true);
  }, []);

  // Save chat history to localStorage whenever messages change (guarded by isHydrated)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error("Failed to save chat history to localStorage", err);
    }
  }, [messages, isHydrated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getHistory = (): ConversationTurn[] =>
    messages.map((m) => ({ role: m.role, content: m.content }));

  const handleSubmit = async () => {
    const q = input.trim();
    if (!q || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.query(q, getHistory());
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.answer,
        sources: res.sources,
        model: res.model,
        retrievedChunks: res.retrieved_chunks,
        answerSource: res.answer_source,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      onSourcesChange(res.sources);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Query failed";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `⚠️ Error: ${errMsg}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {!isHydrated || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[#F8FAFC] mb-2">
                Enterprise AI Assistant
              </h2>
              <p className="text-[#94A3B8] text-sm max-w-sm">
                Ask any question about your uploaded documents. The AI will
                retrieve the most relevant content and cite its sources.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
              {[
                "What is our remote work policy?",
                "Summarize Q2 2026 financial results",
                "What are the MFA requirements?",
                "What is the 30-60-90 day onboarding plan?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-left px-4 py-3 rounded-xl bg-[#1E293B] border border-[#334155] text-sm text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#3B82F6] hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md hover:shadow-blue-500/10 transition-all duration-200 hover:bg-[#1E293B]/90"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-3 duration-300">
              {msg.role === "user" ? (
                <div className="flex justify-end gap-3">
                  <div className="max-w-[75%]">
                    <div className="bg-gradient-to-r from-[#3B82F6] to-[#2563EB] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white shadow-lg shadow-blue-500/20">
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-1 text-right">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shrink-0 mt-1 shadow-md shadow-blue-500/20">
                    <User className="w-4 h-4 text-white" />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <Bot className="w-4 h-4 text-[#3B82F6]" />
                  </div>
                  <div className="max-w-[80%] flex-1">
                    <div className="bg-[#1E293B] border border-[#334155] hover:border-[#3B82F6]/30 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[#F8FAFC] shadow-md transition-all duration-200">
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                    </div>

                    {/* Sources Section */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleSources(msg.id)}
                          className="flex items-center gap-2 text-xs text-[#94A3B8] hover:text-[#3B82F6] transition-colors"
                        >
                          <FileText className="w-3 h-3 text-[#3B82F6]" />
                          {msg.sources.length} source
                          {msg.sources.length !== 1 ? "s" : ""} retrieved
                          {expandedSources.has(msg.id) ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                        {expandedSources.has(msg.id) && (
                          <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            {msg.sources.map((src, i) => (
                              <div
                                key={src.chunk_id}
                                className="bg-[#0F172A] border border-[#334155] hover:border-[#3B82F6]/40 rounded-xl p-3 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-[#3B82F6]/20 text-[#3B82F6] text-[10px] font-bold flex items-center justify-center">
                                      {i + 1}
                                    </span>
                                    <span className="text-xs font-medium text-[#F8FAFC] truncate max-w-[160px]">
                                      {src.filename}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
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
                                      {(src.relevance_score * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                <p className="text-[11px] text-[#94A3B8] leading-relaxed line-clamp-3">
                                  {src.text_preview}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <p className="text-[10px] text-[#94A3B8]">
                        {formatTime(msg.timestamp)}
                        {msg.model && <> · {msg.model}</>}
                        {msg.retrievedChunks != null && msg.answerSource !== "greeting" && (
                          <> · {msg.retrievedChunks} chunks</>
                        )}
                      </p>

                      {msg.answerSource === "documents" && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-[#3B82F6] border border-blue-500/30">
                          📄 Document Grounded
                        </span>
                      )}
                      {msg.answerSource === "general_knowledge" && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-[#F59E0B] border border-amber-500/30">
                          🌐 General Knowledge
                        </span>
                      )}
                      {msg.answerSource === "greeting" && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 text-[#8B5CF6] border border-purple-500/30">
                          👋 Greeting
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#3B82F6] animate-pulse" />
            </div>
            <div className="bg-[#1E293B] border border-[#334155] rounded-2xl rounded-tl-sm px-4 py-3 shadow-md">
              <div className="flex gap-1.5 items-center">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="px-4 pb-4 pt-2 border-t border-[#334155] bg-[#0F172A]">
        {error && (
          <div className="mb-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-[#EF4444]">
            {error}
          </div>
        )}
        <div className="flex gap-3 items-end bg-[#1E293B] border border-[#334155] focus-within:border-[#3B82F6]/70 focus-within:ring-2 focus-within:ring-[#3B82F6]/20 rounded-2xl px-4 py-3 transition-all duration-200 shadow-md">
          <MessageSquare className="w-5 h-5 text-[#94A3B8] shrink-0 mb-0.5" />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your documents…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#F8FAFC] placeholder-[#94A3B8] resize-none focus:outline-none max-h-32 leading-relaxed"
            style={{ minHeight: "24px" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-md shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#94A3B8] text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
