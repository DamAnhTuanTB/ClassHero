import type { ReactNode } from "react";
import { AppToaster } from "@/app/toaster";
import { getServerThemeMode } from "@/lib/server-theme";
import "@/app/(admin)/admin-theme.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const initialThemeMode = await getServerThemeMode();

  return (
    <div
      className={initialThemeMode === "dark" ? "theme-page dark" : "theme-page"}
      data-theme={initialThemeMode}
      data-theme-root="true"
    >
      {children}
      <AppToaster />
    </div>
  );
}
