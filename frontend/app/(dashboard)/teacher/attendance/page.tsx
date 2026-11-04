"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import { getCurrentUser, getProfile } from "@/services/authService";
import { apiFetch, apiRequest } from "@/services/api";

interface AttendanceRecordItem {
  id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  date: string;
  subject: string;
  status: "present" | "absent" | "late";
  remarks?: string | null;
  updated_at?: string | null;
}

interface AttendanceSummaryResponse {
  date: string;
  subject: string;
  total_enrolled: number;
  total_marked: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
  records: AttendanceRecordItem[];
}

export default function TeacherAttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedSubject, setSelectedSubject] = useState("Machine Learning");
  const [summary, setSummary] = useState<AttendanceSummaryResponse | null>(null);
  const [statusMap, setStatusMap] = useState<Record<number, "present" | "absent" | "late">>({});
  const [remarksMap, setRemarksMap] = useState<Record<number, string>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Authentication & Role check
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

  // Fetch attendance data for selectedDate & selectedSubject
  const fetchAttendance = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetch<AttendanceSummaryResponse>(
        `/api/teacher/attendance?date=${selectedDate}&subject=${encodeURIComponent(selectedSubject)}`
      );
      setSummary(data);

      const newStatus: Record<number, "present" | "absent" | "late"> = {};
      const newRemarks: Record<number, string> = {};
      for (const r of data.records) {
        newStatus[r.student_id] = r.status;
        newRemarks[r.student_id] = r.remarks || "";
      }
      setStatusMap(newStatus);
      setRemarksMap(newRemarks);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [selectedDate, selectedSubject]);

  const handleStatusChange = (studentId: number, status: "present" | "absent" | "late") => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleRemarksChange = (studentId: number, text: string) => {
    setRemarksMap((prev) => ({ ...prev, [studentId]: text }));
  };

  const handleMarkAll = (status: "present" | "absent" | "late") => {
    if (!summary) return;
    const next: Record<number, "present" | "absent" | "late"> = {};
    for (const r of summary.records) {
      next[r.student_id] = status;
    }
    setStatusMap(next);
  };

  const handleSaveAttendance = async () => {
    if (!summary) return;
    setSaving(true);
    setFeedbackMsg(null);
    setErrorMsg(null);

    const payload = {
      date: selectedDate,
      subject: selectedSubject,
      records: summary.records.map((r) => ({
        student_id: r.student_id,
        status: statusMap[r.student_id] || "present",
        remarks: remarksMap[r.student_id]?.trim() || null,
      })),
    };

    try {
      const updated = await apiFetch<AttendanceSummaryResponse>("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setSummary(updated);
      setFeedbackMsg(`✓ Attendance for ${selectedDate} (${selectedSubject}) saved successfully!`);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-5">
        <div className="mx-auto w-full max-w-5xl space-y-5">
          {/* Top Title & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Attendance Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Record and track student class participation and presence
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />

              <div className="flex items-center rounded-xl bg-slate-100/90 dark:bg-slate-800/90 p-1 text-xs">
                {(["Machine Learning", "DBMS", "Deep Learning"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSubject(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedSubject === s
                        ? "bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
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

          {/* Metrics Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Enrolled Students</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{summary.total_enrolled}</p>
              </div>
              <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Present</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{summary.present_count}</p>
              </div>
              <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Late</p>
                <p className="mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-400">{summary.late_count}</p>
              </div>
              <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center">
                <p className="text-[11px] font-medium text-red-600 dark:text-red-400">Absent</p>
                <p className="mt-1 text-xl font-extrabold text-red-600 dark:text-red-400">{summary.absent_count}</p>
              </div>
              <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-3.5 text-center col-span-2 sm:col-span-1">
                <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400">Attendance Rate</p>
                <p className="mt-1 text-xl font-extrabold text-violet-600 dark:text-violet-400">{summary.attendance_rate}%</p>
              </div>
            </div>
          )}

          {/* Roster & Table */}
          <div className="glass-panel dark:bg-slate-900/80 dark:border-slate-800 p-4 sm:p-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Student Roster • {selectedSubject}
                </h2>
                <span className="text-xs text-slate-400">({selectedDate})</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkAll("present")}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Mark All Present
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={saving || loading}
                  className="rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Attendance"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading student attendance records...</div>
            ) : summary?.records.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">No registered students found in the database.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3 font-semibold">Student Name</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold">Teacher Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {summary?.records.map((r) => {
                      const curStatus = statusMap[r.student_id] || "present";
                      const curRemarks = remarksMap[r.student_id] || "";

                      return (
                        <tr key={r.student_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900 dark:text-slate-100">{r.student_name}</p>
                            <p className="text-[11px] text-slate-400">{r.student_email}</p>
                          </td>
                          <td className="py-3 px-3">
                            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5">
                              <button
                                type="button"
                                onClick={() => handleStatusChange(r.student_id, "present")}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                  curStatus === "present"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(r.student_id, "late")}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                  curStatus === "late"
                                    ? "bg-amber-500 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                              >
                                Late
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStatusChange(r.student_id, "absent")}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                                  curStatus === "absent"
                                    ? "bg-red-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <input
                              type="text"
                              placeholder="Optional remarks..."
                              value={curRemarks}
                              onChange={(e) => handleRemarksChange(r.student_id, e.target.value)}
                              className="w-full max-w-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
