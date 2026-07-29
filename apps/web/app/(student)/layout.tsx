import type { ReactNode } from "react";
import { AuthenticatedRouteGuard } from "@/components/common/auth/authenticated-route-guard";
import { StudentShell } from "@/components/student/layout/student-shell";
import { getServerThemeMode } from "@/lib/server-theme";
import "./student-theme.css";

const studentReloadScrollBootstrap = `
  try {
    const [navigationEntry] = performance.getEntriesByType("navigation");

    if (navigationEntry?.type === "reload") {
      history.scrollRestoration = "manual";
      window.scrollTo(0, 0);
    }
  } catch {}
`;

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const initialThemeMode = await getServerThemeMode();

  return (
    <div
      className={initialThemeMode === "dark" ? "theme-page dark" : "theme-page"}
      data-theme={initialThemeMode}
      data-theme-root="true"
    >
      <script
        dangerouslySetInnerHTML={{
          __html: studentReloadScrollBootstrap,
        }}
      />
      <AuthenticatedRouteGuard allowedRoles={["STUDENT"]}>
        <StudentShell initialThemeMode={initialThemeMode}>{children}</StudentShell>
      </AuthenticatedRouteGuard>
    </div>
  );
}
