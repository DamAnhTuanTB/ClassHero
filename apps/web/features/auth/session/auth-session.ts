"use client";

import { create } from "zustand";
import type { AuthTokenResponse, AuthUser } from "@/features/auth/api";
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

export function saveAuthSession(response: AuthTokenResponse, remember: boolean) {
  const session: AuthSession = {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: response.user,
    remember,
  };
  const storage = getBrowserStorage(remember);

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
}

export function clearAuthSession() {
  clearStoredSession();
  useAuthSessionStore.getState().clearSession();
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
  const expiresAtMs = getAccessTokenExpiresAtMs(session?.accessToken);

  if (expiresAtMs === null) {
    return true;
  }

  return expiresAtMs <= nowMs;
}

function getAccessTokenExpiresAtMs(token?: string) {
  const encodedPayload = token?.split(".")[1];

  if (!encodedPayload) {
    return null;
  }

  try {
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );
    const payload = JSON.parse(globalThis.atob(paddedPayload)) as Partial<{
      exp: unknown;
    }>;

    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
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
