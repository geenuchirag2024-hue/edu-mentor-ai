# Edu Mentor AI — Project Plan

**Project Name:** AI Driven Conversational Voice Agent for Scalable Automation — Edu Mentor AI  
**Version:** 1.0  
**Date:** July 20, 2026  
**Status:** Planning Phase  

---

## 1. Executive Summary

Edu Mentor AI is a user-friendly web platform that delivers personalized Machine Learning education through a conversational AI voice assistant. Students interact via a chat-style interface with question-and-answer bubbles, guided by an animated mascot that speaks responses aloud. The system is built for English-first delivery with architecture ready for Indian regional languages (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati).

This plan follows industry-standard software delivery: phased milestones, agile sprints, clear acceptance criteria, and production-minded architecture aligned with the AI Mentor Architecture Blueprint.

---

## 2. Project Objectives

| Objective | Success Metric |
|-----------|----------------|
| Deliver ML tutoring via voice + chat | Student can ask ML questions and receive accurate spoken + text answers |
| User-friendly experience | Task completion rate ≥ 90% on first usability test |
| Multilingual readiness | Language switcher UI + i18n hooks; English fully functional in v1 |
| Scalable automation | RAG pipeline ingests ML content; backend API decoupled from UI |
| Production path | Dockerized services; auth + PostgreSQL by Phase 4 |

---

## 3. Scope

### In Scope (v1 — MVP)
- Next.js web app with chat UI (user/assistant bubbles)
- AI voice assistant mascot (visual avatar + TTS playback)
- FastAPI backend with RAG over ML course content
- Speech-to-text (faster-whisper) and text-to-speech (Piper)
- Local LLM inference (Qwen 3 via llama.cpp)
- Vector search (Qdrant + BAAI bge-base-en-v1.5 embeddings)
- English language teaching
- Language selector UI (Indian languages — UI labels only in v1; full teaching in later phases)
- ML subject content ingestion (PDFs via PyMuPDF)

### Out of Scope (v1)
- Full translation of ML curriculum into all Indian languages
- Mobile native apps
- Live human tutor handoff
- Payment / subscription billing
- GPU production serving (vLLM — planned for v2)

---

## 4. Stakeholders & Roles

| Role | Responsibility |
|------|----------------|
| Product Owner | Prioritize features, accept deliverables |
| Frontend Developer | Next.js UI, mascot, chat, i18n shell |
| Backend Developer | FastAPI, RAG, voice pipeline, DB |
| ML/AI Engineer | Model selection, embeddings, RAG tuning |
| DevOps | Docker, deployment, monitoring |
| QA | Test plans, UAT, regression |

---

## 5. Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| LLM | Qwen 3 (GGUF) |
| Inference | llama.cpp (dev) → vLLM (production) |
| Embeddings | BAAI bge-base-en-v1.5 |
| Vector DB | Qdrant |
| Speech-to-Text | faster-whisper |
| Text-to-Speech | Piper |
| Database | PostgreSQL |
| PDF Processing | PyMuPDF |
| Containerization | Docker |

---

## 6. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Mascot   │  │ Chat Bubbles │  │ Language   │  │ Voice     │  │
│  │ Avatar   │  │ (Q&A UI)     │  │ Selector   │  │ Controls  │  │
│  └──────────┘  └──────────────┘  └────────────┘  └───────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │
│  │ Auth    │  │ Chat    │  │ Voice   │  │ RAG Service         │ │
│  │ API     │  │ API     │  │ API     │  │ (retrieve + generate) │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────────┘ │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
   PostgreSQL    faster-whisper   llama.cpp      Qdrant
                  + Piper TTS     (Qwen 3)      (embeddings)
```

### Request Flow (Voice Query)
```
User Voice → faster-whisper (STT) → FastAPI
  → Embed question (bge-base-en-v1.5)
  → Qdrant retrieves ML content chunks
  → Qwen 3 generates answer (llama.cpp)
  → Piper TTS → Audio response
  → Chat bubble + mascot animation on frontend
```

---

## 7. Folder Structure

```
edu-mentor-ai/
├── frontend/
│   ├── app/                    # Next.js App Router pages
│   ├── components/
│   │   ├── chat/               # Message bubbles, input, history
│   │   ├── mascot/             # Voice assistant avatar & animations
│   │   ├── language/           # Language selector (Indian languages)
│   │   ├── layout/             # Header, sidebar, footer
│   │   └── ui/                 # Reusable UI primitives
│   ├── services/               # API client, WebSocket handlers
│   ├── hooks/                  # Custom React hooks
│   ├── locales/                # i18n JSON (en, hi, ta, te, kn, ml, bn, mr, gu)
│   ├── public/mascot/          # Mascot assets (SVG, Lottie, audio)
│   └── types/                  # TypeScript interfaces
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── api/routes/             # REST endpoints
│   ├── api/schemas/            # Pydantic models
│   ├── services/               # Business logic
│   ├── rag/                    # Ingestion, chunking, retrieval
│   ├── voice/                  # STT (whisper) + TTS (Piper)
│   ├── models/                 # LLM wrapper (llama.cpp)
│   ├── db/                     # PostgreSQL models & migrations
│   ├── i18n/                   # Backend language utilities
│   └── tests/                  # pytest suite
├── data/
│   ├── ml-content/raw/         # Source PDFs & documents
│   ├── ml-content/processed/   # Chunked text for RAG
│   └── embeddings/             # Local embedding cache
├── docker/                     # Docker Compose & Dockerfiles
├── docs/                       # Architecture, API, user guides
├── scripts/                    # Setup & utility scripts
└── PROJECT_PLAN.md             # This document
```

---

## 8. Development Phases & Timeline

Estimated duration: **16–20 weeks** (adjust based on team size).

### Phase 0 — Discovery & Setup (Week 1–2)
**Goal:** Align requirements, scaffold repo, define ML curriculum scope.

| Step | Task | Deliverable |
|------|------|-------------|
| 0.1 | Finalize ML syllabus outline (topics, modules, learning objectives) | Syllabus document in `docs/` |
| 0.2 | Initialize Git repo, branching strategy (`main`, `develop`, feature branches) | Repository with README |
| 0.3 | Scaffold Next.js frontend + FastAPI backend | Runnable hello-world apps |
| 0.4 | Configure ESLint, Prettier, Black, pre-commit hooks | Lint/format configs |
| 0.5 | Set up environment variables template (`.env.example`) | Env documentation |
| 0.6 | Docker Compose for Qdrant (local dev) | `docker/docker-compose.yml` |

**Exit Criteria:** Both apps run locally; Qdrant container healthy.

---

### Phase 1 — Chat UI & User Experience (Week 3–5)
**Goal:** User-friendly website with chat interface and mascot shell.

| Step | Task | Deliverable |
|------|------|-------------|
| 1.1 | Design wireframes (chat layout, mascot placement, language bar) | Figma/wireframes in `docs/` |
| 1.2 | Build responsive layout (Tailwind) — header, main chat area, mascot panel | `frontend/components/layout/` |
| 1.3 | Implement chat bubble components (user vs assistant, timestamps, typing indicator) | `frontend/components/chat/` |
| 1.4 | Create mascot component (idle, listening, speaking, thinking states) | `frontend/components/mascot/` |
| 1.5 | Add message input (text + mic button placeholder) | Chat input component |
| 1.6 | Implement language selector UI (English + 8 Indian languages) | `frontend/components/language/` |
| 1.7 | Set up i18n framework (next-intl or react-i18next) with English strings | `frontend/locales/en/` |
| 1.8 | Add placeholder API service layer (mock responses) | `frontend/services/` |
| 1.9 | Accessibility pass (keyboard nav, ARIA labels, contrast) | A11y checklist |

**Exit Criteria:** Student can type messages, see bubbles, mascot animates; language switcher changes UI labels.

---

### Phase 2 — Backend & LLM Integration (Week 6–8)
**Goal:** FastAPI backend with local Qwen 3 inference.

| Step | Task | Deliverable |
|------|------|-------------|
| 2.1 | FastAPI project structure, CORS, health endpoints | `backend/main.py`, `/health` |
| 2.2 | Chat API endpoint (`POST /api/chat`) with Pydantic schemas | `backend/api/routes/chat.py` |
| 2.3 | Integrate llama.cpp with Qwen 3 GGUF model | `backend/models/llm.py` |
| 2.4 | System prompt for ML tutor persona (friendly, pedagogical) | Prompt template in `backend/services/` |
| 2.5 | Connect frontend chat to real backend (replace mocks) | End-to-end text chat |
| 2.6 | Session/conversation history (in-memory first, then PostgreSQL) | `backend/services/conversation.py` |
| 2.7 | Error handling, rate limiting, request validation | Middleware & error responses |
| 2.8 | API documentation (OpenAPI/Swagger auto-generated) | `/docs` endpoint |

**Exit Criteria:** Text-only ML Q&A works end-to-end via backend LLM.

---

### Phase 3 — RAG Pipeline (Week 9–11)
**Goal:** Ground answers in ML course content via retrieval-augmented generation.

| Step | Task | Deliverable |
|------|------|-------------|
| 3.1 | Collect ML source materials (PDFs, notes) into `data/ml-content/raw/` | Curated content library |
| 3.2 | PDF ingestion with PyMuPDF (extract, clean, chunk) | `backend/rag/ingestion.py` |
| 3.3 | Generate embeddings with bge-base-en-v1.5 | `backend/rag/embeddings.py` |
| 3.4 | Store vectors in Qdrant with metadata (topic, chapter, page) | `backend/rag/vector_store.py` |
| 3.5 | Implement retrieval logic (top-k chunks, score threshold) | `backend/rag/retriever.py` |
| 3.6 | Inject retrieved context into LLM prompt | `backend/rag/pipeline.py` |
| 3.7 | Ingestion CLI script (`scripts/ingest_ml_content.py`) | Repeatable ingestion |
| 3.8 | Evaluate RAG quality (sample Q&A benchmark set) | Evaluation report in `docs/` |

**Exit Criteria:** Answers cite ML curriculum content; hallucination rate reduced vs raw LLM.

---

### Phase 4 — Voice Pipeline (Week 12–14)
**Goal:** Full voice assistant — speak questions, hear spoken answers.

| Step | Task | Deliverable |
|------|------|-------------|
| 4.1 | Integrate faster-whisper for STT | `backend/voice/stt.py` |
| 4.2 | Audio upload endpoint (`POST /api/voice/transcribe`) | Voice input API |
| 4.3 | Integrate Piper TTS for English voice output | `backend/voice/tts.py` |
| 4.4 | Audio response endpoint or streaming | TTS API |
| 4.5 | Frontend: browser mic capture + waveform/listening UI | Mic integration |
| 4.6 | Frontend: audio playback synced with mascot "speaking" animation | Mascot + audio sync |
| 4.7 | Push-to-talk and continuous listening modes | UX toggle |
| 4.8 | Latency optimization (chunk streaming where possible) | Performance notes |

**Exit Criteria:** User speaks an ML question; mascot responds with voice + chat bubble.

---

### Phase 5 — Auth, Database & Production Prep (Week 15–17)
**Goal:** User accounts, persistence, containerization.

| Step | Task | Deliverable |
|------|------|-------------|
| 5.1 | PostgreSQL schema (users, sessions, chat history, progress) | `backend/db/migrations/` |
| 5.2 | Authentication (JWT or session-based) | `backend/api/routes/auth.py` |
| 5.3 | User registration/login UI | `frontend/app/(auth)/` |
| 5.4 | Persist chat history per user | DB repositories |
| 5.5 | Learning progress tracking (optional v1: modules completed) | Progress API |
| 5.6 | Dockerize FastAPI, frontend, PostgreSQL, Qdrant | Full `docker-compose.yml` |
| 5.7 | CI pipeline (lint, test, build) | GitHub Actions / similar |
| 5.8 | Environment-based config (dev/staging/prod) | Config management |
| 5.9 | Logging, monitoring hooks (structured logs) | Observability baseline |

**Exit Criteria:** Multi-user deployment via Docker; data persists across sessions.

---

### Phase 6 — Multilingual Expansion (Week 18–20)
**Goal:** Architecture for Indian language teaching (post-MVP).

| Step | Task | Deliverable |
|------|------|-------------|
| 6.1 | Complete UI translations for all 8 Indian languages | `frontend/locales/*/` |
| 6.2 | Evaluate Indic TTS/STT models (AI4Bharat, indic-whisper, etc.) | Tech evaluation doc |
| 6.3 | Backend i18n: language parameter on chat/voice APIs | `backend/i18n/` |
| 6.4 | Translate or generate ML content summaries per language | Localized content pipeline |
| 6.5 | Language-specific TTS voice selection | Piper/multi-voice config |
| 6.6 | QA with native speakers for 2–3 pilot languages (Hindi, Tamil) | UAT report |

**Exit Criteria:** At least one Indian language (e.g., Hindi) fully supported for teaching.

---

## 9. Sprint Plan (Agile — 2-Week Sprints)

| Sprint | Focus | Key User Stories |
|--------|-------|------------------|
| S1 | Setup + layout | As a student, I see a clean ML learning homepage |
| S2 | Chat UI | As a student, I send messages and see reply bubbles |
| S3 | Mascot + i18n shell | As a student, I see a friendly mascot and can switch UI language |
| S4 | Backend chat | As a student, I get AI text answers about ML |
| S5 | RAG ingestion | As a developer, I can ingest ML PDFs into the knowledge base |
| S6 | RAG retrieval | As a student, my answers are grounded in course material |
| S7 | STT | As a student, I can ask questions by voice |
| S8 | TTS + mascot sync | As a student, the mascot speaks answers aloud |
| S9 | Auth + DB | As a student, my chat history is saved when I log in |
| S10 | Docker + CI | As DevOps, I deploy all services with one command |

---

## 10. Key Features Breakdown

### 10.1 Chat Interface (Q&A Bubbles)
- User messages: right-aligned, distinct color
- Assistant messages: left-aligned with mascot avatar
- Typing/thinking indicator while LLM processes
- Markdown support for code snippets (common in ML)
- Copy button on assistant responses
- Scroll-to-latest with smooth animation

### 10.2 AI Voice Assistant Mascot
- Animated character (SVG/Lottie) with states: idle, listening, thinking, speaking
- Lip-sync or pulse animation during TTS playback
- Optional: mascot name and personality (e.g., "Mentor Mira")
- Click mascot for quick tips / onboarding

### 10.3 Machine Learning Curriculum
- Structured modules: Introduction to ML, Supervised Learning, Unsupervised Learning, Neural Networks, Evaluation, Practical Tips
- Content sourced from PDFs and ingested into RAG
- Future: quizzes, progress badges per module

### 10.4 Multilingual Support (Progressive)
| Language | Code | v1 Scope | Future |
|----------|------|----------|--------|
| English | en | Full (UI + teaching + voice) | — |
| Hindi | hi | UI labels | Full teaching + TTS |
| Tamil | ta | UI labels | Full teaching + TTS |
| Telugu | te | UI labels | Full teaching + TTS |
| Kannada | kn | UI labels | Full teaching + TTS |
| Malayalam | ml | UI labels | Full teaching + TTS |
| Bengali | bn | UI labels | Full teaching + TTS |
| Marathi | mr | UI labels | Full teaching + TTS |
| Gujarati | gu | UI labels | Full teaching + TTS |

---

## 11. Testing Strategy

| Level | Scope | Tools |
|-------|-------|-------|
| Unit | RAG chunking, API schemas, UI components | pytest, Jest/Vitest |
| Integration | Chat API → LLM → response | pytest + httpx |
| E2E | Full voice query flow in browser | Playwright |
| RAG Evaluation | 50+ ML Q&A pairs with expected topics | Custom benchmark script |
| Usability | 5–8 student testers | Moderated sessions |
| Performance | STT+LLM+TTS latency under 8s (target) | Locust, manual timing |

---

## 12. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Local LLM too slow on CPU | High | Quantized GGUF; GPU path via vLLM in v2 |
| RAG retrieves irrelevant chunks | Medium | Tune chunk size, top-k, reranking |
| Indian language TTS quality poor | Medium | Pilot Hindi first; evaluate AI4Bharat models |
| ML content copyright | Medium | Use open-licensed materials; attribute sources |
| Voice latency hurts UX | High | Stream partial text; show thinking state early |
| Scope creep (all languages at once) | High | English MVP first; i18n architecture only in v1 |

---

## 13. Milestones & Go-Live Checklist

| Milestone | Target | Definition of Done |
|-----------|--------|-------------------|
| M1: UI Demo | Week 5 | Chat + mascot + language switcher (mock data) |
| M2: Text AI Tutor | Week 8 | Real ML answers via Qwen 3 |
| M3: RAG-Enhanced | Week 11 | Answers grounded in ML PDFs |
| M4: Voice MVP | Week 14 | Full voice in + voice out |
| M5: Production Beta | Week 17 | Auth, Docker, PostgreSQL |
| M6: Hindi Pilot | Week 20 | One Indian language end-to-end |

### Go-Live Checklist
- [ ] All critical user flows tested (text + voice)
- [ ] Security review (auth, input sanitization, CORS)
- [ ] `.env` secrets not committed
- [ ] Docker Compose runs on clean machine
- [ ] README with setup instructions
- [ ] Backup strategy for PostgreSQL
- [ ] Error pages and offline messaging in UI

---

## 14. Future Evolution (Post v1)

1. **Replace llama.cpp with vLLM** for GPU serving at scale
2. **Expand subjects** beyond ML (Deep Learning, Data Science)
3. **Mobile PWA** or React Native app
4. **Analytics dashboard** for educators (engagement, common questions)
5. **Fine-tuned Qwen** on ML Q&A pairs for better pedagogical tone
6. **Gamification** — streaks, badges, module completion certificates

---

## 15. Immediate Next Steps (Week 1 Action Items)

1. **Initialize frontend:** `npx create-next-app@latest frontend --typescript --tailwind --app`
2. **Initialize backend:** FastAPI project with virtual environment
3. **Start Docker Qdrant:** `docker compose -f docker/docker-compose.yml up -d`
4. **Draft ML syllabus:** List 6–8 modules with learning objectives
5. **Design chat + mascot wireframe:** Single-page layout mockup
6. **Download Qwen 3 GGUF** model to `data/models/` (quantized for dev hardware)

---

## 16. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-07-20 | Edu Mentor AI Team | Initial project plan |

---

*This plan is a living document. Update sprint backlogs and timelines as the project progresses.*
