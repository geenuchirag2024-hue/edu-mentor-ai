"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

// Helper component to render code blocks with syntax styling and copy action
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900 shadow-md">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-3.5 py-1.5 text-xs text-slate-400">
        <span className="font-mono text-[11px] uppercase tracking-wider text-violet-400">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          {copied ? "✓ Copied" : "Copy Code"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-xs font-mono text-slate-100 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Inline token renderer for bold, inline code, and math symbols
function renderInline(text: string) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\$[^\$]+\$)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded-md border border-violet-100 bg-violet-50/80 px-1.5 py-0.5 font-mono text-xs font-semibold text-violet-800"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("$") && token.endsWith("$") && token.length > 2) {
      return (
        <span
          key={idx}
          className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-800"
        >
          {token.slice(1, -1)}
        </span>
      );
    }
    return token;
  });
}

// Rich Markdown, list, and heading formatter
function FormattedContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 leading-relaxed">
      {parts.map((part, pIdx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const match = part.match(/^```(\w+)?\n?([\s\S]*?)```$/);
          const lang = match?.[1] || "code";
          const code = match?.[2] || part.slice(3, -3);
          return <CodeBlock key={pIdx} code={code.trim()} language={lang} />;
        }

        return (
          <div key={pIdx} className="space-y-2">
            {part.split("\n\n").map((para, paraIdx) => {
              const trimmed = para.trim();
              if (!trimmed) return null;

              const lines = trimmed.split("\n");
              const isList = lines.every(
                (l) =>
                  l.trim().startsWith("- ") ||
                  l.trim().startsWith("* ") ||
                  /^\d+\.\s/.test(l.trim())
              );

              if (isList) {
                return (
                  <ul key={paraIdx} className="my-2 space-y-1.5 pl-1">
                    {lines.map((line, lIdx) => {
                      const cleanLine = line
                        .replace(/^[-*]\s+|\d+\.\s+/, "")
                        .trim();
                      const isNum = /^\d+\.\s/.test(line.trim());
                      return (
                        <li key={lIdx} className="flex items-start gap-2.5 text-sm">
                          <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                            {isNum ? lIdx + 1 : "•"}
                          </span>
                          <span className="flex-1">{renderInline(cleanLine)}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              if (trimmed.startsWith("### ")) {
                return (
                  <h4 key={paraIdx} className="pt-2 text-sm font-bold text-slate-900">
                    {renderInline(trimmed.replace(/^###\s+/, ""))}
                  </h4>
                );
              }
              if (trimmed.startsWith("## ")) {
                return (
                  <h3
                    key={paraIdx}
                    className="pt-3 text-base font-bold text-slate-900 border-b border-slate-100 pb-1"
                  >
                    {renderInline(trimmed.replace(/^##\s+/, ""))}
                  </h3>
                );
              }

              return (
                <p key={paraIdx} className="text-sm text-slate-800 leading-relaxed">
                  {renderInline(trimmed)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// Copy Answer text button
function CopyAnswerButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      title="Copy answer to clipboard"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

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
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Teacher Notes Library State
  const [resources, setResources] = useState<TeacherResourceItem[]>([]);
  const [resourceSubject, setResourceSubject] = useState("All");
  const [resourceSearch, setResourceSearch] = useState("");
  const [loadingResources, setLoadingResources] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
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
  }, [messages, busy]);

  function handleScroll() {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  }

  function scrollToBottom() {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

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
      const data = await listResources(
        subj || resourceSubject,
        search ?? resourceSearch
      );
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
        if (updated.status === "ready" || updated.status === "failed") {
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
    try {
      const res = await uploadDocument(file, uploadSubject);
      const newDoc = res.document;
      setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      setSelectedDocId(newDoc.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to answer question");
    } finally {
      setBusy(false);
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
    <div className="flex h-full min-h-0 flex-col gap-3 p-1 md:p-2 overflow-hidden">
      {/* Top Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 shrink-0">
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
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === "pdf"
                    ? "bg-violet-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
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
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === "library"
                    ? "bg-indigo-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {resources.length}
              </span>
            )}
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Local Vector Retrieval
          </span>
          <span>•</span>
          <span>Strict Page Grounding</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY PDF TUTOR (FULL-WIDTH EXPANDED RETRIEVAL WORKSPACE) */}
      {/* ========================================================================= */}
      {activeTab === "pdf" && (
        <div className="flex flex-1 flex-col gap-3 min-h-0 w-full overflow-hidden">
          {/* TOP SECTION: Document Header & Controls */}
          <div className="glass-panel p-4 shrink-0 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    PDF & Document Assistant
                  </h2>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                    RAG Workspace
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Upload your textbook, notes, or paper. Ask questions grounded strictly in document text with verifiable page citations.
                </p>
              </div>

              {/* Upload Controls */}
              <div className="flex items-center gap-2">
                <select
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs focus:border-violet-500 focus:outline-none"
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{uploading ? "Uploading..." : "Upload New PDF"}</span>
                </label>
              </div>
            </div>

            {/* Active Document Selector, Status & Telemetry Strip */}
            {documents.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-semibold text-slate-500">
                    Active Document:
                  </span>
                  <select
                    value={selectedDocId ?? ""}
                    onChange={(e) => setSelectedDocId(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow-xs focus:border-violet-500 focus:outline-none"
                  >
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.filename} ({d.page_count} pages)
                      </option>
                    ))}
                  </select>

                  {/* Document Telemetry Badges */}
                  {currentDoc && (
                    <div className="hidden lg:flex items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        📄 <strong>{currentDoc.page_count}</strong> pages
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        🧩 <strong>{currentDoc.chunk_count}</strong> chunks
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        💾 <strong>{Math.round(currentDoc.file_size / 1024)}</strong> KB
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                        🏷️ {currentDoc.subject}
                      </span>
                    </div>
                  )}
                </div>

                {currentDoc && (
                  <div className="flex items-center gap-2">
                    {/* Processing Status Badge */}
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
                        ? "Generating Embeddings..."
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
                      className="text-xs font-medium text-slate-400 hover:text-red-600 transition"
                      title="Delete document and chat history"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error banner if document failed */}
            {currentDoc?.status === "failed" && currentDoc.error_message && (
              <div className="mt-2.5 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
                ⚠️ {currentDoc.error_message}
              </div>
            )}
          </div>

          {/* MIDDLE SECTION: Large Expanded Conversation Window */}
          <div className="glass-panel relative flex flex-1 min-h-[460px] md:min-h-[520px] max-h-[72vh] flex-col overflow-hidden p-4 shadow-sm">
            {/* Conversation Window Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Document Q&A Thread {currentDoc ? `· ${currentDoc.filename}` : ""}
                </span>
                {messages.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {messages.length} message{messages.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="text-xs font-medium text-slate-400 hover:text-slate-700 transition"
                >
                  Clear View
                </button>
              )}
            </div>

            {/* Scrollable Chat Area */}
            <div
              ref={chatContainerRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 space-y-4 overflow-y-auto pr-2 scroll-smooth"
            >
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-2xl text-violet-700 shadow-sm">
                    📖
                  </div>
                  <h3 className="mt-3 text-base font-bold text-slate-800">
                    {currentDoc
                      ? `Ready to explore "${currentDoc.filename}"`
                      : "Upload a PDF or notes file to get started"}
                  </h3>
                  <p className="mt-1 max-w-md text-xs text-slate-500 leading-relaxed">
                    {currentDoc
                      ? "Ask any conceptual question, request a summary, or locate formulas. Answers are retrieved via local embeddings and strictly cited with exact page numbers."
                      : "Upload lecture notes, textbooks, or research PDFs (up to 25MB) to ask grounded questions."}
                  </p>

                  {currentDoc && currentDoc.status === "ready" && (
                    <div className="mt-5 grid max-w-lg grid-cols-1 gap-2 sm:grid-cols-2 text-left">
                      {[
                        {
                          icon: "💡",
                          title: "5 Key Takeaways",
                          prompt: "Summarize this document in 5 key takeaways",
                        },
                        {
                          icon: "🎯",
                          title: "Core Concept",
                          prompt: "Explain the core concept in simple terms",
                        },
                        {
                          icon: "📝",
                          title: "Exam Questions",
                          prompt: "Generate 5 important exam questions with answers",
                        },
                        {
                          icon: "🔍",
                          title: "Practical Examples",
                          prompt: "Give a real-world example from the text",
                        },
                      ].map((card) => (
                        <button
                          key={card.title}
                          type="button"
                          onClick={() => ask(card.prompt)}
                          disabled={busy}
                          className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white/80 p-3 text-xs transition hover:border-violet-300 hover:bg-violet-50/60 shadow-xs hover:shadow-sm"
                        >
                          <span className="text-base">{card.icon}</span>
                          <div>
                            <p className="font-bold text-slate-800">{card.title}</p>
                            <p className="text-[11px] text-slate-500">{card.prompt}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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
                      className={`max-w-[92%] rounded-2xl p-4 shadow-sm transition ${
                        m.role === "user"
                          ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-xs"
                          : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs"
                      }`}
                    >
                      {/* Assistant Header */}
                      {m.role === "assistant" && (
                        <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs">
                          <span className="flex items-center gap-1.5 font-bold text-violet-700">
                            <span>🤖</span>
                            <span>Edu-Mentor Assistant</span>
                          </span>
                          <CopyAnswerButton text={m.content} />
                        </div>
                      )}

                      {/* Content Formatted */}
                      {m.role === "assistant" ? (
                        <FormattedContent content={m.content} />
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">
                          {m.content}
                        </p>
                      )}

                      {/* Source Page Badges */}
                      {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600 font-medium">
                          <span className="font-bold text-violet-700">
                            📍 Cited Pages:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {m.sources.map((p) => (
                              <span
                                key={p}
                                className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-800"
                              >
                                Page {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="mt-1 px-1 text-[10px] text-slate-400">
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}

              {/* Active Thinking Bubble */}
              {busy && (
                <div className="flex flex-col items-start animate-pulse">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-xs border border-violet-200 bg-violet-50/90 p-4 text-sm shadow-sm text-violet-900">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                      <div>
                        <p className="font-semibold text-xs text-violet-900">
                          Retrieving document passages & generating answer...
                        </p>
                        <p className="text-[11px] text-violet-700">
                          Matching relevant chunks against your question with local embeddings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Scroll to Bottom Floating Button */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-28 right-6 z-10 flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-700 hover:scale-105"
              >
                <span>↓</span>
                <span>Jump to latest</span>
              </button>
            )}

            {/* BOTTOM SECTION: Suggested Prompts & Input Box */}
            <div className="shrink-0 mt-2">
              {/* Quick Prompt Pills */}
              {currentDoc && currentDoc.status === "ready" && (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2 pb-2">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Quick Prompts:
                  </span>
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
                      className="rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800 disabled:opacity-50"
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              )}

              {/* Question Input Box */}
              <div className="relative flex items-center">
                <textarea
                  rows={2}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2.5 pr-28 text-sm text-slate-800 placeholder-slate-400 shadow-xs focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 leading-relaxed"
                  placeholder={
                    !currentDoc
                      ? "Upload a document above to begin..."
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
                  disabled={
                    busy ||
                    !question.trim() ||
                    !currentDoc ||
                    currentDoc.status !== "ready"
                  }
                  className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                  <span>{busy ? "Thinking..." : "Ask Question"}</span>
                </button>
              </div>

              {/* Error Alert with Retry */}
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEACHER NOTES LIBRARY */}
      {/* ========================================================================= */}
      {activeTab === "library" && (
        <div className="space-y-4 overflow-y-auto">
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
                          <p>
                            Uploaded by:{" "}
                            <span className="font-semibold text-slate-700">
                              {r.teacher_name}
                            </span>
                          </p>
                          <p>
                            File:{" "}
                            <span className="text-slate-600">
                              {r.original_filename}
                            </span>
                          </p>
                          <p>
                            Date:{" "}
                            {new Date(r.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-2">
                        <button
                          type="button"
                          onClick={() => downloadResource(r.id, r.original_filename)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
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
