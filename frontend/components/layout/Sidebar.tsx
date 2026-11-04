"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthUser, getCurrentUser } from "@/services/authService";
import { MENTOR_PROFILES } from "@/services/mentors";
import type { MentorId } from "@/types/mentor";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<MentorId>("mira");
  const [mentorsExpanded, setMentorsExpanded] = useState(true);

  useEffect(() => {
    setUser(getCurrentUser());
    const handleAuth = () => setUser(getCurrentUser());
    window.addEventListener("edu_mentor_auth_changed", handleAuth);

    // Initial mentor from localStorage
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("edu_mentor_selected_mentor") as MentorId | null;
      if (stored) setSelectedMentor(stored);
    }

    const handleMentorChange = (e: Event) => {
      const detail = (e as CustomEvent<{ mentorId?: MentorId }>).detail;
      const next = detail?.mentorId || (localStorage.getItem("edu_mentor_selected_mentor") as MentorId) || "mira";
      setSelectedMentor(next);
    };

    window.addEventListener("edu_mentor_mentor_changed", handleMentorChange);
    return () => {
      window.removeEventListener("edu_mentor_auth_changed", handleAuth);
      window.removeEventListener("edu_mentor_mentor_changed", handleMentorChange);
    };
  }, []);

  const handleSelectMentor = (id: MentorId) => {
    setSelectedMentor(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("edu_mentor_selected_mentor", id);
      window.dispatchEvent(
        new CustomEvent("edu_mentor_mentor_changed", { detail: { mentorId: id } })
      );
    }
    // If not currently on /chat, navigate to /chat
    if (pathname !== "/chat" && !pathname.startsWith("/chat/")) {
      router.push("/chat");
    }
  };

  const isTeacher = user?.role === "teacher";

  return (
    <aside className="glass-bar dark:bg-slate-900/80 dark:border-slate-800 relative z-20 flex h-full w-[4.75rem] shrink-0 flex-col py-3 transition-colors xl:w-60">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2" aria-label="Main">
        {isTeacher ? (
          // ================= TEACHER NAVIGATION =================
          <>
            <SidebarLink
              href="/teacher"
              label="Dashboard"
              active={pathname === "/teacher"}
              icon={DashboardIcon}
            />
            <SidebarLink
              href="/teacher/attendance"
              label="Attendance"
              active={pathname.startsWith("/teacher/attendance")}
              icon={AttendanceIcon}
            />
            <SidebarLink
              href="/teacher/leave-letters"
              label="Leave Letters"
              active={pathname.startsWith("/teacher/leave-letters")}
              icon={LeaveLetterIcon}
            />
            <SidebarLink
              href="/teacher/notes"
              label="Notes & Materials"
              active={pathname.startsWith("/teacher/notes")}
              icon={NotesIcon}
            />
            <SidebarLink
              href="/teacher/students"
              label="Student Management"
              active={pathname.startsWith("/teacher/students")}
              icon={StudentsIcon}
            />
          </>
        ) : (
          // ================= STUDENT NAVIGATION =================
          <>
            <SidebarLink
              href="/chat"
              label="Tutor"
              active={pathname === "/chat" || pathname.startsWith("/chat/")}
              icon={TutorIcon}
            />

            {/* Expandable Mentors Section */}
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setMentorsExpanded(!mentorsExpanded)}
                className={`group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                  pathname === "/chat"
                    ? "text-violet-600 dark:text-violet-400 bg-violet-50/80 dark:bg-violet-950/40"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
                title="Mentors"
              >
                <div className="flex items-center gap-3">
                  <MentorsIcon className="h-5 w-5 shrink-0" />
                  <span className="hidden xl:inline">Mentors</span>
                </div>
                <span className="hidden xl:inline text-xs text-slate-400 dark:text-slate-500 transition-transform duration-200">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transform transition-transform ${mentorsExpanded ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>

              {/* Mentors Submenu */}
              {mentorsExpanded && (
                <div className="mt-1 flex flex-col gap-1 pl-1 xl:pl-3">
                  {MENTOR_PROFILES.map((m) => {
                    const isSelected = m.id === selectedMentor;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectMentor(m.id)}
                        title={`${m.name} (${m.specialty})`}
                        className={`group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-xs font-medium transition ${
                          isSelected
                            ? "bg-violet-600 text-white shadow-sm font-semibold"
                            : "text-slate-600 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <span className="relative flex h-6 w-6 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-300 dark:ring-slate-700">
                          <img
                            src={m.avatar}
                            alt={m.name}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <div className="hidden min-w-0 flex-1 xl:block">
                          <p className="truncate leading-tight">{m.name.replace("Mentor ", "")}</p>
                          <p className={`truncate text-[10px] ${isSelected ? "text-violet-100" : "text-slate-400 dark:text-slate-400"}`}>
                            {m.specialty}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white xl:mr-1 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <SidebarLink
              href="/quiz"
              label="Quiz"
              active={pathname === "/quiz" || pathname.startsWith("/quiz/")}
              icon={QuizIcon}
            />
            <SidebarLink
              href="/interview"
              label="Interview"
              active={pathname === "/interview" || pathname.startsWith("/interview/")}
              icon={InterviewIcon}
            />
            <SidebarLink
              href="/notes"
              label="Notes"
              active={pathname === "/notes" || pathname.startsWith("/notes/")}
              icon={NotesIcon}
            />
            <SidebarLink
              href="/progress"
              label="Progress"
              active={pathname === "/progress" || pathname.startsWith("/progress/")}
              icon={ProgressIcon}
            />
          </>
        )}

        {/* Settings Navigation Item (Shared for both Student & Teacher) */}
        <div className="mt-2 border-t border-slate-200/80 dark:border-slate-800 pt-2">
          <SidebarLink
            href="/settings"
            label="Settings"
            active={pathname === "/settings" || pathname.startsWith("/settings/")}
            icon={SettingsIcon}
          />
        </div>
      </nav>

      {/* Motivational Bottom Card (Desktop only) */}
      <div className="mx-2 mt-3 hidden rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 p-3.5 text-white shadow-lg shadow-violet-500/25 xl:block">
        <p className="text-xs font-semibold leading-snug">
          {isTeacher ? "Empower your students! 📚" : "Keep Learning, Keep Growing! 🚀"}
        </p>
        <div className="mt-2 flex gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-white" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  active,
  icon: Icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={`flex items-center justify-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition xl:justify-start ${
        active
          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/25"
          : "text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}

// ---------------- Icons ----------------

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function AttendanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

function LeaveLetterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function StudentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

function MentorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
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
