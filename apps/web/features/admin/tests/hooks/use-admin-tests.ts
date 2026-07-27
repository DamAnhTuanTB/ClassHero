import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  createAdminTestQuestion,
  createAdminTestSet,
  deleteAdminTestQuestion,
  deleteAdminTestSet,
  getAdminTestQuestions,
  getAdminTestSets,
  updateAdminTestQuestion,
  updateAdminTestSet,
  type AdminTestQuestionPayload,
  type AdminTestSetPayload,
} from "@/features/admin/tests/api/admin-tests-api";

export function useAdminTestSets(lessonId: string, enabled = true) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    queryKey: ["admin-test-sets", lessonId],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error("No token");
      return getAdminTestSets(lessonId, session.accessToken);
    },
    enabled: enabled && !!session?.accessToken && !!lessonId,
  });
}

export function useAdminTestSetMutations(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const invalidateSets = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-test-sets", lessonId] });

  return {
    createSet: useMutation({
      mutationFn: async (data: AdminTestSetPayload) => {
        if (!session?.accessToken) throw new Error("No token");
        return createAdminTestSet(lessonId, data, session.accessToken);
      },
      onSuccess: invalidateSets,
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
    queryKey: ["admin-test-questions", setId],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error("No token");
      return getAdminTestQuestions(setId, session.accessToken);
    },
    enabled: enabled && !!session?.accessToken && !!setId,
  });
}

export function useAdminTestQuestionMutations(setId: string, lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const invalidateQuestions = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-test-questions", setId] });
  const invalidateSets = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-test-sets", lessonId] });

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
