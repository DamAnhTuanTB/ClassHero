import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { AiGenerationType, Prisma, ReviewStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import { FlashcardGenerationContextService } from "#api/modules/flashcards/services/flashcard-generation-context.service";
import { FlashcardFiguresService } from "#api/modules/flashcards/services/flashcard-figures.service";
import type { FlashcardFigureContext } from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { buildWholeFeatureUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";
import {
  flashcardGenerationJobInputSchema,
  generatedFlashcardOutputSchema,
} from "#api/modules/flashcards/types/flashcard-generation.types";
import {
  toFlashcardSolutionTiptap,
  toFlashcardTiptap,
  validateGeneratedFlashcards,
} from "#api/modules/flashcards/utils/flashcard-generation-mapper";
import { buildFlashcardStructuredInput } from "#api/modules/flashcards/utils/flashcard-generation-prompt";

@Injectable()
export class FlashcardGenerationService {
  private readonly logger = new Logger(FlashcardGenerationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(FlashcardGenerationContextService)
    private readonly generationContext: FlashcardGenerationContextService,
    @Inject(FlashcardFiguresService)
    private readonly figures: FlashcardFiguresService,
    @Optional()
    @Inject(AiProviderCallService)
    private readonly providerCall?: AiProviderCallService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput> {
    if (!context.lessonId || context.type !== AiGenerationType.FLASHCARD) {
      throw new UnrecoverableError("Flashcard generation requires lessonId.");
    }
    const input = parseJobInput(context.inputMeta);
    const draft = await this.prisma.flashcardGenerationRequestDraft.findFirst({
      where: { id: input.requestDraftId, lessonId: context.lessonId },
    });
    if (
      !draft ||
      draft.requestHash !== input.requestHash ||
      draft.packetHash !== input.packetHash ||
      draft.manifestHash !== input.manifestHash ||
      !draft.packetObjectKey ||
      !draft.packetFilename ||
      draft.packetSizeBytes === null ||
      draft.packetPageCount === null ||
      !draft.manifestJson
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Không tìm thấy request draft Flashcard khớp job.",
      );
    }
    if (hashAiValue(draft.schemaJson) !== draft.schemaHash) {
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Schema Flashcard trong request draft đã thay đổi.",
      );
    }
    const currentSourceHash = await this.generationContext.computeCurrentSourceHash(
      context.lessonId,
      input.documentIds,
    );
    if (currentSourceHash !== input.sourceHash) {
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Nguồn PDF Flashcard đã thay đổi sau khi job được tạo.",
      );
    }
    const packetBytes = await this.generationContext.downloadPacket(
      draft.packetObjectKey,
    );
    const packetHash = createHash("sha256").update(packetBytes).digest("hex");
    if (
      packetHash !== draft.packetHash ||
      BigInt(packetBytes.length) !== draft.packetSizeBytes
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_PACKET_INVALID: Packet PDF Flashcard không còn khớp snapshot.",
      );
    }
    const sourceSnapshot = asRecord(draft.sourceSnapshotJson);
    const manifest = readFlashcardPacketManifest(draft.manifestJson);
    const existingCards = await this.prisma.flashcard.findMany({
      where: { lessonId: context.lessonId, deletedAt: null },
      select: { frontJson: true },
    });
    const request = buildFlashcardStructuredInput({
      lessonId: context.lessonId,
      lessonTitle: readRequiredText(sourceSnapshot.lessonTitle, "lessonTitle"),
      documentIds: input.documentIds,
      sourceHash: input.sourceHash,
      packet: {
        filename: draft.packetFilename,
        bytes: packetBytes,
        modelManifest: manifest.modelManifest,
      },
      configuration: {
        ...input,
        systemInstructions: draft.systemInstructions,
        userPrompt: draft.userPrompt,
      },
      existingFronts: existingCards.map((card) => JSON.stringify(card.frontJson)),
    });
    let output;
    try {
      output = this.providerCall
        ? await this.providerCall.generateStructured(
            {
              feature: AiGenerationType.FLASHCARD,
              aiGenerationId: context.aiGenerationId,
              backgroundJobId: context.backgroundJobId,
              attempt: context.attempt,
              operation: "FLASHCARD_GENERATION",
              targetContext: buildWholeFeatureUsageTarget(
                AiGenerationType.FLASHCARD,
                context.aiGenerationId,
              ),
              routeSnapshot: context.providerRouteSnapshot,
            },
            request,
            generatedFlashcardOutputSchema,
          )
        : await this.aiService.generateStructured(
            request,
            generatedFlashcardOutputSchema,
          );
    } finally {
      await this.generationContext
        .cleanupPacket(draft.packetObjectKey)
        .catch(() => undefined);
    }
    validateGeneratedFlashcards({
      output: output.data,
      requestedCount: input.cardCount,
      packetPageCount: draft.packetPageCount,
      difficulty: input.difficulty,
      difficultyCounts: input.difficultyCounts,
    });
    return { action: "FLASHCARD", output };
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId || context.type !== AiGenerationType.FLASHCARD) {
      throw new UnrecoverableError("Flashcard persistence requires lessonId.");
    }
    const input = parseJobInput(context.inputMeta);
    const output = parseAiStructuredOutput(
      generatedFlashcardOutputSchema,
      prepared.output.data,
    );
    const draft = await this.prisma.flashcardGenerationRequestDraft.findFirst({
      where: { id: input.requestDraftId, lessonId: context.lessonId },
      select: { manifestJson: true },
    });
    if (!draft?.manifestJson) {
      throw new UnrecoverableError(
        "AI_INPUT_MANIFEST_INVALID: Không tìm thấy manifest packet PDF Flashcard.",
      );
    }
    const manifestPages = draftManifestPages(draft.manifestJson);
    if (!context.ownerUserId) {
      throw new UnrecoverableError(
        "FLASHCARD_GENERATION_OWNER_REQUIRED: Không có admin sở hữu lượt sinh.",
      );
    }
    const figureCandidates: Array<{
      flashcardId: string;
      context: FlashcardFigureContext;
    }> = [];
    const persistence = await this.prisma.$transaction(async (tx) => {
      const set = await tx.flashcardSet.findFirst({
        where: {
          id: input.targetFlashcardSetId,
          lessonId: context.lessonId!,
          deletedAt: null,
        },
        select: { id: true, cardCount: true },
      });
      if (!set) {
        throw new UnrecoverableError(
          "FLASHCARD_TARGET_SET_NOT_FOUND: Bộ Flashcard đích không còn tồn tại.",
        );
      }
      const lastCard = await tx.flashcard.findFirst({
        where: { flashcardSetId: set.id, deletedAt: null },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });
      const firstSortOrder = (lastCard?.sortOrder ?? -1) + 1;
      for (const [index, card] of output.cards.entries()) {
        const cardId = randomUUID();
        await tx.flashcard.create({
          data: {
            id: cardId,
            flashcardSetId: set.id,
            lessonId: context.lessonId!,
            frontJson: json(toFlashcardTiptap(card.front)),
            backJson: json(toFlashcardTiptap(card.back)),
            solutionJson: json(toFlashcardSolutionTiptap(card.solution)),
            difficulty: card.difficulty,
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            sortOrder: firstSortOrder + index,
            sourceMetadataJson: json({
              sourceHash: input.sourceHash,
              sourcePacketPageNumbers: card.sourcePacketPageNumbers,
              sourcePages: resolveSourcePages(
                card.sourcePacketPageNumbers,
                input.requestDraftId,
                manifestPages,
              ),
              aiGenerationId: context.aiGenerationId,
              generationCardIndex: index,
              requiresSolutionFigure: card.requiresSolutionFigure,
            }),
          },
        });
        const baseFigureContext = {
          flashcardId: cardId,
          front: card.front,
          solution: card.solution,
          sourcePacketPageNumbers: card.sourcePacketPageNumbers,
          targetGrade: input.targetGrade,
          subject: {
            key: input.subjectKey,
            name: input.subjectName,
            slug: input.subjectSlug,
          },
        };
        if (card.requiresSolutionFigure) {
          figureCandidates.push({
            flashcardId: cardId,
            context: baseFigureContext,
          });
        }
      }
      await tx.flashcardSet.update({
        where: { id: set.id },
        data: {
          cardCount: set.cardCount + output.cards.length,
          updatedById: context.ownerUserId,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: context.ownerUserId,
          action: "FLASHCARD_SET_AI_GENERATED",
          entityType: "FlashcardSet",
          entityId: set.id,
          after: toJobJson({ itemCount: output.cards.length }),
          metadata: toJobJson({
            backgroundJobId: context.backgroundJobId,
            aiGenerationId: context.aiGenerationId,
          }),
        },
      });
      return {
        resourceType: "FLASHCARD_SET",
        resourceId: set.id,
        message: "Đã thêm thẻ ghi nhớ AI vào bộ Flashcard.",
        result: {
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          itemCount: output.cards.length,
        },
      };
    });
    const imageRouteSnapshot = readImageRouteSnapshot(context.inputMeta);
    if (figureCandidates.length > 0 && !imageRouteSnapshot) {
      this.logger.warn(
        `Flashcard generation ${context.aiGenerationId} selected ${figureCandidates.length} solution figure(s) but has no valid image route snapshot.`,
      );
      return persistence;
    }
    if (imageRouteSnapshot) {
      const enqueueResults = await Promise.allSettled(
        figureCandidates.map((candidate) =>
          this.figures.createFromContentDecision({
            flashcardId: candidate.flashcardId,
            actorUserId: context.ownerUserId!,
            aiGenerationId: context.aiGenerationId,
            context: candidate.context,
            routeSnapshot: imageRouteSnapshot,
          }),
        ),
      );
      enqueueResults.forEach((result, index) => {
        if (result.status === "rejected") {
          this.logger.error(
            `Could not enqueue Flashcard solution figure ${figureCandidates[index]?.flashcardId ?? "unknown"}: ${getErrorMessage(result.reason)}`,
          );
        }
      });
    }
    return persistence;
  }
}

function parseJobInput(value: unknown) {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).filter(
            ([key]) => key !== "providerRouteSnapshot" && key !== "imageRouteSnapshot",
          ),
        )
      : value;
  const parsed = flashcardGenerationJobInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new UnrecoverableError(
      `Invalid flashcard generation input: ${parsed.error.issues[0]?.message ?? "unknown error"}`,
    );
  }
  return parsed.data;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readImageRouteSnapshot(value: unknown): AiFeatureRoute | null {
  const snapshot = asRecord(value).imageRouteSnapshot;
  const record = asRecord(snapshot);
  return typeof record.model === "string" && Array.isArray(record.candidates)
    ? (snapshot as AiFeatureRoute)
    : null;
}

function getErrorMessage(value: unknown) {
  return value instanceof Error ? value.message : String(value);
}

function readRequiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UnrecoverableError(`AI_INPUT_SNAPSHOT_INVALID: Thiếu trường ${field}.`);
  }
  return value;
}

function readFlashcardPacketManifest(value: unknown) {
  const record = asRecord(value);
  if (record.version !== 1 || !Array.isArray(record.pages)) {
    throw new UnrecoverableError(
      "AI_INPUT_MANIFEST_INVALID: Manifest packet PDF Flashcard không hợp lệ.",
    );
  }
  const pages = record.pages.map((rawPage) => {
    const page = asRecord(rawPage);
    const packetPageNumber = Number(page.packetPageNumber);
    const sourcePdfPageNumber = Number(page.sourcePdfPageNumber);
    if (!Number.isInteger(packetPageNumber) || !Number.isInteger(sourcePdfPageNumber)) {
      throw new UnrecoverableError(
        "AI_INPUT_MANIFEST_INVALID: Số trang trong manifest Flashcard không hợp lệ.",
      );
    }
    return {
      packetPageNumber,
      sourcePdfPageNumber,
      sourceKey: readRequiredText(page.sourceKey, "sourceKey"),
      documentTitle: readRequiredText(page.documentTitle, "documentTitle"),
      printedPageLabel:
        typeof page.printedPageLabel === "string" ? page.printedPageLabel : null,
      lessonDocumentId:
        typeof page.lessonDocumentId === "string" ? page.lessonDocumentId : null,
      sourceDocumentId:
        typeof page.sourceDocumentId === "string" ? page.sourceDocumentId : null,
    };
  });
  return {
    pages,
    modelManifest: {
      version: 1 as const,
      pages: pages.map((page) => ({
        packetPageNumber: page.packetPageNumber,
        sourceKey: page.sourceKey,
        documentTitle: page.documentTitle,
        sourcePdfPageNumber: page.sourcePdfPageNumber,
        printedPageLabel: page.printedPageLabel,
      })),
    },
  };
}

function draftManifestPages(value: unknown) {
  return readFlashcardPacketManifest(value).pages;
}

function resolveSourcePages(
  pageNumbers: number[],
  requestDraftId: string,
  pages: ReturnType<typeof draftManifestPages>,
) {
  return pageNumbers.map((packetPageNumber) => {
    const page = pages.find(
      (candidate) => candidate.packetPageNumber === packetPageNumber,
    );
    if (!page) {
      throw new UnrecoverableError(
        `AI_OUTPUT_SOURCE_INVALID: Trang packet ${packetPageNumber} không tồn tại.`,
      );
    }
    return {
      requestDraftId,
      packetPageNumber,
      sourcePdfPageNumber: page.sourcePdfPageNumber,
      printedPageLabel: page.printedPageLabel,
      documentTitle: page.documentTitle,
      lessonDocumentId: page.lessonDocumentId,
      sourceDocumentId: page.sourceDocumentId,
    };
  });
}
