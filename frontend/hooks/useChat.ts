"use client";

import { useCallback, useState } from "react";
import { streamChatMessage } from "@/services/chatService";
import type { ChatMessage } from "@/types/chat";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setIsLoading(true);
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "user", content: text, timestamp: new Date() },
      ]);

      const assistantId = makeId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
      ]);

      try {
        await streamChatMessage(
          { message: text, session_id: sessionId },
          {
            onToken: (token) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + token } : m
                )
              );
            },
            onComplete: (meta) => {
              setSessionId(meta.session_id);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: meta.sources } : m
                )
              );
            },
          }
        );
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  return { messages, sendMessage, isLoading, sessionId };
}
