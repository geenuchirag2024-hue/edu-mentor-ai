"use client";

import { useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import type { ChatMessage } from "@/types/chat";
import type { TutorMode } from "@/types/tutor";

interface ChatWindowProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  statusMessage?: string | null;
  tutorMode?: TutorMode;
}

const EMPTY_COPY: Record<TutorMode, { title: string; body: string }> = {
  teacher: {
    title: "Hi! I'm Mentor Mira.",
    body: "Ask me to explain an ML concept — type or hold the mic to talk.",
  },
  doubt_solver: {
    title: "What's confusing you?",
    body: "Describe the doubt. I'll hint first if you turn on Hint mode.",
  },
  quiz_master: {
    title: "Ready for a quick oral quiz?",
    body: "Say a topic, and I'll ask you questions one at a time.",
  },
  interviewer: {
    title: "Let's practice interviews.",
    body: "Tell me a topic, or jump to the Interview tab for a scored round.",
  },
};

export default function ChatWindow({
  messages,
  isProcessing,
  statusMessage,
  tutorMode = "teacher",
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.length === 0 && (
        <div className="text-center text-slate-500 mt-12">
          <p className="text-lg font-medium">{EMPTY_COPY[tutorMode].title}</p>
          <p className="text-sm mt-2">{EMPTY_COPY[tutorMode].body}</p>
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
