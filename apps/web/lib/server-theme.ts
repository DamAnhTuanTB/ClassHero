import { cookies } from "next/headers";
import {
  normalizeThemeMode,
  themeStorageKey,
  type AppThemeMode,
} from "@/lib/theme-constants";

export async function getServerThemeMode(): Promise<AppThemeMode> {
  const cookieStore = await cookies();
  return normalizeThemeMode(cookieStore.get(themeStorageKey)?.value) ?? "light";
}
