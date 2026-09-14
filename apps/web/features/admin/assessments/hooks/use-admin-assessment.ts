import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { hasActiveAdminFigure } from "@/lib/admin-figure-status";
import {
  createAdminAssessmentQuestion,
  createAdminAssessmentSet,
  deleteAdminAssessmentQuestion,
  deleteAdminAssessmentSet,
  getAdminAssessmentQuestions,
  getAdminAssessmentSets,
  reviewAdminAssessmentQuestion,
  reviewAllPendingAdminAssessmentQuestions,
  updateAdminAssessmentQuestion,
  updateAdminAssessmentGenerationQuestionJson,
  updateAdminAssessmentSet,
} from "@/features/admin/assessments/api/admin-assessment-api";
import type {
  AdminAssessmentInitialData,
  AdminAssessmentKind,
  AdminAssessmentQuestion,
  AdminAssessmentQuestionPayload,
  AdminAssessmentQuestionUpdatePayload,
  AdminAssessmentSet,
} from "@/features/admin/assessments/types/admin-assessment.types";
import { useAuthenticatedRealtime } from "@/components/common/realtime/authenticated-realtime-provider";

export const adminAssessmentQueryKeys = {
  all: ["admin", "assessment"] as const,
  sets: (kind: AdminAssessmentKind, lessonId: string) =>
    [...adminAssessmentQueryKeys.all, kind, "sets", lessonId] as const,
  setsForUser: (kind: AdminAssessmentKind, lessonId: string, userId?: string) =>
    [...adminAssessmentQueryKeys.sets(kind, lessonId), userId ?? "guest"] as const,
  questions: (kind: AdminAssessmentKind, setId: string) =>
    [...adminAssessmentQueryKeys.all, kind, "questions", setId] as const,
  questionsForUser: (kind: AdminAssessmentKind, setId: string, userId?: string) =>
    [...adminAssessmentQueryKeys.questions(kind, setId), userId ?? "guest"] as const,
};

export function getAdminAssessmentSetsQueryOptions({
  accessToken,
  kind,
  lessonId,
  userId,
}: {
  accessToken: string;
  kind: AdminAssessmentKind;
  lessonId: string;
  userId?: string;
}) {
  return {
    queryKey: adminAssessmentQueryKeys.setsForUser(kind, lessonId, userId),
    queryFn: () => getAdminAssessmentSets(kind, lessonId, accessToken),
    staleTime: 30_000,
  };
}

export function getAdminAssessmentQuestionsQueryOptions({
  accessToken,
  kind,
  setId,
  userId,
}: {
  accessToken: string;
  kind: AdminAssessmentKind;
  setId: string;
  userId?: string;
}) {
  return {
    queryKey: adminAssessmentQueryKeys.questionsForUser(kind, setId, userId),
    queryFn: () => getAdminAssessmentQuestions(kind, setId, accessToken),
    staleTime: 30_000,
  };
}

export function useAdminAssessmentSets(
  kind: AdminAssessmentKind,
  lessonId: string,
  enabled = true,
  initialData?: AdminAssessmentInitialData["sets"],
) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    ...getAdminAssessmentSetsQueryOptions({
      accessToken: session?.accessToken ?? "",
      kind,
      lessonId,
      userId: session?.user.id,
    }),
    enabled: enabled && Boolean(session?.accessToken) && Boolean(lessonId),
    initialData: initialData as AdminAssessmentSet[] | undefined,
    staleTime: 30_000,
  });
}

export function useAdminAssessmentSetMutations(
  kind: AdminAssessmentKind,
  lessonId: string,
) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: adminAssessmentQueryKeys.sets(kind, lessonId),
    });
  return {
    createSet: useMutation({
      mutationFn: (data: { title: string; durationSeconds?: number }) => {
        if (!session?.accessToken) throw new Error("No token");
        return createAdminAssessmentSet(kind, lessonId, data, session.accessToken);
      },
      onSuccess: (createdSet) => {
        queryClient.setQueryData<AdminAssessmentSet[]>(
          adminAssessmentQueryKeys.setsForUser(kind, lessonId, session?.user.id),
          (current) => [...(current ?? []), createdSet],
        );
        void invalidate();
      },
    }),
    updateSet: useMutation({
      mutationFn: ({
        setId,
        data,
      }: {
        setId: string;
        data: { title: string; durationSeconds?: number };
      }) => {
        if (!session?.accessToken) throw new Error("No token");
        return updateAdminAssessmentSet(kind, setId, data, session.accessToken);
      },
      onSuccess: invalidate,
    }),
    deleteSet: useMutation({
      mutationFn: (setId: string) => {
        if (!session?.accessToken) throw new Error("No token");
        return deleteAdminAssessmentSet(kind, setId, session.accessToken);
      },
      onSuccess: invalidate,
    }),
  };
}

export function useAdminAssessmentQuestions(
  kind: AdminAssessmentKind,
  setId: string,
  enabled = true,
  initialData?: AdminAssessmentQuestion[],
) {
  const session = useAuthSessionStore((state) => state.session);
  const { status: realtimeStatus } = useAuthenticatedRealtime();
  return useQuery({
    ...getAdminAssessmentQuestionsQueryOptions({
      accessToken: session?.accessToken ?? "",
      kind,
      setId,
      userId: session?.user.id,
    }),
    enabled: enabled && Boolean(session?.accessToken) && Boolean(setId),
    initialData,
    staleTime: 30_000,
    refetchInterval: (query) =>
      hasActiveAdminFigure(
        query.state.data?.flatMap((question) => question.figures) ?? [],
      )
        ? realtimeStatus === "connected"
          ? 60_000
          : 3_000
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useAdminAssessmentQuestionMutations(
  kind: AdminAssessmentKind,
  setId: string,
  lessonId: string,
) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminAssessmentQueryKeys.questions(kind, setId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminAssessmentQueryKeys.sets(kind, lessonId),
      }),
    ]);
  return {
    createQuestion: useMutation({
      mutationFn: (data: AdminAssessmentQuestionPayload) => {
        if (!session?.accessToken) throw new Error("No token");
        return createAdminAssessmentQuestion(kind, setId, data, session.accessToken);
      },
      onSuccess: invalidate,
    }),
    updateQuestion: useMutation({
      mutationFn: ({
        questionId,
        data,
      }: {
        questionId: string;
        data: AdminAssessmentQuestionUpdatePayload;
      }) => {
        if (!session?.accessToken) throw new Error("No token");
        return updateAdminAssessmentQuestion(kind, questionId, data, session.accessToken);
      },
      onSuccess: invalidate,
    }),
    updateGenerationJson: useMutation({
      mutationFn: ({
        questionId,
        generationQuestionJson,
      }: {
        questionId: string;
        generationQuestionJson: Record<string, unknown>;
      }) => {
        if (!session?.accessToken) throw new Error("No token");
        return updateAdminAssessmentGenerationQuestionJson(
          kind,
          questionId,
          generationQuestionJson,
          session.accessToken,
        );
      },
      onSuccess: invalidate,
    }),
    reviewQuestion: useMutation({
      mutationFn: ({
        questionId,
        reviewStatus,
      }: {
        questionId: string;
        reviewStatus: "APPROVED" | "NEEDS_REVIEW";
      }) => {
        if (!session?.accessToken) throw new Error("No token");
        return reviewAdminAssessmentQuestion(
          kind,
          questionId,
          reviewStatus,
          session.accessToken,
        );
      },
      onSuccess: invalidate,
    }),
    reviewAllQuestions: useMutation({
      mutationFn: () => {
        if (!session?.accessToken) throw new Error("No token");
        return reviewAllPendingAdminAssessmentQuestions(kind, setId, session.accessToken);
      },
      onSuccess: invalidate,
    }),
    deleteQuestion: useMutation({
      mutationFn: (questionId: string) => {
        if (!session?.accessToken) throw new Error("No token");
        return deleteAdminAssessmentQuestion(kind, questionId, session.accessToken);
      },
      onSuccess: invalidate,
    }),
  };
}
