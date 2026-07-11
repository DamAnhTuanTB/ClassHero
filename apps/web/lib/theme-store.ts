"use client";

import { create } from "zustand";
import {
  normalizeThemeMode,
  themeCookieMaxAgeSeconds,
  themeStorageKey,
  type AppThemeMode,
} from "@/lib/theme-constants";

export type { AppThemeMode };

type ThemeStore = {
  isDarkTheme: boolean;
  isHydrated: boolean;
  themeMode: AppThemeMode;
  hydrateTheme: () => void;
  setThemeMode: (themeMode: AppThemeMode) => void;
  toggleTheme: () => void;
};

function readStoredThemeMode(): AppThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const cookieThemeMode = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${themeStorageKey}=`))
    ?.split("=")[1];
  const normalizedCookieThemeMode = normalizeThemeMode(cookieThemeMode);
  if (normalizedCookieThemeMode) {
    return normalizedCookieThemeMode;
  }

  try {
    const storedThemeMode = window.localStorage.getItem(themeStorageKey);
    const normalizedStoredThemeMode = normalizeThemeMode(storedThemeMode);
    if (normalizedStoredThemeMode) {
      return normalizedStoredThemeMode;
    }
  } catch {
    document.documentElement.dataset.themeStorage = "unavailable";
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyThemeMode(themeMode: AppThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const isDarkTheme = themeMode === "dark";

  document.documentElement.dataset.theme = themeMode;
  document.documentElement.classList.toggle("dark", isDarkTheme);
  document.querySelectorAll<HTMLElement>("[data-theme-root]").forEach((themeRoot) => {
    themeRoot.dataset.theme = themeMode;
    themeRoot.classList.toggle("dark", isDarkTheme);
  });
  try {
    window.localStorage.setItem(themeStorageKey, themeMode);
  } catch {
    document.documentElement.dataset.themeStorage = "unavailable";
  }
  document.cookie = `${themeStorageKey}=${themeMode}; path=/; max-age=${themeCookieMaxAgeSeconds}; SameSite=Lax`;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDarkTheme: false,
  isHydrated: false,
  themeMode: "light",
  hydrateTheme: () => {
    const themeMode = readStoredThemeMode();
    applyThemeMode(themeMode);
    set({ isDarkTheme: themeMode === "dark", isHydrated: true, themeMode });
  },
  setThemeMode: (themeMode) => {
    applyThemeMode(themeMode);
    set({ isDarkTheme: themeMode === "dark", isHydrated: true, themeMode });
  },
  toggleTheme: () => {
    get().setThemeMode(get().themeMode === "dark" ? "light" : "dark");
  },
}));
