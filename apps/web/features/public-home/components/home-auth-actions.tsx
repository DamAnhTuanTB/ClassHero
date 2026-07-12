"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import {
  clearAuthSession,
  isAuthSessionAccessTokenExpired,
  useAuthSessionStore,
} from "@/features/auth/session";

export function HomeAuthActions() {
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);
  const isExpiredSession =
    isAuthHydrated && session !== null && isAuthSessionAccessTokenExpired(session);

  useEffect(() => {
    if (isExpiredSession) {
      clearAuthSession();
    }
  }, [isExpiredSession]);

  if (!isAuthHydrated) {
    return <div className="mt-8 min-h-11" aria-hidden="true" />;
  }

  if (session && !isExpiredSession) {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] shadow-[var(--theme-shadow-sm)] transition hover:bg-[var(--theme-surface-soft)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]"
          onClick={clearAuthSession}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg bg-[var(--theme-primary)] px-4 text-sm font-semibold text-[var(--theme-primary-foreground)] transition hover:bg-[var(--theme-primary-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]"
      >
        Đăng nhập
      </Link>
      <Link
        href="/register/student"
        className="theme-button-subtle inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]"
      >
        Đăng ký học sinh
      </Link>
      <Link
        href="/register/parent"
        className="theme-button-subtle inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--theme-focus-ring)]"
      >
        Đăng ký phụ huynh
      </Link>
    </div>
  );
}
