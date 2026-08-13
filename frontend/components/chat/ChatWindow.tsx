"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import type { ChatMessage } from "@/types/chat";

interface ChatWindowProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  statusMessage?: string | null;
}

export default function ChatWindow({ messages, isProcessing, statusMessage }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.length === 0 && (
        <div className="text-center text-slate-500 mt-12">
          <p className="text-lg font-medium">Hi! I&apos;m your ML mentor.</p>
          <p className="text-sm mt-2">
            Ask me anything about Machine Learning — type or use the mic.
          </p>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isProcessing &&
        !(
          messages.length > 0 && messages[messages.length - 1].role === "assistant"
        ) && <TypingIndicator />}
      {isProcessing && statusMessage && (
        <p className="text-center text-sm text-amber-600 px-4">{statusMessage}</p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
