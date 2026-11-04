"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { getCurrentUser, getProfile } from "@/services/authService";
import { apiFetch, apiRequest } from "@/services/api";

interface LeaveLetterItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  subject: string;
  reason: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected";
  teacher_remarks?: string | null;
  reviewed_by_id?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export default function TeacherLeaveLettersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [letters, setLetters] = useState<LeaveLetterItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [activeLetter, setActiveLetter] = useState<LeaveLetterItem | null>(null);
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    getProfile().then((live) => {
      const active = live || user;
      if (active.role !== "teacher") {
        router.replace("/chat");
      }
    });
  }, [router]);

  const fetchLetters = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = statusFilter === "all" ? "/api/teacher/leave-letters" : `/api/teacher/leave-letters?status=${statusFilter}`;
      const data = await apiFetch<LeaveLetterItem[]>(url);
      setLetters(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load leave letters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, [statusFilter]);

  const handleOpenReview = (l: LeaveLetterItem) => {
    setActiveLetter(l);
    setTeacherRemarks(l.teacher_remarks || "");
    setFeedbackMsg(null);
  };

  const handleDecision = async (status: "approved" | "rejected") => {
    if (!activeLetter) return;
    setSubmittingReview(true);
    setErrorMsg(null);

    try {
      const updated = await apiFetch<LeaveLetterItem>(
        `/api/teacher/leave-letters/${activeLetter.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            teacher_remarks: teacherRemarks.trim() || null,
          }),
        }
      );

      setLetters((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setFeedbackMsg(`✓ Leave request #${updated.id} marked as ${status}.`);
      setActiveLetter(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update review status.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const pendingCount = letters.filter((l) => l.status === "pending").length;
  const approvedCount = letters.filter((l) => l.status === "approved").length;
  const rejectedCount = letters.filter((l) => l.status === "rejected").length;

  return (
    <MainLayout>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Student Leave Letters
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review, approve, and record student absence requests
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center rounded-xl bg-slate-100/90 dark:bg-slate-800/90 p-1 text-xs">
              {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                    statusFilter === filter
                      ? "bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {feedbackMsg && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              {feedbackMsg}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
              ✕ {errorMsg}
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Requests</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{letters.length}</p>
            </div>
            <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Pending Review</p>
              <p className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">{pendingCount}</p>
            </div>
            <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Approved</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
            </div>
            <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Rejected</p>
              <p className="mt-1 text-xl font-extrabold text-red-600 dark:text-red-400">{rejectedCount}</p>
            </div>
          </div>

          {/* List of Leave Letters */}
          <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-5 transition-colors">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading student leave letters...</div>
            ) : letters.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No leave letters found for this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {letters.map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {l.student_name}
                        </span>
                        <span className="text-[11px] text-slate-400">({l.student_email})</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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

                      <h3 className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {l.subject}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {l.reason}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>📅 Leave: <strong>{l.start_date}</strong> to <strong>{l.end_date}</strong></span>
                        <span>• Submitted: {new Date(l.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                        {l.teacher_remarks && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            • Remarks: {l.teacher_remarks}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenReview(l)}
                        className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/80 dark:bg-violet-950/40 px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/60 transition"
                      >
                        {l.status === "pending" ? "Review & Decide" : "View Details"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Review & Decision Modal */}
      {activeLetter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Review Leave Request #{activeLetter.id}
                </h3>
                <p className="text-xs text-slate-500">From {activeLetter.student_name} ({activeLetter.student_email})</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveLetter(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Subject: </span>
                <span className="text-slate-900 dark:text-slate-100 font-medium">{activeLetter.subject}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Requested Dates: </span>
                <span className="text-slate-900 dark:text-slate-100 font-medium">
                  {activeLetter.start_date} to {activeLetter.end_date}
                </span>
              </div>
              <div>
                <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Detailed Reason:</span>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/80 p-3 leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                  {activeLetter.reason}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instructor Remarks / Feedback
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Approved. Please review recorded lectures for Chapter 4."
                  value={teacherRemarks}
                  onChange={(e) => setTeacherRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setActiveLetter(null)}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleDecision("rejected")}
                  className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 transition disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={submittingReview}
                  onClick={() => handleDecision("approved")}
                  className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
