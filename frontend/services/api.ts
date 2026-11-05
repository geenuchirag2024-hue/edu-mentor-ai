/**
 * Centralized API client for Edu-Mentor AI.
 *
 * Ensures direct communication with the FastAPI backend (port 8000) on localhost,
 * eliminating the 30-second socket timeout imposed by the Next.js rewrite proxy
 * during local LLM generation.
 */

export function getApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  if (explicit) return explicit;

  // On localhost, direct browser requests straight to FastAPI on port 8000
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ) {
    return "http://localhost:8000";
  }

  return "";
}

const API_URL = getApiBaseUrl();

const UNREACHABLE_MSG =
  "Cannot reach the API. Start the backend with: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000";

const TOKEN_KEY = "edu_mentor_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function friendlyApiError(status: number, body: string): string {
  const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // 1. Try parsing JSON error messages returned by FastAPI
  try {
    const parsed = JSON.parse(body) as {
      detail?: string | Array<{ msg?: string }>;
      message?: string;
      error?: string;
    };
    if (parsed.detail) {
      if (typeof parsed.detail === "string") return parsed.detail;
      if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
    }
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    /* not JSON */
  }

  // 2. Specific HTTP status code diagnostics
  if (status === 504 || status === 408) {
    return "Request timed out during local AI inference. Please try again with fewer questions or a more focused prompt.";
  }

  if (status === 401 || status === 403) {
    return "Your session has expired or is unauthorized. Please log in again.";
  }

  if (status >= 500 || /internal server error/i.test(body)) {
    return stripped && !/internal server error/i.test(stripped)
      ? `Server error (${status}): ${stripped.slice(0, 240)}`
      : "Backend service error. Please make sure the FastAPI server is running on port 8000.";
  }

  return stripped.slice(0, 240) || `API error ${status}`;
}

export async function apiRequest(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const headers = new Headers(options?.headers || {});

  // Automatically inject Bearer token if not explicitly provided
  if (!headers.has("Authorization")) {
    const token = getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  // Route directly to backend URL
  const targetUrl =
    path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${getApiBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;

  try {
    const res = await fetch(targetUrl, {
      ...options,
      headers,
    });
    return res;
  } catch (err) {
    if (options?.signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw new Error("Request was cancelled.");
    }
    throw new Error(UNREACHABLE_MSG);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await apiRequest(path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }
  return res.json() as Promise<T>;
}

export { API_URL };
