"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import {
  getQuizAttemptStatus,
  getStudentFlashcards,
  getStudentLesson,
  getStudentTestStatus,
} from "@/features/student/lessons/api/student-lessons-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export const studentLessonQueryKey = (lessonId: string, userId?: string) => [
  "student",
  "lesson",
  lessonId,
  userId ?? "guest",
];

export const studentFlashcardsQueryKey = (lessonId: string, userId?: string) => [
  "student",
  "lesson",
  lessonId,
  "flashcards",
  userId ?? "guest",
];

export const studentTestStatusQueryKey = (lessonId: string, userId?: string) => [
  "student",
  "lesson",
  lessonId,
  "test-status",
  userId ?? "guest",
];

export const studentQuizAttemptStatusQueryKey = (quizSetId: string, userId?: string) => [
  "student",
  "quiz-set",
  quizSetId,
  "attempt-status",
  userId ?? "guest",
];

function getStudentLessonQueryOptions(
  lessonId: string,
  accessToken?: string,
  userId?: string,
) {
  return {
    queryKey: studentLessonQueryKey(lessonId, userId),
    queryFn: () => getStudentLesson(lessonId, accessToken),
    staleTime: 60_000,
  };
}

function getStudentFlashcardsQueryOptions(
  lessonId: string,
  accessToken?: string,
  userId?: string,
) {
  return {
    queryKey: studentFlashcardsQueryKey(lessonId, userId),
    queryFn: () => getStudentFlashcards(lessonId, accessToken),
    staleTime: 60_000,
  };
}

function getStudentTestStatusQueryOptions(
  lessonId: string,
  accessToken?: string,
  userId?: string,
) {
  return {
    queryKey: studentTestStatusQueryKey(lessonId, userId),
    queryFn: () => getStudentTestStatus(lessonId, accessToken),
    staleTime: 30_000,
  };
}

function getStudentQuizAttemptStatusQueryOptions(
  quizSetId: string,
  accessToken?: string,
  userId?: string,
) {
  return {
    queryKey: studentQuizAttemptStatusQueryKey(quizSetId, userId),
    queryFn: () => getQuizAttemptStatus(quizSetId, accessToken ?? ""),
    staleTime: 30_000,
  };
}

export function useStudentLessonPrefetch() {
  const queryClient = useQueryClient();
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);

  return useCallback(
    async (lessonId: string) => {
      const normalizedLessonId = lessonId.trim();

      if (!isAuthHydrated || !session?.accessToken || !normalizedLessonId) {
        throw new Error("Bạn cần đăng nhập để mở buổi học");
      }

      const accessToken = session.accessToken;
      const userId = session.user.id;
      const lessonPromise = queryClient.fetchQuery(
        getStudentLessonQueryOptions(normalizedLessonId, accessToken, userId),
      );

      void Promise.allSettled([
        queryClient.prefetchQuery(
          getStudentFlashcardsQueryOptions(normalizedLessonId, accessToken, userId),
        ),
        queryClient.prefetchQuery(
          getStudentTestStatusQueryOptions(normalizedLessonId, accessToken, userId),
        ),
      ]);

      const lesson = await lessonPromise;
      const quizSetId = lesson.quizSets[0]?.id;

      if (quizSetId) {
        void queryClient.prefetchQuery(
          getStudentQuizAttemptStatusQueryOptions(quizSetId, accessToken, userId),
        );
      }
    },
    [isAuthHydrated, queryClient, session?.accessToken, session?.user.id],
  );
}

export function useStudentLessonQueries(lessonId: string) {
  const queryClient = useQueryClient();
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);
  const enabled =
    isAuthHydrated && Boolean(session?.accessToken) && lessonId.trim().length > 0;

  const lessonQuery = useQuery({
    ...getStudentLessonQueryOptions(lessonId, session?.accessToken, session?.user.id),
    enabled,
  });
  const flashcardsQuery = useQuery({
    ...getStudentFlashcardsQueryOptions(lessonId, session?.accessToken, session?.user.id),
    enabled,
  });
  const testStatusQuery = useQuery({
    ...getStudentTestStatusQueryOptions(lessonId, session?.accessToken, session?.user.id),
    enabled,
  });
  const quizSetId = lessonQuery.data?.quizSets[0]?.id;

  useEffect(() => {
    if (!enabled || !quizSetId) {
      return;
    }

    void queryClient.prefetchQuery(
      getStudentQuizAttemptStatusQueryOptions(
        quizSetId,
        session?.accessToken,
        session?.user.id,
      ),
    );
  }, [enabled, queryClient, quizSetId, session?.accessToken, session?.user.id]);

  useEffect(() => {
    const nextLessonId = lessonQuery.data?.navigation.next?.id;
    if (!enabled || !nextLessonId) {
      return;
    }

    void queryClient.prefetchQuery({
      ...getStudentLessonQueryOptions(
        nextLessonId,
        session?.accessToken,
        session?.user.id,
      ),
    });
  }, [
    enabled,
    lessonQuery.data?.navigation.next?.id,
    queryClient,
    session?.accessToken,
    session?.user.id,
  ]);

  async function refreshLearningProgress() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: studentFlashcardsQueryKey(lessonId, session?.user.id),
      }),
      queryClient.invalidateQueries({
        queryKey: studentTestStatusQueryKey(lessonId, session?.user.id),
      }),
      queryClient.invalidateQueries({
        queryKey: studentLessonQueryKey(lessonId, session?.user.id),
      }),
    ]);
  }

  return {
    isAuthHydrated,
    lessonQuery,
    flashcardsQuery,
    testStatusQuery,
    token: session?.accessToken ?? "",
    refreshLearningProgress,
  };
}
