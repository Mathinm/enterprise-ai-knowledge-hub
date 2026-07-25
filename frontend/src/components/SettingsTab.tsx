"use client";

import React, { useState, useEffect } from "react";
import { Sliders, Cpu, Database, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { api, Settings } from "@/lib/api";

export default function SettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pending, setPending] = useState<Partial<Settings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings()
      .then((s) => { setSettings(s); setPending({}); })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const current = settings ? { ...settings, ...pending } : null;

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      await api.updateSettings({
        chunk_size: current.chunk_size,
        chunk_overlap: current.chunk_overlap,
        top_k: current.top_k,
        similarity_threshold: current.similarity_threshold,
      });
      setSettings((prev) => prev ? { ...prev, ...pending } : prev);
      setPending({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const isDirty = Object.keys(pending).length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Model Info (read-only) */}
      <section>
        <h2 className="text-sm font-semibold text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#8B5CF6]" />
          AI Provider
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
              Generation Model
            </p>
            <p className="text-sm font-semibold text-[#F8FAFC]">
              {current?.generation_model || "—"}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-1">Google Gemini · Read-only</p>
          </div>
          <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4">
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">
              Embedding Model
            </p>
            <p className="text-sm font-semibold text-[#F8FAFC]">
              {current?.embedding_model || "—"}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-1">gemini-embedding-001 · Read-only</p>
          </div>
        </div>
      </section>

      {/* RAG Hyperparameters */}
      <section>
        <h2 className="text-sm font-semibold text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#3B82F6]" />
          RAG Hyperparameters
        </h2>

        <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-5 space-y-6 shadow-md">
          {/* Chunk Size */}
          <SliderField
            label="Chunk Size"
            description="Number of characters per document chunk. Larger chunks preserve more context."
            value={current?.chunk_size ?? 1000}
            min={500}
            max={1000}
            step={250}
            marks={[500, 750, 1000]}
            onChange={(v) => setPending((p) => ({ ...p, chunk_size: v }))}
          />

          {/* Chunk Overlap */}
          <SliderField
            label="Chunk Overlap"
            description="Character overlap between adjacent chunks. Prevents context loss at chunk boundaries."
            value={current?.chunk_overlap ?? 200}
            min={50}
            max={150}
            step={50}
            marks={[50, 100, 150]}
            onChange={(v) => setPending((p) => ({ ...p, chunk_overlap: v }))}
          />

          {/* Top-K */}
          <SliderField
            label="Top-K Retrieval"
            description="Number of document chunks retrieved per query. Bumping to 6-8 retrieves multi-part topics together."
            value={current?.top_k ?? 6}
            min={3}
            max={10}
            step={1}
            marks={[3, 5, 6, 8, 10]}
            onChange={(v) => setPending((p) => ({ ...p, top_k: v }))}
          />

          {/* Similarity Threshold */}
          <SliderField
            label="Similarity Threshold"
            description="Minimum relevance score (0.0 to 1.0) required to include a chunk. Chunks below threshold are filtered out."
            value={current?.similarity_threshold ?? 0.25}
            min={0.0}
            max={1.0}
            step={0.05}
            marks={[0.0, 0.25, 0.5, 0.75, 1.0]}
            onChange={(v) => setPending((p) => ({ ...p, similarity_threshold: v }))}
          />
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 hover:shadow-blue-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save Settings"}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-[#22C55E] animate-in fade-in duration-300">
            <CheckCircle className="w-4 h-4" />
            Settings saved!
          </span>
        )}

        {error && (
          <span className="flex items-center gap-1.5 text-sm text-[#EF4444]">
            <AlertCircle className="w-4 h-4" />
            {error}
          </span>
        )}
      </div>

      {/* ChromaDB Info */}
      <section>
        <h2 className="text-sm font-semibold text-[#F8FAFC] mb-3 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#22C55E]" />
          Vector Database
        </h2>
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 space-y-2">
          <p className="text-xs text-[#94A3B8]">
            <span className="text-[#F8FAFC] font-medium">Provider:</span> ChromaDB (local persistent store)
          </p>
          <p className="text-xs text-[#94A3B8]">
            <span className="text-[#F8FAFC] font-medium">Similarity:</span> Cosine distance (HNSW index)
          </p>
          <p className="text-xs text-[#94A3B8]">
            <span className="text-[#F8FAFC] font-medium">Path:</span> backend/chroma_db/
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── SliderField Component ────────────────────────────────────────────────────
interface SliderFieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  marks: number[];
  onChange: (v: number) => void;
}

function SliderField({ label, description, value, min, max, step, marks, onChange }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-[#F8FAFC]">{label}</label>
        <span className="text-sm font-bold text-[#3B82F6] tabular-nums">{value}</span>
      </div>
      <p className="text-xs text-[#94A3B8] mb-3">{description}</p>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none bg-[#334155] cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${pct}%, #334155 ${pct}%, #334155 100%)`,
          }}
        />
        <div className="flex justify-between mt-2">
          {marks.map((m) => (
            <span key={m} className="text-[10px] text-[#94A3B8] tabular-nums">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
