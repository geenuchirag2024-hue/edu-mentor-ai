"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
  getLatencyAnalytics,
  getStudentHistory,
  getTeacherOverview,
  LatencyStats,
  listRecentQueries,
  listStudentAnalytics,
  StudentActivitySummary,
  StudentQueryLogOut,
  TeacherOverviewAnalytics,
} from "@/services/analyticsService";
import { apiFetch, apiRequest, friendlyApiError } from "@/services/api";
import { AuthUser, getCurrentUser, getProfile } from "@/services/authService";
import { MENTOR_PROFILES } from "@/services/mentors";
import { uploadTeacherResource } from "@/services/resourceService";

interface TeacherStats {
  enrolled_students: number;
  course_materials_count: number;
  curriculum_modules: number;
  active_quizzes: number;
}

interface TeacherOverview {
  teacher: {
    id: number;
    full_name: string;
    email: string;
    role: string;
  };
  stats: TeacherStats;
}

interface MaterialItem {
  filename: string;
  subject?: string;
  size_bytes: number;
  extension: string;
  chunks_count?: number;
}

export default function TeacherPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [students, setStudents] = useState<AuthUser[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("Machine Learning");
  const [activeTab, setActiveTab] = useState<"overview" | "materials" | "analytics" | "mentors" | "students" | "quizzes">("overview");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  // Analytics Tab State
  const [analyticsOverview, setAnalyticsOverview] = useState<TeacherOverviewAnalytics | null>(null);
  const [studentSummaries, setStudentSummaries] = useState<StudentActivitySummary[]>([]);
  const [latencyStats, setLatencyStats] = useState<LatencyStats | null>(null);
  const [recentQueries, setRecentQueries] = useState<StudentQueryLogOut[]>([]);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<StudentQueryLogOut[] | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [querySubjectFilter, setQuerySubjectFilter] = useState<string>("All");
  const [queryStatusFilter, setQueryStatusFilter] = useState<string>("All");
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    const current = getCurrentUser();
    if (!current) {
      router.replace("/login");
      return;
    }
    setUser(current);

    // Verify role with backend
    getProfile().then((liveUser) => {
      const active = liveUser || current;
      setUser(active);

      if (active.role !== "teacher") {
        setLoading(false);
        return;
      }

      // Fetch teacher data
      Promise.all([
        apiFetch<TeacherOverview>("/api/teacher/overview").catch(() => null),
        apiFetch<AuthUser[]>("/api/teacher/students").catch(() => []),
        apiFetch<{ materials: MaterialItem[] }>("/api/teacher/materials").catch(() => ({ materials: [] })),
      ]).then(([ov, stus, mats]) => {
        if (ov) setOverview(ov);
        if (stus) setStudents(stus);
        if (mats?.materials) setMaterials(mats.materials);
        setLoading(false);
      });
    });
  }, [router]);

  // Load analytics data when tab is active
  useEffect(() => {
    if (activeTab === "analytics") {
      setLoadingAnalytics(true);
      Promise.all([
        getTeacherOverview().catch(() => null),
        listStudentAnalytics().catch(() => []),
        getLatencyAnalytics().catch(() => null),
        listRecentQueries(querySubjectFilter, queryStatusFilter).catch(() => []),
      ]).then(([ov, stus, lat, qrs]) => {
        if (ov) setAnalyticsOverview(ov);
        if (stus) setStudentSummaries(stus);
        if (lat) setLatencyStats(lat);
        if (qrs) setRecentQueries(qrs);
        setLoadingAnalytics(false);
      });
    }
  }, [activeTab, querySubjectFilter, queryStatusFilter]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg(null);
    setUploadErr(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", selectedSubject);

    try {
      const res = await apiRequest("/api/teacher/content/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(friendlyApiError(res.status, text));
      }

      const resData = (await res.json()) as { message?: string; chunks_indexed?: number; subject?: string };
      setUploadMsg(resData.message || `Successfully indexed ${file.name} for ${selectedSubject}.`);

      // Also publish directly to Student Notes Library so students get notified
      uploadTeacherResource(
        file,
        file.name.replace(/\.[^/.]+$/, ""),
        `Course notes and study material for ${selectedSubject}`,
        selectedSubject,
        true
      ).catch(() => {});

      // Refresh materials list and overview
      const mats = await apiFetch<{ materials: MaterialItem[] }>("/api/teacher/materials");
      if (mats?.materials) setMaterials(mats.materials);
      const ov = await apiFetch<TeacherOverview>("/api/teacher/overview");
      if (ov) setOverview(ov);

    } catch (err: unknown) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleViewStudentHistory = async (studentId: number, name: string) => {
    setSelectedStudentName(name);
    try {
      const hist = await getStudentHistory(studentId);
      setSelectedStudentHistory(hist);
    } catch {
      setSelectedStudentHistory([]);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <span>Loading Teacher Dashboard...</span>
        </div>
      </div>
    );
  }

  // Access restriction: Student denied
  if (user?.role !== "teacher") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="glass-panel max-w-md rounded-3xl p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Teacher Portal Access Only</h2>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Your current account is authenticated with the student role. Curriculum management, student analytics, and resource publication are restricted to faculty instructors.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/chat"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/25 hover:opacity-95"
            >
              Back to Student Tutor
            </Link>
            <Link
              href="/notes"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Browse Student Notes Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredStudents = studentSummaries.filter(
    (s) =>
      s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 overflow-y-auto p-4 md:p-6">
      {/* Header Banner */}
      <div className="glass-panel flex flex-col gap-4 rounded-3xl p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Instructor Portal
            </span>
            <span className="text-xs text-slate-400">Edu Mentor AI V3</span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            Welcome back, {user?.full_name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Manage course curriculum, monitor real student study activity, and inspect AI Mentor response latency.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>{uploading ? "Indexing & Publishing..." : "Upload Notes / PDF"}</span>
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {uploadMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-semibold text-emerald-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{uploadMsg}</span>
          </div>
          <button onClick={() => setUploadMsg(null)} className="text-emerald-600 hover:text-emerald-900">✕</button>
        </div>
      )}

      {uploadErr && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 text-xs font-semibold text-red-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{uploadErr}</span>
          </div>
          <button onClick={() => setUploadErr(null)} className="text-red-600 hover:text-red-900">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "overview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📊 Overview
        </button>
        <button
          onClick={() => setActiveTab("materials")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "materials"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📚 Course Materials ({materials.length})
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === "analytics"
              ? "bg-violet-600 text-white shadow-sm"
              : "text-violet-700 bg-violet-50 hover:bg-violet-100"
          }`}
        >
          <span>📈</span>
          <span>Student Analytics & AI Performance</span>
        </button>
        <button
          onClick={() => setActiveTab("mentors")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "mentors"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🤖 AI Mentors & Voices ({MENTOR_PROFILES.length})
        </button>
        <button
          onClick={() => setActiveTab("students")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "students"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          🎓 Enrolled Students ({students.length})
        </button>
        <button
          onClick={() => setActiveTab("quizzes")}
          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "quizzes"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          📝 Quiz Management
        </button>
      </div>

      {/* Tab Content: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass-panel rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Enrolled Students
              </p>
              <p className="mt-1 text-2xl font-black text-indigo-600">
                {overview?.stats.enrolled_students ?? students.length}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Live from PostgreSQL database</p>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Curriculum Files
              </p>
              <p className="mt-1 text-2xl font-black text-violet-600">
                {overview?.stats.course_materials_count ?? materials.length}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Stored in class RAG directory</p>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Syllabus Modules
              </p>
              <p className="mt-1 text-2xl font-black text-slate-800">
                {overview?.stats.curriculum_modules ?? 7}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">ML Syllabus V1 outline</p>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Question Banks
              </p>
              <p className="mt-1 text-2xl font-black text-emerald-600">
                {overview?.stats.active_quizzes ?? 3}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Decision Trees, ML, NN</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: STUDENT ANALYTICS & AI PERFORMANCE */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics && (
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 animate-pulse">
              <div className="h-2 w-2 rounded-full bg-indigo-600" />
              <span>Updating live telemetry metrics...</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass-panel rounded-2xl p-4 shadow-sm border border-violet-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                Active Learners
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {analyticsOverview?.total_active_students ?? 0}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Students with recorded sessions</p>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm border border-indigo-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Total Study Time
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {analyticsOverview?.total_study_hours ?? 0} <span className="text-sm font-semibold text-slate-400">hrs</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Measured active attention</p>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm border border-emerald-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                Questions Answered
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {analyticsOverview?.total_questions_asked ?? 0}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Document & Tutor queries</p>
            </div>

            <div className="glass-panel rounded-2xl p-4 shadow-sm border border-amber-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                Avg Response Latency
              </p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {analyticsOverview?.avg_ai_response_time_ms ?? 0} <span className="text-sm font-semibold text-slate-400">ms</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Monotonic server execution</p>
            </div>
          </div>

          {latencyStats && (
            <div className="glass-panel rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI Response Latency Analytics</h3>
                  <p className="text-xs text-slate-500">Calculated over {latencyStats.total_queries} queries using high-resolution monotonic clocks</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  {latencyStats.failed_count === 0 ? "100% Success Rate" : `${latencyStats.failed_count} Failures`}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Average</p>
                  <p className="mt-1 text-lg font-black text-slate-800">{latencyStats.avg_ms} ms</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Median (P50)</p>
                  <p className="mt-1 text-lg font-black text-slate-800">{latencyStats.median_ms} ms</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400">95th Percentile</p>
                  <p className="mt-1 text-lg font-black text-indigo-700">{latencyStats.p95_ms} ms</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Fastest (Min)</p>
                  <p className="mt-1 text-lg font-black text-emerald-700">{latencyStats.min_ms} ms</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Slowest (Max)</p>
                  <p className="mt-1 text-lg font-black text-amber-700">{latencyStats.max_ms} ms</p>
                </div>
              </div>
            </div>
          )}

          <div className="glass-panel rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student Learning Activity & Time</h3>
                <p className="text-xs text-slate-500">Track active study duration, sessions count, and questions asked by each student</p>
              </div>

              <input
                type="text"
                placeholder="Search students..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400">
                    <th className="py-2 font-bold">Student</th>
                    <th className="py-2 font-bold">Email</th>
                    <th className="py-2 font-bold">Active Study Time</th>
                    <th className="py-2 font-bold">Sessions</th>
                    <th className="py-2 font-bold">Questions</th>
                    <th className="py-2 font-bold">Avg AI Latency</th>
                    <th className="py-2 font-bold">Last Active</th>
                    <th className="py-2 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No student activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const minutes = Math.round(s.total_study_seconds / 60);
                      const hours = (s.total_study_seconds / 3600).toFixed(1);
                      return (
                        <tr key={s.student_id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 font-semibold text-slate-900">{s.full_name}</td>
                          <td className="py-3 text-slate-500">{s.email}</td>
                          <td className="py-3 font-bold text-indigo-700">
                            {minutes > 60 ? `${hours} hrs` : `${minutes} mins`}
                          </td>
                          <td className="py-3 text-slate-600">{s.sessions_count}</td>
                          <td className="py-3 font-semibold text-slate-800">{s.questions_count}</td>
                          <td className="py-3 text-slate-600">{s.avg_response_latency_ms} ms</td>
                          <td className="py-3 text-slate-400">
                            {s.last_active
                              ? new Date(s.last_active).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                              : "Not recorded"}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleViewStudentHistory(s.student_id, s.full_name)}
                              className="rounded-lg bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-200"
                            >
                              View History
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent AI Query Logs</h3>
                <p className="text-xs text-slate-500">Live feed of student queries, generated answers, and verified source citations</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={querySubjectFilter}
                  onChange={(e) => setQuerySubjectFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="All">All Subjects</option>
                  <option value="Machine Learning">Machine Learning</option>
                  <option value="DBMS">DBMS</option>
                  <option value="Deep Learning">Deep Learning</option>
                </select>

                <select
                  value={queryStatusFilter}
                  onChange={(e) => setQueryStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  <option value="All">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
              {recentQueries.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No query logs found for this filter.
                </div>
              ) : (
                recentQueries.map((q) => (
                  <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{q.student_name}</span>
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">{q.subject}</span>
                      </div>
                      <span className="text-slate-400">
                        {new Date(q.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-900 leading-snug">Q: {q.question}</p>
                    <p className="text-slate-600 line-clamp-3 leading-relaxed">A: {q.answer}</p>

                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-slate-100">
                      <span>Latency: {q.total_latency_ms} ms (retrieval: {q.retrieval_latency_ms}ms, generation: {q.generation_latency_ms}ms)</span>
                      {q.sources && q.sources.length > 0 && (
                        <span className="font-bold text-violet-700">Pages cited: {q.sources.join(", ")}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedStudentHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl p-6 shadow-2xl bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Learning History: {selectedStudentName}
                </h3>
                <p className="text-xs text-slate-500">
                  Detailed record of questions asked and AI mentor answers
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentHistory(null)}
                className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
              {selectedStudentHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No questions asked yet by this student.
                </div>
              ) : (
                selectedStudentHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-bold text-indigo-700">{item.subject}</span>
                      <span>{new Date(item.created_at).toLocaleString()}</span>
                    </div>
                    <p className="font-bold text-slate-900">Q: {item.question}</p>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">A: {item.answer}</p>
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2 text-[10px] text-slate-500">
                      <span>Server response latency: {item.total_latency_ms} ms</span>
                      {item.sources && item.sources.length > 0 && (
                        <span className="font-bold text-violet-700">Cited: Pages {item.sources.join(", ")}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: MATERIALS */}
      {activeTab === "materials" && (
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Course Materials & RAG Index</h2>
              <p className="text-xs text-slate-500">
                Uploaded textbooks, notes, and curriculum documents parsed into semantic vectors.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="Machine Learning">Machine Learning</option>
                <option value="DBMS">DBMS</option>
                <option value="Deep Learning">Deep Learning</option>
              </select>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {materials.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No course materials found. Upload a PDF or TXT to populate the curriculum.
              </div>
            ) : (
              materials.map((m) => (
                <div key={m.filename} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs uppercase">
                      {m.extension.replace(".", "") || "DOC"}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{m.filename}</p>
                      <p className="text-[10px] text-slate-400">
                        {m.subject} · {Math.round(m.size_bytes / 1024)} KB · {m.chunks_count ?? 0} indexed chunks
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                    Active in RAG
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content: MENTORS */}
      {activeTab === "mentors" && (
        <div className="space-y-4">
          <div className="glass-panel rounded-3xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-1">Configured AI Mentors & Voices</h2>
            <p className="text-xs text-slate-500 mb-4">
              Inspect active mentor personalities, assigned subjects, and local Piper neural voices.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MENTOR_PROFILES.map((m) => (
                <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm">{m.name}</h3>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      {m.specialty}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{m.title}</p>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: STUDENTS */}
      {activeTab === "students" && (
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Enrolled Students</h2>
          <p className="text-xs text-slate-500 mb-4">
            Live student accounts registered in PostgreSQL database.
          </p>

          <div className="divide-y divide-slate-100">
            {students.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No students registered yet.</p>
            ) : (
              students.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{s.full_name}</p>
                    <p className="text-[10px] text-slate-400">{s.email}</p>
                  </div>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                    Student
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content: QUIZZES */}
      {activeTab === "quizzes" && (
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-1">Quiz & Assessment Management</h2>
          <p className="text-xs text-slate-500 mb-4">
            Curated questions from the verified question bank available for students.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-bold text-slate-800 text-sm">Decision Trees</h4>
              <p className="text-xs text-slate-500 mt-1">4 questions (Entropy, Information Gain, ID3, Overfitting)</p>
              <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Verified
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-bold text-slate-800 text-sm">Supervised Learning</h4>
              <p className="text-xs text-slate-500 mt-1">4 questions (Supervised, Overfitting, Gradient Descent, Regularization)</p>
              <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Verified
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="font-bold text-slate-800 text-sm">Neural Networks</h4>
              <p className="text-xs text-slate-500 mt-1">4 questions (Backprop, Activations, Vanishing Gradient, Loss)</p>
              <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Verified
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
