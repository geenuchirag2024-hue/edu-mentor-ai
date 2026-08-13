"use client";

import { useState } from "react";
import MicButton from "@/components/voice/MicButton";

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
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200 bg-white px-4 py-3 flex gap-2 items-center"
    >
      <MicButton
        onRecordingComplete={onSendVoice}
        disabled={disabled}
        onListeningStart={onListeningStart}
        onListeningEnd={onListeningEnd}
        onListeningCancel={onListeningCancel}
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask a question about Machine Learning..."
        disabled={disabled}
        className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="rounded-xl bg-indigo-600 text-white px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}
