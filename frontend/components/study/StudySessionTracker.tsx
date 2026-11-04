"use client";

import { useEffect, useRef } from "react";
import { getCurrentUser } from "@/services/authService";
import { pingStudySession } from "@/services/analyticsService";

const SESSION_KEY = "edu_mentor_study_session_uuid";

function getOrCreateSessionUuid(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = "sess_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function StudySessionTracker() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    // Only track students
    if (!user || user.role !== "student") return;

    const sessionUuid = getOrCreateSessionUuid();

    // Initial ping on mount
    pingStudySession(sessionUuid).catch(() => {});

    // Periodic heartbeat every 30 seconds
    timerRef.current = setInterval(() => {
      // Only ping if window is focused/visible to measure genuine active attention
      if (typeof document !== "undefined" && !document.hidden) {
        pingStudySession(sessionUuid).catch(() => {});
      }
    }, 30000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return null;
}

