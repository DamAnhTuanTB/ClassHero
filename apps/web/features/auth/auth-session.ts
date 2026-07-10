"use client";

import { create } from "zustand";
import type { AuthTokenResponse, AuthUser } from "./auth-api";

const authSessionStorageKey = "classhero.auth.session";

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  remember: boolean;
};

type AuthSessionStore = {
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
  clearSession: () => void;
};

export const useAuthSessionStore = create<AuthSessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
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

export function clearAuthSession() {
  clearStoredSession();
  useAuthSessionStore.getState().clearSession();
}
