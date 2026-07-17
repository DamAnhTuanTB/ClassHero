import { apiRequest } from "@/lib/api-client";
import { mapLearningPath } from "@/features/admin/courses/mappers/admin-course-api-mappers";
import { toLearningPathApiPayload } from "@/features/admin/courses/payloads/admin-course-api-payloads";
import type { LearningPathFormValues } from "@/features/admin/courses/admin-courses-schemas";
import type { AdminLearningPathApi } from "@/features/admin/courses/types/admin-course-api-types";

export async function listAdminLearningPaths(token: string) {
  const [activePaths, archivedPaths] = await Promise.all([
    apiRequest<AdminLearningPathApi[]>("/admin/learning-paths?pageSize=100", {
      token,
    }),
    apiRequest<AdminLearningPathApi[]>(
      "/admin/learning-paths?status=ARCHIVED&pageSize=100",
      {
        token,
      },
    ),
  ]);

  return [...activePaths, ...archivedPaths].map(mapLearningPath);
}

export async function getAdminLearningPath(pathId: string, token: string) {
  const path = await apiRequest<AdminLearningPathApi>(`/admin/learning-paths/${pathId}`, {
    token,
  });

  return mapLearningPath(path);
}

export async function createAdminLearningPath(
  values: LearningPathFormValues,
  token: string,
) {
  const path = await apiRequest<AdminLearningPathApi>("/admin/learning-paths", {
    method: "POST",
    body: toLearningPathApiPayload(values, "create"),
    token,
  });

  return mapLearningPath(path);
}

export async function updateAdminLearningPath(
  pathId: string,
  values: LearningPathFormValues,
  token: string,
) {
  const path = await apiRequest<AdminLearningPathApi>(`/admin/learning-paths/${pathId}`, {
    method: "PATCH",
    body: toLearningPathApiPayload(values, "update"),
    token,
  });

  return mapLearningPath(path);
}

export async function archiveAdminLearningPath(pathId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/learning-paths/${pathId}`, {
    method: "DELETE",
    token,
  });
}

export async function restoreAdminLearningPath(pathId: string, token: string) {
  const path = await apiRequest<AdminLearningPathApi>(
    `/admin/learning-paths/${pathId}/restore`,
    {
      method: "POST",
      token,
    },
  );

  return mapLearningPath(path);
}

export async function permanentlyDeleteAdminLearningPath(pathId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/learning-paths/${pathId}/permanent`, {
    method: "DELETE",
    token,
  });
}
