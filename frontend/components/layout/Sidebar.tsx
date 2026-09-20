"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/chat", label: "Tutor", icon: TutorIcon },
  { href: "/quiz", label: "Quiz", icon: QuizIcon },
  { href: "/interview", label: "Interview", icon: InterviewIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
  { href: "/progress", label: "Progress", icon: ProgressIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<"settings" | "help" | null>(null);

  return (
    <aside className="glass-bar relative flex h-full w-[4.75rem] shrink-0 flex-col py-3 xl:w-52">
      <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Main">
        {LINKS.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={`flex items-center justify-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition xl:justify-start ${
                active
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/25"
                  : "text-slate-500 hover:bg-white/80 hover:text-slate-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden xl:inline">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-2 border-t border-slate-200/80 pt-2">
        <button
          type="button"
          onClick={() => setPanel(panel === "settings" ? null : "settings")}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition xl:justify-start ${
            panel === "settings"
              ? "bg-white text-slate-800"
              : "text-slate-500 hover:bg-white hover:text-slate-800"
          }`}
        >
          <SettingsIcon className="h-5 w-5 shrink-0" />
          <span className="hidden xl:inline">Settings</span>
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "help" ? null : "help")}
          className={`flex w-full items-center justify-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition xl:justify-start ${
            panel === "help"
              ? "bg-white text-slate-800"
              : "text-slate-500 hover:bg-white hover:text-slate-800"
          }`}
        >
          <HelpIcon className="h-5 w-5 shrink-0" />
          <span className="hidden xl:inline">Help</span>
        </button>
      </div>

      <div className="mx-2 mt-3 hidden rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 p-3.5 text-white shadow-lg shadow-violet-500/25 xl:block">
        <p className="text-sm font-semibold leading-snug">
          Keep Learning, Keep Growing! 🚀
        </p>
        <div className="mt-3 flex gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-white" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
        </div>
      </div>

      {panel && (
        <div className="absolute bottom-28 left-[calc(100%+8px)] z-40 w-72 rounded-2xl border border-white/80 bg-white p-4 text-sm shadow-xl shadow-slate-900/10">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-900">
              {panel === "settings" ? "Settings" : "Help"}
            </p>
            <button
              type="button"
              onClick={() => setPanel(null)}
              className="rounded-full px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {panel === "settings" ? (
            <ul className="space-y-2 text-slate-600">
              <li>Language lives in the top bar.</li>
              <li>Mentor modes (Teacher, Quiz Master, and more) are in Tutor chat.</li>
              <li>Hint mode is the lightbulb on Mira’s panel.</li>
            </ul>
          ) : (
            <ul className="space-y-2 text-slate-600">
              <li>Type a question, or tap the mic, speak, then tap again to send.</li>
              <li>Use Quiz, Interview, Notes, and Progress from this sidebar.</li>
              <li>Tap the speaker on Mira’s messages to hear an answer again.</li>
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}

function TutorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V7l8-3 8 3v12" />
      <path d="M8 10v9m8-9v9M4 19h16" />
    </svg>
  );
}
function QuizIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 9a3 3 0 1 1 5.2 2.1C13.4 12 12 13 12 15" />
      <path d="M12 18h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function InterviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function NotesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h8l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M15 3v5h5M8 13h8M8 17h6" />
    </svg>
  );
}
function ProgressIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V9m6 10V5m6 14v-7m6 7V8" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.7.9 1.2 1.6 1.3H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
function HelpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.1 9a3 3 0 1 1 4.4 2.7c-.9.5-1.5 1.1-1.5 2" />
      <path d="M12 17h.01" />
    </svg>
  );
}
