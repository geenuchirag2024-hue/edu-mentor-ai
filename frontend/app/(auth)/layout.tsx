import Link from "next/link";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/chat" className="flex items-center gap-3 transition hover:opacity-90">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3zm-6 9.2V16c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Edu Mentor AI
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Interactive AI Learning Companion
            </p>
          </div>
        </Link>
      </header>

      <main className="w-full max-w-md">{children}</main>

      <footer className="mt-8 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Edu Mentor AI. Learn • Ask • Practice • Grow
      </footer>
    </div>
  );
}
