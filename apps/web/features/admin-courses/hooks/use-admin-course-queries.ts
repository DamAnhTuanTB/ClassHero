"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAdminLearningPath,
  listAdminLearningPaths,
} from "@/features/admin-courses/api";

export const adminCourseQueryKeys = {
  all: ["admin-courses"] as const,
  learningPaths: () => [...adminCourseQueryKeys.all, "learning-paths"] as const,
  learningPath: (pathId: string) =>
    [...adminCourseQueryKeys.learningPaths(), pathId] as const,
};

export function useAdminLearningPathsQuery() {
  return useQuery({
    queryKey: adminCourseQueryKeys.learningPaths(),
    queryFn: listAdminLearningPaths,
  });
}

export function useAdminLearningPathQuery(pathId: string) {
  return useQuery({
    queryKey: adminCourseQueryKeys.learningPath(pathId),
    queryFn: () => getAdminLearningPath(pathId),
  });
}
