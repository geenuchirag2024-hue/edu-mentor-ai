import type { TutorMode } from "./tutor";

export interface RelatedVideo {
  id: string;
  title: string;
  topic: string;
  subject: string;
  description: string;
  video_url: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: string[];
  isVoice?: boolean;
  related_video?: RelatedVideo | null;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  tutor_mode?: TutorMode;
  hint_level?: number;
  learner_id?: string;
  use_notes?: boolean;
  subject?: string;
  mentor_id?: string;
  language?: string;
  related_video?: RelatedVideo | null;
}

export interface ChatResponse {
  answer: string;
  session_id: string;
  sources?: string[];
  emotion?: string;
  gesture?: string;
  response_type?: string;
  mentor_id?: string;
  language?: string;
  related_video?: RelatedVideo | null;
}
