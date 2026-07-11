import type { Metadata } from "next";
import Script from "next/script";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import { Providers } from "@/app/providers";
import { AppToaster } from "@/app/toaster";
import { getServerThemeMode } from "@/lib/server-theme";
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
    const syncThemeRoots = () => {
      document.querySelectorAll("[data-theme-root]").forEach((themeRoot) => {
        themeRoot.dataset.theme = theme;
        themeRoot.classList.toggle("dark", theme === "dark");
      });
    };
    syncThemeRoots();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", syncThemeRoots, { once: true });
    }
    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
    }
    document.cookie = themeStorageKey + "=" + theme + "; path=/; max-age=${themeCookieMaxAgeSeconds}; SameSite=Lax";
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
        <Script
          id="classhero-theme-init"
          strategy="beforeInteractive"
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
        <Providers>{children}</Providers>
        <AppToaster />
      </body>
    </html>
  );
}
