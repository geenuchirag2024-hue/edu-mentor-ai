"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LanguageSelector from "@/components/language/LanguageSelector";
import { AuthUser, getCurrentUser, getProfile } from "@/services/authService";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  StudentNotificationItem,
} from "@/services/notificationService";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<StudentNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notifRef = useRef<HTMLDivElement>(null);

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

  // Poll notifications for logged in students
  useEffect(() => {
    if (!user || user.role !== "student") return;

    let mounted = true;
    const fetchNotifs = () => {
      listNotifications()
        .then((res) => {
          if (mounted) {
            setNotifications(res.notifications);
            setUnreadCount(res.unread_count);
          }
        })
        .catch(() => {});
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [user]);

  // Close notification dropdown on outside click or Escape key
  useEffect(() => {
    if (!notifOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [notifOpen]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  const handleNotificationClick = async (notif: StudentNotificationItem) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch {
        /* ignore */
      }
    }
    setNotifOpen(false);
    router.push("/notes?tab=library");
  };

  return (
    <header className="glass-bar dark:bg-slate-900/80 dark:border-slate-800 relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 px-3 md:px-4 transition-colors">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={user?.role === "teacher" ? "/teacher" : "/chat"} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/30">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 3 2 8l10 5 8-4v6h2V8L12 3zm-6 9.2V16c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.8l-6 3-6-3z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[18px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Edu Mentor AI
            </h1>
            <p className="hidden text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-400 sm:block">
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
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
              user.role === "teacher"
                ? "border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                : "border border-violet-200 dark:border-violet-900/60 bg-violet-50/90 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300"
            }`}
          >
            <span>{user.role === "teacher" ? "👩‍🏫 Teacher Portal" : "🎓 Student Workspace"}</span>
          </div>
        )}

        {/* Student Notifications Bell */}
        {user && user.role === "student" && (
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              id="header-notification-button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white"
              title="Notifications"
              aria-label="Notifications"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                id="header-notification-dropdown"
                className="absolute right-0 top-12 z-40 w-80 rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/98 dark:bg-slate-900/98 p-3 shadow-2xl shadow-slate-900/20 backdrop-blur-md sm:w-96 text-slate-900 dark:text-slate-100"
              >
                <div className="mb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-violet-100 dark:bg-violet-950/80 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                      No notifications yet. You&apos;re all caught up! ✨
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`group cursor-pointer rounded-xl p-2.5 transition ${
                          n.is_read
                            ? "bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-100/80 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            : "border border-violet-100 dark:border-violet-900/60 bg-violet-50/70 dark:bg-violet-950/40 hover:bg-violet-100/70 dark:hover:bg-violet-950/70 text-slate-900 dark:text-white shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-semibold leading-tight text-slate-800 dark:text-slate-100">
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {n.message}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-400">
                          <span>{new Date(n.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                          <span className="font-semibold text-violet-600 dark:text-violet-400 group-hover:underline">
                            View in Notes Library →
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/90 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mira-status-pulse" />
          Online
        </div>

        {!user && (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              id="header-login-link"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700"
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
