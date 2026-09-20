"use client";

import { useState } from "react";
import Link from "next/link";
import MicButton from "@/components/voice/MicButton";

const CHIPS: { label: string; text?: string; href?: string }[] = [
  { label: "🧠 Explain neural networks", text: "Explain neural networks" },
  { label: "🏆 Give me a quiz", href: "/quiz" },
  { label: "🎤 Interview questions", href: "/interview" },
  { label: "📄 Show notes", href: "/notes" },
];

interface ChatInputProps {
  onSendText: (text: string) => void;
  onSendVoice: (blob: Blob) => void;
  disabled?: boolean;
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onListeningCancel?: () => void;
}

export default function ChatInput({
  onSendText,
  onSendVoice,
  disabled,
  onListeningStart,
  onListeningEnd,
  onListeningCancel,
}: ChatInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSendText(text.trim());
    setText("");
  };

  return (
    <div className="shrink-0 border-t border-slate-100/80 bg-white/50 px-4 py-3 sm:px-5">
      <div className="mb-3 flex flex-wrap gap-2">
        {CHIPS.map((chip) =>
          chip.href ? (
            <Link
              key={chip.label}
              href={chip.href}
              className="rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700"
            >
              {chip.label}
            </Link>
          ) : (
            <button
              key={chip.label}
              type="button"
              disabled={disabled}
              onClick={() => chip.text && onSendText(chip.text)}
              className="rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50"
            >
              {chip.label}
            </button>
          )
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="flex items-end gap-2 rounded-[1.6rem] border border-violet-100 bg-white px-2.5 py-2 shadow-[0_12px_32px_-14px_rgb(109_40_217_/_0.38)] transition focus-within:border-violet-300 focus-within:shadow-violet-200/70">
          <MicButton
            variant="input"
            onRecordingComplete={onSendVoice}
            disabled={disabled}
            onListeningStart={onListeningStart}
            onListeningEnd={onListeningEnd}
            onListeningCancel={onListeningCancel}
          />
          <textarea
            value={text}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!text.trim() || disabled) return;
                onSendText(text.trim());
                setText("");
              }
            }}
            placeholder="Ask a question about Machine Learning..."
            disabled={disabled}
            className="max-h-32 min-h-[3.25rem] min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-md shadow-violet-600/30 transition hover:from-violet-500 hover:to-indigo-400 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
      <p className="mt-2 px-2 text-[11px] text-slate-400">
        Try: <span className="text-slate-500">Explain overfitting</span>
        {" · "}
        <span className="text-slate-500">What is gradient descent?</span>
      </p>
    </div>
  );
}
