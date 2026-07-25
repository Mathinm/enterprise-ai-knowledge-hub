# Enterprise AI Knowledge Hub — Frontend

The frontend is a modern web application built with **Next.js 16** (App Router), **Tailwind CSS**, and **TypeScript**. It provides a dark-themed, responsive 3-column workspace with interactive chat, document upload, and hyperparameter tuning.

---

## Tech Stack

- **Framework**: Next.js 16 + React 19
- **Styling**: Tailwind CSS + Custom Design System Tokens
- **Icons**: Lucide React
- **Language**: TypeScript 5+

---

## Quick Setup

### 1. Environment Configuration

Create `.env.local` inside the `frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## Directory Structure

```
frontend/src/
├── app/
│   ├── layout.tsx         # Root layout with Inter font and dark theme wrapper
│   ├── page.tsx           # Main workspace layout assembling Header, Sidebar, Tabs & RightPanel
│   └── globals.css        # Custom design tokens, scrollbar, range slider & keyframe animations
├── components/
│   ├── Header.tsx         # Top bar with search, animated Gemini badge & health status
│   ├── Sidebar.tsx        # Collapsible navigation sidebar (3 primary tabs)
│   ├── AIAssistantTab.tsx # Full-height chat interface with expandable source citation cards
│   ├── DocumentsTab.tsx   # Drag-and-drop upload zone, multi-step progress & document cards
│   ├── SettingsTab.tsx    # RAG hyperparameter sliders (chunk size, overlap, top-k, threshold)
│   ├── RightPanel.tsx     # Context panel displaying active query sources & pipeline health
│   └── StatusBar.tsx      # Footer status bar showing live ChromaDB, doc & chunk metrics
└── lib/
    └── api.ts             # Type-safe API client for communicating with FastAPI backend
```

---

## Tab Overview

### 1. 💬 AI Assistant
- Full-height chat workspace with fixed bottom input box.
- Asynchronous response rendering with animated typing indicator.
- Expandable **Sources** section for every assistant answer displaying document filename, chunk ID, relevance match percentage, and text preview.

### 2. 📄 Documents
- Multi-format drag-and-drop file upload zone (`.pdf`, `.docx`, `.txt`, `.md`, `.html`).
- Animated 4-step ingestion progress indicator: `Extracting` $\rightarrow$ `Chunking` $\rightarrow$ `Embedding` $\rightarrow$ `Saving`.
- Interactive document registry cards with hover-lift effect, file size, chunk count, upload timestamp, and delete action.

### 3. ⚙️ Settings
- Read-only AI Provider status cards for Google Gemini (`gemini-2.5-flash` & `gemini-embedding-001`).
- Tuneable hyperparameter sliders:
  - **Chunk Size** (500 / 750 / 1000 chars)
  - **Chunk Overlap** (50 / 100 / 150 chars)
  - **Top-K Retrieval** (3 / 5 / 6 / 8 / 10 chunks)
  - **Similarity Threshold** (0.00 to 1.00)
- Save button with instant backend update.
