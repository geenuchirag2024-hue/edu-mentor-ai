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
}

export default function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          type="button"
          title={mode.hint}
          onClick={() => onChange(mode.id)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            value === mode.id
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
