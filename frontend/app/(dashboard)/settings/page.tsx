"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { AuthUser, clearSession, getCurrentUser, getProfile } from "@/services/authService";
import { getStoredTheme, setTheme, ThemeMode } from "@/services/themeService";
import { apiFetch, apiRequest } from "@/services/api";

interface StudentLeaveItem {
  id: number;
  subject: string;
  reason: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
  teacher_remarks?: string | null;
  reviewed_by_name?: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [theme, setCurrentTheme] = useState<ThemeMode>("light");
  const [confirmLogout, setConfirmLogout] = useState(false);

  // Leave letter submission state (for students)
  const [leaveSubject, setLeaveSubject] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveStartDate, setLeaveStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [leaveEndDate, setLeaveEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [myLeaves, setMyLeaves] = useState<StudentLeaveItem[]>([]);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<string | null>(null);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);

  useEffect(() => {
    const current = getCurrentUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    setUser(current);
    getProfile().then((live) => {
      if (live) setUser(live);
    });

    setCurrentTheme(getStoredTheme());

    const handleThemeChange = (e: Event) => {
      const detail = (e as CustomEvent<{ theme?: ThemeMode }>).detail;
      if (detail?.theme) setCurrentTheme(detail.theme);
    };

    window.addEventListener("edu_mentor_theme_changed", handleThemeChange);
    return () => {
      window.removeEventListener("edu_mentor_theme_changed", handleThemeChange);
    };
  }, [router]);

  // If student, load their leave letters
  useEffect(() => {
    if (user && user.role === "student") {
      apiFetch<StudentLeaveItem[]>("/api/teacher/leave-letters/my")
        .then((data) => setMyLeaves(data))
        .catch(() => {});
    }
  }, [user]);

  const handleThemeSelect = (newTheme: ThemeMode) => {
    setCurrentTheme(newTheme);
    setTheme(newTheme);
  };

  const handleLogout = () => {
    clearSession();
    router.replace("/login");
  };

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveSubject.trim() || !leaveReason.trim()) {
      setLeaveErr("Please provide both subject and reason for the leave letter.");
      return;
    }

    setSubmittingLeave(true);
    setLeaveMsg(null);
    setLeaveErr(null);

    try {
      const res = await apiFetch<StudentLeaveItem>("/api/teacher/leave-letters/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: leaveSubject.trim(),
          reason: leaveReason.trim(),
          start_date: leaveStartDate,
          end_date: leaveEndDate,
        }),
      });

      setLeaveMsg("Leave letter submitted successfully! Your teacher will review it.");
      setLeaveSubject("");
      setLeaveReason("");
      setMyLeaves((prev) => [res, ...prev]);
    } catch (err: unknown) {
      setLeaveErr(err instanceof Error ? err.message : "Failed to submit leave letter.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const isTeacher = user?.role === "teacher";

  return (
    <MainLayout>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Settings & Preferences
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage your profile, theme appearance, and educational preferences
            </p>
          </div>

          {/* Section 1: Account Information & Logout */}
          <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-5 sm:p-6 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-base font-bold text-white shadow-md shadow-violet-500/25">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {user?.full_name || "Active User"}
                    </h2>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isTeacher
                          ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                          : "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800"
                      }`}
                    >
                      {user?.role || "student"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  id="settings-logout-btn"
                  onClick={() => setConfirmLogout(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-600 dark:text-red-400 shadow-sm transition hover:bg-red-100 dark:hover:bg-red-900/60"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Access Scope: </span>
                <span>
                  {isTeacher
                    ? "Teacher Portal (Curriculum upload, Attendance roster, Leave reviews)"
                    : "Student Workspace (Conversational Tutor, Mentors, Quizzes, Notes)"}
                </span>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Authentication: </span>
                <span>JWT Secure Session (Stateless Bearer Authorization)</span>
              </div>
            </div>
          </div>

          {/* Section 2: Appearance & Theme */}
          <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-5 sm:p-6 transition-colors">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Appearance & Theme
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose how Edu-Mentor AI looks for your learning sessions
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Light Theme Option */}
              <button
                type="button"
                onClick={() => handleThemeSelect("light")}
                className={`relative flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                  theme === "light"
                    ? "border-violet-600 bg-violet-50/60 dark:bg-violet-950/40 ring-2 ring-violet-600"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 mb-2">
                  ☀️
                </div>
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Light Theme</h3>
                  {theme === "light" && (
                    <span className="h-2 w-2 rounded-full bg-violet-600" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Clean, bright violet surfaces with high legibility for day study.
                </p>
              </button>

              {/* Dark Theme Option */}
              <button
                type="button"
                onClick={() => handleThemeSelect("dark")}
                className={`relative flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                  theme === "dark"
                    ? "border-violet-600 bg-violet-50/60 dark:bg-violet-950/40 ring-2 ring-violet-600"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-900 text-indigo-200 mb-2">
                  🌙
                </div>
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Dark Theme</h3>
                  {theme === "dark" && (
                    <span className="h-2 w-2 rounded-full bg-violet-600" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Deep midnight surfaces designed for eye comfort during night research.
                </p>
              </button>

              {/* System Default Option */}
              <button
                type="button"
                onClick={() => handleThemeSelect("system")}
                className={`relative flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                  theme === "system"
                    ? "border-violet-600 bg-violet-50/60 dark:bg-violet-950/40 ring-2 ring-violet-600"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300"
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mb-2">
                  💻
                </div>
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">System Default</h3>
                  {theme === "system" && (
                    <span className="h-2 w-2 rounded-full bg-violet-600" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Automatically sync with your operating system light/dark mode settings.
                </p>
              </button>
            </div>
          </div>

          {/* Section 3: Student Leave Letter Submission (Student Only) */}
          {!isTeacher && (
            <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-5 sm:p-6 transition-colors">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Submit Leave Letter
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Send a formal absence request to your course instructor
                </p>
              </div>

              {leaveMsg && (
                <div className="mt-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  ✓ {leaveMsg}
                </div>
              )}
              {leaveErr && (
                <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
                  ✕ {leaveErr}
                </div>
              )}

              <form onSubmit={handleSubmitLeave} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Subject / Topic
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Leave Request for Medical Checkup"
                      value={leaveSubject}
                      onChange={(e) => setLeaveSubject(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveStartDate}
                        onChange={(e) => setLeaveStartDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        required
                        value={leaveEndDate}
                        onChange={(e) => setLeaveEndDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason & Explanation
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide details regarding your upcoming absence..."
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingLeave}
                    className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {submittingLeave ? "Submitting..." : "Submit Leave Request"}
                  </button>
                </div>
              </form>

              {/* Past Submissions list */}
              {myLeaves.length > 0 && (
                <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                    Your Submitted Leave Requests
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {myLeaves.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{l.subject}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              l.status === "approved"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : l.status === "rejected"
                                ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                                : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {l.status}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 dark:text-slate-300">{l.reason}</p>
                        <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-400">
                          Dates: {l.start_date} to {l.end_date}
                          {l.teacher_remarks && (
                            <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">
                              • Remarks: {l.teacher_remarks}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 4: AI Voice & Audio Guide */}
          <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-5 sm:p-6 transition-colors">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">
              AI Voice & Mentors
            </h2>
            <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <p>• <strong>Mira</strong>: Foundations & General ML (Piper <code>en_US-lessac-medium</code> / multilingual).</p>
              <p>• <strong>Arjun</strong>: DBMS, Transactions & SQL Architecture (Piper <code>en_US-ryan-medium</code>).</p>
              <p>• <strong>Tara</strong>: Deep Learning & Neural Architectures (Piper <code>en_US-amy-medium</code>).</p>
              <p>• <strong>Kiran</strong>: Practical Code Implementation & Labs (Piper <code>en_US-danny-low</code>).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm Sign Out</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to end your Edu-Mentor AI learning session?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
