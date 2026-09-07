"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminSourceDocumentOcrPreviewContent } from "@/features/admin/courses/api/admin-course-documents-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export function useAdminSourceDocumentOcrPreviewContent(
  sourceDocumentId: string | null,
  artifactVersion: string | null,
  enabled = true,
) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    queryKey: [
      "admin",
      "source-document-ocr-preview-content",
      session?.user.id ?? "guest",
      sourceDocumentId,
      artifactVersion,
    ],
    queryFn: () =>
      getAdminSourceDocumentOcrPreviewContent(
        sourceDocumentId ?? "",
        session?.accessToken ?? "",
      ),
    enabled: enabled && Boolean(sourceDocumentId && session?.accessToken),
    staleTime: 10 * 60 * 1_000,
  });
}
