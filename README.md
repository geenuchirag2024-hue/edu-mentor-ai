# Edu-Mentor AI V3

**AI-Driven Conversational Voice Agent for Scalable Educational Tutoring**

Edu-Mentor AI is a production-grade educational platform featuring multi-mentor conversational voice tutoring, multilingual support (English, Hindi, Kannada), subject-aware RAG, role-based access control (Student / Teacher), and a secure password recovery system.

---

## What's New in V3

1. **Four Specialized AI Mentors**:
   - **Mentor Mira**: Friendly Foundation Tutor (warm, reassuring; specializes in ML basics & gentle onboarding).
   - **Mentor Arjun**: Practical Systems Architect (calm, measured; specializes in DBMS, normalization, indexing, and scalable architecture).
   - **Mentor Tara**: Deep Learning Specialist (clear, composed, analytical; specializes in neural networks, math intuition, backpropagation, and Transformers).
   - **Mentor Kiran**: Applied AI & ML Practitioner (energetic, conversational; specializes in hands-on code, training dynamics, loss functions, and scikit-learn/PyTorch).

2. **Multilingual Speech & Educational AI (English, Hindi, Kannada)**:
   - **LLM Prompting**: Generates grammatically coherent explanations in native scripts:
     - English (`en`): Clear conversational English.
     - Hindi (`hi`): Natural Devanagari script (`उत्तर स्वाभाविक हिंदी भाषा में, देवनागरी लिपि में दें।`).
     - Kannada (`kn`): Natural Kannada script (`ಉತ್ತರವನ್ನು ಸಹಜ ಕನ್ನಡ ಭಾಷೆಯಲ್ಲಿ, ಕನ್ನಡ ಲಿಪಿಯಲ್ಲಿ ನೀಡಿ.`).
   - **Faster-Whisper STT**: Multilingual speech recognition supporting English, Hindi, and Kannada with automatic language detection, manual override, and confidence scoring.
   - **Piper TTS Engine**:
     - English: Distinct verified models for all 4 mentors (`en_US-lessac-medium`, `en_US-ryan-medium`, `en_US-amy-medium`, `en_US-danny-low`).
     - Hindi: Distinct verified models (`hi_IN-priyamvada-medium`, `hi_IN-rohan-medium`, `hi_IN-pratham-medium`).
     - Kannada: Explicit fallback handling where text is preserved and displayed accurately without playing incompatible English voices.
   - **Audio Caching**: Audio outputs cached by `(text, mentor_id, language, engine, voice_model)` to eliminate redundant synthesis while preventing cross-mentor voice bleed.

3. **Secure Password Recovery (Forgot Password & Reset Password)**:
   - Full support for both **Student** and **Teacher** accounts.
   - **No Account Enumeration**: Returns generic confirmation regardless of whether the email exists.
   - **Cryptographic Security**: Tokens generated via `secrets.token_urlsafe(32)` and stored as SHA-256 hashes.
   - **Single-Use & Expiry**: Configurable expiration window (default 20 minutes); invalidated immediately upon use.
   - **Role Preservation**: Strictly preserves student and teacher roles during password updates.
   - **SMTP Integration**: Fully configurable via environment variables with a simulated development workflow.

---

## Hardware & Inference Stack

* **Operating System**: Windows 11 (64-bit AMD64) / Linux
* **Target GPU**: NVIDIA GeForce RTX 5060 Laptop GPU (8 GB VRAM, Driver 592+, CUDA 13.1)
* **CPU / Memory**: 32 GB RAM, Multi-threaded CPU fallback with `mmap` and `mlock`
* **Local Inference Engines**:
  - LLM: `llama-cpp-python` (GGUF quantization, Qwen-series models)
  - STT: `faster-whisper` (`base` multilingual int8 model)
  - TTS: `piper-tts` (ONNX speech synthesis with dedicated background workers)

---

## Environment Variables & Configuration

Create a `.env` file in the project root:

```env
# Application
APP_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://edu_mentor:edu_mentor_dev@localhost:5432/edu_mentor_ai

# Authentication
JWT_SECRET=change-me-to-a-secure-random-key-in-production
JWT_EXPIRY_HOURS=24

# Password Reset & Email Delivery
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=20
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_FROM_EMAIL=noreply@edumentor.ai
SMTP_USE_TLS=true

# AI Models & Storage
LLM_MODEL_PATH=data/models/qwen3.gguf
LLM_FALLBACK_MODEL_PATH=data/models/qwen3.gguf
LLM_N_GPU_LAYERS=0  # Set >0 or -1 when compiled with CUDA GPU offloading
WHISPER_MODEL=base
PIPER_MODEL_DIR=data/models/piper
```

*Note: In development mode when `SMTP_HOST` is empty, password reset links are safely provided in development responses and logged locally without exposing tokens in public logs.*

---

## Installation & Setup

### 1. Setup Python Environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

### 2. Download AI Voice Models

```powershell
python scripts/download_models.py --all-piper-voices
```

This installs:
- 4 English mentor voice models (`lessac`, `ryan`, `amy`, `danny`)
- 3 Hindi mentor voice models (`priyamvada`, `rohan`, `pratham`)

### 3. Setup Frontend

```powershell
cd frontend
npm install
cd ..
```

### 4. Run Both Services Concurrently

Run the included starter script:

```powershell
.\run_dev.ps1
```

- **Backend API**: `http://127.0.0.1:8000` (Docs: `http://127.0.0.1:8000/docs`)
- **Frontend Web App**: `http://localhost:3000`

---

## API Endpoints Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/health` | GET | System and database health status |
| `/api/auth/register` | POST | User registration with `role` (student / teacher) |
| `/api/auth/login` | POST | User sign in returning JWT access token |
| `/api/auth/me` | GET | Authenticated user profile |
| `/api/auth/forgot-password` | POST | Initiate password recovery; sends reset instructions |
| `/api/auth/validate-reset-token` | POST | Validate token existence, expiration, and single-use status |
| `/api/auth/reset-password` | POST | Update password with verified reset token |
| `/api/chat` | POST | Text ML Q&A with mentor and language routing |
| `/api/chat/stream` | POST | Server-Sent Events (SSE) streaming chat responses |
| `/api/assistant/voice-query` | POST | End-to-end voice query (Audio &rarr; STT &rarr; RAG &rarr; LLM &rarr; TTS) |
| `/api/voice/transcribe` | POST | Multilingual audio transcription with language detection |
| `/api/voice/synthesize` | POST | Text-to-speech generation with mentor voice resolution |
| `/api/mentors` | GET | Centralized mentor profiles and voice metadata |

---

## Verification & Test Commands

### Run Full Mentor Voice & Multilingual Verification
```powershell
.\.venv\Scripts\python.exe scripts/verify_voice_and_mentors.py
```

### Run Password Reset & Security Verification
```powershell
.\.venv\Scripts\python.exe scripts/test_password_reset_runner.py
```

### Run Frontend Production Build & TypeScript Compiler
```powershell
cd frontend
npx tsc --noEmit
npm run build
```
