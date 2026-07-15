import type { Metadata } from "next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import { Providers } from "@/app/providers";
import { getServerThemeMode } from "@/lib/server-theme";
import {
  adminSidebarCollapsedDatasetKey,
  adminSidebarCollapsedStorageKey,
  studentSidebarCollapsedDatasetKey,
  studentSidebarCollapsedStorageKey,
} from "@/lib/sidebar-collapse-state";
import { themeCookieMaxAgeSeconds, themeStorageKey } from "@/lib/theme-constants";
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
  description: "Learning path MVP front-end",
};

const themeInitScript = `
(() => {
  try {
    const themeStorageKey = "${themeStorageKey}";
    let storedTheme;
    try {
      storedTheme = window.localStorage.getItem(themeStorageKey);
    } catch {
    }
    const cookieTheme = document.cookie
      .split("; ")
      .find((item) => item.startsWith(themeStorageKey + "="))
      ?.split("=")[1];
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const theme = cookieTheme === "dark" || cookieTheme === "light"
      ? cookieTheme
      : storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
      : prefersDark
        ? "dark"
        : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
    }
    document.cookie = themeStorageKey + "=" + theme + "; path=/; max-age=${themeCookieMaxAgeSeconds}; SameSite=Lax";

    [
      ["${adminSidebarCollapsedStorageKey}", "${adminSidebarCollapsedDatasetKey}"],
      ["${studentSidebarCollapsedStorageKey}", "${studentSidebarCollapsedDatasetKey}"],
    ].forEach(([storageKey, datasetKey]) => {
      let isCollapsed = false;
      try {
        isCollapsed = window.localStorage.getItem(storageKey) === "true";
      } catch {
      }
      document.documentElement.dataset[datasetKey] = String(isCollapsed);
    });
  } catch {
  }
})();
`;

const themeBodySyncScript = `
(() => {
  try {
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    document.body.dataset.theme = theme;
    document.body.classList.toggle("dark", theme === "dark");
  } catch {
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialThemeMode = await getServerThemeMode();

  return (
    <html
      lang="vi"
      data-theme={initialThemeMode}
      className={initialThemeMode === "dark" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script
          id="classhero-theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body
        data-theme-root="true"
        data-theme={initialThemeMode}
        suppressHydrationWarning
        className={`${beVietnamPro.variable} ${baloo2.variable} ${
          initialThemeMode === "dark" ? "dark" : ""
        }`}
      >
        <script
          id="classhero-theme-body-sync"
          dangerouslySetInnerHTML={{ __html: themeBodySyncScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
