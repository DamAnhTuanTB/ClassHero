"use client";

import type { ReactNode } from "react";
import type { AuthRole, AuthUser } from "@/features/auth/types/auth-api-types";
import { useAuthGuard } from "@/features/auth/session/use-auth-guard";

export function AuthenticatedRouteGuard({
  allowedRoles,
  children,
  initialUser = null,
  redirectTo = "/login",
}: {
  allowedRoles?: readonly AuthRole[];
  children: ReactNode;
  initialUser?: AuthUser | null;
  redirectTo?: string;
}) {
  const { isAuthHydrated, isAuthorized } = useAuthGuard({
    allowedRoles,
    redirectTo,
  });
  const isServerAuthorized =
    !isAuthHydrated &&
    initialUser !== null &&
    (allowedRoles?.length ? allowedRoles.includes(initialUser.role) : true);

  if (!isAuthorized && !isServerAuthorized) {
    return <div aria-busy="true" className="min-h-screen bg-[var(--theme-bg)]" />;
  }

  return children;
}
