"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, getProfile } from "@/services/authService";

export default function HomeGateway() {
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    // Verify token with backend /api/auth/me for live role accuracy
    getProfile()
      .then((liveUser) => {
        const active = liveUser || user;
        if (active.role === "teacher") {
          router.replace("/teacher");
        } else {
          router.replace("/chat");
        }
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-600 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Checking authentication...</p>
      </div>
    </div>
  );
}
