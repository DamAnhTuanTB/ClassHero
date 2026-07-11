export type AppThemeMode = "light" | "dark";

export const themeStorageKey = "classhero-theme";
export const themeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export function normalizeThemeMode(themeMode: string | null | undefined) {
  return themeMode === "dark" || themeMode === "light" ? themeMode : null;
}
