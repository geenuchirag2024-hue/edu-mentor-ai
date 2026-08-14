export interface VoiceQueryResponse {
  transcript: string;
  answer: string;
  audio_base64: string;
  session_id: string;
  sources?: string[];
  emotion?: MascotEmotion;
  gesture?: MascotGesture;
  response_type?: string;
}

export type MascotState = "idle" | "listening" | "thinking" | "speaking";

export type MascotEmotion =
  | "neutral"
  | "happy"
  | "thinking"
  | "surprised"
  | "sad"
  | "confident"
  | "greeting";

export type MascotGesture =
  | "none"
  | "point"
  | "nod"
  | "shake"
  | "raise_hand"
  | "celebrate"
  | "wave";
