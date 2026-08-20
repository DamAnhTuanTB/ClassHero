"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminFileSignedUrl } from "@/features/admin/courses/api/admin-course-documents-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export function useAdminFileAccessUrl(fileId: string | null, enabled = true) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    queryKey: ["admin", "file-access-url", session?.user.id ?? "guest", fileId],
    queryFn: () => getAdminFileSignedUrl(fileId ?? "", session?.accessToken ?? ""),
    enabled: enabled && Boolean(fileId && session?.accessToken),
    staleTime: 10 * 60 * 1_000,
  });
}
