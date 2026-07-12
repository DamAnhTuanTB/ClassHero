"use client";

import type { ReactNode } from "react";
import type { AuthRole } from "@/features/auth/api";
import { useAuthGuard } from "@/features/auth/session";

export function AuthenticatedRouteGuard({
  allowedRoles,
  children,
  redirectTo = "/login",
}: {
  allowedRoles?: readonly AuthRole[];
  children: ReactNode;
  redirectTo?: string;
}) {
  const { isAuthorized } = useAuthGuard({
    allowedRoles,
    redirectTo,
  });

  if (!isAuthorized) {
    return (
      <div
        aria-busy="true"
        className="min-h-screen bg-[var(--theme-bg)]"
      />
    );
  }

  return children;
}
