import { apiRequest } from "@/lib/api-client";
import type {
  AdminChapter,
  AdminLearningPath,
  AdminLesson,
  AdminPublishStatus,
  AdminSubject,
} from "@/features/admin/courses/admin-courses-data";
import type {
  ChapterFormValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";

type AdminLearningPathApi = {
  id: string;
  title: string;
  slug: string;
  thumbnailFileId: string | null;
  thumbnailFile: {
    id: string;
    originalName: string;
    url: string | null;
  } | null;
  descriptionJson: unknown;
  subject: AdminSubject;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  enrolledStudentCount: number;
  totalChapterCount: number;
  totalLessonCount: number;
  status: AdminPublishStatus;
  sortOrder: number;
  updatedAt: string;
  chapters?: AdminChapterApi[];
};

type AdminChapterApi = {
  id: string;
  learningPathId: string;
  orderIndex: number;
  title: string;
  overview: string | null;
  objectivesJson: unknown;
  status: AdminPublishStatus;
  lessons?: AdminLessonApi[];
};

type AdminLessonApi = {
  id: string;
  chapterId: string;
  orderIndex: number;
  title: string;
  shortDescription: string | null;
  scheduledAt: string | null;
  examOpenAt: string | null;
  videoUrl: string | null;
  completionMinScore: number;
  trialEnabled: boolean;
  status: AdminPublishStatus;
};

type UploadedFileApi = {
  id: string;
  originalName: string;
  publicUrl: string | null;
};

type SignedUrlApi = {
  url: string;
  expiresAt: string;
};

type AdminLearningPathPayload = {
  descriptionJson?: Record<string, unknown>;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd?: number | null;
  slug?: string;
  sortOrder: number;
  status: Exclude<AdminPublishStatus, "ARCHIVED">;
  subject: AdminSubject;
  thumbnailFileId?: string | null;
  title: string;
};

type AdminChapterPayload = {
  objectivesJson?: Record<string, unknown> | null;
  orderIndex?: number;
  overview?: string | null;
  status?: AdminPublishStatus;
  title?: string;
};

type AdminLessonPayload = {
  completionMinScore?: number;
  examOpenAt?: string | null;
  orderIndex?: number;
  scheduledAt?: string | null;
  shortDescription?: string | null;
  status?: AdminPublishStatus;
  title?: string;
  trialEnabled?: boolean;
  videoUrl?: string | null;
};

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
  values: Partial<ChapterFormValues>,
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

export async function archiveAdminLesson(lessonId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/lessons/${lessonId}`, {
    method: "DELETE",
    token,
  });
}

export async function uploadAdminCourseCover(file: File, token: string) {
  const formData = new FormData();
  formData.set("purpose", "EDITOR_IMAGE");
  formData.set("file", file);

  const uploadedFile = await apiRequest<UploadedFileApi>("/files/upload", {
    method: "POST",
    body: formData,
    token,
  });
  const signedUrl = uploadedFile.publicUrl
    ? { url: uploadedFile.publicUrl }
    : await apiRequest<SignedUrlApi>(`/files/${uploadedFile.id}/signed-url`, {
        token,
      });

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.originalName,
    imageUrl: signedUrl.url,
  };
}

function mapLearningPath(path: AdminLearningPathApi): AdminLearningPath {
  const chapters = (path.chapters ?? []).map(mapChapter);

  return {
    id: path.id,
    title: path.title,
    slug: path.slug,
    thumbnailFileId: path.thumbnailFileId,
    thumbnailFileName: path.thumbnailFile?.originalName ?? "",
    thumbnailImageUrl: path.thumbnailFile?.url ?? "",
    description: descriptionJsonToText(path.descriptionJson),
    subject: path.subject,
    grade: path.grade,
    originalPriceVnd: path.originalPriceVnd,
    salePriceVnd: path.salePriceVnd,
    enrolledStudentCount: path.enrolledStudentCount,
    totalChapterCount: path.totalChapterCount,
    totalLessonCount: path.totalLessonCount,
    status: path.status,
    sortOrder: path.sortOrder,
    updatedAt: path.updatedAt,
    chapters,
  };
}

function mapChapter(chapter: AdminChapterApi): AdminChapter {
  return {
    id: chapter.id,
    orderIndex: chapter.orderIndex,
    title: chapter.title,
    overview: chapter.overview ?? "",
    objectives: objectivesJsonToText(chapter.objectivesJson),
    status: chapter.status,
    lessons: (chapter.lessons ?? []).map(mapLesson),
  };
}

function mapLesson(lesson: AdminLessonApi): AdminLesson {
  return {
    id: lesson.id,
    chapterId: lesson.chapterId,
    orderIndex: lesson.orderIndex,
    title: lesson.title,
    shortDescription: lesson.shortDescription ?? "",
    scheduledAt: toDateTimeLocalValue(lesson.scheduledAt),
    examOpenAt: toDateTimeLocalValue(lesson.examOpenAt),
    videoUrl: lesson.videoUrl ?? "",
    completionMinScore: lesson.completionMinScore,
    trialEnabled: lesson.trialEnabled ?? false,
    status: lesson.status,
  };
}

function toLearningPathApiPayload(
  values: LearningPathFormValues,
  mode: "create" | "update",
): AdminLearningPathPayload {
  if (!values.subject || values.grade === "") {
    throw new Error("Learning path subject and grade are required");
  }

  const thumbnailFileId = values.thumbnailFileId.trim();
  const slug = values.slug.trim();

  return {
    title: values.title.trim(),
    ...(slug ? { slug } : {}),
    subject: values.subject,
    grade: Number(values.grade),
    originalPriceVnd:
      values.originalPriceVnd === "" ? 0 : Number(values.originalPriceVnd),
    salePriceVnd: values.salePriceVnd === "" ? null : Number(values.salePriceVnd),
    thumbnailFileId: thumbnailFileId || (mode === "update" ? null : undefined),
    descriptionJson: { text: values.description.trim() },
    status: values.status,
    sortOrder: Number(values.sortOrder),
  };
}

function toChapterApiPayload(values: Partial<ChapterFormValues>): AdminChapterPayload {
  return {
    ...(values.orderIndex !== undefined ? { orderIndex: Number(values.orderIndex) } : {}),
    ...(values.title !== undefined ? { title: values.title.trim() } : {}),
    ...(values.overview !== undefined
      ? { overview: values.overview?.trim() ?? null }
      : {}),
    ...(values.objectives !== undefined
      ? { objectivesJson: { text: values.objectives?.trim() ?? "" } }
      : {}),
    ...(values.status !== undefined ? { status: values.status } : {}),
  };
}

function toLessonApiPayload(values: Partial<LessonFormValues>): AdminLessonPayload {
  return {
    ...(values.orderIndex !== undefined ? { orderIndex: Number(values.orderIndex) } : {}),
    ...(values.title !== undefined ? { title: values.title.trim() } : {}),
    ...(values.shortDescription !== undefined
      ? { shortDescription: values.shortDescription?.trim() || null }
      : {}),
    ...(values.scheduledAt !== undefined
      ? { scheduledAt: toIsoDateTime(values.scheduledAt) }
      : {}),
    ...(values.examOpenAt !== undefined
      ? { examOpenAt: toIsoDateTime(values.examOpenAt) }
      : {}),
    ...(values.videoUrl !== undefined
      ? { videoUrl: values.videoUrl?.trim() || null }
      : {}),
    ...(values.completionMinScore !== undefined
      ? { completionMinScore: Number(values.completionMinScore) }
      : {}),
    ...(values.trialEnabled !== undefined ? { trialEnabled: values.trialEnabled } : {}),
    ...(values.status !== undefined ? { status: values.status } : {}),
  };
}

function descriptionJsonToText(value: unknown) {
  if (isRecord(value) && typeof value.text === "string") {
    return value.text;
  }

  return extractTextFromTiptap(value);
}

function objectivesJsonToText(value: unknown) {
  if (isRecord(value) && typeof value.text === "string") {
    return value.text;
  }

  return "";
}

function extractTextFromTiptap(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  const content = Array.isArray(value.content) ? value.content : [];
  const text = content
    .map((item) => {
      if (isRecord(item) && typeof item.text === "string") {
        return item.text;
      }

      return extractTextFromTiptap(item);
    })
    .filter(Boolean)
    .join(" ");

  return text.trim();
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
