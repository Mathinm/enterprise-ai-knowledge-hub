"use client";

import React from "react";
import { MessageSquare, FileText, Settings, ChevronLeft, ChevronRight } from "lucide-react";

export type Tab = "assistant" | "documents" | "settings";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "assistant", label: "AI Assistant", icon: MessageSquare },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <aside
      className={`relative flex flex-col bg-[#111827] border-r border-[#334155] shrink-0 transition-all duration-300 ease-in-out ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#3B82F6] transition-colors shadow-md"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>

      <nav className="flex flex-col gap-1 pt-4 px-2">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                isActive
                  ? "bg-gradient-to-r from-[#3B82F6]/20 via-[#8B5CF6]/15 to-transparent text-[#F8FAFC] border border-[#3B82F6]/40 shadow-md shadow-blue-500/10"
                  : "text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC]"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                  isActive ? "text-[#3B82F6] scale-110" : "text-[#94A3B8]"
                }`}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
