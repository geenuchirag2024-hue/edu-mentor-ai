"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { getCurrentUser, register, UserRole } from "@/services/authService";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect directly to role destination
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      if (user.role === "teacher") {
        router.replace("/teacher");
      } else {
        router.replace("/chat");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const response = await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });

      // Role-based destination
      if (response.user.role === "teacher") {
        router.push("/teacher");
      } else {
        router.push("/chat");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel w-full rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Create Account
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Join Edu-Mentor AI and start learning or teaching
        </p>
      </div>

      {error && (
        <div
          id="register-error-alert"
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Role Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
            I am a:
          </label>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select Role">
            <button
              type="button"
              id="role-select-student"
              onClick={() => setRole("student")}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3.5 text-center transition ${
                role === "student"
                  ? "border-violet-600 bg-violet-50/80 text-violet-900 ring-2 ring-violet-500/30"
                  : "border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span className="text-xl">🎓</span>
              <span className="text-sm font-semibold">Student</span>
              <span className="text-[11px] text-slate-500">Learn with AI Mentors</span>
            </button>

            <button
              type="button"
              id="role-select-teacher"
              onClick={() => setRole("teacher")}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3.5 text-center transition ${
                role === "teacher"
                  ? "border-indigo-600 bg-indigo-50/80 text-indigo-900 ring-2 ring-indigo-500/30"
                  : "border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span className="text-xl">👩‍🏫</span>
              <span className="text-sm font-semibold">Teacher / Faculty</span>
              <span className="text-[11px] text-slate-500">Manage Course & Classes</span>
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="register-fullname"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            Full Name
          </label>
          <input
            id="register-fullname"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Johnson"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="register-email"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            Email Address
          </label>
          <input
            id="register-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="register-password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            Password
          </label>
          <input
            id="register-password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div>
          <label
            htmlFor="register-confirm-password"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
          >
            Confirm Password
          </label>
          <input
            id="register-confirm-password"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <button
          id="register-submit-button"
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg
                className="h-4 w-4 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Creating account...</span>
            </>
          ) : (
            <span>Sign Up as {role === "teacher" ? "Teacher" : "Student"}</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-violet-600 hover:text-violet-700 hover:underline"
        >
          Sign in here
        </Link>
      </div>
    </div>
  );
}
