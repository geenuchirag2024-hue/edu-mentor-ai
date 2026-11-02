import { apiRequest, friendlyApiError } from "./api";
import type { VoiceQueryResponse } from "@/types/voice";

export async function sendVoiceQuery(
  audioBlob: Blob,
  sessionId?: string,
  extra?: {
    tutor_mode?: string;
    learner_id?: string;
    use_notes?: boolean;
    mentor_id?: string;
    subject?: string;
    language?: string;
  },
  signal?: AbortSignal
): Promise<VoiceQueryResponse> {
  const form = new FormData();
  const filename = audioBlob.type.includes("webm")
    ? "recording.webm"
    : audioBlob.type.includes("ogg")
    ? "recording.ogg"
    : audioBlob.type.includes("mp4")
    ? "recording.mp4"
    : "recording.wav";
  form.append("audio", audioBlob, filename);
  if (sessionId) form.append("session_id", sessionId);
  if (extra?.tutor_mode) form.append("tutor_mode", extra.tutor_mode);
  if (extra?.learner_id) form.append("learner_id", extra.learner_id);
  if (extra?.use_notes) form.append("use_notes", "true");
  if (extra?.mentor_id) form.append("mentor_id", extra.mentor_id);
  if (extra?.subject) form.append("subject", extra.subject);
  if (extra?.language) form.append("language", extra.language);

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

export async function synthesizeSpeech(
  text: string,
  mentorId: string = "mira",
  language: string = "en",
  signal?: AbortSignal
): Promise<string> {
  const res = await apiRequest("/api/voice/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mentor_id: mentorId, language }),
    signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(friendlyApiError(res.status, err));
  }

  const data = (await res.json()) as { audio_base64: string };
  return data.audio_base64;
}
