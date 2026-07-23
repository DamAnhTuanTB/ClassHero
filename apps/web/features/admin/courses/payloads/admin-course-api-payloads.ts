import type {
  ChapterFormValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type {
  AdminChapterPayload,
  AdminLearningPathPayload,
  AdminLessonPayload,
} from "@/features/admin/courses/types/admin-course-api-types";

export function toLearningPathApiPayload(
  values: LearningPathFormValues,
  mode: "create" | "update",
): AdminLearningPathPayload {
  if (!values.subject || values.grade === "") {
    throw new Error("Course subject and grade are required");
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

export function toChapterApiPayload(
  values: Partial<ChapterFormValues>,
): AdminChapterPayload {
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

export function toLessonApiPayload(
  values: Partial<LessonFormValues>,
): AdminLessonPayload {
  const sourceDocumentExtractions = normalizeLessonSourceDocumentExtractions(
    values.sourceDocumentExtractions,
    values.foundationDocumentOrder,
  );

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
    ...(sourceDocumentExtractions !== undefined
      ? { sourceDocumentExtractions }
      : {}),
  };
}

function normalizeLessonSourceDocumentExtractions(
  values: Partial<LessonFormValues>["sourceDocumentExtractions"],
  foundationDocumentOrder: Partial<LessonFormValues>["foundationDocumentOrder"],
) {
  if (values === undefined) {
    return undefined;
  }

  return values.map((value, index) => {
    const orderKey = `EXTRACTION:${value.clientKey}`;
    const explicitOrder = foundationDocumentOrder?.indexOf(orderKey) ?? -1;

    return {
      ...(value.id ? { id: value.id } : {}),
      sourceDocumentId: value.sourceDocumentId.trim(),
      pageStart: Number(value.pageStart),
      pageEnd: Number(value.pageEnd),
      sortOrder: explicitOrder >= 0 ? explicitOrder : index,
    };
  });
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
