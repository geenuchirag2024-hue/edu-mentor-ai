"use client";

import { useState, type ReactNode } from "react";
import type { ChatMessage, RelatedVideo } from "@/types/chat";
import { revealSpokenText } from "./speechReveal";

export interface SpeechReveal {
  messageId: string | null;
  ratio: number;
  active: boolean;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onSpeak?: (text: string, messageId: string) => void;
  onWatchVideo?: (video: RelatedVideo) => void;
  speech?: SpeechReveal;
}

export default function MessageBubble({
  message,
  onSpeak,
  onWatchVideo,
  speech,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);
  const time = message.timestamp.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const speakingThis =
    !isUser &&
    Boolean(speech?.active && speech.messageId === message.id && message.content.trim());

  const shown = speakingThis
    ? revealSpokenText(message.content, speech?.ratio ?? 0)
    : message.content;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {isUser ? (
        <div className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-indigo-600 text-[10px] font-semibold text-white shadow-sm">
          You
        </div>
      ) : (
        <img
          src="/mascot/mira-idle.jpg"
          alt=""
          className="mb-1 h-10 w-10 shrink-0 rounded-full object-cover object-top shadow-sm ring-2 ring-white"
        />
      )}

      <div
        className={`flex min-w-0 flex-col ${
          isUser
            ? "max-w-[min(80%,28rem)] items-end"
            : "max-w-[min(92%,42rem)] items-start"
        }`}
      >
        {!isUser && (
          <div className="mb-1.5 flex items-baseline gap-2 px-1">
            <span className="text-[13px] font-semibold text-slate-700">Mentor Mira</span>
            <time className="text-[11px] text-slate-400">{time}</time>
          </div>
        )}
        <div
          className={`w-fit px-4 py-2.5 leading-relaxed ${
            isUser
              ? "rounded-2xl rounded-br-md bg-gradient-to-br from-violet-600 to-indigo-500 text-[15px] text-white shadow-md shadow-violet-600/25"
              : "rounded-2xl rounded-bl-md border border-white/80 bg-white/95 text-[15px] text-slate-800 shadow-sm"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">
            {shown || " "}
            {speakingThis && (speech?.ratio ?? 0) < 0.995 && (
              <span className="mira-caret" aria-hidden>
                |
              </span>
            )}
          </p>
          {!isUser && message.sources && message.sources.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Sources: {message.sources.join(", ")}
            </p>
          )}

          {/* Related Video Recommendation badge */}
          {!isUser && message.related_video && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center">
              <button
                type="button"
                onClick={() => onWatchVideo?.(message.related_video!)}
                className="group flex items-center gap-2 rounded-xl bg-violet-50/90 hover:bg-violet-100/90 border border-violet-200/80 px-3 py-1.5 text-xs font-semibold text-violet-700 transition shadow-xs hover:shadow-sm"
                title={`Watch related video: ${message.related_video.title}`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shadow-xs group-hover:scale-105 transition-transform">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span>Watch Video: {message.related_video.topic || message.related_video.title}</span>
                {message.related_video.duration_seconds && (
                  <span className="text-[10px] opacity-75 font-normal">
                    ({Math.round(message.related_video.duration_seconds)}s)
                  </span>
                )}
              </button>
            </div>
          )}

          {isUser && (
            <time className="mt-2 block text-[11px] text-white/70">{time}</time>
          )}
        </div>

        {!isUser && message.content.trim() && (
          <div className="mt-1.5 flex items-center gap-0.5 px-1 text-slate-400">
            <IconButton
              title="Helpful"
              active={feedback === "up"}
              onClick={() => setFeedback(feedback === "up" ? null : "up")}
            >
              <path d="M7 10v12M14 22H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h8.4a2 2 0 0 1 1.9 1.4l1.4 5.2A2 2 0 0 1 16.8 19H14" />
              <path d="M14 10V5a3 3 0 0 0-3-3l-4 8" />
            </IconButton>
            <IconButton
              title="Not helpful"
              active={feedback === "down"}
              onClick={() => setFeedback(feedback === "down" ? null : "down")}
            >
              <path d="M17 14V2M10 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8.4a2 2 0 0 1-1.9-1.4L8.3 7.4A2 2 0 0 1 10.1 5H14" />
              <path d="M10 14v5a3 3 0 0 0 3 3l4-8" />
            </IconButton>
            <IconButton title={copied ? "Copied" : "Copy"} onClick={() => void copy()}>
              {copied ? (
                <path d="M5 13l4 4L19 7" />
              ) : (
                <>
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </>
              )}
            </IconButton>
            {onSpeak && (
              <IconButton
                title={speakingThis ? "Speaking…" : "Play with text"}
                active={speakingThis}
                onClick={() => onSpeak(message.content, message.id)}
              >
                <path d="M11 5 6 9H2v6h4l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  title,
  onClick,
  active,
  children,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-lg p-1.5 transition ${
        active ? "text-violet-600" : "hover:bg-white hover:text-slate-700"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {children}
      </svg>
    </button>
  );
}
