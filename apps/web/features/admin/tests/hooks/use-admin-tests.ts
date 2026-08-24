import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  createAdminTestQuestion,
  createAdminTestSet,
  deleteAdminTestQuestion,
  deleteAdminTestSet,
  getAdminTestQuestions,
  getAdminTestSets,
  reviewAdminTestQuestion,
  updateAdminTestQuestion,
  updateAdminTestSet,
  type AdminTestQuestionPayload,
  type AdminTestSet,
  type AdminTestSetPayload,
} from "@/features/admin/tests/api/admin-tests-api";

const adminTestQueryKeys = {
  all: ["admin", "tests"] as const,
  sets: (lessonId: string) => [...adminTestQueryKeys.all, "sets", lessonId] as const,
  setsForUser: (lessonId: string, userId?: string) =>
    [...adminTestQueryKeys.sets(lessonId), userId ?? "guest"] as const,
  questions: (setId: string) => [...adminTestQueryKeys.all, "questions", setId] as const,
  questionsForUser: (setId: string, userId?: string) =>
    [...adminTestQueryKeys.questions(setId), userId ?? "guest"] as const,
};

export function getAdminTestSetsQueryOptions({
  accessToken,
  lessonId,
  userId,
}: {
  accessToken: string;
  lessonId: string;
  userId?: string;
}) {
  return {
    queryKey: adminTestQueryKeys.setsForUser(lessonId, userId),
    queryFn: () => getAdminTestSets(lessonId, accessToken),
    staleTime: 30_000,
  };
}

export function getAdminTestQuestionsQueryOptions({
  accessToken,
  setId,
  userId,
}: {
  accessToken: string;
  setId: string;
  userId?: string;
}) {
  return {
    queryKey: adminTestQueryKeys.questionsForUser(setId, userId),
    queryFn: () => getAdminTestQuestions(setId, accessToken),
    staleTime: 30_000,
  };
}

export function useAdminTestSets(lessonId: string, enabled = true) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    ...getAdminTestSetsQueryOptions({
      accessToken: session?.accessToken ?? "",
      lessonId,
      userId: session?.user.id,
    }),
    enabled: enabled && !!session?.accessToken && !!lessonId,
  });
}

export function useAdminTestSetMutations(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const invalidateSets = () =>
    queryClient.invalidateQueries({
      queryKey: adminTestQueryKeys.sets(lessonId),
    });

  return {
    createSet: useMutation({
      mutationFn: async (data: AdminTestSetPayload) => {
        if (!session?.accessToken) throw new Error("No token");
        return createAdminTestSet(lessonId, data, session.accessToken);
      },
      onSuccess: (createdSet) => {
        const cachedSet: AdminTestSet = {
          ...createdSet,
          _count: createdSet._count ?? { questions: createdSet.questionCount },
        };
        queryClient.setQueryData<AdminTestSet[]>(
          adminTestQueryKeys.setsForUser(lessonId, session?.user.id),
          (currentSets) => [...(currentSets ?? []), cachedSet],
        );
        void invalidateSets();
      },
    }),
    deleteSet: useMutation({
      mutationFn: async (setId: string) => {
        if (!session?.accessToken) throw new Error("No token");
        return deleteAdminTestSet(setId, session.accessToken);
      },
      onSuccess: invalidateSets,
    }),
    updateSet: useMutation({
      mutationFn: async ({
        data,
        setId,
      }: {
        data: AdminTestSetPayload;
        setId: string;
      }) => {
        if (!session?.accessToken) throw new Error("No token");
        return updateAdminTestSet(setId, data, session.accessToken);
      },
      onSuccess: invalidateSets,
    }),
  };
}

export function useAdminTestQuestions(setId: string, enabled = true) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    ...getAdminTestQuestionsQueryOptions({
      accessToken: session?.accessToken ?? "",
      setId,
      userId: session?.user.id,
    }),
    enabled: enabled && !!session?.accessToken && !!setId,
  });
}

export function useAdminTestQuestionMutations(setId: string, lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const invalidateQuestions = () =>
    queryClient.invalidateQueries({
      queryKey: adminTestQueryKeys.questions(setId),
    });
  const invalidateSets = () =>
    queryClient.invalidateQueries({
      queryKey: adminTestQueryKeys.sets(lessonId),
    });

  return {
    createQuestion: useMutation({
      mutationFn: async (data: AdminTestQuestionPayload) => {
        if (!session?.accessToken) throw new Error("No token");
        return createAdminTestQuestion(setId, data, session.accessToken);
      },
      onSuccess: async () => {
        await Promise.all([invalidateQuestions(), invalidateSets()]);
      },
    }),
    updateQuestion: useMutation({
      mutationFn: async ({
        questionId,
        data,
      }: {
        questionId: string;
        data: AdminTestQuestionPayload;
      }) => {
        if (!session?.accessToken) throw new Error("No token");
        return updateAdminTestQuestion(questionId, data, session.accessToken);
      },
      onSuccess: invalidateQuestions,
    }),
    reviewQuestion: useMutation({
      mutationFn: async (questionId: string) => {
        if (!session?.accessToken) throw new Error("No token");
        return reviewAdminTestQuestion(questionId, session.accessToken);
      },
      onSuccess: async () => {
        await Promise.all([invalidateQuestions(), invalidateSets()]);
      },
    }),
    deleteQuestion: useMutation({
      mutationFn: async (questionId: string) => {
        if (!session?.accessToken) throw new Error("No token");
        return deleteAdminTestQuestion(questionId, session.accessToken);
      },
      onSuccess: async () => {
        await Promise.all([invalidateQuestions(), invalidateSets()]);
      },
    }),
  };
}
