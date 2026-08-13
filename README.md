<<<<<<< HEAD
# Edu Mentor AI

**AI Driven Conversational Voice Agent for Scalable Automation**

A web platform that teaches **Machine Learning** through an AI voice assistant mascot and chat-style Q&A interface.

## Features

- Voice in / voice out ML tutoring (mic → STT → Qwen → TTS)
- Chat UI with animated mascot (Mentor Mira)
- RAG over your ML curriculum (PDFs/text → Qdrant)
- LoRA fine-tuning pipeline for custom tutor model
- Multilingual UI (9 languages)
- JWT auth + PostgreSQL persistence

## Quick Start

### 1. Environment

```bash
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Download AI Models

```bash
bash scripts/download_models.sh
# Or skip large Qwen download during dev:
python scripts/download_models.py --skip-qwen
```

### 3. Start Qdrant (requires Docker)

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 4. Ingest ML Content (Phase 2)

Place PDFs or `.txt` files in `data/ml-content/raw/`, then:

```bash
python scripts/ingest_ml_content.py
```

### 5. Run Backend

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Run Frontend

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000/chat

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/chat` | POST | Text ML Q&A |
| `/api/assistant/voice-query` | POST | Full voice pipeline |
| `/api/voice/transcribe` | POST | STT only |
| `/api/voice/synthesize` | POST | TTS only |
| `/api/auth/register` | POST | User registration |
| `/api/auth/login` | POST | User login |

## Project Structure

See [docs/architecture/FOLDER_STRUCTURE.md](docs/architecture/FOLDER_STRUCTURE.md) and [PROJECT_PLAN.md](PROJECT_PLAN.md).

## Fine-Tuning (Phase 3)

```bash
python -m backend.training.dataset_builder
bash scripts/run_finetune.sh
```

## Docker Full Stack

```bash
docker compose -f docker/docker-compose.yml --profile full up -d
python scripts/init_db.py
```

## Tests

```bash
pytest backend/tests -v
```
=======
# edu-mentor-ai
>>>>>>> 4950d67d47ebe37a420c27bcfa4fae75f5953857
