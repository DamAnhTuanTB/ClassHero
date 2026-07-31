import type { Metadata } from "next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import { Providers } from "@/app/providers";
import { AppToaster } from "@/app/toaster";
import { getServerSidebarCollapseState } from "@/lib/server-sidebar-collapse-state";
import { getServerThemeMode } from "@/lib/server-theme";
import "@/app/globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

const baloo2 = Baloo_2({
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Learning Path System",
  description: "Course MVP front-end",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [initialThemeMode, initialSidebarCollapseState] = await Promise.all([
    getServerThemeMode(),
    getServerSidebarCollapseState(),
  ]);

  return (
    <html
      lang="vi"
      data-theme={initialThemeMode}
      data-admin-sidebar-collapsed={String(
        initialSidebarCollapseState.adminSidebarCollapsed,
      )}
      data-student-sidebar-collapsed={String(
        initialSidebarCollapseState.studentSidebarCollapsed,
      )}
      className={initialThemeMode === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <body
        data-theme-root="true"
        data-theme={initialThemeMode}
        suppressHydrationWarning
        className={`${beVietnamPro.variable} ${baloo2.variable} ${
          initialThemeMode === "dark" ? "dark" : ""
        }`}
      >
        <Providers>
          {children}
          <AppToaster />
        </Providers>
      </body>
    </html>
  );
}
