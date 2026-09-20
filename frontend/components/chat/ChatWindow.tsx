"use client";

import { useEffect, useRef } from "react";
import MessageBubble, { type SpeechReveal } from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import type { ChatMessage } from "@/types/chat";
import type { TutorMode } from "@/types/tutor";

interface ChatWindowProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  statusMessage?: string | null;
  tutorMode?: TutorMode;
  onSpeak?: (text: string, messageId: string) => void;
  speech?: SpeechReveal;
}

const EMPTY_COPY: Record<TutorMode, { title: string; body: string }> = {
  teacher: {
    title: "Hi — I’m Mentor Mira.",
    body: "Ask me to explain an ML concept. Type, or tap the mic to talk.",
  },
  doubt_solver: {
    title: "What’s confusing you?",
    body: "Describe the doubt. I’ll hint first if you turn on Hint mode.",
  },
  quiz_master: {
    title: "Ready for a quick oral quiz?",
    body: "Name a topic and I’ll ask you questions one at a time.",
  },
  interviewer: {
    title: "Let’s practice interviews.",
    body: "Pick a topic here, or open the Interview section for a scored round.",
  },
};

export default function ChatWindow({
  messages,
  isProcessing,
  statusMessage,
  tutorMode = "teacher",
  onSpeak,
  speech,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, speech?.ratio, speech?.messageId]);

  const last = messages[messages.length - 1];
  const showThinking =
    isProcessing &&
    (!last || last.role !== "assistant" || !last.content.trim());

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
      <div className="space-y-5">
        {messages.length === 0 && (
          <div className="mx-auto mt-10 max-w-lg text-center">
            <p className="text-lg font-semibold tracking-tight text-slate-800">
              {EMPTY_COPY[tutorMode].title}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {EMPTY_COPY[tutorMode].body}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSpeak={onSpeak}
            speech={speech}
          />
        ))}
        {showThinking && <TypingIndicator />}
        {statusMessage && !showThinking && (
          <p className="px-2 text-center text-xs font-medium text-indigo-500">
            {statusMessage}
          </p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
