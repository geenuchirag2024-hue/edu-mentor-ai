# Edu Mentor AI — Folder Structure Reference

This structure extends the [AI Mentor Architecture Blueprint](../AI_Mentor_Architecture_Blueprint.pdf) for the Edu Mentor AI project.

## Root

| Path | Purpose |
|------|---------|
| `frontend/` | Next.js web application |
| `backend/` | FastAPI Python backend |
| `data/` | ML content, models, embeddings |
| `docker/` | Docker Compose and Dockerfiles |
| `docs/` | Documentation |
| `scripts/` | Setup and utility scripts |

## Frontend

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router pages and layouts |
| `app/(auth)/` | Login, register pages |
| `app/(dashboard)/` | Main learning/chat experience |
| `app/api/` | Next.js API routes (if needed) |
| `components/chat/` | Message bubbles, input, chat history |
| `components/mascot/` | Voice assistant avatar and animations |
| `components/language/` | Language selector for Indian languages |
| `components/layout/` | Header, sidebar, page shells |
| `components/ui/` | Buttons, cards, modals (design system) |
| `services/` | API client, WebSocket handlers |
| `hooks/` | Custom React hooks (useVoice, useChat) |
| `locales/` | i18n translation files per language |
| `public/mascot/` | Mascot images, Lottie, audio cues |
| `types/` | TypeScript interfaces |

## Backend

| Path | Purpose |
|------|---------|
| `main.py` | FastAPI application entry point |
| `api/routes/` | REST endpoint handlers |
| `api/schemas/` | Pydantic request/response models |
| `services/` | Business logic (conversation, tutor persona) |
| `rag/` | PDF ingestion, chunking, embedding, retrieval |
| `voice/` | STT (faster-whisper) and TTS (Piper) |
| `models/` | LLM wrapper (llama.cpp / future vLLM) |
| `db/migrations/` | PostgreSQL schema migrations |
| `db/repositories/` | Data access layer |
| `i18n/` | Backend language utilities |
| `utils/` | Shared helpers |
| `tests/` | pytest unit and integration tests |

## Data

| Path | Purpose |
|------|---------|
| `ml-content/raw/` | Source PDFs and documents |
| `ml-content/processed/` | Chunked text ready for embedding |
| `embeddings/` | Local embedding cache |
| `models/` | Downloaded GGUF model files |
