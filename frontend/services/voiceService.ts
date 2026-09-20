import { apiRequest, friendlyApiError } from "./api";
import type { VoiceQueryResponse } from "@/types/voice";

export async function sendVoiceQuery(
  audioBlob: Blob,
  sessionId?: string,
  extra?: { tutor_mode?: string; learner_id?: string; use_notes?: boolean },
  signal?: AbortSignal
): Promise<VoiceQueryResponse> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.wav");
  if (sessionId) form.append("session_id", sessionId);
  if (extra?.tutor_mode) form.append("tutor_mode", extra.tutor_mode);
  if (extra?.learner_id) form.append("learner_id", extra.learner_id);
  if (extra?.use_notes) form.append("use_notes", "true");

  const res = await apiRequest("/api/assistant/voice-query", {
    method: "POST",
    body: form,
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  return res.json() as Promise<VoiceQueryResponse>;
}

export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<string> {
  const res = await apiRequest("/api/voice/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(friendlyApiError(res.status, err));
  }

  const data = (await res.json()) as { audio_base64: string };
  return data.audio_base64;
}
