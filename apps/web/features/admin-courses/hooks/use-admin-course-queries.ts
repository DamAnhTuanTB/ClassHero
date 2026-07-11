"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminLearningPath,
  listAdminLearningPaths,
} from "@/features/admin-courses/api";
import type { AdminLearningPath } from "@/features/admin-courses/data";

export const adminCourseQueryKeys = {
  all: ["admin-courses"] as const,
  learningPaths: () => [...adminCourseQueryKeys.all, "learning-paths"] as const,
  learningPath: (pathId: string) =>
    [...adminCourseQueryKeys.learningPaths(), pathId] as const,
};

export function useAdminLearningPathsQuery(initialData?: AdminLearningPath[]) {
  return useQuery({
    queryKey: adminCourseQueryKeys.learningPaths(),
    queryFn: listAdminLearningPaths,
    initialData,
  });
}

export function useAdminLearningPathQuery(
  pathId: string,
  initialData?: AdminLearningPath | null,
) {
  return useQuery({
    queryKey: adminCourseQueryKeys.learningPath(pathId),
    queryFn: () => getAdminLearningPath(pathId),
    initialData,
  });
}
