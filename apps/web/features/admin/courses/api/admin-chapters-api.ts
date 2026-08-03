import { apiRequest } from "@/lib/api-client";
import { mapChapter } from "@/features/admin/courses/mappers/admin-course-api-mappers";
import { toChapterApiPayload } from "@/features/admin/courses/payloads/admin-course-api-payloads";
import type {
  ChapterFormValues,
  ChapterUpdateValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { AdminChapterApi } from "@/features/admin/courses/types/admin-course-api-types";

export async function createAdminChapter(
  pathId: string,
  values: ChapterFormValues,
  token: string,
) {
  const chapter = await apiRequest<AdminChapterApi>(
    `/admin/learning-paths/${pathId}/chapters`,
    {
      method: "POST",
      body: toChapterApiPayload(values),
      token,
    },
  );

  return mapChapter(chapter);
}

export async function updateAdminChapter(
  chapterId: string,
  values: ChapterUpdateValues,
  token: string,
) {
  const chapter = await apiRequest<AdminChapterApi>(`/admin/chapters/${chapterId}`, {
    method: "PATCH",
    body: toChapterApiPayload(values),
    token,
  });

  return mapChapter(chapter);
}

export async function archiveAdminChapter(chapterId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/chapters/${chapterId}`, {
    method: "DELETE",
    token,
  });
}
