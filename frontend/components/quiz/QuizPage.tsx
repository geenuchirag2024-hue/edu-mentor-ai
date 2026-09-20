"use client";

import { useMemo, useState } from "react";
import MiraStage from "@/components/mascot/MiraStage";
import { getLearnerId } from "@/services/learner";
import { generateQuiz, gradeQuiz, requestHint } from "@/services/tutorService";
import type { QuizGradeResult, QuizPayload } from "@/types/tutor";
import type { MascotEmotion, MascotGesture, MascotState } from "@/types/voice";

const SUBJECTS = ["Machine Learning", "Python", "Deep Learning", "Neural Networks"];

export default function QuizPage() {
  const [subject, setSubject] = useState("Machine Learning");
  const [topic, setTopic] = useState("Decision Trees");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "auto">(
    "auto"
  );
  const [nQuestions, setNQuestions] = useState(5);
  const [quiz, setQuiz] = useState<QuizPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<QuizGradeResult | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>("idle");
  const [emotion, setEmotion] = useState<MascotEmotion>("confident");
  const [gesture, setGesture] = useState<MascotGesture>("raise_hand");

  const question = quiz?.questions[index];
  const progressPct = useMemo(() => {
    if (!quiz) return 0;
    return Math.round((index / quiz.questions.length) * 100);
  }, [quiz, index]);

  async function startQuiz() {
    setBusy(true);
    setError(null);
    setResult(null);
    setHint(null);
    setMascotState("thinking");
    try {
      const payload = await generateQuiz({
        subject,
        topic,
        difficulty: difficulty === "auto" ? null : difficulty,
        n_questions: nQuestions,
        learner_id: getLearnerId(),
      });
      setQuiz(payload);
      setIndex(0);
      setAnswers({});
      setDraft("");
      setEmotion("confident");
      setGesture("raise_hand");
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate quiz");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  function selectOption(value: string) {
    setDraft(value);
  }

  async function submitCurrent() {
    if (!quiz || !question) return;
    const nextAnswers = { ...answers, [question.id]: draft };
    setAnswers(nextAnswers);
    setHint(null);

    if (index + 1 < quiz.questions.length) {
      setIndex(index + 1);
      setDraft(nextAnswers[quiz.questions[index + 1].id] || "");
      return;
    }

    setBusy(true);
    setMascotState("thinking");
    try {
      const graded = await gradeQuiz({
        quiz_id: quiz.quiz_id,
        answers: nextAnswers,
        learner_id: getLearnerId(),
      });
      setResult(graded);
      setEmotion((graded.emotion as MascotEmotion) || "happy");
      setGesture((graded.gesture as MascotGesture) || "celebrate");
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grade quiz");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  async function hintForCurrent() {
    if (!quiz || !question) return;
    setBusy(true);
    setMascotState("thinking");
    try {
      const data = await requestHint(quiz.quiz_id, question.id);
      setHint(data.hint);
      setEmotion("thinking");
      setGesture("point");
      setMascotState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hint failed");
      setMascotState("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto md:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        {!quiz && (
          <section className="glass-panel p-5">
            <h2 className="text-lg font-semibold text-slate-800">Generate Quiz</h2>
            <p className="mt-1 text-sm text-slate-500">
              Mira builds MCQs, true/false, and short answers, then adapts difficulty from your history.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Subject
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Topic
                <input
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </label>
              <label className="text-sm">
                Difficulty
                <select
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(e.target.value as typeof difficulty)
                  }
                >
                  <option value="auto">Adaptive (from your progress)</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="text-sm">
                Questions
                <input
                  type="number"
                  min={3}
                  max={12}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  value={nQuestions}
                  onChange={(e) => setNQuestions(Number(e.target.value))}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={startQuiz}
              disabled={busy}
              className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Generating…" : "Generate Quiz"}
            </button>
          </section>
        )}

        {quiz && question && !result && (
          <section className="glass-panel p-5">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                {quiz.topic} · {quiz.difficulty}
              </span>
              <span>
                Question {index + 1} / {quiz.questions.length}
              </span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-base font-medium text-slate-800">{question.prompt}</p>
            <div className="mt-4 space-y-2">
              {question.options.length > 0 ? (
                question.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => selectOption(opt)}
                    className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm ${
                      draft === opt
                        ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                        : "border-slate-200 hover:border-indigo-200"
                    }`}
                  >
                    {opt}
                  </button>
                ))
              ) : (
                <textarea
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Type a short answer…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              )}
            </div>
            {hint && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {hint}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={hintForCurrent}
                disabled={busy}
                className="rounded-xl bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900"
              >
                Hint
              </button>
              <button
                type="button"
                onClick={submitCurrent}
                disabled={busy || !draft.trim()}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {index + 1 === quiz.questions.length ? "Submit quiz" : "Next"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuiz(null);
                  setResult(null);
                }}
                className="rounded-xl px-4 py-2 text-sm text-slate-500"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {result && (
          <section className="glass-panel p-5">
            <h2 className="text-lg font-semibold">
              Score: {result.score}/{result.total} · {result.accuracy}%
            </h2>
            <p className="mt-2 text-sm text-slate-600">{result.mascot_message}</p>
            {result.weak_areas.length > 0 && (
              <p className="mt-2 text-sm">
                <span className="font-medium">Weak areas: </span>
                {result.weak_areas.join(", ")}
              </p>
            )}
            <ul className="mt-4 space-y-3">
              {result.details.map((d) => (
                <li
                  key={d.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    d.is_correct
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-rose-200 bg-rose-50"
                  }`}
                >
                  <p className="font-medium">{d.prompt}</p>
                  <p className="mt-1">Your answer: {d.given || "—"}</p>
                  {!d.is_correct && (
                    <p>Correct: {d.correct_answer}</p>
                  )}
                  <p className="mt-1 text-slate-600">{d.explanation}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setQuiz(null);
                setResult(null);
                setEmotion("greeting");
                setGesture("wave");
              }}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white"
            >
              New quiz
            </button>
          </section>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <aside className="w-full shrink-0 md:w-80">
        <MiraStage
          state={mascotState}
          emotion={emotion}
          gesture={gesture}
          size={220}
        />
      </aside>
    </div>
  );
}
