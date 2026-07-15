import type { ReactNode } from "react";
import { AppToaster } from "@/app/toaster";
import { StudentCoursesShell } from "@/features/student-courses/layout/student-courses-shell";
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
      {/*
        TODO: Re-enable before production:
        <AuthenticatedRouteGuard allowedRoles={["STUDENT"]}>
          <StudentCoursesShell>{children}</StudentCoursesShell>
        </AuthenticatedRouteGuard>
      */}
      <StudentCoursesShell initialThemeMode={initialThemeMode}>{children}</StudentCoursesShell>
      <AppToaster />
    </div>
  );
}
