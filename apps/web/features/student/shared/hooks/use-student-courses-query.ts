"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  getStudentLearningPathDetail,
  listStudentLearningPaths,
  mockPurchaseLearningPath,
} from "@/features/student/shared/api/student-learning-paths-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

export const studentLearningPathsQueryKey = (userId?: string) => [
  "student",
  "learning-paths",
  userId ?? "guest",
];

export const studentLearningPathDetailQueryKey = (slug: string, userId?: string) => [
  "student",
  "learning-path",
  slug,
  userId ?? "guest",
];

function getStudentLearningPathsQueryOptions(accessToken?: string, userId?: string) {
  return {
    queryKey: studentLearningPathsQueryKey(userId),
    queryFn: () => listStudentLearningPaths(accessToken),
    staleTime: 60_000,
  };
}

function getStudentLearningPathDetailQueryOptions(
  slug: string,
  accessToken?: string,
  userId?: string,
) {
  return {
    queryKey: studentLearningPathDetailQueryKey(slug, userId),
    queryFn: () => getStudentLearningPathDetail(slug, accessToken),
    staleTime: 60_000,
  };
}

export function useStudentCoursesQuery() {
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);

  return {
    isAuthHydrated,
    session,
    query: useQuery({
      ...getStudentLearningPathsQueryOptions(session?.accessToken, session?.user.id),
      enabled: isAuthHydrated,
    }),
  };
}

export function useStudentCourseDetailQuery(slug: string) {
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);

  return {
    isAuthHydrated,
    session,
    query: useQuery({
      ...getStudentLearningPathDetailQueryOptions(
        slug,
        session?.accessToken,
        session?.user.id,
      ),
      enabled: isAuthHydrated && slug.length > 0,
    }),
  };
}

export function useStudentCourseDetailPrefetch() {
  const queryClient = useQueryClient();
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);

  return useCallback(
    (slug: string) => {
      if (!isAuthHydrated || !slug) {
        return Promise.resolve();
      }

      return queryClient.prefetchQuery(
        getStudentLearningPathDetailQueryOptions(
          slug,
          session?.accessToken,
          session?.user.id,
        ),
      );
    },
    [isAuthHydrated, queryClient, session?.accessToken, session?.user.id],
  );
}

export function useStudentMockPurchaseMutation(slug: string) {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);

  return useMutation({
    mutationFn: (learningPathId: string) => {
      if (!session?.accessToken) {
        throw new Error("Bạn cần đăng nhập để mua khóa học");
      }

      return mockPurchaseLearningPath(learningPathId, session.accessToken);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: studentLearningPathDetailQueryKey(slug, session?.user.id),
        }),
        queryClient.invalidateQueries({
          queryKey: studentLearningPathsQueryKey(session?.user.id),
        }),
      ]);
    },
  });
}
