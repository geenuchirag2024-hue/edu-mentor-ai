import { apiFetch, apiRequest, friendlyApiError } from "@/services/api";

export interface TeacherOverviewAnalytics {
  total_active_students: number;
  total_study_hours: number;
  total_questions_asked: number;
  avg_ai_response_time_ms: number;
  total_resources_published: number;
}

export interface StudentActivitySummary {
  student_id: number;
  full_name: string;
  email: string;
  total_study_seconds: number;
  sessions_count: number;
  questions_count: number;
  avg_response_latency_ms: number;
  last_active?: string | null;
}

export interface StudentQueryLogOut {
  id: number;
  student_name: string;
  subject: string;
  question: string;
  answer: string;
  sources: number[];
  retrieval_latency_ms: number;
  generation_latency_ms: number;
  total_latency_ms: number;
  status: string;
  created_at: string;
}

export interface LatencyStats {
  avg_ms: number;
  median_ms: number;
  p95_ms: number;
  min_ms: number;
  max_ms: number;
  failed_count: number;
  total_queries: number;
}

export interface StudySessionPingResponse {
  session_uuid: string;
  active_duration_seconds: number;
  status: string;
}

export async function getTeacherOverview(): Promise<TeacherOverviewAnalytics> {
  return apiFetch<TeacherOverviewAnalytics>("/api/analytics/teacher/overview");
}

export async function listStudentAnalytics(): Promise<StudentActivitySummary[]> {
  return apiFetch<StudentActivitySummary[]>("/api/analytics/teacher/students");
}

export async function getStudentHistory(studentId: number): Promise<StudentQueryLogOut[]> {
  return apiFetch<StudentQueryLogOut[]>(`/api/analytics/teacher/students/${studentId}/history`);
}

export async function getLatencyAnalytics(): Promise<LatencyStats> {
  return apiFetch<LatencyStats>("/api/analytics/teacher/latency");
}

export async function listRecentQueries(
  subject?: string,
  statusFilter?: string,
  limit: number = 50
): Promise<StudentQueryLogOut[]> {
  const params = new URLSearchParams();
  if (subject && subject !== "All") params.append("subject", subject);
  if (statusFilter && statusFilter !== "All") params.append("status_filter", statusFilter);
  params.append("limit", String(limit));

  const query = `?${params.toString()}`;
  return apiFetch<StudentQueryLogOut[]>(`/api/analytics/teacher/queries${query}`);
}

export async function pingStudySession(
  sessionUuid: string
): Promise<StudySessionPingResponse> {
  const res = await apiRequest("/api/analytics/study-session/ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_uuid: sessionUuid }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  return res.json();
}

