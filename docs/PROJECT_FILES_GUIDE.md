# Edu Mentor AI — Project Files Guide

This document explains the operational role of each file used to run the Edu Mentor AI project locally.

---

## Table of Contents

1. [How to Run](#how-to-run)
2. [Configuration & Environment](#1-configuration--environment)
3. [Backend — Entry & Core](#2-backend--entry--core)
4. [Backend — API Routes](#3-backend--api-routes)
5. [Backend — API Schemas](#4-backend--api-schemas)
6. [Backend — Business Logic & Pipeline](#5-backend--business-logic--pipeline)
7. [Backend — AI Models](#6-backend--ai-models)
8. [Backend — RAG (Retrieval-Augmented Generation)](#7-backend--rag-retrieval-augmented-generation)
9. [Backend — Database (Optional)](#8-backend--database-optional)
10. [Backend — Utilities](#9-backend--utilities)
11. [Frontend — App Shell & Routing](#10-frontend--app-shell--routing)
12. [Frontend — Config & Build](#11-frontend--config--build)
13. [Frontend — UI Components](#12-frontend--ui-components)
14. [Frontend — Hooks & Services](#13-frontend--hooks--services)
15. [Scripts (Setup & Maintenance)](#14-scripts-setup--maintenance)
16. [Docker (Alternative Run Method)](#15-docker-alternative-run-method)
17. [Runtime Data Files](#16-runtime-data-files)
18. [Request Flow](#request-flow)
19. [Quick Reference](#quick-reference)

---

## How to Run

### Windows (manual)

```powershell
# Terminal 1 — Backend (port 8000)
cd "project 2.000"
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (port 3000)
cd frontend
npm run dev
```

### Linux / macOS

```bash
# Starts both backend and frontend together
./scripts/dev.sh
```

### URLs

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000        |
| Backend  | http://localhost:8000        |
| API Docs | http://localhost:8000/docs   |
| Health   | http://localhost:8000/health   |

---

## 1. Configuration & Environment

| File | Operational Role |
|------|------------------|
| `.env` | **Live configuration.** Sets API URL, LLM model path, token limits, Qdrant/Postgres URLs, Whisper/TTS settings. Read by the backend at startup. |
| `.env.example` | Template listing all supported environment variables. Copy to `.env` when setting up a new environment. |
| `backend/requirements.txt` | Python dependencies (FastAPI, llama-cpp, Whisper, Piper, embeddings, etc.). Installed into `.venv`. |
| `frontend/package.json` | Node.js dependencies and npm scripts (`dev`, `build`, `start`, `lint`). |
| `frontend/package-lock.json` | Locks exact npm package versions for reproducible installs. |
| `.venv/` | Python virtual environment containing all backend packages. Must be activated before running uvicorn. |
| `frontend/node_modules/` | Installed npm packages (Next.js, React, Tailwind, etc.). Required for `npm run dev`. |

---

## 2. Backend — Entry & Core

| File | Operational Role |
|------|------------------|
| `backend/main.py` | **Backend entry point.** Creates the FastAPI app, preloads AI models at startup (LLM, STT, TTS, embeddings, vector store), registers API routes, and enables CORS. |
| `backend/config.py` | Loads all settings from `.env` (model paths, ports, RAG limits, JWT secret, etc.). Used by every backend module. |
| `backend/__init__.py` | Marks `backend` as a Python package so `uvicorn backend.main:app` works. |

---

## 3. Backend — API Routes

| File | Operational Role |
|------|------------------|
| `backend/api/routes/chat.py` | **`POST /api/chat`** — returns a full text answer. **`POST /api/chat/stream`** — streams tokens via SSE for faster UI feedback. |
| `backend/api/routes/voice.py` | **`POST /api/voice/transcribe`** — speech to text. **`POST /api/voice/synthesize`** — text to audio. **`POST /api/assistant/voice-query`** — full voice pipeline (STT → LLM → TTS). |
| `backend/api/routes/health.py` | **`GET /health`** — returns `{"status":"healthy"}` to verify the backend is running. |
| `backend/api/routes/auth.py` | User login/register endpoints. Uses PostgreSQL when available. |

---

## 4. Backend — API Schemas

| File | Operational Role |
|------|------------------|
| `backend/api/schemas/chat.py` | Defines `ChatRequest`, `ChatResponse`, and message types for the chat API. |
| `backend/api/schemas/voice.py` | Defines voice request/response types (transcript, audio base64, etc.). |
| `backend/api/schemas/auth.py` | Defines login/register payload and token response types. |

---

## 5. Backend — Business Logic & Pipeline

| File | Operational Role |
|------|------------------|
| `backend/services/assistant_pipeline.py` | **Core orchestrator.** Builds prompts, runs RAG + LLM for text queries, and runs STT → LLM → TTS for voice queries. |
| `backend/services/prompts.py` | System prompts for the ML tutor (text vs voice), greeting detection, and message history assembly. |
| `backend/services/conversation.py` | In-memory chat history store keyed by `session_id`. Keeps context across conversation turns. |

---

## 6. Backend — AI Models

| File | Operational Role |
|------|------------------|
| `backend/models/llm.py` | Loads the Qwen GGUF model via llama-cpp and generates text (streaming or full). Falls back to mock answers if the model file is missing. |
| `backend/voice/stt.py` | **Speech-to-text** using faster-whisper. Converts uploaded audio to transcript text. |
| `backend/voice/tts.py` | **Text-to-speech** using Piper. Converts answer text to WAV audio returned as base64 to the frontend. |

---

## 7. Backend — RAG (Retrieval-Augmented Generation)

| File | Operational Role |
|------|------------------|
| `backend/rag/pipeline.py` | Retrieves relevant course material context, then asks the LLM to answer using that context. |
| `backend/rag/retriever.py` | Embeds the user query and searches the vector store for the most relevant chunks. |
| `backend/rag/embeddings.py` | Converts text to embedding vectors using fastembed (`BAAI/bge-base-en-v1.5`). |
| `backend/rag/vector_store.py` | Connects to **Qdrant** if running; otherwise falls back to the local JSON store. |
| `backend/rag/local_store.py` | JSON-based vector search fallback when Docker/Qdrant is unavailable. |
| `backend/rag/chunking.py` | Splits documents into chunks for ingestion into the vector store. |
| `backend/rag/ingestion.py` | Loads PDFs/text and indexes them into the vector store. |

---

## 8. Backend — Database (Optional)

| File | Operational Role |
|------|------------------|
| `backend/db/database.py` | SQLAlchemy async engine connecting to PostgreSQL (used for auth/user features). |
| `backend/db/models.py` | Database table definitions (users, sessions, etc.). |

> **Note:** The chat works without PostgreSQL. Auth features require a running Postgres instance.

---

## 9. Backend — Utilities

| File | Operational Role |
|------|------------------|
| `backend/utils/audio.py` | Converts audio bytes ↔ base64 for API transport. |
| `backend/utils/audio_preprocess.py` | Audio preprocessing helpers (normalization, format conversion). |
| `backend/utils/tts_text.py` | Cleans text before TTS (removes markdown, expands abbreviations for speech). |
| `backend/i18n/languages.py` | Language/locale configuration support. |

---

## 10. Frontend — App Shell & Routing

| File | Operational Role |
|------|------------------|
| `frontend/app/layout.tsx` | Root HTML layout, page title, and global CSS import. |
| `frontend/app/page.tsx` | Home page — immediately redirects to `/chat`. |
| `frontend/app/(dashboard)/chat/page.tsx` | Chat page route — renders the main `ChatPage` component. |
| `frontend/app/globals.css` | Global Tailwind/CSS styles for the entire app. |

---

## 11. Frontend — Config & Build

| File | Operational Role |
|------|------------------|
| `frontend/next.config.ts` | Next.js settings (React strict mode, standalone output for Docker). |
| `frontend/tsconfig.json` | TypeScript compiler options and path aliases (`@/...`). |
| `frontend/tailwind.config.ts` | Tailwind CSS theme and content paths. |
| `frontend/postcss.config.mjs` | PostCSS pipeline (Tailwind + Autoprefixer). |
| `frontend/next-env.d.ts` | Auto-generated TypeScript types for Next.js. |
| `frontend/.next/` | **Build cache** created by `npm run dev` / `npm run build`. Not edited manually. |

---

## 12. Frontend — UI Components

| File | Operational Role |
|------|------------------|
| `frontend/components/chat/ChatPage.tsx` | **Main chat screen** — wires mascot, chat window, input, and audio player together. |
| `frontend/components/chat/ChatWindow.tsx` | Displays the message list, typing indicator, and status text. |
| `frontend/components/chat/ChatInput.tsx` | Text input box and mic button for sending messages. |
| `frontend/components/chat/MessageBubble.tsx` | Renders a single user or assistant message bubble. |
| `frontend/components/chat/TypingIndicator.tsx` | Animated "thinking" dots shown while waiting for a response. |
| `frontend/components/voice/MicButton.tsx` | Hold-to-record microphone button UI. |
| `frontend/components/voice/useVoiceRecorder.ts` | Captures microphone audio in the browser using the Web Audio API. |
| `frontend/components/voice/AudioPlayer.tsx` | Plays TTS audio responses from base64 WAV data. |
| `frontend/components/mascot/MascotAvatar.tsx` | Animated mascot reflecting idle / listening / thinking / speaking states. |
| `frontend/components/mascot/useMascotState.ts` | State machine for mascot animation states. |
| `frontend/components/layout/Header.tsx` | Top navigation bar. |
| `frontend/components/layout/MainLayout.tsx` | Page wrapper with header and content area. |
| `frontend/components/language/LanguageSelector.tsx` | Language/locale picker UI. |
| `frontend/components/ui/Button.tsx` | Reusable styled button component. |

---

## 13. Frontend — Hooks & Services

| File | Operational Role |
|------|------------------|
| `frontend/services/api.ts` | Base HTTP client — reads `NEXT_PUBLIC_API_URL` and handles fetch/errors. |
| `frontend/services/chatService.ts` | Calls `/api/chat` and `/api/chat/stream` for text chat. |
| `frontend/services/voiceService.ts` | Calls voice endpoints (transcribe, synthesize, voice-query). |
| `frontend/hooks/useVoiceAssistant.ts` | **Main chat logic hook** — manages messages, streaming, voice recording, TTS playback, and session ID. |
| `frontend/hooks/useChat.ts` | Simpler text-only chat hook with streaming support. |
| `frontend/types/chat.ts` | TypeScript types for messages, requests, and responses. |
| `frontend/types/voice.ts` | TypeScript types for voice and mascot states. |

---

## 14. Scripts (Setup & Maintenance)

| File | Operational Role |
|------|------------------|
| `scripts/dev.sh` | Starts backend and frontend together in one command (creates venv if needed). |
| `scripts/run.sh` | Runs any Python script with the correct venv and `PYTHONPATH`. |
| `scripts/download_models.py` | Downloads Qwen GGUF and Piper voice models into `data/models/`. **Required before real LLM/TTS responses.** |
| `scripts/download_models.sh` | Shell wrapper for the model download script. |
| `scripts/ingest_ml_content.py` | Ingests PDF course material into the vector store for RAG. |
| `scripts/init_db.py` | Initializes PostgreSQL database tables. |
| `scripts/smoke_test_models.py` | Quick test that LLM, STT, TTS, and embeddings load correctly. |
| `scripts/run_finetune.sh` | Runs the model fine-tuning pipeline. |

---

## 15. Docker (Alternative Run Method)

| File | Operational Role |
|------|------------------|
| `docker/docker-compose.yml` | Defines Qdrant, Postgres, backend, and frontend containers. |
| `docker/Dockerfile.backend` | Builds the backend container image. |
| `docker/Dockerfile.frontend` | Builds the frontend container image. |

### Docker commands

```bash
# Start Qdrant only
docker compose -f docker/docker-compose.yml up -d

# Start full stack (Qdrant + Postgres + backend + frontend)
docker compose -f docker/docker-compose.yml --profile full up -d
```

---

## 16. Runtime Data Files

| File / Folder | Operational Role |
|---------------|------------------|
| `data/models/qwen3.gguf` | The Qwen LLM model file loaded by `backend/models/llm.py`. |
| `data/models/piper/en_US-lessac-medium/` | Piper TTS voice model (`.onnx` file + config JSON). |
| `data/embeddings/local_rag.json` | Local vector store fallback used when Qdrant is not running. |
| `data/models/download.log` | Log from model download attempts. |

---

## Request Flow

### Text chat

```
Browser (localhost:3000)
  → ChatPage.tsx
  → useVoiceAssistant.ts
  → chatService.ts
  → POST /api/chat/stream  (backend/api/routes/chat.py)
  → assistant_pipeline.py
      → retriever.py → embeddings.py → vector_store.py
      → llm.py → data/models/qwen3.gguf
  → Tokens streamed back to UI
```

### Voice query

```
Browser mic recording
  → useVoiceRecorder.ts
  → voiceService.ts
  → POST /api/assistant/voice-query  (backend/api/routes/voice.py)
  → assistant_pipeline.py
      → stt.py        (audio → text)
      → llm.py        (text → answer)
      → tts.py        (answer → audio)
  → JSON response with transcript, answer, and audio_base64
  → AudioPlayer.tsx plays the response
```

---

## Quick Reference

### Files you directly use to run the project

| Priority | File / Folder | Action |
|----------|---------------|--------|
| 1 | `.env` | Configure ports, model paths, API URL |
| 2 | `.venv/` | Activate, then run uvicorn on `backend/main.py` |
| 3 | `frontend/package.json` | Run `npm run dev` |
| 4 | `data/models/` | Download AI models via `scripts/download_models.py` |
| 5 | `frontend/node_modules/` | Run `npm install` once if missing |

### First-time setup checklist

- [ ] Copy `.env.example` → `.env`
- [ ] Create Python venv: `python -m venv .venv`
- [ ] Install backend deps: `pip install -r backend/requirements.txt`
- [ ] Install frontend deps: `cd frontend && npm install`
- [ ] Download models: `python scripts/download_models.py`
- [ ] Start backend: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- [ ] Start frontend: `cd frontend && npm run dev`
- [ ] Open http://localhost:3000

---

*Edu Mentor AI — Project Files Guide*
