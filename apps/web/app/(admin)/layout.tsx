import type { ReactNode } from "react";
import { AuthenticatedRouteGuard } from "@/components/common/auth/authenticated-route-guard";
import { getServerAuthUser } from "@/features/auth/session/server-auth-session";
import { getServerThemeMode } from "@/lib/server-theme";
import "@/app/(admin)/admin-theme.css";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [initialThemeMode, serverAuthUser] = await Promise.all([
    getServerThemeMode(),
    getServerAuthUser(),
  ]);
  const initialUser = serverAuthUser?.role === "ADMIN" ? serverAuthUser : null;

  return (
    <div
      className={initialThemeMode === "dark" ? "theme-page dark" : "theme-page"}
      data-theme={initialThemeMode}
      data-theme-root="true"
    >
      <AuthenticatedRouteGuard allowedRoles={["ADMIN"]} initialUser={initialUser}>
        {children}
      </AuthenticatedRouteGuard>
    </div>
  );
}
