"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getStudentActiveTestStatus } from "@/features/student/lessons/api/student-lessons-api";

const FOCUS_REFRESH_DEDUP_MS = 250;
let lastFocusRefreshAt = 0;

export function studentActiveTestStatusQueryKey(userId?: string) {
  return ["student", "test-attempt", "active-status", userId ?? "guest"] as const;
}

export function useAiChatAvailability() {
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);
  const isEnabled =
    isAuthHydrated && session?.user.role === "STUDENT" && Boolean(session.accessToken);
  const query = useQuery({
    queryKey: studentActiveTestStatusQueryKey(session?.user.id),
    queryFn: () => getStudentActiveTestStatus(session?.accessToken ?? ""),
    enabled: isEnabled,
    staleTime: 5_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isEnabled) return;

    const refreshAvailability = () => {
      const now = Date.now();
      if (now - lastFocusRefreshAt < FOCUS_REFRESH_DEDUP_MS) return;
      lastFocusRefreshAt = now;
      void query.refetch();
    };
    window.addEventListener("focus", refreshAvailability);
    return () => window.removeEventListener("focus", refreshAvailability);
  }, [isEnabled, query.refetch]);

  return {
    isBlockedDuringTest: query.data?.isActive === true,
  };
}
