import { apiFetch, apiRequest } from "./api";
import type {
  InterviewStart,
  InterviewTurnResult,
  NotesUploadResult,
  ProgressDashboard,
  QuizGradeResult,
  QuizPayload,
} from "@/types/tutor";

export async function generateQuiz(body: {
  subject: string;
  topic: string;
  difficulty?: string | null;
  n_questions: number;
  learner_id: string;
}): Promise<QuizPayload> {
  return apiFetch("/api/tutor/quiz/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function gradeQuiz(body: {
  quiz_id: string;
  answers: Record<string, string>;
  learner_id: string;
}): Promise<QuizGradeResult> {
  return apiFetch("/api/tutor/quiz/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function requestHint(quiz_id: string, question_id: string) {
  return apiFetch<{
    question_id: string;
    hint_level: number;
    hint: string;
    revealed: boolean;
    emotion: string;
    gesture: string;
  }>("/api/tutor/quiz/hint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quiz_id, question_id }),
  });
}

export async function fetchProgress(learnerId: string): Promise<ProgressDashboard> {
  return apiFetch(`/api/tutor/progress?learner_id=${encodeURIComponent(learnerId)}`);
}

export async function startInterview(body: {
  topic: string;
  n_questions: number;
  learner_id: string;
}): Promise<InterviewStart> {
  return apiFetch("/api/tutor/interview/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function answerInterview(
  interview_id: string,
  answer: string
): Promise<InterviewTurnResult> {
  return apiFetch("/api/tutor/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interview_id, answer }),
  });
}

export async function uploadNotes(
  file: File,
  sessionId: string,
  learnerId: string
): Promise<NotesUploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("session_id", sessionId);
  form.append("learner_id", learnerId);
  const res = await apiRequest("/api/tutor/notes/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error((await res.text()) || "Upload failed");
  return res.json() as Promise<NotesUploadResult>;
}

export async function listNotes(sessionId: string) {
  return apiFetch<{
    session_id: string;
    documents: { doc_id: string; filename: string; chunks: number }[];
  }>(`/api/tutor/notes?session_id=${encodeURIComponent(sessionId)}`);
}

export async function askNotes(body: {
  session_id: string;
  question: string;
  learner_id: string;
}) {
  return apiFetch<{
    answer: string;
    session_id: string;
    sources: string[];
  }>("/api/tutor/notes/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
