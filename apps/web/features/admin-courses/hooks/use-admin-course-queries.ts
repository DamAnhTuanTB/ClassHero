"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  archiveAdminChapter,
  archiveAdminLearningPath,
  archiveAdminLesson,
  createAdminChapter,
  createAdminLearningPath,
  createAdminLesson,
  getAdminLearningPath,
  listAdminLearningPaths,
  permanentlyDeleteAdminLearningPath,
  restoreAdminLearningPath,
  updateAdminChapter,
  updateAdminLearningPath,
  updateAdminLesson,
  uploadAdminCourseCover,
} from "@/features/admin-courses/api";
import type { AdminLearningPath } from "@/features/admin-courses/data";
import type {
  ChapterFormValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin-courses/schemas";
import { useAuthSessionStore } from "@/features/auth/session";

export const adminCourseQueryKeys = {
  all: ["admin-courses"] as const,
  admin: (userId: string | undefined) =>
    [...adminCourseQueryKeys.all, "admin", userId ?? "anonymous"] as const,
  learningPaths: (userId: string | undefined) =>
    [...adminCourseQueryKeys.admin(userId), "learning-paths"] as const,
  learningPath: (userId: string | undefined, pathId: string) =>
    [...adminCourseQueryKeys.learningPaths(userId), pathId] as const,
};

export function useAdminLearningPathsQuery(initialData?: AdminLearningPath[]) {
  const session = useAuthSessionStore((state) => state.session);
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);

  return useQuery({
    queryKey: adminCourseQueryKeys.learningPaths(session?.user.id),
    queryFn: () => listAdminLearningPaths(session?.accessToken ?? ""),
    enabled: isAuthHydrated && Boolean(session?.accessToken),
    initialData,
  });
}

export function useAdminLearningPathQuery(
  pathId: string,
  initialData?: AdminLearningPath | null,
) {
  const session = useAuthSessionStore((state) => state.session);
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);

  return useQuery({
    queryKey: adminCourseQueryKeys.learningPath(session?.user.id, pathId),
    queryFn: () => getAdminLearningPath(pathId, session?.accessToken ?? ""),
    enabled: isAuthHydrated && Boolean(session?.accessToken),
    initialData,
  });
}

export function useAdminCourseMutations() {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);
  const token = session?.accessToken ?? "";
  const userId = session?.user.id;

  function invalidateLearningPaths() {
    return queryClient.invalidateQueries({
      queryKey: adminCourseQueryKeys.learningPaths(userId),
    });
  }

  function invalidateLearningPath(pathId: string) {
    return Promise.all([
      invalidateLearningPaths(),
      queryClient.invalidateQueries({
        queryKey: adminCourseQueryKeys.learningPath(userId, pathId),
      }),
    ]);
  }

  return {
    archiveChapter: useMutation({
      mutationFn: ({ chapterId }: { chapterId: string }) =>
        archiveAdminChapter(chapterId, token),
    }),
    archiveLesson: useMutation({
      mutationFn: ({ lessonId }: { lessonId: string }) =>
        archiveAdminLesson(lessonId, token),
    }),
    archivePath: useMutation({
      mutationFn: ({ pathId }: { pathId: string }) =>
        archiveAdminLearningPath(pathId, token),
      onSuccess: () => invalidateLearningPaths(),
    }),
    createChapter: useMutation({
      mutationFn: ({ pathId, values }: { pathId: string; values: ChapterFormValues }) =>
        createAdminChapter(pathId, values, token),
      onSuccess: (_chapter, variables) => invalidateLearningPath(variables.pathId),
    }),
    createLesson: useMutation({
      mutationFn: ({
        chapterId,
        values,
      }: {
        chapterId: string;
        values: LessonFormValues;
      }) => createAdminLesson(chapterId, values, token),
    }),
    createPath: useMutation({
      mutationFn: (values: LearningPathFormValues) =>
        createAdminLearningPath(values, token),
      onSuccess: () => invalidateLearningPaths(),
    }),
    deletePathPermanently: useMutation({
      mutationFn: ({ pathId }: { pathId: string }) =>
        permanentlyDeleteAdminLearningPath(pathId, token),
      onSuccess: () => invalidateLearningPaths(),
    }),
    restorePath: useMutation({
      mutationFn: ({ pathId }: { pathId: string }) =>
        restoreAdminLearningPath(pathId, token),
      onSuccess: () => invalidateLearningPaths(),
    }),
    updateChapter: useMutation({
      mutationFn: ({
        chapterId,
        values,
      }: {
        chapterId: string;
        values: Partial<ChapterFormValues>;
      }) => updateAdminChapter(chapterId, values, token),
    }),
    updateLesson: useMutation({
      mutationFn: ({
        lessonId,
        values,
      }: {
        lessonId: string;
        values: Partial<LessonFormValues>;
      }) => updateAdminLesson(lessonId, values, token),
    }),
    updatePath: useMutation({
      mutationFn: ({
        pathId,
        values,
      }: {
        pathId: string;
        values: LearningPathFormValues;
      }) => updateAdminLearningPath(pathId, values, token),
      onSuccess: (_path, variables) => invalidateLearningPath(variables.pathId),
    }),
    uploadCover: useMutation({
      mutationFn: (file: File) => uploadAdminCourseCover(file, token),
    }),
    invalidateLearningPath,
    invalidateLearningPaths,
  };
}
