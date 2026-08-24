import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  getAdminQuizSets,
  createAdminQuizSet,
  deleteAdminQuizSet,
  getAdminQuizQuestions,
  createAdminQuizQuestion,
  deleteAdminQuizQuestion,
  reviewAllPendingAdminQuizQuestions,
  reviewAdminQuizQuestion,
  updateAdminQuizQuestion,
  updateAdminQuizGenerationQuestionJson,
  updateAdminQuizSet,
  uploadAdminQuizImage,
  attachAdminQuizFigureUpload,
  applyAdminQuizFigureDraft,
  compileAdminQuizFigureDraft,
  createNewAdminQuizFigureWithAi,
  previewNewAdminQuizFigureWithAi,
  deleteAdminQuizFigure,
  type AdminQuizQuestion,
  type AdminQuizFigure,
  type AdminQuizFigureCreateAiInput,
  updateAdminQuizFigureCaption,
  type AdminQuizQuestionPayload,
  type AdminQuizQuestionUpdatePayload,
  type AdminQuizSet,
} from "@/features/admin/quiz/api/admin-quiz-api";

const ACTIVE_QUIZ_FIGURE_STATUSES = new Set<AdminQuizFigure["status"]>([
  "QUEUED",
  "RENDERING",
  "REPAIRING",
]);

const adminQuizQueryKeys = {
  all: ["admin", "quiz"] as const,
  sets: (lessonId: string) => [...adminQuizQueryKeys.all, "sets", lessonId] as const,
  setsForUser: (lessonId: string, userId?: string) =>
    [...adminQuizQueryKeys.sets(lessonId), userId ?? "guest"] as const,
  questions: (setId: string) => [...adminQuizQueryKeys.all, "questions", setId] as const,
  questionsForUser: (setId: string, userId?: string) =>
    [...adminQuizQueryKeys.questions(setId), userId ?? "guest"] as const,
};

export function getAdminQuizSetsQueryOptions({
  accessToken,
  lessonId,
  userId,
}: {
  accessToken: string;
  lessonId: string;
  userId?: string;
}) {
  return {
    queryKey: adminQuizQueryKeys.setsForUser(lessonId, userId),
    queryFn: () => getAdminQuizSets(lessonId, accessToken),
    staleTime: 30_000,
  };
}

export function getAdminQuizQuestionsQueryOptions({
  accessToken,
  setId,
  userId,
}: {
  accessToken: string;
  setId: string;
  userId?: string;
}) {
  return {
    queryKey: adminQuizQueryKeys.questionsForUser(setId, userId),
    queryFn: () => getAdminQuizQuestions(setId, accessToken),
    staleTime: 30_000,
  };
}

export function useAdminQuizSets(
  lessonId: string,
  enabled = true,
  initialData?: AdminQuizSet[],
) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    ...getAdminQuizSetsQueryOptions({
      accessToken: session?.accessToken ?? "",
      lessonId,
      userId: session?.user.id,
    }),
    enabled: enabled && !!session?.accessToken && !!lessonId,
    initialData,
  });
}

export function useAdminQuizSetMutations(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { title: string }) => {
      if (!session?.accessToken) throw new Error("No token");
      return createAdminQuizSet(lessonId, data, session.accessToken);
    },
    onSuccess: (createdSet) => {
      const cachedSet: AdminQuizSet = {
        ...createdSet,
        _count: createdSet._count ?? { questions: createdSet.questionCount },
      };
      queryClient.setQueryData<AdminQuizSet[]>(
        adminQuizQueryKeys.setsForUser(lessonId, session?.user.id),
        (currentSets) => [...(currentSets ?? []), cachedSet],
      );
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.sets(lessonId),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (setId: string) => {
      if (!session?.accessToken) throw new Error("No token");
      return deleteAdminQuizSet(setId, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.sets(lessonId),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ data, setId }: { data: { title: string }; setId: string }) => {
      if (!session?.accessToken) throw new Error("No token");
      return updateAdminQuizSet(setId, data, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.sets(lessonId),
      });
    },
  });

  return {
    createSet: createMutation,
    deleteSet: deleteMutation,
    updateSet: updateMutation,
  };
}

export function useAdminQuizQuestions(
  setId: string,
  enabled = true,
  initialData?: AdminQuizQuestion[],
) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    ...getAdminQuizQuestionsQueryOptions({
      accessToken: session?.accessToken ?? "",
      setId,
      userId: session?.user.id,
    }),
    enabled: enabled && !!session?.accessToken && !!setId,
    initialData,
    refetchInterval: (query) =>
      hasActiveQuizFigureJobs(query.state.data) ? 2_000 : false,
    refetchIntervalInBackground: false,
  });
}

export function hasActiveQuizFigureJobs(questions?: AdminQuizQuestion[]) {
  return Boolean(
    questions?.some((question) =>
      question.figures?.some((figure) => ACTIVE_QUIZ_FIGURE_STATUSES.has(figure.status)),
    ),
  );
}

export function useAdminQuizQuestionMutations(setId: string, lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: AdminQuizQuestionPayload) => {
      if (!session?.accessToken) throw new Error("No token");
      return createAdminQuizQuestion(setId, data, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.questions(setId),
      });
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.sets(lessonId),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      questionId,
      data,
    }: {
      questionId: string;
      data: AdminQuizQuestionUpdatePayload;
    }) => {
      if (!session?.accessToken) throw new Error("No token");
      return updateAdminQuizQuestion(questionId, data, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.questions(setId),
      });
    },
  });

  const updateGenerationJsonMutation = useMutation({
    mutationFn: async ({
      questionId,
      generationQuestionJson,
    }: {
      questionId: string;
      generationQuestionJson: Record<string, unknown>;
    }) => {
      if (!session?.accessToken) throw new Error("No token");
      return updateAdminQuizGenerationQuestionJson(
        questionId,
        generationQuestionJson,
        session.accessToken,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.questions(setId),
      });
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.sets(lessonId),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (questionId: string) => {
      if (!session?.accessToken) throw new Error("No token");
      return deleteAdminQuizQuestion(questionId, session.accessToken);
    },
    onSuccess: async (_result, questionId) => {
      queryClient.setQueriesData<AdminQuizQuestion[]>(
        { queryKey: adminQuizQueryKeys.questions(setId) },
        (currentQuestions) =>
          currentQuestions?.filter((question) => question.id !== questionId),
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQuizQueryKeys.questions(setId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminQuizQueryKeys.sets(lessonId),
        }),
      ]);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (questionId: string) => {
      if (!session?.accessToken) throw new Error("No token");
      return reviewAdminQuizQuestion(questionId, session.accessToken);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQuizQueryKeys.questions(setId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminQuizQueryKeys.sets(lessonId),
        }),
      ]);
    },
  });

  const reviewAllMutation = useMutation({
    mutationFn: async () => {
      if (!session?.accessToken) throw new Error("No token");
      return reviewAllPendingAdminQuizQuestions(setId, session.accessToken);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQuizQueryKeys.questions(setId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminQuizQueryKeys.sets(lessonId),
        }),
      ]);
    },
  });

  return {
    createQuestion: createMutation,
    updateQuestion: updateMutation,
    updateGenerationJson: updateGenerationJsonMutation,
    deleteQuestion: deleteMutation,
    reviewQuestion: reviewMutation,
    reviewAllQuestions: reviewAllMutation,
  };
}

export function useAdminQuizFigureUpload(setId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      questionId: string;
      role: "QUESTION" | "SOLUTION";
      file: File;
      altText: string;
      caption?: string;
    }) => {
      if (!session?.accessToken) throw new Error("No token");
      const uploaded = await uploadAdminQuizImage(input.file, session.accessToken);
      return attachAdminQuizFigureUpload(
        input.questionId,
        {
          role: input.role,
          fileId: uploaded.fileId,
          altText: input.altText,
          caption: input.caption,
        },
        session.accessToken,
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: adminQuizQueryKeys.questions(setId),
      }),
  });
}

export function useAdminQuizFigureMutations(setId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const token = session?.accessToken ?? "";
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: adminQuizQueryKeys.questions(setId),
    });

  const compileDraft = useMutation({
    mutationFn: (input: {
      questionId: string;
      figure: AdminQuizFigure;
      latexSource: string;
      altText: string;
      caption: string | null;
    }) => {
      const revision = input.figure.currentRevision;
      return compileAdminQuizFigureDraft(
        input.questionId,
        input.figure.id,
        {
          baseRevisionId: revision?.id ?? null,
          sourceVersion: revision?.sourceVersion ?? 1,
          latexSource: input.latexSource,
          altText: input.altText,
          caption: input.caption,
        },
        token,
      );
    },
  });
  const applyDraft = useMutation({
    mutationFn: (input: {
      questionId: string;
      figure: AdminQuizFigure;
      revisionId: string;
      sourceVersion: number;
    }) =>
      applyAdminQuizFigureDraft(
        input.questionId,
        input.figure.id,
        {
          baseRevisionId: input.figure.currentRevision?.id ?? null,
          revisionId: input.revisionId,
          sourceVersion: input.sourceVersion,
        },
        token,
      ),
    onSuccess: invalidate,
  });
  const createWithAi = useMutation({
    mutationFn: (
      input: {
        questionId: string;
        figure: AdminQuizFigure;
      } & AdminQuizFigureCreateAiInput,
    ) =>
      createNewAdminQuizFigureWithAi(
        input.questionId,
        input.figure.id,
        {
          baseRevisionId: input.figure.currentRevision?.id ?? null,
          mode: input.mode,
          adminInstructions: input.adminInstructions,
          model: input.model,
          temperature: input.temperature,
          reasoningEffort: input.reasoningEffort,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
        },
        token,
      ),
    onSuccess: invalidate,
  });
  const previewWithAi = useMutation({
    mutationFn: (
      input: {
        questionId: string;
        figure: AdminQuizFigure;
      } & AdminQuizFigureCreateAiInput,
    ) =>
      previewNewAdminQuizFigureWithAi(
        input.questionId,
        input.figure.id,
        {
          baseRevisionId: input.figure.currentRevision?.id ?? null,
          mode: input.mode,
          adminInstructions: input.adminInstructions,
          model: input.model,
          temperature: input.temperature,
          reasoningEffort: input.reasoningEffort,
          systemPrompt: input.systemPrompt,
          userPrompt: input.userPrompt,
        },
        token,
      ),
  });
  const updateCaption = useMutation({
    mutationFn: (input: {
      questionId: string;
      figure: AdminQuizFigure;
      caption: string | null;
    }) =>
      updateAdminQuizFigureCaption(
        input.questionId,
        input.figure.id,
        {
          baseRevisionId: input.figure.currentRevision?.id ?? null,
          caption: input.caption,
        },
        token,
      ),
    onSuccess: invalidate,
  });
  const deleteFigure = useMutation({
    mutationFn: (input: { questionId: string; figure: AdminQuizFigure }) =>
      deleteAdminQuizFigure(
        input.questionId,
        input.figure.id,
        { baseRevisionId: input.figure.currentRevision?.id ?? null },
        token,
      ),
    onSuccess: invalidate,
  });

  return {
    applyDraft,
    compileDraft,
    createWithAi,
    previewWithAi,
    deleteFigure,
    updateCaption,
  };
}
