import { API_URL, apiFetch } from "./api";
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
  onComplete: (meta: { session_id: string; sources: string[] }) => void;
}

export async function streamChatMessage(
  request: ChatRequest,
  callbacks: StreamChatCallbacks
): Promise<void> {
  const res = await fetch(`${API_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
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
      };
      if (data.token) callbacks.onToken(data.token);
      if (data.done && data.session_id) {
        callbacks.onComplete({
          session_id: data.session_id,
          sources: data.sources ?? [],
        });
      }
    }
  }
}
