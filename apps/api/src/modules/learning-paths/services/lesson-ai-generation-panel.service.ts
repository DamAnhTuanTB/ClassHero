import { Inject, Injectable } from "@nestjs/common";
import {
  AiGenerationType,
  AiModelPurpose,
  AiProviderName,
  DocumentStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { supportsHighDetailPdfInput } from "#api/modules/provider-operations/utils/ai-model-capabilities";
import { readJobErrorDetails } from "#api/jobs/job-error";
import { resolveLessonSummarySubject } from "#api/modules/ai/utils/lesson-summary-subject";

const PANEL_GENERATION_TYPES = [
  AiGenerationType.SUMMARY,
  AiGenerationType.QUIZ,
  AiGenerationType.FLASHCARD,
  AiGenerationType.TEST,
] as const;

const panelGenerationSelect = {
  id: true,
  type: true,
  status: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  model: true,
  latencyMs: true,
  estimatedCostVnd: true,
  inputMetaJson: true,
  providerUsageEvents: { select: { costVnd: true } },
  backgroundJob: {
    select: {
      id: true,
      status: true,
      resourceType: true,
      resourceId: true,
      result: true,
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
    @Inject(AiModelRoutingService)
    private readonly modelRouting: AiModelRoutingService,
  ) {}

  async getForAdmin(lessonId: string) {
    const [
      lesson,
      summaryRoute,
      summaryFigureRoute,
      quizRoute,
      quizFigureRoute,
      flashcardRoute,
      flashcardFigureRoute,
      activeModels,
      ...generations
    ] =
      await Promise.all([
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
              domain: { select: { name: true, slug: true } },
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
              sourceDocumentId: true,
              file: {
                select: {
                  originalName: true,
                  mimeType: true,
                  checksum: true,
                  status: true,
                },
              },
              pageRange: { select: { pageStart: true, pageEnd: true } },
              sourceDocument: {
                select: { status: true },
              },
            },
          },
        },
      }),
      this.modelRouting.resolve(AiGenerationType.SUMMARY, AiModelPurpose.TEXT),
      this.modelRouting.resolve(AiGenerationType.SUMMARY, AiModelPurpose.IMAGE),
      this.modelRouting.resolve(AiGenerationType.QUIZ, AiModelPurpose.TEXT),
      this.modelRouting.resolve(AiGenerationType.QUIZ, AiModelPurpose.IMAGE),
      this.modelRouting.resolve(AiGenerationType.FLASHCARD, AiModelPurpose.TEXT),
      this.modelRouting.resolve(AiGenerationType.FLASHCARD, AiModelPurpose.IMAGE),
      this.modelRouting.getAllActiveModels(),
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

    const pageRangeEndpoints = lesson.documents.flatMap((document) => {
      if (!document.pageRange || !document.sourceDocumentId) return [];
      const { pageStart, pageEnd } = document.pageRange;
      const { sourceDocumentId } = document;
      return pageStart === pageEnd
        ? [{ sourceDocumentId, pageNumber: pageStart }]
        : [
            { sourceDocumentId, pageNumber: pageStart },
            { sourceDocumentId, pageNumber: pageEnd },
          ];
    });
    const sourcePages =
      pageRangeEndpoints.length === 0
        ? []
        : await this.prisma.sourceDocumentPage.findMany({
            where: { OR: pageRangeEndpoints },
            select: { sourceDocumentId: true, pageNumber: true, metadataJson: true },
          });
    const printedPageNumberBySourcePage = new Map(
      sourcePages.map((page) => [
        `${page.sourceDocumentId}:${page.pageNumber}`,
        readPrintedPageNumber(page.metadataJson),
      ]),
    );

    const embeddingConfig = this.aiService.getEmbeddingConfig();
    const documents = lesson.documents.map((document) => {
      const packetUnavailableReason = getPacketDocumentUnavailableReason(document);
      const canUseForSummary =
        document.status === DocumentStatus.READY &&
        packetUnavailableReason === null;
      const quizUnavailableReason =
        getQuizDocumentUnavailableReason(document) ??
        getQuizPacketDocumentUnavailableReason(document);
      const canUseForQuiz = quizUnavailableReason === null;
      const flashcardUnavailableReason = getFlashcardDocumentUnavailableReason({
        status: document.status,
        chunkCount: document.chunkCount,
        embeddingReady:
          document.embeddingProvider === AiProviderName.OPENAI &&
          document.embeddingModel === embeddingConfig.model &&
          document.embeddingDimensions === embeddingConfig.dimensions,
      });
      return {
        id: document.id,
        title: document.title?.trim() || document.file.originalName,
        kind: document.kind,
        status: document.status,
        chunkCount: document.chunkCount,
        pageRange: formatPrintedPageRange(
          document.pageRange,
          document.sourceDocumentId,
          printedPageNumberBySourcePage,
        ),
        canUseForSummary,
        canUseForQuiz,
        canUseForFlashcard: flashcardUnavailableReason === null,
        unavailableReason:
          getSummaryDocumentUnavailableReason(document) ?? packetUnavailableReason,
        quizUnavailableReason,
        flashcardUnavailableReason,
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
    const quizDocuments = documents.filter((document) => document.canUseForQuiz);
    const quizReady = quizDocuments.length > 0;
    const lessonSubject = resolveLessonSummarySubject({
      domainName: lesson.learningPath.domain.name,
      domainSlug: lesson.learningPath.domain.slug,
    });
    const latestByType = new Map<AiGenerationType, PanelGenerationRecord>();
    for (const generation of generations) {
      if (generation) latestByType.set(generation.type, generation);
    }

    const summaryCandidates = summaryRoute.candidates.filter(supportsHighDetailPdfInput);
    const resolvedSummaryCandidate =
      summaryCandidates.find((candidate) => candidate.available) ??
      summaryCandidates[0] ??
      null;
    const summaryModelOptions = activeModels.filter(supportsHighDetailPdfInput);
    const quizCandidates = quizRoute.candidates.filter(supportsHighDetailPdfInput);
    const resolvedQuizCandidate =
      quizCandidates.find((candidate) => candidate.available) ??
      quizCandidates[0] ??
      null;
    const quizModelOptions = activeModels.filter(supportsHighDetailPdfInput);
    const resolvedSummaryFigureCandidate =
      summaryFigureRoute.candidates.find((candidate) => candidate.available) ??
      summaryFigureRoute.candidates[0] ??
      null;
    const resolvedQuizFigureCandidate =
      quizFigureRoute.candidates.find((candidate) => candidate.available) ??
      quizFigureRoute.candidates[0] ??
      null;
    const resolvedFlashcardCandidate =
      flashcardRoute.candidates.find((candidate) => candidate.available) ??
      flashcardRoute.candidates[0] ??
      null;
    const resolvedFlashcardFigureCandidate =
      flashcardFigureRoute.candidates.find((candidate) => candidate.available) ??
      flashcardFigureRoute.candidates[0] ??
      null;

    return {
      lesson: {
        id: lesson.id,
        title: lesson.title,
        subjectKey: lessonSubject.key,
        targetGrade:
          lesson.learningPath.targetAudiences
            .map(({ targetAudience }) => targetAudience.grade)
            .filter((grade): grade is number => grade !== null)
            .sort((left, right) => left - right)[0] ?? null,
      },
      readiness: {
        summaryReady,
        generationReady,
        quizReady,
        readyDocumentCount: readyDocuments.length,
        embeddedDocumentCount: readyDocuments.filter(
          (document) => document.embeddingReady,
        ).length,
        reason: getReadinessReason({
          activeDocumentCount: lesson.documents.length,
          summaryReady,
          generationReady,
        }),
        quizReason: getQuizReadinessReason({
          activeDocumentCount: lesson.documents.length,
          quizDocumentCount: quizDocuments.length,
          quizReady,
        }),
      },
      documents,
      summaryConfiguration: {
        isDefaultConfigured: summaryRoute.hasConfiguration,
        resolvedProvider: resolvedSummaryCandidate?.provider ?? null,
        resolvedModel: resolvedSummaryCandidate?.model ?? null,
        temperature: summaryRoute.temperature,
        reasoningEffort: summaryRoute.reasoningEffort,
        maxOutputTokens: summaryRoute.maxOutputTokens,
        modelOptions: summaryModelOptions.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      summaryFigureConfiguration: {
        isDefaultConfigured: summaryFigureRoute.hasConfiguration,
        resolvedProvider: resolvedSummaryFigureCandidate?.provider ?? null,
        resolvedModel: resolvedSummaryFigureCandidate?.model ?? null,
        temperature: summaryFigureRoute.temperature,
        reasoningEffort: summaryFigureRoute.reasoningEffort,
        maxOutputTokens: summaryFigureRoute.maxOutputTokens,
        modelOptions: activeModels.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      quizConfiguration: {
        isDefaultConfigured: quizRoute.hasConfiguration,
        resolvedProvider: resolvedQuizCandidate?.provider ?? null,
        resolvedModel: resolvedQuizCandidate?.model ?? null,
        temperature: quizRoute.temperature,
        reasoningEffort: quizRoute.reasoningEffort,
        maxOutputTokens: quizRoute.maxOutputTokens,
        modelOptions: quizModelOptions.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      quizFigureConfiguration: {
        isDefaultConfigured: quizFigureRoute.hasConfiguration,
        resolvedProvider: resolvedQuizFigureCandidate?.provider ?? null,
        resolvedModel: resolvedQuizFigureCandidate?.model ?? null,
        temperature: quizFigureRoute.temperature,
        reasoningEffort: quizFigureRoute.reasoningEffort,
        maxOutputTokens: quizFigureRoute.maxOutputTokens,
        modelOptions: activeModels.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      flashcardConfiguration: {
        isDefaultConfigured: flashcardRoute.hasConfiguration,
        resolvedProvider: resolvedFlashcardCandidate?.provider ?? null,
        resolvedModel: resolvedFlashcardCandidate?.model ?? null,
        temperature: flashcardRoute.temperature,
        reasoningEffort: flashcardRoute.reasoningEffort,
        maxOutputTokens: flashcardRoute.maxOutputTokens,
        modelOptions: activeModels.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      flashcardFigureConfiguration: {
        isDefaultConfigured: flashcardFigureRoute.hasConfiguration,
        resolvedProvider: resolvedFlashcardFigureCandidate?.provider ?? null,
        resolvedModel: resolvedFlashcardFigureCandidate?.model ?? null,
        temperature: flashcardFigureRoute.temperature,
        reasoningEffort: flashcardFigureRoute.reasoningEffort,
        maxOutputTokens: flashcardFigureRoute.maxOutputTokens,
        modelOptions: activeModels.map((candidate) => ({
          provider: candidate.provider,
          model: candidate.model,
          available: candidate.available,
          capabilities: candidate.capabilitiesJson,
        })),
      },
      jobs: Object.fromEntries(
        PANEL_GENERATION_TYPES.map((type) => [
          type,
          serializeLatestGeneration(type, latestByType.get(type)),
        ]),
      ),
    };
  }
}

function formatPrintedPageRange(
  pageRange: { pageStart: number; pageEnd: number } | null,
  sourceDocumentId: string | null,
  printedPageNumberBySourcePage: Map<string, number | null>,
) {
  if (!pageRange) return null;

  const getDisplayedPage = (pageNumber: number) =>
    (sourceDocumentId
      ? printedPageNumberBySourcePage.get(`${sourceDocumentId}:${pageNumber}`)
      : null) ?? pageNumber;

  return {
    pageStart: getDisplayedPage(pageRange.pageStart),
    pageEnd: getDisplayedPage(pageRange.pageEnd),
  };
}

function readPrintedPageNumber(metadataJson: Prisma.JsonValue | null) {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return null;
  }

  const printedPage = (metadataJson as Record<string, unknown>).printedPage;
  if (!printedPage || typeof printedPage !== "object" || Array.isArray(printedPage)) {
    return null;
  }

  const value = (printedPage as Record<string, unknown>).printedPageNumber;
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function getSummaryDocumentUnavailableReason(document: { status: DocumentStatus }) {
  if (document.status === DocumentStatus.UPLOADED) {
    return "Đang chờ xử lý";
  }
  if (document.status === DocumentStatus.PROCESSING) {
    return "Đang xử lý";
  }
  if (document.status === DocumentStatus.FAILED) {
    return "Xử lý thất bại";
  }
  return null;
}

function getQuizDocumentUnavailableReason(document: {
  status: DocumentStatus;
}) {
  if (document.status === DocumentStatus.UPLOADED) return "Đang chờ xử lý Quiz";
  if (document.status === DocumentStatus.PROCESSING) return "Đang xử lý Quiz";
  if (document.status === DocumentStatus.FAILED) return "Xử lý Quiz thất bại";
  return null;
}

function getFlashcardDocumentUnavailableReason(document: {
  status: DocumentStatus;
  chunkCount: number;
  embeddingReady: boolean;
}) {
  if (document.status === DocumentStatus.UPLOADED) return "Đang chờ xử lý Flashcard";
  if (document.status === DocumentStatus.PROCESSING) return "Đang xử lý Flashcard";
  if (document.status === DocumentStatus.FAILED) return "Xử lý Flashcard thất bại";
  if (document.chunkCount <= 0) return "Tài liệu chưa có nội dung để tạo Flashcard";
  if (!document.embeddingReady) return "Embedding chưa sẵn sàng cho Flashcard";
  return null;
}

function getPacketDocumentUnavailableReason(document: {
  sourceDocumentId: string | null;
  pageRange: { pageStart: number; pageEnd: number } | null;
  file: {
    mimeType: string;
    checksum: string | null;
    status: string;
  };
  sourceDocument: { status: DocumentStatus } | null;
}) {
  if (document.file.mimeType !== "application/pdf") return "Chỉ hỗ trợ file PDF";
  if (document.file.status === "DELETED" || !document.file.checksum) {
    return "File PDF không còn khả dụng";
  }
  const hasSourceDocument = document.sourceDocumentId !== null;
  const hasPageRange = document.pageRange !== null;
  if (hasSourceDocument !== hasPageRange) return "Liên kết khoảng trang chưa hoàn chỉnh";
  if (hasSourceDocument && document.sourceDocument?.status !== DocumentStatus.READY) {
    return "Tài liệu nguồn chưa sẵn sàng";
  }
  return null;
}

function getQuizPacketDocumentUnavailableReason(document: {
  sourceDocumentId: string | null;
  pageRange: { pageStart: number; pageEnd: number } | null;
  file: {
    mimeType: string;
    checksum: string | null;
    status: string;
  };
  sourceDocument: { status: DocumentStatus } | null;
}) {
  if (document.file.mimeType !== "application/pdf") return "Chỉ hỗ trợ file PDF";
  if (document.file.status === "DELETED" || !document.file.checksum) {
    return "File PDF không còn khả dụng";
  }
  const hasSourceDocument = document.sourceDocumentId !== null;
  const hasPageRange = document.pageRange !== null;
  if (hasSourceDocument !== hasPageRange) return "Liên kết khoảng trang chưa hoàn chỉnh";
  if (hasSourceDocument && document.sourceDocument?.status !== DocumentStatus.READY) {
    return "Tài liệu nguồn chưa sẵn sàng";
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
  const recordedCostVnd = generation.providerUsageEvents.reduce(
    (total, event) => total + event.costVnd,
    0,
  );
  return {
    aiGenerationId: generation.id,
    type,
    jobId: job?.id ?? null,
    status: job?.status ?? generation.status,
    resourceType: job?.resourceType ?? null,
    resourceId: job?.resourceId ?? null,
    reviewStatus: getGeneratedReviewStatus(type, generation),
    error: job?.errorMessage ?? generation.errorMessage,
    errorDetails: readJobErrorDetails(job?.result),
    createdAt: job?.createdAt ?? generation.createdAt,
    startedAt: job?.startedAt ?? generation.startedAt,
    finishedAt: job?.finishedAt ?? generation.finishedAt,
    updatedAt: job?.updatedAt ?? generation.finishedAt ?? generation.createdAt,
    model: generation.model,
    latencyMs: generation.latencyMs,
    estimatedCostVnd:
      generation.providerUsageEvents.length > 0
        ? recordedCostVnd
        : generation.estimatedCostVnd,
    usageEventCount: generation.providerUsageEvents.length,
    inputMetaJson: generation.inputMetaJson,
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
    return "Tài liệu chưa xử lý xong hoặc PDF chưa sẵn sàng.";
  }
  if (!input.generationReady) {
    return "Đang chờ tạo embedding cho tài liệu.";
  }
  return null;
}

function getQuizReadinessReason(input: {
  activeDocumentCount: number;
  quizDocumentCount: number;
  quizReady: boolean;
}) {
  if (input.activeDocumentCount === 0) return "Buổi học chưa có tài liệu cho Quiz.";
  if (input.quizDocumentCount === 0) {
    return "Tài liệu Quiz chưa có PDF sẵn sàng.";
  }
  if (!input.quizReady) return "PDF Quiz chưa sẵn sàng.";
  return null;
}
