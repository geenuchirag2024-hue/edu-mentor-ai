"use client";

import Link from "next/link";
import React, { useState } from "react";
import { forgotPassword } from "@/services/authService";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await forgotPassword(email.trim());
      setSubmitted(true);
      if (res.reset_link_dev) {
        setDevLink(res.reset_link_dev);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to process request. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel w-full rounded-3xl p-6 sm:p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Reset Your Password
        </h2>
        <p className="mt-1.5 text-sm text-slate-500">
          Enter your registered email address and we&apos;ll send you password recovery instructions.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      {submitted ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-emerald-900">
              Instructions Dispatched
            </h3>
            <p className="mt-1 text-xs text-emerald-700 leading-relaxed">
              If an account exists for <strong>{email}</strong>, password reset instructions will be provided. Please check your inbox and spam folder.
            </p>
          </div>

          {devLink && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-800">
              <span className="font-bold">Development Mode Helper:</span>
              <p className="mt-1">SMTP is not configured in local environment. Use the direct link below:</p>
              <Link
                href={devLink.replace(/^https?:\/\/[^/]+/, "")}
                className="mt-2 inline-block font-semibold text-amber-900 underline break-all"
              >
                Continue to Reset Password &rarr;
              </Link>
            </div>
          )}

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 hover:underline"
            >
              &larr; Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Email Address
            </label>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <button
            id="forgot-submit-button"
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
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Processing request...</span>
              </>
            ) : (
              <span>Send Reset Instructions</span>
            )}
          </button>

          <div className="mt-6 text-center text-sm text-slate-500">
            Remembered your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-violet-600 hover:text-violet-700 hover:underline"
            >
              Sign in now
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

