"use client";

import { create } from "zustand";
import { readAuthAccessTokenExpiresAtMs } from "@/features/auth/session/auth-access-token";
import {
  clearServerAuthSessionCookie,
  hasServerAuthSessionMarker,
  persistServerAuthSessionCookie,
} from "@/features/auth/session/auth-session-cookie-client";
import type { AuthTokenResponse, AuthUser } from "@/features/auth/types/auth-api-types";
import { getAuthSessionErrorReason } from "@/features/auth/session/auth-session-errors";

const authSessionStorageKey = "classhero.auth.session";

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  remember: boolean;
};

type AuthSessionStore = {
  isHydrated: boolean;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  clearSession: () => void;
};

export const useAuthSessionStore = create<AuthSessionStore>((set) => ({
  isHydrated: false,
  session: null,
  setSession: (session) => set({ isHydrated: true, session }),
  clearSession: () => set({ isHydrated: true, session: null }),
}));

function getBrowserStorage(remember: boolean) {
  if (typeof window === "undefined") {
    return null;
  }

  return remember ? window.localStorage : window.sessionStorage;
}

function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(authSessionStorageKey);
  window.sessionStorage.removeItem(authSessionStorageKey);
}

export async function saveAuthSession(response: AuthTokenResponse, remember: boolean) {
  const session: AuthSession = {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: response.user,
    remember,
  };
  const storage = getBrowserStorage(remember);

  await persistServerAuthSessionCookie(session.accessToken);
  clearStoredSession();
  storage?.setItem(authSessionStorageKey, JSON.stringify(session));
  useAuthSessionStore.getState().setSession(session);
}

export function hydrateAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  const storedSession =
    readStoredSession(window.localStorage.getItem(authSessionStorageKey)) ??
    readStoredSession(window.sessionStorage.getItem(authSessionStorageKey));

  useAuthSessionStore.getState().setSession(storedSession);

  if (
    storedSession &&
    !isAuthSessionAccessTokenExpired(storedSession) &&
    !hasServerAuthSessionMarker()
  ) {
    void persistServerAuthSessionCookie(storedSession.accessToken).catch(() => undefined);
  }
}

export function clearAuthSession() {
  clearStoredSession();
  useAuthSessionStore.getState().clearSession();
  void clearServerAuthSessionCookie().catch(() => undefined);
}

export async function clearAuthSessionEverywhere() {
  clearStoredSession();
  useAuthSessionStore.getState().clearSession();

  try {
    await clearServerAuthSessionCookie();
  } catch {
    // Local state must still be cleared when the web session endpoint is unavailable.
  }
}

export function clearExpiredAuthSession(error: unknown) {
  if (getAuthSessionErrorReason(error) !== "expired-session") {
    return false;
  }

  clearAuthSession();
  return true;
}

export function isAuthSessionAccessTokenExpired(
  session: AuthSession | null,
  nowMs = Date.now(),
) {
  const expiresAtMs = readAuthAccessTokenExpiresAtMs(session?.accessToken);

  if (expiresAtMs === null) {
    return true;
  }

  return expiresAtMs <= nowMs;
}

function readStoredSession(value: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<AuthSession>;

    if (
      typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.remember === "boolean" &&
      parsed.user &&
      typeof parsed.user.id === "string"
    ) {
      return parsed as AuthSession;
    }
  } catch {
    return null;
  }

  return null;
}
