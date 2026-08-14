import type { TutorMode } from "./tutor";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[];
  isVoice?: boolean;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  tutor_mode?: TutorMode;
  hint_level?: number;
  learner_id?: string;
  use_notes?: boolean;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
  sources?: string[];
  emotion?: string;
  gesture?: string;
  response_type?: string;
}
