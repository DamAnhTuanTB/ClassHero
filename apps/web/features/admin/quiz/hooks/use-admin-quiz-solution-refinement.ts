import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  type AdminQuizSolutionMode,
  getAdminQuizSolutionRefinementJob,
  previewAdminQuizSolutionRefinement,
  queueAdminQuizSolutionRefinement,
} from "@/features/admin/quiz/api/admin-quiz-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { adminAssessmentQueryKeys } from "@/features/admin/assessments/hooks/use-admin-assessment";

export function useAdminQuizSolutionRefinement(
  setId: string,
  assessmentKind: "quiz" | "test",
) {
  const session = useAuthSessionStore((state) => state.session);
  const token = session?.accessToken ?? "";
  const queryClient = useQueryClient();

  const preview = useMutation({
    mutationFn: (input: {
      questionId: string;
      mode: AdminQuizSolutionMode;
      adminInstructions: string;
      includeCurrentSolutionAsRejected: boolean;
    }) =>
      previewAdminQuizSolutionRefinement(
        input.questionId,
        {
          mode: input.mode,
          adminInstructions: input.adminInstructions || undefined,
          includeCurrentSolutionAsRejected: input.includeCurrentSolutionAsRejected,
        },
        token,
        assessmentKind,
      ),
  });
  const queue = useMutation({
    mutationFn: (input: {
      questionId: string;
      mode: AdminQuizSolutionMode;
      adminInstructions: string;
      includeCurrentSolutionAsRejected: boolean;
      requestHash: string;
    }) =>
      queueAdminQuizSolutionRefinement(
        input.questionId,
        {
          mode: input.mode,
          adminInstructions: input.adminInstructions || undefined,
          includeCurrentSolutionAsRejected: input.includeCurrentSolutionAsRejected,
          requestHash: input.requestHash,
        },
        token,
        assessmentKind,
      ),
  });
  const invalidateQuestion = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: adminAssessmentQueryKeys.questions(assessmentKind, setId),
      }),
    [assessmentKind, queryClient, setId],
  );

  return { invalidateQuestion, preview, queue };
}

export function useAdminQuizSolutionRefinementJob(jobId: string | null) {
  const session = useAuthSessionStore((state) => state.session);
  return useQuery({
    queryKey: ["admin", "quiz", "solution-refinement-job", jobId ?? "idle"],
    queryFn: () =>
      getAdminQuizSolutionRefinementJob(jobId ?? "", session?.accessToken ?? ""),
    enabled: Boolean(jobId && session?.accessToken),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "QUEUED" || status === "RUNNING" ? 1_500 : false;
    },
    staleTime: 0,
  });
}
