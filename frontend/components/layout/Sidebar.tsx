"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthUser, getCurrentUser } from "@/services/authService";

const BASE_LINKS = [
  { href: "/chat", label: "Tutor", icon: TutorIcon },
  { href: "/quiz", label: "Quiz", icon: QuizIcon },
  { href: "/interview", label: "Interview", icon: InterviewIcon },
  { href: "/notes", label: "Notes", icon: NotesIcon },
  { href: "/progress", label: "Progress", icon: ProgressIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<"settings" | "help" | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getCurrentUser());
    const handleAuth = () => setUser(getCurrentUser());
    window.addEventListener("edu_mentor_auth_changed", handleAuth);
    return () => window.removeEventListener("edu_mentor_auth_changed", handleAuth);
  }, []);

  // Close panel on Escape key
  useEffect(() => {
    if (!panel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panel]);

  const isTeacher = user?.role === "teacher";
  const links = isTeacher
    ? [{ href: "/teacher", label: "Teacher", icon: TeacherIcon }, ...BASE_LINKS]
    : BASE_LINKS;

  return (
    <>
      <aside className="glass-bar relative z-20 flex h-full w-[4.75rem] shrink-0 flex-col py-3 xl:w-52">
        <nav className="flex flex-1 flex-col gap-1 px-2" aria-label="Main">
          {links.map((link) => {
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
            {isTeacher ? "Empower your students! 📚" : "Keep Learning, Keep Growing! 🚀"}
          </p>
          <div className="mt-3 flex gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-white" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
        </div>
      </aside>

      {/* Global High-Z Modal Overlay for Settings and Help */}
      {panel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPanel(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-6 shadow-2xl shadow-slate-900/30 transition-all sm:p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  {panel === "settings" ? (
                    <SettingsIcon className="h-5 w-5" />
                  ) : (
                    <HelpIcon className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {panel === "settings" ? "Application Settings" : "Edu Mentor AI Guide & Help"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {panel === "settings"
                      ? "Customize your audio, avatar, and learning workspace"
                      : "Quick tips for an optimal conversational learning experience"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Close modal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
              {panel === "settings" ? (
                <div className="space-y-4 text-xs">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <h4 className="font-semibold text-slate-800">Account & Permissions</h4>
                    <p className="mt-0.5 text-slate-500">
                      Logged in as <strong className="text-slate-700">{user?.full_name || "Guest"}</strong> ({user?.email || "N/A"})
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-800 uppercase">
                        {user?.role || "student"}
                      </span>
                      {isTeacher && (
                        <span className="text-[11px] text-indigo-600 font-medium">
                          ✓ Curriculum upload & student analytics access
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <h4 className="font-semibold text-slate-800">AI Mentor Voice & Speech</h4>
                    <ul className="mt-2 space-y-1.5 text-slate-600">
                      <li>• <strong>Mira</strong>: Warm, friendly foundations (Piper <code>en_US-lessac-medium</code>).</li>
                      <li>• <strong>Arjun</strong>: Calm, practical DBMS architect (Piper <code>en_US-ryan-medium</code> or adaptive fallback).</li>
                      <li>• <strong>Tara</strong>: Analytical Deep Learning tutor (Piper <code>en_US-amy-medium</code> or adaptive fallback).</li>
                      <li>• <strong>Kiran</strong>: Energetic code practitioner (Piper <code>en_US-danny-low</code> or adaptive fallback).</li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <h4 className="font-semibold text-slate-800">Avatar Motion & Lip Sync</h4>
                    <p className="mt-1 text-slate-600 leading-relaxed">
                      Edu-Mentor AI automatically synchronizes facial gestures, eye blinks, and jaw motion with active Piper audio playback. Mouth animation remains stationary during speech pauses and silence.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs text-slate-600">
                  <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3.5">
                    <h4 className="font-bold text-violet-900">Conversational Voice Interaction</h4>
                    <p className="mt-1 text-violet-800 leading-relaxed">
                      Tap the microphone button once to start speaking. When you finish your thought, tap it again to submit your question. The system transcribes your speech via faster-whisper, retrieves subject documents via RAG, and generates the mentor&apos;s answer with voice synthesis.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <h4 className="font-semibold text-slate-800">Switching Mentors & Subjects</h4>
                    <p className="mt-1 leading-relaxed">
                      Use the top pill selector in Tutor chat to switch between Mira, Arjun, Tara, and Kiran. Each mentor brings a distinct teaching philosophy and persona. You can also toggle between Machine Learning, DBMS, and Deep Learning at any time.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                    <h4 className="font-semibold text-slate-800">Tutor Modes & Hints</h4>
                    <p className="mt-1 leading-relaxed">
                      Switch between <em>Standard</em>, <em>Socratic</em> (asks guiding questions), <em>Code Explainer</em>, and <em>Exam Prep</em> modes using the mode toggle next to the subject pills.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TeacherIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M6 6h10M6 10h10M6 14h6" />
    </svg>
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
