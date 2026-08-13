# Indic Voice Model Evaluation (Phase 5)

## STT Candidates
| Model | Languages | Notes |
|-------|-----------|-------|
| faster-whisper | Multilingual incl. Hindi | Good baseline |
| AI4Bharat IndicWhisper | Hindi, Tamil, etc. | Better Indic accuracy |
| indic-whisper | Multiple Indic | Community models |

## TTS Candidates
| Model | Languages | Notes |
|-------|-----------|-------|
| Piper multi-voice | Limited Indic | Easy integration |
| AI4Bharat Indic-TTS | Hindi, Tamil, etc. | Higher quality |

## Pilot Recommendation
Start Hindi pilot with IndicWhisper STT + Indic-TTS, keep English Piper/Qwen pipeline as fallback.
