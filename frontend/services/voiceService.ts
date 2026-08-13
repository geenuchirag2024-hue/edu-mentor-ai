import { API_URL } from "./api";
import type { VoiceQueryResponse } from "@/types/voice";

export async function sendVoiceQuery(
  audioBlob: Blob,
  sessionId?: string
): Promise<VoiceQueryResponse> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.wav");
  if (sessionId) form.append("session_id", sessionId);

  const res = await fetch(`${API_URL}/api/assistant/voice-query`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Voice API error ${res.status}`);
  }

  return res.json() as Promise<VoiceQueryResponse>;
}

export async function synthesizeSpeech(text: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/voice/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `TTS API error ${res.status}`);
  }

  const data = (await res.json()) as { audio_base64: string };
  return data.audio_base64;
}
