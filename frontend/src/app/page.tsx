"use client";

import React, { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Sidebar, { Tab } from "@/components/Sidebar";
import RightPanel from "@/components/RightPanel";
import StatusBar from "@/components/StatusBar";
import AIAssistantTab from "@/components/AIAssistantTab";
import DocumentsTab from "@/components/DocumentsTab";
import SettingsTab from "@/components/SettingsTab";
import { api, Document, HealthStatus, QuerySource } from "@/lib/api";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("assistant");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeSources, setActiveSources] = useState<QuerySource[]>([]);

  const fetchHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchDocuments();
    // Poll health every 30 seconds
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchDocuments]);

  const handleDocumentsChange = useCallback(async () => {
    await Promise.all([fetchDocuments(), fetchHealth()]);
  }, [fetchDocuments, fetchHealth]);

  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-[#F8FAFC] font-inter overflow-hidden">
      <Header health={health} />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
        />

        {/* Main Workspace */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Tab Title */}
          <div className="px-6 py-4 border-b border-[#334155] bg-[#0F172A] shrink-0">
            <h2 className="text-base font-semibold text-[#F8FAFC]">
              {activeTab === "assistant" && "AI Assistant"}
              {activeTab === "documents" && "Document Management"}
              {activeTab === "settings" && "Settings"}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {activeTab === "assistant" &&
                "Ask questions about your enterprise knowledge base"}
              {activeTab === "documents" &&
                "Upload, manage and inspect your indexed documents"}
              {activeTab === "settings" &&
                "Configure RAG pipeline hyperparameters"}
            </p>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "assistant" && (
              <AIAssistantTab onSourcesChange={setActiveSources} />
            )}
            {activeTab === "documents" && (
              <DocumentsTab
                documents={documents}
                onDocumentsChange={handleDocumentsChange}
              />
            )}
            {activeTab === "settings" && <SettingsTab />}
          </div>
        </main>

        {/* Right Context Panel */}
        <RightPanel sources={activeSources} />
      </div>

      <StatusBar health={health} loading={healthLoading} />
    </div>
  );
}
