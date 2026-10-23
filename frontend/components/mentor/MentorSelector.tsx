"use client";

import { useState } from "react";
import type { MentorId } from "@/types/mentor";
import { MENTOR_PROFILES } from "@/services/mentors";

interface MentorSelectorProps {
  selectedMentor: MentorId;
  onSelectMentor: (mentorId: MentorId) => void;
  disabled?: boolean;
}

export default function MentorSelector({
  selectedMentor,
  onSelectMentor,
  disabled = false,
}: MentorSelectorProps) {
  const [openModal, setOpenModal] = useState(false);

  return (
    <div className="relative">
      {/* Mentor Quick Switcher Pills */}
      <div className="flex items-center gap-1.5 rounded-xl bg-slate-100/90 p-1 text-xs">
        {MENTOR_PROFILES.map((m) => {
          const isSelected = m.id === selectedMentor;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectMentor(m.id)}
              className={`group relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition duration-150 ${
                isSelected
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 disabled:opacity-50"
              }`}
              title={`${m.name} — ${m.title}: ${m.description}`}
            >
              <span className="relative flex h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-300">
                <img
                  src={m.avatar}
                  alt={m.name}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="hidden sm:inline font-medium">{m.name.replace("Mentor ", "")}</span>
              {isSelected && (
                <span className="h-1.5 w-1.5 rounded-full bg-violet-600" />
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setOpenModal(true)}
          className="ml-0.5 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700 transition"
          title="View all mentor profiles"
          aria-label="View mentor profiles"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
      </div>

      {/* Mentor Details Modal for full specs */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Choose Your AI Mentor</h3>
                <p className="text-xs text-slate-500">
                  Select an educator based on your learning goals and preferred teaching style.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MENTOR_PROFILES.map((m) => {
                const isSelected = m.id === selectedMentor;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (!disabled) {
                        onSelectMentor(m.id);
                        setOpenModal(false);
                      }
                    }}
                    className={`relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition duration-150 ${
                      isSelected
                        ? "border-violet-500 bg-violet-50/50 ring-2 ring-violet-500/20"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="relative h-14 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                      <img
                        src={m.avatar}
                        alt={m.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-900">{m.name}</h4>
                        {isSelected && (
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-medium text-violet-700">{m.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{m.description}</p>
                      <p className="mt-1 text-[11px] italic text-slate-400">&ldquo;{m.greeting}&rdquo;</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
