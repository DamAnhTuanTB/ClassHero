"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { clearExpiredAuthSession, hydrateAuthSession } from "@/features/auth/session";
import { useThemeStore } from "@/lib/theme-store";

export function Providers({ children }: { children: ReactNode }) {
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error) => {
            clearExpiredAuthSession(error);
          },
        }),
        queryCache: new QueryCache({
          onError: (error) => {
            clearExpiredAuthSession(error);
          },
        }),
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
    hydrateAuthSession();
  }, [hydrateTheme]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
