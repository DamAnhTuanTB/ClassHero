import type { ReactNode } from "react";
import { getServerThemeMode } from "@/lib/server-theme";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const initialThemeMode = await getServerThemeMode();

  return (
    <div
      className={initialThemeMode === "dark" ? "theme-page dark" : "theme-page"}
      data-theme={initialThemeMode}
      data-theme-root="true"
    >
      {children}
    </div>
  );
}
