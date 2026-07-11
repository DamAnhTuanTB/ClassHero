"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { useThemeStore } from "@/lib/theme-store";

export function Providers({ children }: { children: ReactNode }) {
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  useLayoutEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
