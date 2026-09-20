import { apiFetch, apiRequest, friendlyApiError } from "./api";
import type { ChatRequest, ChatResponse } from "@/types/chat";

export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export interface StreamChatCallbacks {
  onToken: (token: string) => void;
  onComplete: (meta: {
    session_id: string;
    sources: string[];
    emotion?: string;
    gesture?: string;
    response_type?: string;
  }) => void;
}

function chatStreamUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (explicit) return `${explicit}/api/chat/stream`;
  // Hit FastAPI directly so Next.js rewrites cannot buffer SSE (which hid Mira's reply).
  if (typeof window !== "undefined") {
    return "http://127.0.0.1:8000/api/chat/stream";
  }
  return "/api/chat/stream";
}

export async function streamChatMessage(
  request: ChatRequest,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const res = await apiRequest(chatStreamUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Streaming not supported by this browser");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6)) as {
        token?: string;
        done?: boolean;
        session_id?: string;
        sources?: string[];
        emotion?: string;
        gesture?: string;
        response_type?: string;
      };
      if (data.token) callbacks.onToken(data.token);
      if (data.done && data.session_id) {
        callbacks.onComplete({
          session_id: data.session_id,
          sources: data.sources ?? [],
          emotion: data.emotion,
          gesture: data.gesture,
          response_type: data.response_type,
        });
      }
    }
  }

  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6)) as {
        token?: string;
        done?: boolean;
        session_id?: string;
        sources?: string[];
        emotion?: string;
        gesture?: string;
        response_type?: string;
      };
      if (data.token) callbacks.onToken(data.token);
      if (data.done && data.session_id) {
        callbacks.onComplete({
          session_id: data.session_id,
          sources: data.sources ?? [],
          emotion: data.emotion,
          gesture: data.gesture,
          response_type: data.response_type,
        });
      }
    } catch {
      /* trailing partial line */
    }
  }
}
