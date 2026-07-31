import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  getAdminQuizSets,
  createAdminQuizSet,
  deleteAdminQuizSet,
  getAdminQuizQuestions,
  createAdminQuizQuestion,
  deleteAdminQuizQuestion,
  updateAdminQuizQuestion,
  updateAdminQuizSet,
  type AdminQuizQuestion,
  type AdminQuizQuestionPayload,
  type AdminQuizSet,
  type QuizDifficulty,
} from "@/features/admin/quiz/api/admin-quiz-api";

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
    mutationFn: async (data: { title: string; difficulty?: QuizDifficulty }) => {
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
    mutationFn: async ({
      data,
      setId,
    }: {
      data: { title: string; difficulty?: QuizDifficulty };
      setId: string;
    }) => {
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
  });
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
      data: AdminQuizQuestionPayload;
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

  const deleteMutation = useMutation({
    mutationFn: async (questionId: string) => {
      if (!session?.accessToken) throw new Error("No token");
      return deleteAdminQuizQuestion(questionId, session.accessToken);
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

  return {
    createQuestion: createMutation,
    updateQuestion: updateMutation,
    deleteQuestion: deleteMutation,
  };
}
