"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import MiraStage from "@/components/mascot/MiraStage";
import {
  askDocument,
  deleteDocument,
  DocumentAskResponse,
  DocumentItem,
  DocumentMessageItem,
  getDocument,
  getDocumentHistory,
  listDocuments,
  retryDocument,
  uploadDocument,
} from "@/services/documentService";
import {
  downloadResource,
  listResources,
  TeacherResourceItem,
} from "@/services/resourceService";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

export default function NotesPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "library" ? "library" : "pdf";
  const [activeTab, setActiveTab] = useState<"pdf" | "library">(initialTab);

  // PDF Tutor State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DocumentMessageItem[]>([]);
  const [question, setQuestion] = useState("");
  const [uploadSubject, setUploadSubject] = useState("General");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string>("");

  // Teacher Notes Library State
  const [resources, setResources] = useState<TeacherResourceItem[]>([]);
  const [resourceSubject, setResourceSubject] = useState("All");
  const [resourceSearch, setResourceSearch] = useState("");
  const [loadingResources, setLoadingResources] = useState(false);

  // Mascot State
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [emotion, setEmotion] = useState<MascotEmotion>("greeting");
  const [gesture, setGesture] = useState<MascotGesture>("wave");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load documents and resources on mount
  useEffect(() => {
    loadDocs();
    loadLibrary();
  }, []);

  // Sync tab with URL search parameter
  useEffect(() => {
    if (searchParams.get("tab") === "library") {
      setActiveTab("library");
    }
  }, [searchParams]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load student documents
  async function loadDocs() {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      if (docs.length > 0 && selectedDocId === null) {
        setSelectedDocId(docs[0].id);
      }
    } catch {
      /* ignore */
    }
  }

  // Load teacher notes library
  async function loadLibrary(subj?: string, search?: string) {
    setLoadingResources(true);
    try {
      const data = await listResources(subj || resourceSubject, search ?? resourceSearch);
      setResources(data);
    } catch {
      /* ignore */
    } finally {
      setLoadingResources(false);
    }
  }

  // Load chat history when selected document changes
  useEffect(() => {
    if (!selectedDocId) {
      setMessages([]);
      return;
    }
    getDocumentHistory(selectedDocId)
      .then((hist) => setMessages(hist.messages))
      .catch(() => setMessages([]));
  }, [selectedDocId]);

  // Poll active document status if it's currently processing
  useEffect(() => {
    const activeDoc = documents.find((d) => d.id === selectedDocId);
    if (!activeDoc || activeDoc.status === "ready" || activeDoc.status === "failed") {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const updated = await getDocument(activeDoc.id);
        setDocuments((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        if (updated.status === "ready") {
          setEmotion("happy");
          setGesture("nod");
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        } else if (updated.status === "failed") {
          setEmotion("thinking");
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch {
        /* ignore */
      }
    }, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [selectedDocId, documents]);

  // Handle PDF upload
  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMascotState("thinking");
    try {
      const res = await uploadDocument(file, uploadSubject);
      const newDoc = res.document;
      setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      setSelectedDocId(newDoc.id);
      setEmotion("happy");
      setGesture("nod");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setMascotState("idle");
    }
  }

  // Ask Mentor a question about the active document
  async function ask(customQuestion?: string) {
    const q = (customQuestion || question).trim();
    if (!q || !selectedDocId) return;

    const activeDoc = documents.find((d) => d.id === selectedDocId);
    if (!activeDoc || activeDoc.status !== "ready") {
      setError("Please wait until the document is finished processing.");
      return;
    }

    setLastQuestion(q);
    setBusy(true);
    setError(null);
    setMascotState("thinking");
    setEmotion("thinking");

    // Optimistically add user question to chat
    const tempUserMsg: DocumentMessageItem = {
      id: Date.now(),
      role: "user",
      content: q,
      sources: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setQuestion("");

    try {
      const data: DocumentAskResponse = await askDocument(selectedDocId, q);
      const assistantMsg: DocumentMessageItem = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.answer,
        sources: data.sources || [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setEmotion("confident");
      setGesture("point");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to answer question");
      setEmotion("neutral");
    } finally {
      setBusy(false);
      setMascotState("idle");
    }
  }

  // Handle delete document
  async function handleDelete(docId: number) {
    if (!confirm("Are you sure you want to delete this document and its chat history?")) return;
    try {
      await deleteDocument(docId);
      const remaining = documents.filter((d) => d.id !== docId);
      setDocuments(remaining);
      setSelectedDocId(remaining.length > 0 ? remaining[0].id : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete document");
    }
  }

  // Handle retry
  async function handleRetry(docId: number) {
    try {
      await retryDocument(docId);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "uploaded", error_message: null } : d))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    }
  }

  // Active document object
  const currentDoc = documents.find((d) => d.id === selectedDocId);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-1 md:p-2">
      {/* Top Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("pdf")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "pdf"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <span>📄</span>
            <span>My PDF Tutor</span>
            {documents.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === "pdf" ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                {documents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("library");
              loadLibrary();
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeTab === "library"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200"
            }`}
          >
            <span>📚</span>
            <span>Teacher Notes Library</span>
            {resources.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === "library" ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                {resources.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:block text-xs text-slate-400">
          Fast Ingestion • Strict Grounding • Monotonic Latency Tracking
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY PDF TUTOR */}
      {/* ========================================================================= */}
      {activeTab === "pdf" && (
        <div className="flex flex-1 flex-col gap-4 lg:flex-row min-h-0">
          {/* Left / Main Panel */}
          <div className="flex flex-1 flex-col gap-4 min-w-0">
            {/* Document Header & Upload Bar */}
            <div className="glass-panel p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    PDF & Document Assistant
                  </h2>
                  <p className="text-xs text-slate-500">
                    Upload your notes or textbook PDF. Ask questions grounded strictly in your document.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
                  >
                    <option value="General">Subject: General</option>
                    <option value="Machine Learning">Machine Learning</option>
                    <option value="DBMS">DBMS</option>
                    <option value="Deep Learning">Deep Learning</option>
                  </select>

                  <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700">
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={(e) => void onFile(e.target.files?.[0])}
                      disabled={uploading}
                    />
                    <span>{uploading ? "Uploading..." : "Upload New PDF"}</span>
                  </label>
                </div>
              </div>

              {/* Document Selector & Status Badge */}
              {documents.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Active Document:</span>
                    <select
                      value={selectedDocId ?? ""}
                      onChange={(e) => setSelectedDocId(Number(e.target.value))}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800"
                    >
                      {documents.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} ({d.page_count} pages)
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentDoc && (
                    <div className="flex items-center gap-2">
                      {/* Status indicator */}
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          currentDoc.status === "ready"
                            ? "bg-emerald-100 text-emerald-800"
                            : currentDoc.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800 animate-pulse"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            currentDoc.status === "ready"
                              ? "bg-emerald-500"
                              : currentDoc.status === "failed"
                              ? "bg-red-500"
                              : "bg-amber-500"
                          }`}
                        />
                        {currentDoc.status === "ready"
                          ? `Ready (${currentDoc.page_count} pages, ${currentDoc.chunk_count} chunks)`
                          : currentDoc.status === "extracting_text"
                          ? "Extracting Text..."
                          : currentDoc.status === "generating_embeddings"
                          ? "Generating Vectors..."
                          : currentDoc.status === "uploaded"
                          ? "Queued for Indexing"
                          : "Processing Failed"}
                      </span>

                      {currentDoc.status === "failed" && (
                        <button
                          type="button"
                          onClick={() => handleRetry(currentDoc.id)}
                          className="text-xs font-semibold text-violet-600 hover:underline"
                        >
                          Retry
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(currentDoc.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                        title="Delete document"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Error Alert */}
              {currentDoc?.status === "failed" && currentDoc.error_message && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  ⚠️ {currentDoc.error_message}
                </div>
              )}
            </div>

            {/* Conversation History Thread */}
            <div className="glass-panel flex flex-1 flex-col p-4 min-h-[320px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Document Q&A Thread {currentDoc ? `· ${currentDoc.filename}` : ""}
                </span>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMessages([])}
                    className="text-xs font-medium text-slate-400 hover:text-slate-700"
                  >
                    Clear View
                  </button>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                    <span className="text-3xl">📖</span>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {currentDoc
                        ? `Ask questions about "${currentDoc.filename}"`
                        : "Upload a PDF or notes file to get started"}
                    </p>
                    <p className="mt-1 max-w-sm text-xs text-slate-400">
                      Answers are grounded strictly in your document text with page references.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${
                        m.role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          m.role === "user"
                            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-sm"
                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.content}</p>

                        {/* Source page badges for assistant */}
                        {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500 font-medium">
                            <span className="font-semibold text-violet-700">📍 Cited Pages:</span>
                            <div className="flex flex-wrap gap-1">
                              {m.sources.map((p) => (
                                <span
                                  key={p}
                                  className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800"
                                >
                                  Page {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="mt-1 px-1 text-[10px] text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))
                )}
                {/* Active LLM Generation Bubble */}
                {busy && (
                  <div className="flex flex-col items-start animate-pulse">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm shadow-sm text-violet-900">
                      <div className="flex items-center gap-2.5">
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                        <span className="text-xs font-semibold">
                          Mira is analyzing document passages & generating answer...
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Quick Prompt Pills */}
              {currentDoc && currentDoc.status === "ready" && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                  <span className="text-[11px] font-semibold text-slate-400">Prompts:</span>
                  {[
                    "Summarize this document in 5 key takeaways",
                    "Explain the core concept in simple terms",
                    "Generate 5 important exam questions with answers",
                    "Give a real-world example from the text",
                  ].map((pill) => (
                    <button
                      key={pill}
                      type="button"
                      onClick={() => ask(pill)}
                      disabled={busy}
                      className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1 text-[11px] text-slate-600 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50"
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              )}

              {/* Question Input Box */}
              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="relative flex items-center">
                  <textarea
                    rows={2}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
                    placeholder={
                      !currentDoc
                        ? "Upload a document first..."
                        : currentDoc.status !== "ready"
                        ? "Document is indexing, please wait..."
                        : "Ask questions about this PDF (Enter to send, Shift+Enter for new line)..."
                    }
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void ask();
                      }
                    }}
                    disabled={busy || !currentDoc || currentDoc.status !== "ready"}
                  />
                  <button
                    type="button"
                    onClick={() => ask()}
                    disabled={busy || !question.trim() || !currentDoc || currentDoc.status !== "ready"}
                    className="absolute right-2 bottom-2 rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                  >
                    {busy ? "Thinking..." : "Ask Mentor"}
                  </button>
                </div>
                {error && (
                  <div className="mt-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 shadow-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-base">⚠️</span>
                      <div className="flex-1">
                        <p className="font-semibold">Unable to process document query</p>
                        <p className="mt-0.5 text-rose-700">{error}</p>
                      </div>
                    </div>
                    {lastQuestion && (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => ask(lastQuestion)}
                          disabled={busy}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                        >
                          Retry Question
                        </button>
                        <button
                          type="button"
                          onClick={() => setError(null)}
                          className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Mascot Stage */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="glass-panel sticky top-4 flex flex-col items-center p-4">
              <MiraStage
                state={mascotState}
                emotion={emotion}
                gesture={gesture}
                size={200}
              />
              <div className="mt-3 text-center">
                <p className="text-sm font-bold text-slate-800">Mira AI Tutor</p>
                <p className="text-xs text-slate-500">
                  {busy ? "Analyzing document pages..." : "Ready to explain your notes"}
                </p>
              </div>

              {currentDoc && (
                <div className="mt-4 w-full rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pages:</span>
                    <span className="font-semibold text-slate-700">{currentDoc.page_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Chunks:</span>
                    <span className="font-semibold text-slate-700">{currentDoc.chunk_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Size:</span>
                    <span className="font-semibold text-slate-700">
                      {Math.round(currentDoc.file_size / 1024)} KB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Subject:</span>
                    <span className="font-semibold text-violet-700">{currentDoc.subject}</span>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEACHER NOTES LIBRARY */}
      {/* ========================================================================= */}
      {activeTab === "library" && (
        <div className="space-y-4">
          <div className="glass-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Teacher Notes & Course Materials
                </h2>
                <p className="text-xs text-slate-500">
                  Study notes, presentations, and curriculum materials published by your instructors.
                </p>
              </div>

              {/* Search & Subject Filter */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={resourceSearch}
                  onChange={(e) => {
                    setResourceSearch(e.target.value);
                    loadLibrary(resourceSubject, e.target.value);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />

                <select
                  value={resourceSubject}
                  onChange={(e) => {
                    setResourceSubject(e.target.value);
                    loadLibrary(e.target.value, resourceSearch);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="All">All Subjects</option>
                  <option value="Machine Learning">Machine Learning</option>
                  <option value="DBMS">DBMS</option>
                  <option value="Deep Learning">Deep Learning</option>
                </select>
              </div>
            </div>

            {/* Resources Grid */}
            <div className="mt-5">
              {loadingResources ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Loading published materials...
                </div>
              ) : resources.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-4xl">📂</span>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    No study materials found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Your teachers haven&apos;t published notes for this subject yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                            {r.subject}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {Math.round(r.file_size / 1024)} KB
                          </span>
                        </div>

                        <h3 className="mt-2 text-sm font-bold text-slate-900 leading-snug">
                          {r.title}
                        </h3>

                        {r.description && (
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {r.description}
                          </p>
                        )}

                        <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] text-slate-400 space-y-0.5">
                          <p>Uploaded by: <span className="font-semibold text-slate-700">{r.teacher_name}</span></p>
                          <p>File: <span className="text-slate-600">{r.original_filename}</span></p>
                          <p>Date: {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-2">
                        <button
                          type="button"
                          onClick={() => downloadResource(r.id, r.original_filename)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          <span>Download Original File</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
