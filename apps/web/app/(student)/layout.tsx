import type { ReactNode } from "react";
import { AuthenticatedRouteGuard } from "@/components/common/auth/authenticated-route-guard";
import { StudentShell } from "@/components/student/layout/student-shell";
import { getServerAuthSession } from "@/features/auth/session/server-auth-session";
import { getServerThemeMode } from "@/lib/server-theme";
import "./student-theme.css";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const [initialThemeMode, serverAuthSession] = await Promise.all([
    getServerThemeMode(),
    getServerAuthSession(),
  ]);
  const initialCurrentUser =
    serverAuthSession?.currentUser.user.role === "STUDENT"
      ? serverAuthSession.currentUser
      : null;
  const initialUser = initialCurrentUser?.user ?? null;

  return (
    <div
      className={initialThemeMode === "dark" ? "theme-page dark" : "theme-page"}
      data-theme={initialThemeMode}
      data-theme-root="true"
    >
      <AuthenticatedRouteGuard allowedRoles={["STUDENT"]} initialUser={initialUser}>
        <StudentShell
          initialCurrentUser={initialCurrentUser}
          initialThemeMode={initialThemeMode}
        >
          {children}
        </StudentShell>
      </AuthenticatedRouteGuard>
    </div>
  );
}
