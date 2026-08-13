export interface VoiceQueryResponse {
  transcript: string;
  answer: string;
  audio_base64: string;
  session_id: string;
  sources?: string[];
}

export type MascotState = "idle" | "listening" | "thinking" | "speaking";
