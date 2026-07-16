"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/features/auth/api/auth-api";
import {
  clearAuthSession,
  isAuthSessionAccessTokenExpired,
  useAuthSessionStore,
} from "@/features/auth/session/auth-session";
import { isAuthSessionError } from "@/features/auth/session/auth-session-errors";
import { getPostLoginRedirectPath } from "@/features/auth/utils/post-login-redirect";

export function GuestRouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);
  const [isValidatingSession, setIsValidatingSession] = useState(false);
  const [validationBypassedToken, setValidationBypassedToken] = useState<string | null>(
    null,
  );
  const isExpiredSession =
    isHydrated && session !== null && isAuthSessionAccessTokenExpired(session);
  const shouldValidateSession =
    isHydrated &&
    session !== null &&
    !isExpiredSession &&
    validationBypassedToken !== session.accessToken;

  useEffect(() => {
    if (!isHydrated || session === null) {
      setIsValidatingSession(false);
      setValidationBypassedToken(null);
      return;
    }

    if (isExpiredSession) {
      setValidationBypassedToken(null);
      clearAuthSession();
      return;
    }

    if (!shouldValidateSession) {
      return;
    }

    let isActive = true;

    setIsValidatingSession(true);
    getCurrentUser(session.accessToken)
      .then((response) => {
        if (!isActive) {
          return;
        }

        router.replace(getPostLoginRedirectPath(response.user.role));
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (isAuthSessionError(error)) {
          clearAuthSession();
        } else {
          setValidationBypassedToken(session.accessToken);
        }

        setIsValidatingSession(false);
      });

    return () => {
      isActive = false;
    };
  }, [isExpiredSession, isHydrated, router, session, shouldValidateSession]);

  if (!isHydrated || shouldValidateSession || isValidatingSession) {
    return <div aria-busy="true" className="min-h-screen bg-[var(--theme-bg)]" />;
  }

  return children;
}
