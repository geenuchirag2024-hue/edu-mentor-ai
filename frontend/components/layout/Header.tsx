"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LanguageSelector from "@/components/language/LanguageSelector";
import { AuthUser, clearSession, getCurrentUser, getProfile } from "@/services/authService";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    getProfile().then((u) => {
      if (u) setUser(u);
    });

    const handleAuthChange = () => {
      setUser(getCurrentUser());
    };

    window.addEventListener("edu_mentor_auth_changed", handleAuthChange);
    return () => {
      window.removeEventListener("edu_mentor_auth_changed", handleAuthChange);
    };
  }, []);

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (name.slice(0, 2) || "U").toUpperCase();
  };

  const handleLogout = () => {
    clearSession();
    setMenuOpen(false);
    router.push("/login");
  };

  return (
    <header className="glass-bar flex h-14 shrink-0 items-center justify-between gap-3 px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={user?.role === "teacher" ? "/teacher" : "/chat"} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3zm-6 9.2V16c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-bold tracking-tight text-slate-900">
              Edu Mentor AI
            </h1>
            <p className="hidden text-[11px] font-medium tracking-wide text-slate-400 sm:block">
              Learn • Ask • Practice • Grow
            </p>
          </div>
        </Link>
      </div>

      <div className="relative flex items-center gap-2.5">
        <LanguageSelector />
        
        {/* Role Badge if logged in */}
        {user && (
          <div
            id="header-role-badge"
            className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${
              user.role === "teacher"
                ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border border-violet-200 bg-violet-50 text-violet-700"
            }`}
          >
            <span>{user.role === "teacher" ? "👩‍🏫 Teacher" : "🎓 Student"}</span>
          </div>
        )}

        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold text-emerald-700 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mira-status-pulse" />
          Online
        </div>

        {user ? (
          <div className="relative">
            <button
              type="button"
              id="header-user-menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-semibold text-white shadow-sm ring-2 ring-white transition hover:opacity-90"
              title={`${user.full_name} (${user.role})`}
            >
              {getInitials(user.full_name || user.email)}
            </button>

            {menuOpen && (
              <div
                id="header-user-dropdown"
                className="absolute right-0 top-11 z-50 w-60 rounded-2xl border border-white/80 bg-white p-3 shadow-xl shadow-slate-900/10"
              >
                <div className="mb-2 border-b border-slate-100 pb-2 px-1">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-bold text-slate-900">
                      {user.full_name}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        user.role === "teacher"
                          ? "bg-indigo-100 text-indigo-800"
                          : "bg-violet-100 text-violet-800"
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-slate-500 mt-0.5">
                    {user.email}
                  </p>
                </div>

                {user.role === "teacher" ? (
                  <Link
                    href="/teacher"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
                  >
                    <span>📊</span>
                    <span>Teacher Dashboard</span>
                  </Link>
                ) : (
                  <Link
                    href="/chat"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-violet-700 transition hover:bg-violet-50"
                  >
                    <span>💬</span>
                    <span>Student Tutor</span>
                  </Link>
                )}

                <button
                  type="button"
                  id="header-logout-button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-medium text-red-600 transition hover:bg-red-50 mt-1"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              id="header-login-link"
              className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              id="header-register-link"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
