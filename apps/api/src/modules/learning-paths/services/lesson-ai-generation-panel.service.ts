import { Inject, Injectable } from "@nestjs/common";
import { AiGenerationType, AiProviderName, DocumentStatus, Prisma } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";

const PANEL_GENERATION_TYPES = [
  AiGenerationType.SUMMARY,
  AiGenerationType.QUIZ,
  AiGenerationType.FLASHCARD,
  AiGenerationType.TEST,
] as const;

const panelGenerationSelect = {
  type: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  backgroundJob: {
    select: {
      id: true,
      status: true,
      resourceType: true,
      resourceId: true,
      errorMessage: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      updatedAt: true,
    },
  },
  lessonSummaries: { take: 1, select: { reviewStatus: true } },
  quizSets: { take: 1, select: { reviewStatus: true } },
  flashcardSets: { take: 1, select: { reviewStatus: true } },
  testSets: { take: 1, select: { reviewStatus: true } },
} satisfies Prisma.AiGenerationSelect;

type PanelGenerationRecord = Prisma.AiGenerationGetPayload<{
  select: typeof panelGenerationSelect;
}>;

@Injectable()
export class LessonAiGenerationPanelService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
  ) {}

  async getForAdmin(lessonId: string) {
    const [lesson, ...generations] = await Promise.all([
      this.prisma.lesson.findFirst({
        where: {
          id: lessonId,
          deletedAt: null,
          learningPath: { deletedAt: null },
        },
        select: {
          id: true,
          title: true,
          learningPath: {
            select: {
              targetAudiences: {
                select: { targetAudience: { select: { grade: true, name: true } } },
              },
            },
          },
          documents: {
            where: { replacedAt: null },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              title: true,
              kind: true,
              status: true,
              chunkCount: true,
              embeddingProvider: true,
              embeddingModel: true,
              embeddingDimensions: true,
              file: { select: { originalName: true } },
              pageRange: { select: { pageStart: true, pageEnd: true } },
            },
          },
        },
      }),
      ...PANEL_GENERATION_TYPES.map((type) =>
        this.prisma.aiGeneration.findFirst({
          where: { lessonId, type },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: panelGenerationSelect,
        }),
      ),
    ]);

    if (!lesson) {
      throwLessonNotFound();
    }

    const embeddingConfig = this.aiService.getEmbeddingConfig();
    const documents = lesson.documents.map((document) => {
      const canUseForSummary =
        document.status === DocumentStatus.READY && document.chunkCount > 0;
      return {
        id: document.id,
        title: document.title?.trim() || document.file.originalName,
        kind: document.kind,
        status: document.status,
        chunkCount: document.chunkCount,
        pageRange: document.pageRange,
        canUseForSummary,
        unavailableReason: getSummaryDocumentUnavailableReason(document),
        embeddingReady:
          document.embeddingProvider === AiProviderName.OPENAI &&
          document.embeddingModel === embeddingConfig.model &&
          document.embeddingDimensions === embeddingConfig.dimensions,
      };
    });
    const readyDocuments = documents.filter((document) => document.canUseForSummary);
    const summaryReady = readyDocuments.length > 0;
    const generationReady =
      summaryReady && readyDocuments.every((document) => document.embeddingReady);
    const latestByType = new Map<AiGenerationType, PanelGenerationRecord>();
    for (const generation of generations) {
      if (generation) latestByType.set(generation.type, generation);
    }

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        targetGrade:
          lesson.learningPath.targetAudiences
            .map(({ targetAudience }) => targetAudience.grade)
            .filter((grade): grade is number => grade !== null)
            .sort((left, right) => left - right)[0] ?? null,
      },
      readiness: {
        summaryReady,
        generationReady,
        readyDocumentCount: readyDocuments.length,
        embeddedDocumentCount: readyDocuments.filter(
          (document) => document.embeddingReady,
        ).length,
        reason: getReadinessReason({
          activeDocumentCount: lesson.documents.length,
          summaryReady,
          generationReady,
        }),
      },
      documents,
      jobs: Object.fromEntries(
        PANEL_GENERATION_TYPES.map((type) => [
          type,
          serializeLatestGeneration(type, latestByType.get(type)),
        ]),
      ),
    };
  }
}

function getSummaryDocumentUnavailableReason(document: {
  status: DocumentStatus;
  chunkCount: number;
}) {
  if (document.status === DocumentStatus.UPLOADED) {
    return "Đang chờ xử lý";
  }
  if (document.status === DocumentStatus.PROCESSING) {
    return "Đang xử lý";
  }
  if (document.status === DocumentStatus.FAILED) {
    return "Xử lý thất bại";
  }
  if (document.chunkCount === 0) {
    return "Chưa có nội dung để tạo";
  }
  return null;
}

function serializeLatestGeneration(
  type: (typeof PANEL_GENERATION_TYPES)[number],
  generation: PanelGenerationRecord | undefined,
) {
  if (!generation) {
    return null;
  }
  const job = generation.backgroundJob;
  return {
    type,
    jobId: job?.id ?? null,
    status: job?.status ?? generation.status,
    resourceType: job?.resourceType ?? null,
    resourceId: job?.resourceId ?? null,
    reviewStatus: getGeneratedReviewStatus(type, generation),
    error: job?.errorMessage ?? generation.errorMessage,
    createdAt: job?.createdAt ?? generation.createdAt,
    startedAt: job?.startedAt ?? generation.startedAt,
    finishedAt: job?.finishedAt ?? generation.finishedAt,
    updatedAt: job?.updatedAt ?? generation.finishedAt ?? generation.createdAt,
  };
}

function getGeneratedReviewStatus(
  type: (typeof PANEL_GENERATION_TYPES)[number],
  generation: PanelGenerationRecord,
) {
  if (type === AiGenerationType.SUMMARY) {
    return generation.lessonSummaries[0]?.reviewStatus ?? null;
  }
  if (type === AiGenerationType.QUIZ) {
    return generation.quizSets[0]?.reviewStatus ?? null;
  }
  if (type === AiGenerationType.FLASHCARD) {
    return generation.flashcardSets[0]?.reviewStatus ?? null;
  }
  return generation.testSets[0]?.reviewStatus ?? null;
}

function getReadinessReason(input: {
  activeDocumentCount: number;
  summaryReady: boolean;
  generationReady: boolean;
}) {
  if (input.activeDocumentCount === 0) {
    return "Buổi học chưa có tài liệu.";
  }
  if (!input.summaryReady) {
    return "Tài liệu chưa xử lý xong hoặc chưa có đoạn nội dung.";
  }
  if (!input.generationReady) {
    return "Đang chờ tạo embedding cho tài liệu.";
  }
  return null;
}
