"use client";

import { useVoiceRecorder } from "./useVoiceRecorder";

interface MicButtonProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
  onListeningStart?: () => void;
  onListeningEnd?: () => void;
  onListeningCancel?: () => void;
}

export default function MicButton({
  onRecordingComplete,
  disabled,
  onListeningStart,
  onListeningEnd,
  onListeningCancel,
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={isRecording ? "Click to stop & send" : "Click mic, speak, click again to send"}
        className={`rounded-full p-3 transition-colors ${
          isRecording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        } disabled:opacity-50`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </button>
      {error && (
        <span className="absolute bottom-full left-0 mb-2 max-w-xs rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 shadow-sm">
          {error}
        </span>
      )}
    </div>
  );
}
