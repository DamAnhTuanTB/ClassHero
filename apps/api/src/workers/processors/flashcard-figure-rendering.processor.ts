import { createHash } from "node:crypto";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  AiGenerationType,
  BackgroundJobQueue,
  BackgroundJobStatus,
  FlashcardFigureAttemptKind,
  FlashcardFigureAttemptStatus,
  FlashcardFigureRole,
  FlashcardFigureRevisionStatus,
  FlashcardFigureStatus,
  Prisma,
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { toJobJson } from "#api/jobs/job-json";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { RealtimeJobSnapshotPublisherService } from "#api/modules/realtime/services/realtime-job-snapshot-publisher.service";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import { FlashcardFigureArtifactService } from "#api/modules/flashcards/services/flashcard-figure-artifact.service";
import { FlashcardTexRendererClientService } from "#api/modules/flashcards/services/flashcard-tex-renderer-client.service";
import {
  buildFlashcardFigureStructuredInput,
  generatedFlashcardFigureSchema,
  type FlashcardFigureContext,
} from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import {
  assertFlashcardFigureLatexSource,
  autoRepairFlashcardFigureLatexSource,
  sanitizeFlashcardFigureSvg,
} from "#api/modules/flashcards/utils/flashcard-figure-source-policy";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { buildItemUsageTarget } from "#api/modules/provider-operations/utils/provider-usage-target";

const durableJobSelect = {
  id: true,
  queue: true,
  status: true,
  ownerUserId: true,
  resourceType: true,
  resourceId: true,
  inputMeta: true,
  attempts: true,
  maxAttempts: true,
} satisfies Prisma.BackgroundJobSelect;

@Injectable()
export class FlashcardFigureRenderingProcessor {
  private readonly logger = new Logger(FlashcardFigureRenderingProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService)
    private readonly provider: AiProviderCallService,
    @Inject(FlashcardTexRendererClientService)
    private readonly renderer: FlashcardTexRendererClientService,
    @Inject(FlashcardFigureArtifactService)
    private readonly artifacts: FlashcardFigureArtifactService,
    @Optional()
    @Inject(RealtimeJobSnapshotPublisherService)
    private readonly realtimeJobs?: RealtimeJobSnapshotPublisherService,
  ) {}

  async process(
    bullJob: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: bullJob.data.backgroundJobId },
      select: durableJobSelect,
    });
    if (!job) throw new UnrecoverableError("Flashcard figure job not found.");
    if (job.queue !== BackgroundJobQueue.FLASHCARD_FIGURE_RENDERING) {
      throw new UnrecoverableError(`Job ${job.id} is not a Flashcard figure job.`);
    }
    if (job.status === BackgroundJobStatus.SUCCEEDED) {
      return skipped(job, "Flashcard figure job already succeeded.");
    }
    if (job.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`Flashcard figure job ${job.id} was cancelled.`);
    }
    const metadata = readRecord(job.inputMeta);
    const figureId = readRequiredString(metadata.figureId, "figureId");
    const revisionId = readRequiredString(metadata.revisionId, "revisionId");
    const context = readContext(metadata.contextSnapshot);
    const routeSnapshot = readRoute(metadata.routeSnapshot);
    const attemptNumber =
      (
        await this.prisma.flashcardFigureRenderAttempt.aggregate({
          where: { flashcardFigureId: figureId },
          _max: { attemptNumber: true },
        })
      )._max.attemptNumber ?? 0;
    const nextAttempt = attemptNumber + 1;
    await this.prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(bullJob.id ?? job.id),
        attempts: nextAttempt,
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });
    await this.realtimeJobs?.publishById(job.id);
    let attemptId: string | null = null;
    try {
      const figure = await this.prisma.flashcardFigure.findFirstOrThrow({
        where: { id: figureId, deletedAt: null, pendingRevisionId: revisionId },
        select: {
          id: true,
          role: true,
          aiGenerationId: true,
          flashcardId: true,
          flashcard: { select: { sortOrder: true } },
          subjectKey: true,
          pendingRevision: { select: { id: true, sourceVersion: true } },
        },
      });
      if (!figure.pendingRevision || figure.role !== FlashcardFigureRole.SOLUTION) {
        throw new UnrecoverableError("FLASHCARD_FIGURE_CONTEXT_MISMATCH");
      }
      const mode = readFigureMode(metadata.mode);
      const baseRequest = buildFlashcardFigureStructuredInput({
        context,
        adminInstructions: readOptionalString(metadata.adminInstructions),
        mode,
        systemPrompt: readOptionalString(metadata.systemPrompt),
        userPrompt: readOptionalString(metadata.userPrompt),
      });
      const request: AiStructuredInput = {
        ...baseRequest,
        model: routeSnapshot.model,
        temperature: routeSnapshot.temperature ?? undefined,
        reasoningEffort: isReasoningEffort(routeSnapshot.reasoningEffort)
          ? routeSnapshot.reasoningEffort
          : undefined,
        maxTokens: routeSnapshot.maxOutputTokens ?? baseRequest.maxTokens,
      };
      const output = await this.provider.generateStructured(
        {
          feature: AiGenerationType.FLASHCARD,
          aiGenerationId: figure.aiGenerationId,
          backgroundJobId: job.id,
          attempt: nextAttempt,
          callSequence: 1,
          operation: "FLASHCARD_SOLUTION_FIGURE_GENERATION",
          targetContext: buildItemUsageTarget({
            kind: "FLASHCARD_CARD",
            entityId: figure.flashcardId,
            sortOrder: figure.flashcard.sortOrder,
            figureRole: "SOLUTION",
          }),
          routeSnapshot,
          allowProviderFallback: false,
        },
        request,
        generatedFlashcardFigureSchema,
      );
      const repaired = autoRepairFlashcardFigureLatexSource({
        source: output.data.latexSource,
        subjectKey: figure.subjectKey,
        authorityText: JSON.stringify({
          role: "SOLUTION",
          front: context.front,
          solution: context.solution,
        }),
      });
      assertFlashcardFigureLatexSource(repaired.source);
      const sourceHash = hash(repaired.source);
      attemptId = (
        await this.prisma.flashcardFigureRenderAttempt.create({
          data: {
            flashcardFigureId: figure.id,
            revisionId,
            backgroundJobId: job.id,
            attemptNumber: nextAttempt,
            sourceVersion: figure.pendingRevision.sourceVersion,
            kind:
              figure.pendingRevision.sourceVersion === 1
                ? FlashcardFigureAttemptKind.INITIAL
                : FlashcardFigureAttemptKind.ADMIN_REGENERATE,
            status: FlashcardFigureAttemptStatus.RUNNING,
            sourceHash,
          },
          select: { id: true },
        })
      ).id;
      await this.prisma.$transaction([
        this.prisma.flashcardFigureRevision.update({
          where: { id: revisionId },
          data: {
            status: FlashcardFigureRevisionStatus.RENDERING,
            latexSource: repaired.source,
            sourceHash,
          },
        }),
        this.prisma.flashcardFigure.update({
          where: { id: figure.id },
          data: { status: FlashcardFigureStatus.RENDERING },
        }),
      ]);
      const rendered = await this.renderer.render(repaired.source, figure.subjectKey);
      if (!rendered.ok) {
        throw new Error(
          [
            rendered.code,
            ...rendered.issues.map((issue) => `${issue.code}: ${issue.message}`),
            rendered.log,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
      const svg = sanitizeFlashcardFigureSvg(rendered.svg);
      await this.prisma.flashcardFigureRevision.update({
        where: { id: revisionId },
        data: {
          previewSvg: svg,
          sanitizedSvgHash: hash(svg),
          rendererVersion: rendered.rendererVersion,
          validatorVersion: "flashcard-svg-policy-v1",
        },
      });
      await this.artifacts.promoteSvg({
        figureId: figure.id,
        revisionId,
        svg,
        actorUserId: job.ownerUserId,
      });
      await this.prisma.flashcardFigureRenderAttempt.update({
        where: { id: attemptId },
        data: {
          status: FlashcardFigureAttemptStatus.SUCCEEDED,
          compileLog: rendered.log,
          durationMs: rendered.durationMs,
          finishedAt: new Date(),
        },
      });
      const result: BackgroundJobBullmqResult = {
        status: "SUCCEEDED",
        queue: BackgroundJobQueue.FLASHCARD_FIGURE_RENDERING,
        resourceType: "FLASHCARD_FIGURE",
        resourceId: figure.id,
        action: "FLASHCARD_FIGURE_RENDER",
        message: "Đã tạo hình minh họa lời giải Flashcard.",
        handledAt: new Date().toISOString(),
        details: { role: "SOLUTION", mode, revisionId },
      };
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: BackgroundJobStatus.SUCCEEDED,
          result: toJobJson(result),
          finishedAt: new Date(),
          errorMessage: null,
        },
      });
      return result;
    } catch (error) {
      const message = getJobErrorMessage(error).slice(0, 2_000);
      const finishedAt = new Date();
      await Promise.allSettled([
        ...(attemptId
          ? [
              this.prisma.flashcardFigureRenderAttempt.update({
                where: { id: attemptId },
                data: {
                  status: FlashcardFigureAttemptStatus.FAILED,
                  errorCategory: "FLASHCARD_FIGURE_RENDER",
                  errorCode: firstErrorCode(message),
                  compileLog: message,
                  finishedAt,
                },
              }),
            ]
          : []),
        this.prisma.flashcardFigureRevision.update({
          where: { id: revisionId },
          data: {
            status: FlashcardFigureRevisionStatus.NEEDS_REVIEW,
            lastErrorCategory: "FLASHCARD_FIGURE_RENDER",
            lastErrorCode: firstErrorCode(message),
            lastErrorMessage: message,
            finishedAt,
          },
        }),
        this.prisma.flashcardFigure.update({
          where: { id: figureId },
          data: {
            status: FlashcardFigureStatus.NEEDS_REVIEW,
            lastErrorCategory: "FLASHCARD_FIGURE_RENDER",
            lastErrorCode: firstErrorCode(message),
            lastErrorMessage: message,
          },
        }),
        this.prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            status: BackgroundJobStatus.FAILED,
            errorMessage: message,
            finishedAt,
          },
        }),
      ]);
      this.logger.warn(`Flashcard figure job ${job.id} failed: ${message}`);
      throw new UnrecoverableError(message);
    }
  }
}

function readContext(value: unknown): FlashcardFigureContext {
  const record = readRecord(value);
  const subject = readRecord(record.subject);
  if (
    typeof record.flashcardId !== "string" ||
    typeof record.front !== "string" ||
    typeof record.solution !== "string" ||
    !["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"].includes(String(subject.key)) ||
    typeof subject.name !== "string" ||
    typeof subject.slug !== "string"
  ) {
    throw new UnrecoverableError("FLASHCARD_FIGURE_CONTEXT_INVALID");
  }
  return {
    flashcardId: record.flashcardId,
    front: record.front,
    solution: record.solution,
    currentSolutionLatexSource:
      typeof record.currentSolutionLatexSource === "string"
        ? record.currentSolutionLatexSource
        : null,
    sourcePacketPageNumbers: Array.isArray(record.sourcePacketPageNumbers)
      ? record.sourcePacketPageNumbers.filter(
          (page): page is number => Number.isInteger(page) && Number(page) > 0,
        )
      : [],
    targetGrade: typeof record.targetGrade === "number" ? record.targetGrade : null,
    subject: {
      key: subject.key as FlashcardFigureContext["subject"]["key"],
      name: subject.name,
      slug: subject.slug,
    },
  };
}

function readFigureMode(value: unknown): "REGENERATE" | "EDIT_CURRENT" {
  return value === "EDIT_CURRENT" ? "EDIT_CURRENT" : "REGENERATE";
}

function readRoute(value: unknown): AiFeatureRoute {
  const route = readRecord(value);
  if (typeof route.model !== "string" || !Array.isArray(route.candidates)) {
    throw new UnrecoverableError("FLASHCARD_FIGURE_ROUTE_INVALID");
  }
  return value as AiFeatureRoute;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) {
    throw new UnrecoverableError(`Flashcard figure job is missing ${field}.`);
  }
  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isReasoningEffort(
  value: unknown,
): value is "none" | "low" | "medium" | "high" | "xhigh" {
  return ["none", "low", "medium", "high", "xhigh"].includes(String(value));
}

function hash(value: string) {
  return createHash("sha256").update(value.trim()).digest("hex");
}

function firstErrorCode(message: string) {
  return message.match(/^([A-Z0-9_]+)/u)?.[1] ?? "FLASHCARD_FIGURE_RENDER_FAILED";
}

function skipped(
  record: Prisma.BackgroundJobGetPayload<{ select: typeof durableJobSelect }>,
  message: string,
): BackgroundJobBullmqResult {
  return {
    status: "SKIPPED",
    queue: record.queue,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    action: "FLASHCARD_FIGURE_RENDER",
    message,
    handledAt: new Date().toISOString(),
  };
}
