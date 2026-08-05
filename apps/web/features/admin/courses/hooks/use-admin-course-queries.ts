"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  archiveAdminLearningPath,
  createAdminLearningPath,
  getAdminLearningPath,
  listAdminLearningPaths,
  permanentlyDeleteAdminLearningPath,
  restoreAdminLearningPath,
  updateAdminLearningPath,
} from "@/features/admin/courses/api/admin-learning-paths-api";
import {
  archiveAdminChapter,
  createAdminChapter,
  updateAdminChapter,
} from "@/features/admin/courses/api/admin-chapters-api";
import {
  archiveAdminLesson,
  createAdminLesson,
  moveAdminLesson,
  updateAdminLesson,
} from "@/features/admin/courses/api/admin-lessons-api";
import { uploadAdminCourseCover } from "@/features/admin/courses/api/admin-course-files-api";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import type {
  ChapterFormValues,
  ChapterUpdateValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { adminAiGenerationQueryKeys } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";

export const adminCourseQueryKeys = {
  all: ["admin-courses"] as const,
  admin: (userId: string | undefined) =>
    [...adminCourseQueryKeys.all, "admin", userId ?? "anonymous"] as const,
  learningPaths: (userId: string | undefined) =>
    [...adminCourseQueryKeys.admin(userId), "learning-paths"] as const,
  learningPath: (userId: string | undefined, pathId: string) =>
    [...adminCourseQueryKeys.learningPaths(userId), pathId] as const,
};

function getAdminLearningPathQueryOptions({
  accessToken,
  pathId,
  userId,
}: {
  accessToken: string;
  pathId: string;
  userId?: string;
}) {
  return {
    queryKey: adminCourseQueryKeys.learningPath(userId, pathId),
    queryFn: () => getAdminLearningPath(pathId, accessToken),
    staleTime: 60_000,
  };
}

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
    ...getAdminLearningPathQueryOptions({
      accessToken: session?.accessToken ?? "",
      pathId,
      userId: session?.user.id,
    }),
    enabled: isAuthHydrated && Boolean(session?.accessToken) && Boolean(pathId),
    initialData,
  });
}

export function useAdminLearningPathPrefetch() {
  const queryClient = useQueryClient();
  const isAuthHydrated = useAuthSessionStore((state) => state.isHydrated);
  const session = useAuthSessionStore((state) => state.session);

  return useCallback(
    (pathId: string) => {
      if (!isAuthHydrated || !session?.accessToken || !pathId) {
        return Promise.resolve();
      }

      return queryClient.prefetchQuery(
        getAdminLearningPathQueryOptions({
          accessToken: session.accessToken,
          pathId,
          userId: session.user.id,
        }),
      );
    },
    [isAuthHydrated, queryClient, session?.accessToken, session?.user.id],
  );
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

  function invalidateDocumentState() {
    return queryClient.invalidateQueries({
      queryKey: ["admin-course-documents"],
    });
  }

  function invalidateAiPanel(lessonId: string) {
    return queryClient.invalidateQueries({
      queryKey: adminAiGenerationQueryKeys.panel(lessonId),
    });
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
        pathId,
        values,
      }: {
        chapterId: string | null;
        pathId: string;
        values: LessonFormValues;
      }) => createAdminLesson(pathId, chapterId, values, token),
      onSuccess: (data) => {
        invalidateDocumentState();
        if (data?.id) {
          queryClient.invalidateQueries({
            queryKey: adminAiGenerationQueryKeys.panel(data.id),
          });
        }
      },
    }),
    moveLesson: useMutation({
      mutationFn: ({
        chapterId,
        lessonId,
        targetOrderIndex,
      }: {
        chapterId: string | null;
        lessonId: string;
        targetOrderIndex: number;
      }) => moveAdminLesson(lessonId, chapterId, targetOrderIndex, token),
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
        values: ChapterUpdateValues;
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
      onSuccess: (_data, variables) => {
        invalidateDocumentState();
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(variables.lessonId),
        });
      },
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
    invalidateAiPanel,
  };
}
