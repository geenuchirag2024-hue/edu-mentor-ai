"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { apiFetch, apiRequest, friendlyApiError } from "@/services/api";
import { AuthUser, getCurrentUser, getProfile } from "@/services/authService";
import { MENTOR_PROFILES } from "@/services/mentors";

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
  const [activeTab, setActiveTab] = useState<"overview" | "materials" | "mentors" | "students" | "quizzes">("overview");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);


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
          <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
          <p className="mt-2 text-sm text-slate-600">
            You are logged in as a <strong>Student ({user?.email})</strong>. This area is reserved exclusively for verified faculty and instructors.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/chat"
              className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
            >
              Return to Student Tutor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-1">
      {/* Welcome Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-xl shadow-indigo-600/15">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <span>👩‍🏫</span>
              <span>Faculty Portal</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              Welcome, {user?.full_name || "Instructor"}
            </h1>
            <p className="mt-1 text-sm text-indigo-100">
              Manage your machine learning curriculum, monitor enrolled students, and oversee student learning outcomes.
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={uploading}
              className="rounded-2xl border-0 bg-white/20 px-3 py-2.5 text-xs font-semibold text-white backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer"
            >
              <option value="Machine Learning" className="text-slate-900 bg-white">Machine Learning</option>
              <option value="DBMS" className="text-slate-900 bg-white">DBMS</option>
              <option value="Deep Learning" className="text-slate-900 bg-white">Deep Learning</option>
            </select>
            <label className="cursor-pointer rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-indigo-700 shadow-md transition hover:bg-indigo-50">
              <span>{uploading ? "Indexing..." : `+ Upload Material`}</span>
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {uploadMsg && (
          <div className="mt-4 rounded-xl bg-emerald-500/30 p-2.5 text-xs font-medium text-emerald-50 backdrop-blur-md">
            ✓ {uploadMsg}
          </div>
        )}
        {uploadErr && (
          <div className="mt-4 rounded-xl bg-rose-500/40 p-2.5 text-xs font-medium text-rose-50 backdrop-blur-md">
            ✕ {uploadErr}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
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

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Real Metrics Cards */}
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

          {/* Quick Actions & Future Placeholders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-panel rounded-3xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span>📚</span> Recent Course Materials
              </h3>
              {materials.length === 0 ? (
                <p className="text-xs text-slate-500">No course materials uploaded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {materials.slice(0, 4).map((m) => (
                    <li key={m.filename} className="flex items-center justify-between rounded-xl bg-white/80 p-2.5 text-xs">
                      <span className="font-medium text-slate-800 truncate">{m.filename}</span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {(m.size_bytes / 1024).toFixed(1)} KB
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Clear, honest placeholders */}
            <div className="glass-panel rounded-3xl p-5 shadow-sm border border-dashed border-indigo-200">
              <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px]">Planned for V3 Phase 3 & 4</span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                Faculty Control Features
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                The following tools are designed for future phase integration:
              </p>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="font-semibold text-slate-800">📌 Automated Quiz Generator</p>
                  <p className="text-[11px] text-slate-500">Generates custom difficulty quizzes from instructor PDFs.</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <p className="font-semibold text-slate-800">🎥 Educational Video Matching Control</p>
                  <p className="text-[11px] text-slate-500">Assigns video lecture assets to curriculum modules.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "materials" && (
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Curriculum Materials Repository</h2>
              <p className="text-xs text-slate-500">Documents stored here are indexed into the multi-subject course RAG store.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                disabled={uploading}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Machine Learning">Machine Learning</option>
                <option value="DBMS">DBMS</option>
                <option value="Deep Learning">Deep Learning</option>
              </select>
              <label className="cursor-pointer rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition">
                <span>{uploading ? "Indexing..." : "+ Add PDF / TXT"}</span>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {materials.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No curriculum documents found in data/ml-content/raw. Upload one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="pb-2 font-semibold">Document</th>
                    <th className="pb-2 font-semibold">Subject</th>
                    <th className="pb-2 font-semibold">Type</th>
                    <th className="pb-2 font-semibold">Size</th>
                    <th className="pb-2 font-semibold">Chunks</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {materials.map((m) => (
                    <tr key={m.filename} className="hover:bg-slate-50/50">
                      <td className="py-3 font-medium text-slate-800">{m.filename}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {m.subject || "Machine Learning"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500 uppercase">{m.extension.replace(".", "")}</td>
                      <td className="py-3 text-slate-500">{(m.size_bytes / 1024).toFixed(1)} KB</td>
                      <td className="py-3 text-slate-600 font-medium">{m.chunks_count ? `${m.chunks_count} chunks` : "Indexed"}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Active in RAG
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {activeTab === "mentors" && (
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Configured AI Mentors & Voice Rigs</h2>
            <p className="text-xs text-slate-500">
              Overview of deployed AI personas, pedagogical domains, Piper TTS voice models, and animation capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MENTOR_PROFILES.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                      <img src={m.avatar} alt={m.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${m.badgeColor}`}>
                          {m.specialty}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-indigo-700">{m.title}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{m.description}</p>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-2 rounded-xl bg-slate-50/80 p-3 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-slate-500">TTS Engine:</span>
                      <span className="font-mono text-[11px] font-semibold text-indigo-700 uppercase">
                        {m.voice.ttsEngine}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-slate-500">Assigned Voice Model:</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-800">
                        {m.voice.voiceModel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-slate-500">Pacing / Speaking Rate:</span>
                      <span className="font-medium text-slate-700">{m.voice.speakingRate}x</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-slate-500">Voice Identity / Traits:</span>
                      <span className="italic text-slate-600 text-[11px]">{m.voice.traits}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium text-slate-500">Avatar Rig:</span>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        {m.avatarConfig.hasRig ? "Full 2D Viseme Rig" : "Photo Rig (Blink + Sway + Jaw Modulation)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
                  Fallback Voice: <code className="text-slate-600">{m.voice.fallbackVoice}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "students" && (
        <div className="glass-panel rounded-3xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Enrolled Students</h2>
            <p className="text-xs text-slate-500">Real users registered with role: student from PostgreSQL.</p>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No students have registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="pb-2 font-semibold">Student Name</th>
                    <th className="pb-2 font-semibold">Email</th>
                    <th className="pb-2 font-semibold">Role</th>
                    <th className="pb-2 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-medium text-slate-800">{s.full_name}</td>
                      <td className="py-3 text-slate-600">{s.email}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : "Active"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
