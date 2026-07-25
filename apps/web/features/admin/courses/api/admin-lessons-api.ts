import { apiRequest } from "@/lib/api-client";
import { mapLesson } from "@/features/admin/courses/mappers/admin-course-api-mappers";
import { toLessonApiPayload } from "@/features/admin/courses/payloads/admin-course-api-payloads";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import type { AdminLessonApi } from "@/features/admin/courses/types/admin-course-api-types";

export async function createAdminLesson(
  chapterId: string,
  values: LessonFormValues,
  token: string,
) {
  const lesson = await apiRequest<AdminLessonApi>(
    `/admin/chapters/${chapterId}/lessons`,
    {
      method: "POST",
      body: toLessonApiPayload(values),
      token,
    },
  );

  return mapLesson(lesson);
}

export async function updateAdminLesson(
  lessonId: string,
  values: Partial<LessonFormValues>,
  token: string,
) {
  const lesson = await apiRequest<AdminLessonApi>(`/admin/lessons/${lessonId}`, {
    method: "PATCH",
    body: toLessonApiPayload(values),
    token,
  });

  return mapLesson(lesson);
}

export async function updateAdminLessonVideoSettings(
  lessonId: string,
  customVideoSettings: any,
  token: string,
) {
  const lesson = await apiRequest<AdminLessonApi>(`/admin/lessons/${lessonId}`, {
    method: "PATCH",
    body: { customVideoSettings },
    token,
  });

  return mapLesson(lesson);
}

export async function archiveAdminLesson(lessonId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/lessons/${lessonId}`, {
    method: "DELETE",
    token,
  });
}

export async function getAdminLesson(lessonId: string, token: string) {
  const lesson = await apiRequest<AdminLessonApi>(`/admin/lessons/${lessonId}`, {
    method: "GET",
    token,
  });

  return mapLesson(lesson);
}
