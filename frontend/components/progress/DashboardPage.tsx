"use client";

import { useEffect, useState } from "react";
import MascotAvatar from "@/components/mascot/MascotAvatar";
import { getLearnerId } from "@/services/learner";
import { fetchProgress } from "@/services/tutorService";
import type { ProgressDashboard } from "@/types/tutor";

export default function DashboardPage() {
  const [data, setData] = useState<ProgressDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProgress(getLearnerId())
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="p-6 text-sm text-slate-500">Loading your learning…</p>;
  }

  const xpPct = Math.min(100, Math.round((data.xp_into_level / data.xp_per_level) * 100));
  const emotion =
    data.quiz_accuracy >= 80 ? "happy" : data.needs_improvement ? "thinking" : "greeting";
  const gesture = data.streak_days >= 3 ? "celebrate" : "wave";

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto py-4 md:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={`${data.streak_days} day streak`} value="🔥 Streak" />
          <Stat label={`${data.questions_answered}`} value="Questions answered" />
          <Stat label={`${data.quiz_accuracy}%`} value="Quiz accuracy" />
          <Stat label={`Level ${data.level}`} value={`${data.xp} XP`} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Level progress</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.xp_into_level} / {data.xp_per_level} XP to the next level
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Adaptive difficulty: <span className="font-medium capitalize">{data.difficulty}</span>
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Your learning</h2>
          {data.topics.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Chat, take a quiz, or upload notes to start tracking topics.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.topics.map((t) => (
                <li key={t.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-slate-500">{Math.round(t.mastery)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${Math.min(100, t.mastery)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-slate-500">Strongest: </span>
              {data.strongest_topic || "—"}
            </p>
            <p>
              <span className="text-slate-500">Needs improvement: </span>
              {data.needs_improvement || "—"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800">Badges</h2>
          {data.badges.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Earn badges with quizzes, streaks, and interviews.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.badges.map((b) => (
                <span
                  key={b.id}
                  className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-900"
                >
                  {b.label}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="flex w-full shrink-0 flex-col items-center md:w-64">
        <div className="rounded-3xl bg-gradient-to-b from-slate-50 to-indigo-50/60 px-4 py-6 shadow-sm ring-1 ring-slate-200/80">
          <MascotAvatar
            state="idle"
            emotion={emotion}
            gesture={gesture}
          />
        </div>
        <p className="mt-3 max-w-[16rem] text-center text-xs text-slate-500">
          {data.quizzes_completed} quizzes · {data.interviews_completed} interviews
        </p>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500">{value}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{label}</p>
    </div>
  );
}
