"use client";

import { useEffect, useState } from "react";
import MascotAvatar from "@/components/mascot/MascotAvatar";
import { getLearnerId, getNotesSessionId } from "@/services/learner";
import { askNotes, listNotes, uploadNotes } from "@/services/tutorService";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

interface NoteDoc {
  doc_id: string;
  filename: string;
  chunks: number;
}

export default function NotesPage() {
  const [docs, setDocs] = useState<NoteDoc[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [emotion, setEmotion] = useState<MascotEmotion>("greeting");
  const [gesture, setGesture] = useState<MascotGesture>("wave");

  async function refresh() {
    try {
      const data = await listNotes(getNotesSessionId());
      setDocs(data.documents);
    } catch {
      /* first visit — empty */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMascotState("thinking");
    try {
      await uploadNotes(file, getNotesSessionId(), getLearnerId());
      await refresh();
      setEmotion("happy");
      setGesture("nod");
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    setMascotState("thinking");
    try {
      const data = await askNotes({
        session_id: getNotesSessionId(),
        question: question.trim(),
        learner_id: getLearnerId(),
      });
      setAnswer(data.answer);
      setSources(data.sources || []);
      setEmotion("confident");
      setGesture("point");
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer from notes");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto py-4 md:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">PDF / Notes Tutor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload lecture notes or a PDF, then ask questions grounded in your material.
          </p>
          <label className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-8 text-sm text-indigo-800">
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
              disabled={busy}
            />
            {busy ? "Processing…" : "Click to upload PDF or .txt notes"}
          </label>
          {docs.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {docs.map((d) => (
                <li key={d.doc_id}>
                  {d.filename} · {d.chunks} chunks
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-medium">Ask about your notes</label>
          <textarea
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            placeholder='e.g. "Explain ID3 from my notes."'
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            type="button"
            onClick={ask}
            disabled={busy || !question.trim()}
            className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Ask Mira
          </button>
          {answer && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
              {answer}
              {sources.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Sources: {sources.join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <aside className="flex w-full shrink-0 flex-col items-center md:w-64">
        <div className="rounded-3xl bg-gradient-to-b from-slate-50 to-indigo-50/60 px-4 py-6 shadow-sm ring-1 ring-slate-200/80">
          <MascotAvatar state={mascotState} emotion={emotion} gesture={gesture} />
        </div>
      </aside>
    </div>
  );
}
