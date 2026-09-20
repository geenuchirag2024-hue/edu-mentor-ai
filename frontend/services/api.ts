const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const UNREACHABLE_MSG =
  "Cannot reach the API. Start the backend with: python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000";

export function friendlyApiError(status: number, body: string): string {
  const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (status >= 500 || /internal server error/i.test(body)) {
    return "Speech failed. Keep the backend running and try again — or type the question instead.";
  }
  try {
    const parsed = JSON.parse(body) as { detail?: string };
    if (parsed.detail) return parsed.detail;
  } catch {
    /* not JSON */
  }
  return stripped.slice(0, 240) || `API error ${status}`;
}

export async function apiRequest(
  path: string,
  options?: RequestInit
): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, options);
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
