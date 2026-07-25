"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Upload, File, Trash2, CheckCircle, Loader2, FileText,
  AlertCircle, X, Database
} from "lucide-react";
import { api, Document } from "@/lib/api";

type UploadStep = "idle" | "extracting" | "chunking" | "embedding" | "saving" | "done" | "error";

interface UploadState {
  file: File;
  step: UploadStep;
  error?: string;
  result?: { chunks_created: number };
}

interface DocumentsTabProps {
  documents: Document[];
  onDocumentsChange: () => void;
}

const STEPS: { key: UploadStep; label: string }[] = [
  { key: "extracting", label: "Extracting" },
  { key: "chunking", label: "Chunking" },
  { key: "embedding", label: "Embedding" },
  { key: "saving", label: "Saving" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function FileTypeIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    pdf: "text-red-400",
    docx: "text-blue-400",
    txt: "text-gray-400",
    md: "text-purple-400",
    html: "text-orange-400",
  };
  return (
    <div className={`${colors[type] || "text-gray-400"}`}>
      <FileText className="w-5 h-5" />
    </div>
  );
}

function ProgressSteps({ step }: { step: UploadStep }) {
  const stepOrder = ["extracting", "chunking", "embedding", "saving", "done"];
  const currentIdx = stepOrder.indexOf(step);

  return (
    <div className="flex items-center gap-2 mt-2">
      {STEPS.map(({ key, label }, idx) => {
        const done = currentIdx > idx;
        const active = stepOrder[currentIdx] === key;
        return (
          <React.Fragment key={key}>
            <div className="flex items-center gap-1">
              {done ? (
                <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
              ) : active ? (
                <Loader2 className="w-3.5 h-3.5 text-[#3B82F6] animate-spin" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-[#334155]" />
              )}
              <span
                className={`text-[10px] ${
                  done ? "text-[#22C55E]" : active ? "text-[#3B82F6]" : "text-[#94A3B8]"
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-px max-w-[24px] ${done ? "bg-[#22C55E]" : "bg-[#334155]"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function DocumentsTab({ documents, onDocumentsChange }: DocumentsTabProps) {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED = [".pdf", ".docx", ".txt", ".md", ".html"];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const processFile = useCallback(async (file: File) => {
    const id = crypto.randomUUID();
    const uploadState: UploadState = { file, step: "extracting" };
    setUploads((p) => [...p, uploadState]);

    const update = (step: UploadStep, extra?: Partial<UploadState>) =>
      setUploads((p) =>
        p.map((u) => (u.file === file ? { ...u, step, ...extra } : u))
      );

    try {
      update("extracting");
      await sleep(400);
      update("chunking");
      await sleep(400);
      update("embedding");
      const result = await api.uploadDocument(file);
      update("saving");
      await sleep(300);
      update("done", { result: { chunks_created: result.chunks_created } });
      onDocumentsChange();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      update("error", { error: msg });
    }
  }, [onDocumentsChange]);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const valid = arr.filter((f) =>
      ALLOWED.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    valid.forEach(processFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.deleteDocument(id);
      onDocumentsChange();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const clearUpload = (file: File) =>
    setUploads((p) => p.filter((u) => u.file !== file));

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 gap-6">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${
          isDragOver
            ? "border-[#3B82F6] bg-[#3B82F6]/10"
            : "border-[#334155] hover:border-[#3B82F6]/50 hover:bg-[#1E293B]/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md,.html"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
          isDragOver ? "bg-[#3B82F6]/20" : "bg-[#1E293B]"
        }`}>
          <Upload className={`w-7 h-7 ${isDragOver ? "text-[#3B82F6]" : "text-[#94A3B8]"}`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#F8FAFC]">
            Drop files here or click to browse
          </p>
          <p className="text-xs text-[#94A3B8] mt-1">
            Supports: PDF, DOCX, TXT, Markdown, HTML
          </p>
        </div>
      </div>

      {/* Upload Progress Cards */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#F8FAFC]">Upload Queue</h3>
          {uploads.map((u, i) => (
            <div
              key={i}
              className={`bg-[#1E293B] border rounded-xl px-4 py-3 ${
                u.step === "error"
                  ? "border-red-500/30"
                  : u.step === "done"
                  ? "border-green-500/30"
                  : "border-[#334155]"
              }`}
            >
              <div className="flex items-center gap-3">
                <FileTypeIcon type={u.file.name.split(".").pop() || ""} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#F8FAFC] truncate">
                    {u.file.name}
                  </p>
                  <p className="text-xs text-[#94A3B8]">{formatBytes(u.file.size)}</p>
                </div>
                {(u.step === "done" || u.step === "error") && (
                  <button onClick={() => clearUpload(u.file)} className="text-[#94A3B8] hover:text-[#F8FAFC]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {u.step === "error" ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-[#EF4444]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {u.error}
                </div>
              ) : u.step === "done" ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-[#22C55E]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Indexed {u.result?.chunks_created} chunks successfully
                </div>
              ) : (
                <ProgressSteps step={u.step} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document List */}
      <div>
        <h3 className="text-sm font-semibold text-[#F8FAFC] mb-3">
          Indexed Documents{" "}
          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-[#1E293B] text-[#94A3B8] text-[10px] border border-[#334155]">
            {documents.length}
          </span>
        </h3>

        {documents.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#334155] rounded-2xl">
            <Database className="w-10 h-10 text-[#334155] mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">No documents indexed yet.</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Upload files above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 flex items-center gap-4 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:border-[#3B82F6]/50 transition-all duration-300"
              >
                <FileTypeIcon type={doc.file_type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#F8FAFC] truncate">
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[#94A3B8]">
                      {formatBytes(doc.file_size)}
                    </span>
                    <span className="text-[#334155]">·</span>
                    <span className="text-xs text-[#94A3B8]">
                      {doc.chunk_count} chunks
                    </span>
                    <span className="text-[#334155]">·</span>
                    <span className="text-xs text-[#94A3B8]">
                      {formatDate(doc.ingested_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-[#22C55E] border border-green-500/20">
                    <CheckCircle className="w-3 h-3" />
                    Indexed
                  </span>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-500/10 transition-all disabled:opacity-50"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
