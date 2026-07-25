import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import {
  getAdminQuizSets,
  createAdminQuizSet,
  updateAdminQuizSet,
  deleteAdminQuizSet,
  getAdminQuizQuestions,
  createAdminQuizQuestion,
  deleteAdminQuizQuestion,
} from "../api/admin-quiz-api";

export function useAdminQuizSets(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    queryKey: ["admin-quiz-sets", lessonId],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error("No token");
      return getAdminQuizSets(lessonId, session.accessToken);
    },
    enabled: !!session?.accessToken && !!lessonId,
  });
}

export function useAdminQuizSetMutations(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!session?.accessToken) throw new Error("No token");
      return createAdminQuizSet(lessonId, data, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quiz-sets", lessonId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (setId: string) => {
      if (!session?.accessToken) throw new Error("No token");
      return deleteAdminQuizSet(setId, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quiz-sets", lessonId] });
    },
  });

  return {
    createSet: createMutation,
    deleteSet: deleteMutation,
  };
}

export function useAdminQuizQuestions(setId: string) {
  const session = useAuthSessionStore((state) => state.session);

  return useQuery({
    queryKey: ["admin-quiz-questions", setId],
    queryFn: async () => {
      if (!session?.accessToken) throw new Error("No token");
      return getAdminQuizQuestions(setId, session.accessToken);
    },
    enabled: !!session?.accessToken && !!setId,
  });
}

export function useAdminQuizQuestionMutations(setId: string, lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!session?.accessToken) throw new Error("No token");
      return createAdminQuizQuestion(setId, data, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quiz-questions", setId] });
      queryClient.invalidateQueries({ queryKey: ["admin-quiz-sets", lessonId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (questionId: string) => {
      if (!session?.accessToken) throw new Error("No token");
      return deleteAdminQuizQuestion(questionId, session.accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-quiz-questions", setId] });
      queryClient.invalidateQueries({ queryKey: ["admin-quiz-sets", lessonId] });
    },
  });

  return {
    createQuestion: createMutation,
    deleteQuestion: deleteMutation,
  };
}
