import { API_URL, friendlyApiError, getStoredToken } from "./api";

export type UserRole = "student" | "teacher";

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: UserRole;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

const TOKEN_KEY = "edu_mentor_token";
const USER_KEY = "edu_mentor_user";

export function getToken(): string | null {
  return getStoredToken();
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    if (!user.role) {
      user.role = "student";
    }
    return user;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event("edu_mentor_auth_changed"));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("edu_mentor_auth_changed"));
}

export async function register(data: {
  full_name: string;
  email: string;
  password: string;
  role?: string;
}): Promise<AuthResponse> {
  const payload = {
    full_name: data.full_name.trim(),
    email: data.email.trim(),
    password: data.password,
    role: data.role || "student",
  };

  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  const result = (await res.json()) as AuthResponse;
  setSession(result.access_token, result.user);
  return result;
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(friendlyApiError(res.status, text));
  }

  const result = (await res.json()) as AuthResponse;
  setSession(result.access_token, result.user);
  return result;
}

export async function getProfile(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        clearSession();
      }
      return null;
    }
    const user = (await res.json()) as AuthUser;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    return user;
  } catch {
    return getCurrentUser();
  }
}
