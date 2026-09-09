"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  generateAdminLessonContent,
  getAdminAiGenerationPanel,
  getAdminAiJob,
  getAdminLessonSummary,
  previewAdminLessonSummaryPrompt,
  previewAdminQuizPrompt,
  previewAdminFlashcardPrompt,
  upsertAdminLessonSummary,
  updateAdminLessonSummaryPhaseOneBlocks,
  deleteAdminLessonSummary,
  applyAdminStemFigureDraft,
  compileAdminStemFigureDraft,
  createNewAdminStemFigure,
  previewCreateNewAdminStemFigure,
  deleteAdminStemFigure,
  getAdminStemFigures,
  ensureAdminStemFigureForBlock,
  replaceAdminStemFigure,
  retryAdminStemFigure,
  promoteAdminStemFigureSourceCrop,
  applyAdminStemFigureRasterEdit,
  previewAdminStemFigureRasterEdit,
} from "@/features/admin/ai-generation/api/admin-ai-generation-api";
import type {
  AdminAiGenerationPanelData,
  AdminAiGenerationPayload,
  AdminAiGenerationType,
  AdminAiJobStatus,
  AdminLessonSummaryContent,
  AdminLessonSummaryReviewStatus,
  AdminSummaryGenerationPayload,
  AdminQuizGenerationPayload,
  AdminFlashcardGenerationPayload,
  AdminStemFigure,
  AdminStemFigureCreateAiInput,
  AdminStemFigureRasterEditInput,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type { LessonSummaryPhaseOneLayoutOperation } from "@/features/admin/ai-generation/utils/lesson-summary-phase-one-preview";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { getUsageEvents } from "@/features/admin/ai-settings/api/provider-operations-api";

export const adminAiGenerationQueryKeys = {
  panel: (lessonId: string) =>
    ["admin", "lessons", lessonId, "ai-generation-panel"] as const,
  job: (jobId: string) => ["admin", "ai-jobs", jobId] as const,
  summary: (lessonId: string) => ["admin", "lessons", lessonId, "summary"] as const,
  stemFigures: (lessonId: string) =>
    ["admin", "lessons", lessonId, "stem-figures"] as const,
  usageEvents: (aiGenerationId: string, page: number) =>
    ["admin", "ai-generations", aiGenerationId, "usage-events", page] as const,
};

export function useAdminAiGenerationPanel(
  lessonId: string,
  options?: { pollUsage?: boolean },
) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.panel(lessonId),
    queryFn: () => getAdminAiGenerationPanel(lessonId, session?.accessToken ?? ""),
    enabled: Boolean(lessonId && session?.accessToken),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      if (options?.pollUsage) return 1_500;
      return data.documents.some((doc) => doc.status === "PROCESSING") ? 5_000 : false;
    },
    refetchIntervalInBackground: false,
  });
}

export function useAdminAiGenerationUsageEvents(
  aiGenerationId: string | null,
  page: number,
  enabled: boolean,
) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.usageEvents(aiGenerationId ?? "idle", page),
    queryFn: () =>
      getUsageEvents(session?.accessToken ?? "", page, {
        aiGenerationId: aiGenerationId ?? undefined,
        pageSize: 20,
      }),
    enabled: enabled && Boolean(aiGenerationId && session?.accessToken),
    staleTime: 2_000,
    refetchInterval: enabled ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function useAdminStemFigures(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
    queryFn: () => getAdminStemFigures(lessonId, session?.accessToken ?? ""),
    enabled: Boolean(lessonId && session?.accessToken),
    staleTime: 2_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) =>
      query.state.data?.some((figure) =>
        ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status),
      )
        ? 1_500
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useEnsureAdminStemFigureForBlock(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: (input: { blockPath: string; figureIndex?: number }) =>
      ensureAdminStemFigureForBlock(lessonId, input, session?.accessToken ?? ""),
  });
}

function useInvalidateStemFigures(lessonId: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.summary(lessonId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminAiGenerationQueryKeys.panel(lessonId),
      }),
    ]);
  };
}

export function useRetryAdminStemFigure(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const invalidate = useInvalidateStemFigures(lessonId);
  return useMutation({
    mutationFn: (figure: AdminStemFigure) =>
      retryAdminStemFigure(lessonId, figure, session?.accessToken ?? ""),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminStemFigure(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const invalidate = useInvalidateStemFigures(lessonId);
  return useMutation({
    mutationFn: (figure: AdminStemFigure) =>
      deleteAdminStemFigure(lessonId, figure, session?.accessToken ?? ""),
    onSuccess: invalidate,
  });
}

export function useCreateNewAdminStemFigure(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminStemFigureCreateAiInput) =>
      createNewAdminStemFigure(lessonId, input, session?.accessToken ?? ""),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        }),
      ]);
    },
  });
}

export function usePreviewCreateNewAdminStemFigure(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: (input: AdminStemFigureCreateAiInput) =>
      previewCreateNewAdminStemFigure(lessonId, input, session?.accessToken ?? ""),
  });
}

export function useReplaceAdminStemFigure(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const invalidate = useInvalidateStemFigures(lessonId);
  return useMutation({
    mutationFn: (input: { figure: AdminStemFigure; file: File }) =>
      replaceAdminStemFigure(
        lessonId,
        input.figure,
        input.file,
        session?.accessToken ?? "",
      ),
    onSuccess: invalidate,
  });
}

export function useAdminStemFigureSourceCrop(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const invalidate = useInvalidateStemFigures(lessonId);
  return useMutation({
    mutationFn: (input: {
      figure: AdminStemFigure;
      sourceObjectKey: string;
      enhance: boolean;
    }) =>
      promoteAdminStemFigureSourceCrop(
        lessonId,
        input.figure,
        input.sourceObjectKey,
        input.enhance,
        session?.accessToken ?? "",
      ),
    onSuccess: invalidate,
  });
}

export function usePreviewAdminStemFigureRasterEdit(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: (input: AdminStemFigureRasterEditInput) =>
      previewAdminStemFigureRasterEdit(lessonId, input, session?.accessToken ?? ""),
  });
}

export function useApplyAdminStemFigureRasterEdit(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const invalidate = useInvalidateStemFigures(lessonId);
  return useMutation({
    mutationFn: (input: AdminStemFigureRasterEditInput) =>
      applyAdminStemFigureRasterEdit(lessonId, input, session?.accessToken ?? ""),
    onSuccess: invalidate,
  });
}

export function useCompileAdminStemFigureDraft(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: ({
      figureId,
      ...body
    }: {
      figureId: string;
      baseRevisionId: string | null;
      sourceVersion: number;
      latexSource: string;
      altText: string;
      caption: string | null;
    }) =>
      compileAdminStemFigureDraft(lessonId, figureId, body, session?.accessToken ?? ""),
  });
}

export function useApplyAdminStemFigureDraft(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const invalidate = useInvalidateStemFigures(lessonId);
  return useMutation({
    mutationFn: ({
      figureId,
      ...body
    }: {
      figureId: string;
      baseRevisionId: string | null;
      revisionId: string;
      sourceVersion: number;
      altText: string;
      caption: string | null;
    }) => applyAdminStemFigureDraft(lessonId, figureId, body, session?.accessToken ?? ""),
    onSuccess: invalidate,
  });
}

export function useAdminAiJob(jobId: string | null, enabled: boolean) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.job(jobId ?? "idle"),
    queryFn: () => getAdminAiJob(jobId ?? "", session?.accessToken ?? ""),
    enabled: enabled && Boolean(jobId && session?.accessToken),
    refetchOnWindowFocus: false,
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
  const panelQueryKey = adminAiGenerationQueryKeys.panel(lessonId);
  return useMutation({
    mutationFn: (payload: AdminAiGenerationPayload) =>
      generateAdminLessonContent(lessonId, payload, session?.accessToken ?? ""),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: panelQueryKey });
      const previousPanel =
        queryClient.getQueryData<AdminAiGenerationPanelData>(panelQueryKey);
      queryClient.setQueryData<AdminAiGenerationPanelData>(panelQueryKey, (panel) =>
        setPanelGenerationPending(panel, payload.type, null, "QUEUED"),
      );
      return { previousPanel };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousPanel) {
        queryClient.setQueryData(panelQueryKey, context.previousPanel);
      }
    },
    onSuccess: (job, payload) => {
      queryClient.setQueryData<AdminAiGenerationPanelData>(panelQueryKey, (panel) =>
        setPanelGenerationPending(panel, payload.type, job.jobId, job.status),
      );
      void queryClient.invalidateQueries({ queryKey: panelQueryKey });
    },
  });
}

function setPanelGenerationPending(
  panel: AdminAiGenerationPanelData | undefined,
  type: AdminAiGenerationType,
  jobId: string | null,
  status: AdminAiJobStatus,
) {
  const currentJob = panel?.jobs[type];
  if (!panel || !currentJob) return panel;

  const now = new Date().toISOString();
  return {
    ...panel,
    jobs: {
      ...panel.jobs,
      [type]: {
        ...currentJob,
        jobId,
        status,
        error: null,
        errorDetails: null,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        updatedAt: now,
      },
    },
  };
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

export function usePreviewAdminFlashcardPrompt(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  return useMutation({
    mutationFn: (payload: AdminFlashcardGenerationPayload) =>
      previewAdminFlashcardPrompt(
        lessonId,
        payload,
        session?.accessToken ?? "",
      ),
  });
}

export function useAdminLessonSummary(lessonId: string, enabled = true) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: adminAiGenerationQueryKeys.summary(lessonId),
    queryFn: () => getAdminLessonSummary(lessonId, session?.accessToken ?? ""),
    enabled: enabled && Boolean(lessonId && session?.accessToken),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpsertAdminLessonSummary(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data:
        | {
            contentJson: AdminLessonSummaryContent;
            source: "ADMIN" | "AI";
            reviewStatus: AdminLessonSummaryReviewStatus;
          }
        | {
            phaseOneBlockJsonByPath: Record<string, unknown>;
            phaseOneLayoutOperations?: LessonSummaryPhaseOneLayoutOperation[];
            source: "ADMIN" | "AI";
            reviewStatus: AdminLessonSummaryReviewStatus;
          },
    ) =>
      "phaseOneBlockJsonByPath" in data
        ? updateAdminLessonSummaryPhaseOneBlocks(
            lessonId,
            data,
            session?.accessToken ?? "",
          )
        : upsertAdminLessonSummary(lessonId, data, session?.accessToken ?? ""),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.summary(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
        }),
      ]);
    },
  });
}

export function useDeleteAdminLessonSummary(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAdminLessonSummary(lessonId, session?.accessToken ?? ""),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.summary(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
        }),
      ]);
    },
  });
}
