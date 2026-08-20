import { createHash } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { AiGenerationType, ContentSource, ReviewStatus } from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { AiService } from "#api/modules/ai/services/ai.service";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { LessonSourcePacketService } from "#api/modules/ai/services/lesson-source-packet.service";
import type { LessonSourcePacketManifest } from "#api/modules/ai/types/lesson-source-packet.types";
import {
  LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
  lessonSummaryJobInputSchema,
  lessonSummaryOutputSchema,
  stemFigurePlanDraftSchema,
  getLessonSummaryProviderTransportOutputSchema,
  type LessonSummaryOutput,
} from "#api/modules/ai/types/lesson-summary.types";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import { StemFiguresService } from "#api/modules/stem-figures/services/stem-figures.service";
import {
  FigureReferenceResolverService,
  hashFigureReferenceSnapshot,
  type FigureReferenceAsset,
  type FigureReferenceSnapshot,
} from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { buildStemFigureGenerationBrief } from "#api/modules/stem-figures/utils/stem-figure-generation-brief";
import { compareStemFigurePositions } from "#api/modules/stem-figures/utils/stem-figure-position";

@Injectable()
export class LessonSummaryGenerationService {
  private readonly logger = new Logger(LessonSummaryGenerationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(LessonSourcePacketService)
    private readonly packets: LessonSourcePacketService,
    @Inject(StemFigureJobService)
    private readonly stemFigureJobs: StemFigureJobService,
    @Inject(FigureReferenceResolverService)
    private readonly figureReferences: FigureReferenceResolverService,
    @Inject(StemFiguresService)
    private readonly stemFigures: StemFiguresService,
    @Optional()
    @Inject(AiProviderCallService)
    private readonly providerCall?: AiProviderCallService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput<LessonSummaryOutput>> {
    if (context.type !== AiGenerationType.SUMMARY || !context.lessonId) {
      throw new UnrecoverableError("Invalid lesson summary generation context.");
    }
    const input = lessonSummaryJobInputSchema.safeParse(
      omitProviderRouteSnapshot(context.inputMeta),
    );
    if (!input.success) {
      throw new UnrecoverableError(
        `Invalid lesson summary job input: ${input.error.issues[0]?.message ?? "unknown error"}`,
      );
    }

    const draft = await this.prisma.lessonSummaryRequestDraft.findFirst({
      where: { id: input.data.requestDraftId, lessonId: context.lessonId },
    });
    if (
      !draft ||
      draft.requestHash !== input.data.requestHash ||
      draft.packetHash !== input.data.packetHash ||
      draft.manifestHash !== input.data.manifestHash
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Không tìm thấy request draft bất biến khớp với job.",
      );
    }
    const currentSourceHash = await this.packets.computeCurrentSourceHash(
      context.lessonId,
      input.data.documentIds,
    );
    if (currentSourceHash !== input.data.sourceHash) {
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Tài liệu buổi học đã thay đổi sau khi job được tạo.",
      );
    }
    const packetBytes = await this.downloadAndVerifyPacket(draft);
    const sourceSnapshot = readRecord(draft.sourceSnapshotJson);
    const manifest = readPacketManifest(draft.manifestJson);
    const subject = {
      key: input.data.subjectKey,
      name: input.data.subjectName,
      slug: input.data.subjectSlug,
    } as const;
    const structuredInput = buildLessonSummaryStructuredInput({
      lessonId: context.lessonId,
      lessonTitle: readRequiredText(sourceSnapshot.lessonTitle, "lessonTitle"),
      targetGrade: input.data.targetGrade,
      subject,
      documentIds: input.data.documentIds,
      sourceHash: input.data.sourceHash,
      packet: {
        filename: draft.packetFilename,
        bytes: packetBytes,
        modelManifest: {
          version: 1,
          pages: manifest.pages.map((page) => ({
            packetPageNumber: page.packetPageNumber,
            sourceKey: page.sourceKey,
            documentTitle: page.documentTitle,
            sourcePdfPageNumber: page.sourcePdfPageNumber,
            printedPageLabel: page.printedPageLabel,
          })),
        },
      },
      configuration: input.data,
      systemInstructions: draft.systemInstructions,
      userPrompt: draft.userPrompt,
    });
    const providerSchema = getLessonSummaryProviderTransportOutputSchema(
      subject.key,
      "CONTEXTUAL",
      input.data.targetGrade,
    );
    const schemaHash = hashAiValue(
      buildAiStructuredTextFormat(
        providerSchema,
        structuredInput.outputName,
        structuredInput.schemaReferenceStrategy,
      ).schema,
    );
    if (schemaHash !== draft.schemaHash) {
      throw new UnrecoverableError(
        "AI_INPUT_SCHEMA_STALE: Output schema đã thay đổi sau khi preview.",
      );
    }
    let providerOutput;
    try {
      providerOutput = this.providerCall
        ? await this.providerCall.generateStructured(
            {
              feature: AiGenerationType.SUMMARY,
              aiGenerationId: context.aiGenerationId,
              backgroundJobId: context.backgroundJobId,
              attempt: context.attempt,
              callSequence: 1,
              routeSnapshot: normalizeSummaryRouteSnapshot(context.providerRouteSnapshot),
            },
            structuredInput,
            providerSchema,
          )
        : await this.aiService.generateStructured(structuredInput, providerSchema);
    } finally {
      await this.packets.cleanup(draft.packetObjectKey).catch(() => undefined);
    }

    const mapped = mapLessonSummaryProviderOutput({
      lessonId: context.lessonId,
      output: providerOutput.data,
      packetPageCount: draft.packetPageCount,
      targetGrade: input.data.targetGrade,
      subjectKey: subject.key,
    });
    return {
      action: "SUMMARY",
      output: { ...providerOutput, data: mapped.content },
      recordedOutput: {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: providerOutput.data,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: subject.key,
        targetGrade: input.data.targetGrade,
        packetPageCount: draft.packetPageCount,
      },
      contextMetadata: {
        figures: mapped.figures,
        subject,
        targetGrade: input.data.targetGrade,
        packetManifest: manifest,
        requestDraftId: draft.id,
        routeSnapshot: normalizeFigureRouteSnapshot(context.providerRouteSnapshot),
      },
    };
  }

  private async downloadAndVerifyPacket(draft: {
    packetObjectKey: string;
    packetHash: string;
    packetSizeBytes: bigint;
  }) {
    const bytes = await this.packets.download(draft.packetObjectKey);
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (
      actualHash !== draft.packetHash ||
      BigInt(bytes.length) !== draft.packetSizeBytes
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_PACKET_INVALID: Packet PDF không còn khớp snapshot.",
      );
    }
    return bytes;
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId) {
      throw new UnrecoverableError("Lesson summary persistence requires lessonId.");
    }
    const output = parseAiStructuredOutput(
      lessonSummaryOutputSchema,
      prepared.output.data,
    );
    const figureDrafts = readFigureDrafts(prepared.contextMetadata);
    const subject = readSubjectSnapshot(prepared.contextMetadata);
    const targetGrade = readTargetGrade(prepared.contextMetadata);
    const routeSnapshot = readFigureRouteSnapshot(prepared.contextMetadata);
    const packetManifest = readPacketManifestFromMetadata(prepared.contextMetadata);
    const textbookSourceImageOptions = readTextbookSourceImageOptions(context.inputMeta);
    const { useTextbookSourceImages, autoEnhanceTextbookSourceImages } =
      textbookSourceImageOptions;
    const referenceResolutions = await this.figureReferences.resolveMany({
      manifest: packetManifest,
      plans: figureDrafts.map((item) => item.draft),
    });
    const resolvedFigureDrafts = figureDrafts.map((item, index) => {
      const resolution = referenceResolutions[index];
      if (!resolution) {
        throw new UnrecoverableError(
          "STEM_FIGURE_REFERENCE_RESOLUTION_MISSING: Kết quả phân giải hình không đầy đủ.",
        );
      }
      return {
        ...item,
        draft: resolution.plan,
        referenceSnapshot: resolution.snapshot,
      };
    });
    const figuresToPersist = buildFiguresToPersist(
      resolvedFigureDrafts,
      useTextbookSourceImages,
    );

    const summary = await this.prisma.$transaction(async (transaction) => {
      const lesson = await transaction.lesson.findFirst({
        where: { id: context.lessonId!, deletedAt: null },
        select: { id: true },
      });
      if (!lesson) {
        throw new UnrecoverableError("LESSON_NOT_FOUND: Không tìm thấy buổi học.");
      }
      const before = await transaction.lessonSummary.findUnique({
        where: { lessonId: context.lessonId! },
        select: { id: true, aiGenerationId: true },
      });
      const persistedBase = await transaction.lessonSummary.upsert({
        where: { lessonId: context.lessonId! },
        create: {
          lessonId: context.lessonId!,
          contentJson: {
            type: "lesson_summary_blocks",
            version: 3,
            data: output,
          },
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: context.aiGenerationId,
          ...(context.ownerUserId
            ? {
                createdById: context.ownerUserId,
                updatedById: context.ownerUserId,
              }
            : {}),
        },
        update: {
          contentJson: {
            type: "lesson_summary_blocks",
            version: 3,
            data: output,
          },
          source: ContentSource.AI,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          aiGenerationId: context.aiGenerationId,
          ...(context.ownerUserId ? { updatedById: context.ownerUserId } : {}),
          deletedAt: null,
        },
        select: { id: true },
      });

      await transaction.stemFigure.deleteMany({
        // The uniqueness constraint also covers soft-deleted rows. A full Summary
        // regeneration replaces the complete figure set, so stale deleted rows
        // must be removed too before recreating the same block positions.
        where: { lessonSummaryId: persistedBase.id },
      });
      const contentWithFigures = structuredClone(output);
      const createdFigures = [];
      for (const item of figuresToPersist) {
        const generationBrief =
          item.mode === "PHASE_TWO"
            ? buildStemFigureGenerationBrief({
                output,
                blockPath: item.blockPath,
                plan: item.draft,
                targetGrade,
                referenceAssets: item.referenceSnapshot.assets,
              })
            : null;
        const initialStatus = item.mode === "PHASE_TWO" ? "QUEUED" : "NEEDS_REVIEW";
        const created = await transaction.stemFigure.create({
          data: {
            lessonId: context.lessonId!,
            lessonSummaryId: persistedBase.id,
            aiGenerationId: context.aiGenerationId,
            blockPath: item.blockPath,
            figureIndex: item.figureIndex,
            localPlanId: item.draft.localId,
            planJson: item.draft,
            subjectKey: subject.key,
            subjectName: subject.name,
            subjectSlug: subject.slug,
            createdById: context.ownerUserId,
            status: initialStatus,
          },
          select: { id: true, blockPath: true },
        });
        const revision = await transaction.stemFigureRevision.create({
          data: {
            stemFigureId: created.id,
            origin: "INITIAL_AI",
            status: initialStatus,
            latexSource: null,
            sourceHash: null,
            referenceSnapshotJson: item.referenceSnapshot,
            referenceSnapshotHash: hashFigureReferenceSnapshot(item.referenceSnapshot),
            generationBriefHash: generationBrief ? hashAiValue(generationBrief) : null,
            sourceVersion: 1,
            altText: item.draft.altText,
            caption: item.draft.caption,
            createdById: context.ownerUserId,
          },
          select: { id: true },
        });
        await transaction.stemFigure.update({
          where: { id: created.id },
          data: { pendingRevisionId: revision.id },
        });
        attachFigureReference(contentWithFigures, created.blockPath, item.figureIndex, {
          kind: "TEX_FIGURE",
          figureId: created.id,
          figureOrigin: item.draft.figureOrigin,
          altText: item.draft.altText,
          caption: item.draft.caption,
          status: initialStatus,
        });
        createdFigures.push({
          ...created,
          revisionId: revision.id,
          generationBrief,
          mode: item.mode,
          sourceAsset: item.sourceAsset,
          referenceSnapshot: item.referenceSnapshot,
          referenceSnapshotHash: hashFigureReferenceSnapshot(item.referenceSnapshot),
        });
      }
      const persisted = await transaction.lessonSummary.update({
        where: { id: persistedBase.id },
        data: {
          contentJson: {
            type: "lesson_summary_blocks",
            version: 3,
            data: contentWithFigures,
          },
        },
        select: {
          id: true,
          lessonId: true,
          source: true,
          reviewStatus: true,
          aiGenerationId: true,
          updatedAt: true,
        },
      });

      if (before?.aiGenerationId !== context.aiGenerationId) {
        await transaction.auditLog.create({
          data: {
            actorUserId: context.ownerUserId,
            action: "LESSON_SUMMARY_AI_GENERATED",
            entityType: "LessonSummary",
            entityId: persisted.id,
            after: toJobJson(persisted),
            metadata: toJobJson({
              backgroundJobId: context.backgroundJobId,
              aiGenerationId: context.aiGenerationId,
            }),
          },
        });
      }

      return { persisted, createdFigures };
    });

    const importedSourceFigureIds = new Set<string>();
    if (useTextbookSourceImages) {
      // Promote sequentially because each promotion updates the same Summary JSON.
      // Parallel transactions could overwrite another crop's SUCCEEDED reference.
      for (const figure of summary.createdFigures) {
        if (figure.mode !== "SOURCE_CROP" || !figure.sourceAsset) continue;
        try {
          await this.stemFigures.promoteResolvedSourceCrop({
            lessonId: context.lessonId!,
            figureId: figure.id,
            actorUserId: context.ownerUserId,
            assetObjectKey: figure.sourceAsset.objectKey,
            referenceSnapshot: figure.referenceSnapshot,
            referenceSnapshotHash: figure.referenceSnapshotHash,
            autoEnhance: autoEnhanceTextbookSourceImages,
          });
          importedSourceFigureIds.add(figure.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Không thể tự gắn crop SGK cho stem figure ${figure.id}: ${message}`,
          );
          await this.prisma.$transaction([
            this.prisma.stemFigure.update({
              where: { id: figure.id },
              data: {
                status: "NEEDS_REVIEW",
                lastErrorCategory: "SOURCE_CROP_IMPORT",
                lastErrorCode: "STEM_FIGURE_SOURCE_CROP_IMPORT_FAILED",
                lastErrorMessage: message.slice(0, 2_000),
              },
            }),
            this.prisma.stemFigureRevision.update({
              where: { id: figure.revisionId },
              data: {
                status: "NEEDS_REVIEW",
                lastErrorCategory: "SOURCE_CROP_IMPORT",
                lastErrorCode: "STEM_FIGURE_SOURCE_CROP_IMPORT_FAILED",
                lastErrorMessage: message.slice(0, 2_000),
                finishedAt: new Date(),
              },
            }),
          ]);
        }
      }
    } else {
      await Promise.all(
        summary.createdFigures.map((figure) =>
          this.stemFigureJobs.enqueue(figure.id, context.ownerUserId, {
            revisionId: figure.revisionId,
            trigger: "INITIAL",
            generationBrief: figure.generationBrief!,
            routeSnapshot,
          }),
        ),
      );
    }

    const sourceFigureNeedsReviewCount = summary.createdFigures.filter(
      (figure) =>
        figure.mode === "NEEDS_REVIEW" ||
        (figure.mode === "SOURCE_CROP" && !importedSourceFigureIds.has(figure.id)),
    ).length;

    return {
      resourceType: "LESSON_SUMMARY",
      resourceId: summary.persisted.id,
      message: useTextbookSourceImages
        ? autoEnhanceTextbookSourceImages
          ? "Đã tạo tóm tắt, tự động làm nét và xử lý ảnh gốc sách giáo khoa."
          : "Đã tạo tóm tắt và xử lý ảnh gốc sách giáo khoa."
        : "Đã tạo tóm tắt buổi học bằng AI.",
      result: {
        lessonId: summary.persisted.lessonId,
        reviewStatus: summary.persisted.reviewStatus,
        stemFigureCount: summary.createdFigures.length,
        sourceFigureImportedCount: importedSourceFigureIds.size,
        sourceFigureEnhancedCount: autoEnhanceTextbookSourceImages
          ? importedSourceFigureIds.size
          : 0,
        sourceFigureNeedsReviewCount,
        generatedFigureSkippedCount: useTextbookSourceImages
          ? figureDrafts.filter(
              (figure) => figure.draft.figureOrigin === "GENERATED_FROM_BRIEF",
            ).length
          : 0,
        phaseTwoEnqueuedCount: useTextbookSourceImages
          ? 0
          : summary.createdFigures.length,
      },
    };
  }
}

function readFigureDrafts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const figures = (value as Record<string, unknown>).figures;
  if (!Array.isArray(figures)) return [];
  return figures
    .flatMap((figure) => {
      if (!figure || typeof figure !== "object" || Array.isArray(figure)) return [];
      const record = figure as Record<string, unknown>;
      if (typeof record.blockPath !== "string") return [];
      const draft = stemFigurePlanDraftSchema.safeParse(record.draft);
      const figureIndex = record.figureIndex;
      return draft.success &&
        typeof figureIndex === "number" &&
        Number.isInteger(figureIndex)
        ? [{ blockPath: record.blockPath, figureIndex, draft: draft.data }]
        : [];
    })
    .sort(compareStemFigurePositions);
}

type ResolvedFigureDraft = ReturnType<typeof readFigureDrafts>[number] & {
  referenceSnapshot: FigureReferenceSnapshot;
};

type FigureToPersist = ResolvedFigureDraft & {
  mode: "PHASE_TWO" | "SOURCE_CROP" | "NEEDS_REVIEW";
  sourceAsset?: FigureReferenceAsset;
};

export function buildFiguresToPersist(
  figures: ResolvedFigureDraft[],
  useTextbookSourceImages: boolean,
): FigureToPersist[] {
  if (!useTextbookSourceImages) {
    return figures.map((figure) => ({ ...figure, mode: "PHASE_TWO" }));
  }

  const usedLocalIds = new Set(figures.map((figure) => figure.draft.localId));
  const nextFigureIndexByBlock = new Map<string, number>();
  const result: FigureToPersist[] = [];

  for (const figure of figures) {
    // The checked mode only reuses textbook evidence already returned by Phase 1.
    // AI-authored figure ideas have no source crop, so they remain in the raw
    // Phase-1 audit output but are not materialized and never reach Phase 2.
    if (figure.draft.figureOrigin === "GENERATED_FROM_BRIEF") continue;

    const assets = figure.referenceSnapshot.assets;
    const canAutoPromoteAll =
      figure.referenceSnapshot.status === "resolved" &&
      assets.length > 0 &&
      assets.length <= 3 &&
      assets.every((asset) => asset.source === "OCR_CROP");
    const firstIndex = nextFigureIndexByBlock.get(figure.blockPath) ?? 0;

    if (!canAutoPromoteAll) {
      const draft = {
        ...figure.draft,
        localId: figure.draft.localId,
      };
      result.push({
        ...figure,
        draft,
        figureIndex: firstIndex,
        referenceSnapshot: {
          ...figure.referenceSnapshot,
          localPlanId: draft.localId,
        },
        mode: "NEEDS_REVIEW",
      });
      nextFigureIndexByBlock.set(figure.blockPath, firstIndex + 1);
      continue;
    }

    assets.forEach((asset, assetIndex) => {
      const localId =
        assetIndex === 0 ? figure.draft.localId : allocateStemFigureLocalId(usedLocalIds);
      usedLocalIds.add(localId);
      const draft = { ...figure.draft, localId };
      result.push({
        ...figure,
        draft,
        figureIndex: firstIndex + assetIndex,
        referenceSnapshot: {
          ...figure.referenceSnapshot,
          localPlanId: localId,
          assets: [asset],
        },
        mode: "SOURCE_CROP",
        sourceAsset: asset,
      });
    });
    nextFigureIndexByBlock.set(figure.blockPath, firstIndex + assets.length);
  }

  return result;
}

function allocateStemFigureLocalId(used: Set<string>) {
  for (let value = 1; value <= 999; value += 1) {
    const candidate = `F${String(value).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new UnrecoverableError("STEM_FIGURE_LOCAL_ID_EXHAUSTED");
}

function readTextbookSourceImageOptions(value: unknown) {
  const parsed = lessonSummaryJobInputSchema.safeParse(omitProviderRouteSnapshot(value));
  if (!parsed.success) {
    return {
      useTextbookSourceImages: false,
      autoEnhanceTextbookSourceImages: false,
    };
  }
  return {
    useTextbookSourceImages: parsed.data.useTextbookSourceImages,
    autoEnhanceTextbookSourceImages:
      parsed.data.useTextbookSourceImages && parsed.data.autoEnhanceTextbookSourceImages,
  };
}

function readTargetGrade(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetGrade = (value as Record<string, unknown>).targetGrade;
  return typeof targetGrade === "number" && Number.isInteger(targetGrade)
    ? targetGrade
    : null;
}

function readPacketManifestFromMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnrecoverableError("Missing lesson PDF packet manifest.");
  }
  return readPacketManifest((value as Record<string, unknown>).packetManifest);
}

function readFigureRouteSnapshot(value: unknown): AiFeatureRoute | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const route = (value as Record<string, unknown>).routeSnapshot;
  return route && typeof route === "object" && !Array.isArray(route)
    ? (route as AiFeatureRoute)
    : undefined;
}

function readSubjectSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnrecoverableError("Missing lesson subject snapshot for STEM figures.");
  }
  const subject = (value as Record<string, unknown>).subject;
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) {
    throw new UnrecoverableError("Missing lesson subject snapshot for STEM figures.");
  }
  const record = subject as Record<string, unknown>;
  if (
    !["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"].includes(String(record.key)) ||
    typeof record.name !== "string" ||
    typeof record.slug !== "string"
  ) {
    throw new UnrecoverableError("Invalid lesson subject snapshot for STEM figures.");
  }
  return {
    key: record.key as "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL",
    name: record.name,
    slug: record.slug,
  };
}

function attachFigureReference(
  content: LessonSummaryOutput,
  blockPath: string,
  figureIndex: number,
  visual: {
    kind: "TEX_FIGURE";
    figureId: string;
    figureOrigin: "TEXTBOOK_SOURCE" | "GENERATED_FROM_BRIEF";
    altText: string;
    caption: string | null;
    status: "QUEUED" | "NEEDS_REVIEW";
  },
) {
  const match = blockPath.match(/^sections\.(\d+)\.blocks\.(\d+)$/u);
  if (!match) throw new Error(`Invalid STEM figure block path: ${blockPath}`);
  const section = content.sections[Number(match[1])];
  const block = section?.blocks[Number(match[2])];
  if (!block) throw new Error(`STEM figure block path not found: ${blockPath}`);
  block.figures[figureIndex] = visual;
}

function omitProviderRouteSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([key]) => key !== "providerRouteSnapshot",
    ),
  );
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UnrecoverableError(
      "AI_INPUT_SNAPSHOT_INVALID: Snapshot JSON không hợp lệ.",
    );
  }
  return value as Record<string, unknown>;
}

function readRequiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UnrecoverableError(
      `AI_INPUT_SNAPSHOT_INVALID: Snapshot thiếu trường ${field}.`,
    );
  }
  return value;
}

function readRequiredInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new UnrecoverableError(
      `AI_INPUT_SNAPSHOT_INVALID: Snapshot thiếu trường ${field}.`,
    );
  }
  return value;
}

function readNullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readPacketManifest(value: unknown): LessonSourcePacketManifest {
  const manifest = readRecord(value);
  if (manifest.version !== 1 || !Array.isArray(manifest.pages)) {
    throw new UnrecoverableError(
      "AI_INPUT_MANIFEST_INVALID: Packet manifest không hợp lệ.",
    );
  }
  const pages = manifest.pages.map((value, index) => {
    const page = readRecord(value);
    return {
      packetPageNumber: readRequiredInteger(
        page.packetPageNumber,
        `pages.${index}.packetPageNumber`,
      ),
      sourceKey: readRequiredText(page.sourceKey, `pages.${index}.sourceKey`),
      lessonDocumentId: readRequiredText(
        page.lessonDocumentId,
        `pages.${index}.lessonDocumentId`,
      ),
      sourceDocumentId: readNullableText(page.sourceDocumentId),
      sourceFileId: readRequiredText(page.sourceFileId, `pages.${index}.sourceFileId`),
      sourcePdfPageNumber: readRequiredInteger(
        page.sourcePdfPageNumber,
        `pages.${index}.sourcePdfPageNumber`,
      ),
      printedPageLabel: readNullableText(page.printedPageLabel),
      pageRangeId: readNullableText(page.pageRangeId),
      documentTitle: readRequiredText(page.documentTitle, `pages.${index}.documentTitle`),
      segmentOrder: readRequiredInteger(page.segmentOrder, `pages.${index}.segmentOrder`),
    };
  });
  const pageCount = readRequiredInteger(manifest.pageCount, "pageCount");
  if (pageCount !== pages.length) {
    throw new UnrecoverableError(
      "AI_INPUT_MANIFEST_INVALID: Số trang packet không khớp manifest.",
    );
  }
  return {
    version: 1,
    lessonId: readRequiredText(manifest.lessonId, "lessonId"),
    packetHash: readRequiredText(manifest.packetHash, "packetHash"),
    pageCount,
    pages,
  };
}

function normalizeSummaryRouteSnapshot(
  route: AiGenerationExecutionContext["providerRouteSnapshot"],
) {
  if (!route) return undefined;
  const selectedCandidate =
    route.candidates.find((candidate) => candidate.available) ?? route.candidates[0];
  return {
    ...route,
    candidates: selectedCandidate ? [selectedCandidate] : [],
    maxOutputTokens: Math.max(
      route.maxOutputTokens ?? 0,
      LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
    ),
  };
}

function normalizeFigureRouteSnapshot(
  route: AiGenerationExecutionContext["providerRouteSnapshot"],
) {
  const normalized = normalizeSummaryRouteSnapshot(route);
  if (!normalized) return undefined;
  return {
    ...normalized,
    maxOutputTokens: Math.min(normalized.maxOutputTokens, 6_000),
  };
}
