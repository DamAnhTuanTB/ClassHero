"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminCatalogOptions } from "@/features/admin/domains/api/admin-domains-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export function useAdminCatalogOptions() {
  const session = useAuthSessionStore((state) => state.session);
  const isHydrated = useAuthSessionStore((state) => state.isHydrated);
  return useQuery({ queryKey: ["admin-course-catalog-options", session?.user.id], queryFn: () => getAdminCatalogOptions(session?.accessToken ?? ""), enabled: isHydrated && Boolean(session?.accessToken), staleTime: 60_000 });
}
