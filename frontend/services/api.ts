const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const UNREACHABLE_MSG =
  "Cannot reach the API. Start the backend with: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000";

const TOKEN_KEY = "edu_mentor_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function friendlyApiError(status: number, body: string): string {
  const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (status >= 500 || /internal server error/i.test(body)) {
    return "Service error. Keep the backend running and try again — or type the question instead.";
  }
  try {
    const parsed = JSON.parse(body) as { detail?: string | Array<{ msg?: string }> };
    if (parsed.detail) {
      if (typeof parsed.detail === "string") return parsed.detail;
      if (Array.isArray(parsed.detail) && parsed.detail[0]?.msg) return parsed.detail[0].msg;
    }
  } catch {
    /* not JSON */
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

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
    return res;
  } catch (err) {
    if (options?.signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw new Error("Cancelled");
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
