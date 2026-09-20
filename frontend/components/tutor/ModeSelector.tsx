"use client";

import type { TutorMode } from "@/types/tutor";

const MODES: { id: TutorMode; label: string; hint: string }[] = [
  { id: "teacher", label: "Teacher", hint: "Step-by-step explanations" },
  { id: "doubt_solver", label: "Doubt Solver", hint: "Clear a specific confusion" },
  { id: "quiz_master", label: "Quiz Master", hint: "Mira asks you questions" },
  { id: "interviewer", label: "Interviewer", hint: "Technical interview practice" },
];

interface ModeSelectorProps {
  value: TutorMode;
  onChange: (mode: TutorMode) => void;
  compact?: boolean;
}

export default function ModeSelector({
  value,
  onChange,
  compact = false,
}: ModeSelectorProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "px-4 pb-3 pt-1"}`}>
      {!compact && (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Mode
        </span>
      )}
      <div className="flex flex-wrap gap-1 rounded-full bg-slate-100 p-1">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            title={mode.hint}
            onClick={() => onChange(mode.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              value === mode.id
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
