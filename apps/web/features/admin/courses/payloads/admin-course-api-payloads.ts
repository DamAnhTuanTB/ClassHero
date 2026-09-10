import type {
  ChapterUpdateValues,
  LearningPathFormValues,
  LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type {
  AdminChapterPayload,
  AdminLearningPathPayload,
  AdminLessonPayload,
} from "@/features/admin/courses/types/admin-course-api-types";
import type { CustomVideoSettings } from "@/components/shared/custom-youtube-player";

export function toLearningPathApiPayload(
  values: LearningPathFormValues,
  mode: "create" | "update",
): AdminLearningPathPayload {
  if (!values.domainId || values.targetAudienceIds.length !== 1) {
    throw new Error("Course domain and exactly one target audience are required");
  }

  const thumbnailFileId = values.thumbnailFileId.trim();
  const slug = values.slug.trim();

  return {
    title: values.title.trim(),
    ...(slug ? { slug } : {}),
    domainId: values.domainId,
    targetAudienceIds: values.targetAudienceIds,
    originalPriceVnd:
      values.originalPriceVnd === "" ? 0 : Number(values.originalPriceVnd),
    salePriceVnd: values.salePriceVnd === "" ? null : Number(values.salePriceVnd),
    startDate: values.startDate || null,
    endDate: values.endDate || null,
    lessonCountMin: values.lessonCountMin === "" ? null : values.lessonCountMin,
    lessonCountMax: values.lessonCountMax === "" ? null : values.lessonCountMax,
    thumbnailFileId: thumbnailFileId || (mode === "update" ? null : undefined),
    descriptionJson: { text: values.description.trim() },
    status: values.status,
    sortOrder: Number(values.sortOrder),
  };
}

export function toChapterApiPayload(values: ChapterUpdateValues): AdminChapterPayload {
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
    ...(values.title !== undefined ? { title: values.title.trim() } : {}),
    ...(values.shortDescription !== undefined
      ? { shortDescription: values.shortDescription?.trim() || null }
      : {}),
    ...(values.overviewContentJson !== undefined
      ? { overviewContentJson: values.overviewContentJson }
      : {}),
    ...(values.lessonType !== undefined ? { lessonType: values.lessonType } : {}),
    ...(values.lessonType !== undefined || values.liveUrl !== undefined
      ? {
          liveUrl: values.lessonType === "BASIC" ? null : values.liveUrl?.trim() || null,
        }
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
    ...(sourceDocumentExtractions !== undefined ? { sourceDocumentExtractions } : {}),
  };
}

export function toCustomVideoSettingsApiPayload(
  settings: CustomVideoSettings,
): CustomVideoSettings {
  return {
    isDisabled: settings.isDisabled,
    startTimeInSeconds: settings.startTimeInSeconds,
    endTimeCutInSeconds: settings.endTimeCutInSeconds,
    introOverlayDurationInSeconds: settings.introOverlayDurationInSeconds,
    pauseOverlayDurationInSeconds: settings.pauseOverlayDurationInSeconds,
    seekStepInSeconds: settings.seekStepInSeconds,
    letterboxTopPercentage: settings.letterboxTopPercentage,
    letterboxRightPercentage: settings.letterboxRightPercentage,
    letterboxBottomPercentage: settings.letterboxBottomPercentage,
    letterboxLeftPercentage: settings.letterboxLeftPercentage,
    hasWatermark: settings.hasWatermark,
    ...(settings.chapters !== undefined
      ? {
          chapters: settings.chapters.map((chapter) => ({
            time: chapter.time,
            title: chapter.title,
          })),
        }
      : {}),
    ...(settings.transcriptLanguage !== undefined
      ? { transcriptLanguage: settings.transcriptLanguage }
      : {}),
    ...(settings.transcript !== undefined
      ? {
          transcript: settings.transcript.map((segment) => ({
            ...(segment.endTime !== undefined ? { endTime: segment.endTime } : {}),
            time: segment.time,
            text: segment.text,
          })),
        }
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
