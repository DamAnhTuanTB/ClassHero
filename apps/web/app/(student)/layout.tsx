import type { ReactNode } from "react";
import { AppToaster } from "@/app/toaster";
import { AuthenticatedRouteGuard } from "@/components/common/auth/authenticated-route-guard";
import { StudentShell } from "@/components/student/layout/student-shell";
import { getServerThemeMode } from "@/lib/server-theme";
import "./student-theme.css";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const initialThemeMode = await getServerThemeMode();

  return (
    <div
      className={initialThemeMode === "dark" ? "theme-page dark" : "theme-page"}
      data-theme={initialThemeMode}
      data-theme-root="true"
    >
      <AuthenticatedRouteGuard allowedRoles={["STUDENT"]}>
        <StudentShell initialThemeMode={initialThemeMode}>{children}</StudentShell>
      </AuthenticatedRouteGuard>
      <AppToaster />
    </div>
  );
}
