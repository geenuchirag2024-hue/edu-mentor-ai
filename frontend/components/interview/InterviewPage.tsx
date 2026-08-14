"use client";

import { useState } from "react";
import MascotAvatar from "@/components/mascot/MascotAvatar";
import MicButton from "@/components/voice/MicButton";
import { getLearnerId } from "@/services/learner";
import { answerInterview, startInterview } from "@/services/tutorService";
import { API_URL } from "@/services/api";
import type { InterviewTurnResult } from "@/types/tutor";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

export default function InterviewPage() {
  const [topic, setTopic] = useState("Machine Learning");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [number, setNumber] = useState(1);
  const [total, setTotal] = useState(5);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<InterviewTurnResult[]>([]);
  const [finished, setFinished] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [avg, setAvg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [emotion, setEmotion] = useState<MascotEmotion>("confident");
  const [gesture, setGesture] = useState<MascotGesture>("raise_hand");

  async function begin() {
    setBusy(true);
    setError(null);
    setHistory([]);
    setFinished(false);
    setSummary(null);
    setMascotState("thinking");
    try {
      const data = await startInterview({
        topic,
        n_questions: 5,
        learner_id: getLearnerId(),
      });
      setInterviewId(data.interview_id);
      setPrompt(data.prompt);
      setNumber(data.question_number);
      setTotal(data.total);
      setEmotion((data.emotion as MascotEmotion) || "confident");
      setGesture((data.gesture as MascotGesture) || "raise_hand");
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start interview");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  async function submit(text: string) {
    if (!interviewId || !text.trim()) return;
    setBusy(true);
    setMascotState("thinking");
    try {
      const data = await answerInterview(interviewId, text.trim());
      setHistory((prev) => [...prev, data]);
      setAnswer("");
      setEmotion((data.emotion as MascotEmotion) || "thinking");
      setGesture((data.gesture as MascotGesture) || "nod");
      if (data.finished) {
        setFinished(true);
        setPrompt(null);
        setSummary(data.mascot_message || "Interview complete.");
        setAvg(data.average_score ?? data.score);
      } else {
        setPrompt(data.next_prompt);
        setNumber((data.question_number || 0) + 1);
      }
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not evaluate answer");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  async function fromVoice(blob: Blob) {
    setMascotState("thinking");
    const form = new FormData();
    form.append("audio", blob, "recording.wav");
    try {
      const res = await fetch(`${API_URL}/api/voice/transcribe`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { text: string };
      if (data.text) {
        setAnswer(data.text);
        await submit(data.text);
      } else {
        setError("Could not transcribe. Try again.");
        setMascotState("idle");
      }
    } catch {
      setError("Voice transcription failed.");
      setMascotState("idle");
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto py-4 md:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        {!interviewId && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Interview Mode</h2>
            <p className="mt-1 text-sm text-slate-500">
              Mira asks technical questions, scores your answers, and gives feedback.
            </p>
            <label className="mt-4 block text-sm">
              Topic
              <input
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={begin}
              disabled={busy}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Starting…" : "Start interview"}
            </button>
          </section>
        )}

        {prompt && !finished && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">
              Question {number} / {total}
            </p>
            <p className="mt-2 text-base font-medium text-slate-800">{prompt}</p>
            <textarea
              className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              rows={4}
              placeholder="Answer as you would in an interview…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={busy}
            />
            <div className="mt-3 flex items-center gap-2">
              <MicButton
                onRecordingComplete={fromVoice}
                disabled={busy}
                onListeningStart={() => setMascotState("listening")}
                onListeningEnd={() => setMascotState("thinking")}
                onListeningCancel={() => setMascotState("idle")}
              />
              <button
                type="button"
                onClick={() => submit(answer)}
                disabled={busy || !answer.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Submit answer
              </button>
            </div>
          </section>
        )}

        {history.map((turn, i) => (
          <article
            key={`${turn.interview_id}-${i}`}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
          >
            <p className="font-medium text-indigo-700">Score: {turn.score}/10</p>
            <p className="mt-1 text-slate-700">{turn.feedback}</p>
            {turn.strengths?.length > 0 && (
              <p className="mt-2 text-emerald-700">
                Strengths: {turn.strengths.join("; ")}
              </p>
            )}
            {turn.improvements?.length > 0 && (
              <p className="mt-1 text-amber-800">
                Improve: {turn.improvements.join("; ")}
              </p>
            )}
          </article>
        ))}

        {finished && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="font-semibold">Interview complete</h3>
            <p className="mt-1 text-sm">
              Average score: {avg ?? "—"} / 10
            </p>
            <p className="mt-2 text-sm text-slate-700">{summary}</p>
            <button
              type="button"
              onClick={() => {
                setInterviewId(null);
                setHistory([]);
                setFinished(false);
              }}
              className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white"
            >
              New interview
            </button>
          </section>
        )}

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
