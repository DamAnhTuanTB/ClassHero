"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStudentLearningPathDetail,
  listStudentLearningPaths,
  mockPurchaseLearningPath,
} from "@/features/student/shared/student-courses-api";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

const studentLearningPathsQueryKey = (userId?: string) => [
  "student",
  "learning-paths",
  userId ?? "guest",
];

const studentLearningPathDetailQueryKey = (slug: string, userId?: string) => [
  "student",
  "learning-path",
  slug,
  userId ?? "guest",
];

export function useStudentCoursesQuery() {
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);

  return {
    isAuthHydrated,
    session,
    query: useQuery({
      queryKey: studentLearningPathsQueryKey(session?.user.id),
      queryFn: () => listStudentLearningPaths(session?.accessToken),
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
      queryKey: studentLearningPathDetailQueryKey(slug, session?.user.id),
      queryFn: () => getStudentLearningPathDetail(slug, session?.accessToken),
      enabled: isAuthHydrated && slug.length > 0,
    }),
  };
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
