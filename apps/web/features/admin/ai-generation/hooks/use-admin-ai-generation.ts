"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateAdminLessonContent,
  getAdminAiGenerationPanel,
  getAdminAiJob,
  getAdminLessonSummary,
  previewAdminLessonSummaryPrompt,
  previewAdminQuizPrompt,
  upsertAdminLessonSummary,
} from "@/features/admin/ai-generation/api/admin-ai-generation-api";
import type {
  AdminAiGenerationPayload,
  AdminLessonSummaryContent,
  AdminLessonSummaryReviewStatus,
  AdminSummaryGenerationPayload,
  AdminQuizGenerationPayload,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export const adminAiGenerationQueryKeys = {
  panel: (lessonId: string) =>
    ["admin", "lessons", lessonId, "ai-generation-panel"] as const,
  job: (jobId: string) => ["admin", "ai-jobs", jobId] as const,
  summary: (lessonId: string) => ["admin", "lessons", lessonId, "summary"] as const,
};

export function useAdminAiGenerationPanel(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.panel(lessonId),
    queryFn: () => getAdminAiGenerationPanel(lessonId, session?.accessToken ?? ""),
    enabled: Boolean(lessonId && session?.accessToken),
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.documents.some((doc) => doc.status === "PROCESSING") ? 5_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

export function useAdminAiJob(jobId: string | null, enabled: boolean) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.job(jobId ?? "idle"),
    queryFn: () => getAdminAiJob(jobId ?? "", session?.accessToken ?? ""),
    enabled: enabled && Boolean(jobId && session?.accessToken),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 1_500 : false;
    },
    staleTime: 0,
  });
}

export function useGenerateAdminLessonContent(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminAiGenerationPayload) =>
      generateAdminLessonContent(lessonId, payload, session?.accessToken ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
      });
    },
  });
}

export function usePreviewAdminLessonSummaryPrompt(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: (payload: AdminSummaryGenerationPayload) =>
      previewAdminLessonSummaryPrompt(lessonId, payload, session?.accessToken ?? ""),
  });
}

export function usePreviewAdminQuizPrompt(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: (payload: AdminQuizGenerationPayload) =>
      previewAdminQuizPrompt(lessonId, payload, session?.accessToken ?? ""),
  });
}

export function useAdminLessonSummary(lessonId: string, enabled = true) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.summary(lessonId),
    queryFn: () => getAdminLessonSummary(lessonId, session?.accessToken ?? ""),
    enabled: enabled && Boolean(lessonId && session?.accessToken),
    staleTime: 15_000,
  });
}

export function useUpsertAdminLessonSummary(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      contentJson: AdminLessonSummaryContent;
      source: "ADMIN" | "AI";
      reviewStatus: AdminLessonSummaryReviewStatus;
    }) => upsertAdminLessonSummary(lessonId, data, session?.accessToken ?? ""),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.summary(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        }),
      ]);
    },
  });
}
