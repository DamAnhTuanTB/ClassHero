"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AuthRole } from "@/features/auth/types/auth-api-types";
import {
  clearAuthSession,
  isAuthSessionAccessTokenExpired,
  useAuthSessionStore,
} from "@/features/auth/session/auth-session";
import { getAuthSessionErrorReason } from "@/features/auth/session/auth-session-errors";

export type AuthGuardFailureReason =
  "missing-session" | "forbidden-role" | "expired-session" | "forbidden";

export type UseAuthGuardOptions = {
  allowedRoles?: readonly AuthRole[];
  authError?: unknown;
  redirectTo?: string;
};

export function useAuthGuard({
  allowedRoles = [],
  authError,
  redirectTo = "/login",
}: UseAuthGuardOptions = {}) {
  const router = useRouter();
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);
  const sessionFailureReason = getSessionFailureReason({
    allowedRoles,
    isHydrated,
    isTokenExpired: isAuthSessionAccessTokenExpired(session),
    role: session?.user.role,
    token: session?.accessToken,
  });
  const errorFailureReason = getAuthSessionErrorReason(authError);
  const failureReason = sessionFailureReason ?? errorFailureReason;
  const isAuthorized = isHydrated && failureReason === null;

  useEffect(() => {
    if (!isHydrated || failureReason === null) {
      return;
    }

    if (failureReason === "missing-session" || failureReason === "expired-session") {
      clearAuthSession();
    }

    router.replace(redirectTo);
  }, [failureReason, isHydrated, redirectTo, router]);

  return {
    failureReason,
    isAuthHydrated: isHydrated,
    isAuthorized,
    isCheckingAuth: !isHydrated || failureReason !== null,
    session,
  };
}

function getSessionFailureReason({
  allowedRoles,
  isHydrated,
  isTokenExpired,
  role,
  token,
}: {
  allowedRoles: readonly AuthRole[];
  isHydrated: boolean;
  isTokenExpired: boolean;
  role?: AuthRole;
  token?: string;
}): AuthGuardFailureReason | null {
  if (!isHydrated) {
    return null;
  }

  if (!token || !role) {
    return "missing-session";
  }

  if (isTokenExpired) {
    return "expired-session";
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return "forbidden-role";
  }

  return null;
}
