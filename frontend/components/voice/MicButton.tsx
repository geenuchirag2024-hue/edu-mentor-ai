"use client";

import { useVoiceRecorder } from "./useVoiceRecorder";

interface MicButtonProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onListeningCancel?: () => void;
  variant?: "default" | "input" | "glass" | "dock";
}

export default function MicButton({
  onRecordingComplete,
  disabled,
  onListeningStart,
  onListeningEnd,
  onListeningCancel,
  variant = "default",
}: MicButtonProps) {
  const { isRecording, error, startRecording, stopRecording } = useVoiceRecorder();

  const handleClick = async () => {
    if (disabled) return;

    if (!isRecording) {
      try {
        await startRecording();
        onListeningStart?.();
      } catch {
        // error set in hook
      }
    } else {
      onListeningEnd?.();
      try {
        const blob = await stopRecording();
        onRecordingComplete(blob);
      } catch {
        onListeningCancel?.();
      }
    }
  };

  const idleClass =
    variant === "input"
      ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25 hover:bg-violet-500"
      : variant === "glass" || variant === "dock"
        ? "bg-white/15 text-white hover:bg-white/25"
        : "text-slate-500 hover:bg-white hover:text-violet-600";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={isRecording ? "Click to stop & send" : "Click mic, speak, click again to send"}
        aria-pressed={isRecording}
        className={`relative rounded-full p-2.5 transition ${
          isRecording
            ? "bg-red-500 text-white shadow-sm shadow-red-500/30"
            : idleClass
        } disabled:opacity-50`}
      >
        {isRecording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400/40" />
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="relative">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      {isRecording && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
          Recording
        </span>
      )}
      {error && (
        <span className="absolute bottom-full left-0 mb-2 max-w-xs rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 shadow-sm">
          {error}
        </span>
      )}
    </div>
  );
}
