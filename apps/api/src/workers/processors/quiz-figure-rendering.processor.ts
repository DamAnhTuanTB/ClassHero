import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiGenerationType,
  BackgroundJobQueue,
  BackgroundJobStatus,
  Prisma,
  QuizFigureAttemptKind,
  QuizFigureAttemptStatus,
  QuizFigureRevisionStatus,
  QuizFigureRole,
  QuizFigureStatus,
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { toJobJson } from "#api/jobs/job-json";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import {
  AiProviderCallService,
  type ResolvedAiStructuredRequestTrace,
} from "#api/modules/ai/services/ai-provider-call.service";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import {
  QuizTexRendererClientService,
  type QuizTexRendererResult,
} from "#api/modules/quiz-figures/services/quiz-tex-renderer-client.service";
import {
  buildQuestionFigureInput,
  buildQuizFigureRefinementInput,
  buildSolutionFigureInput,
  generatedQuizQuestionFigureSchema,
  generatedQuizFigureRefinementSchema,
  generatedQuizSolutionFigureSchema,
  quizFigurePlanSchema,
  readQuizFigureTargetGrade,
  resolveQuizFigureSystemPrompt,
  type QuizFigurePlan,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import {
  assertQuizFigureLatexSource,
  autoRepairQuizFigureLatexSource,
  sanitizeQuizFigureSvg,
} from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import type {
  AiFeatureRoute,
  ProviderUsageOperation,
} from "#api/modules/provider-operations/types/provider-operations.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";

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
export class QuizFigureRenderingProcessor {
  private readonly logger = new Logger(QuizFigureRenderingProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiProviderCallService)
    private readonly provider: AiProviderCallService,
    @Inject(QuizTexRendererClientService)
    private readonly renderer: QuizTexRendererClientService,
    @Inject(QuizFigureArtifactService)
    private readonly artifacts: QuizFigureArtifactService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
  ) {}

  async process(
    bullJob: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const durableJob = await this.prisma.backgroundJob.findUnique({
      where: { id: bullJob.data.backgroundJobId },
      select: durableJobSelect,
    });
    if (!durableJob) throw new UnrecoverableError("Quiz figure job not found.");
    if (durableJob.queue !== BackgroundJobQueue.QUIZ_FIGURE_RENDERING) {
      throw new UnrecoverableError(`Job ${durableJob.id} is not a Quiz figure job.`);
    }
    if (durableJob.status === BackgroundJobStatus.SUCCEEDED) {
      return skipped(durableJob, "Quiz figure job already succeeded.");
    }
    if (durableJob.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`Quiz figure job ${durableJob.id} was cancelled.`);
    }
    const metadata = readRecord(durableJob.inputMeta);
    const figureId = readRequiredString(metadata.figureId, "figureId");
    const revisionId = readRequiredString(metadata.revisionId, "revisionId");
    const latestAttempt = await this.prisma.quizFigureRenderAttempt.aggregate({
      where: { quizFigureId: figureId },
      _max: { attemptNumber: true },
    });
    const attemptNumber = (latestAttempt._max.attemptNumber ?? 0) + 1;
    await this.prisma.backgroundJob.update({
      where: { id: durableJob.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(bullJob.id ?? durableJob.id),
        attempts: attemptNumber,
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
      },
    });

    let attemptId: string | null = null;
    try {
      const figure = await this.prisma.quizFigure.findFirstOrThrow({
        where: { id: figureId, deletedAt: null, pendingRevisionId: revisionId },
        select: {
          id: true,
          role: true,
          aiGenerationId: true,
          quizQuestionId: true,
          planJson: true,
          subjectKey: true,
          subjectName: true,
          subjectSlug: true,
          aiGeneration: { select: { inputMetaJson: true } },
          pendingRevision: {
            select: {
              id: true,
              origin: true,
              sourceVersion: true,
              latexSource: true,
              sourceHash: true,
            },
          },
          currentRevision: {
            select: {
              latexSource: true,
              sourceKind: true,
              deliveryFile: { select: { mimeType: true, objectKey: true } },
            },
          },
        },
      });
      if (!figure.pendingRevision) {
        throw new UnrecoverableError("Quiz figure pending revision is missing.");
      }
      const plan = readPlan(metadata.planSnapshot ?? figure.planJson);
      if (plan.role !== figure.role) {
        throw new UnrecoverableError("QUIZ_FIGURE_PLAN_ROLE_MISMATCH");
      }
      const subject = readSubject(figure);
      const targetGrade = readQuizFigureTargetGrade(figure.aiGeneration?.inputMetaJson);
      const routeSnapshot = readRouteSnapshot(metadata.routeSnapshot);
      const adminInstructions = readOptionalString(metadata.adminInstructions);
      const aiMode = readQuizFigureAiMode(metadata.aiMode);
      const operation = readQuizFigureOperation(metadata.operation);
      const systemPrompt = readOptionalString(metadata.systemPrompt);
      const userPrompt = readOptionalString(metadata.userPrompt);
      const persistedSource = figure.pendingRevision.latexSource?.trim();
      const generatedSource = persistedSource
        ? null
        : await this.createSource({
            figure,
            plan,
            subject,
            targetGrade,
            routeSnapshot,
            backgroundJobId: durableJob.id,
            attempt: attemptNumber,
            adminInstructions,
            aiMode,
            operation,
            systemPrompt,
            userPrompt,
          });
      const autoRepair = autoRepairQuizFigureLatexSource({
        source: persistedSource ?? generatedSource!,
        subjectKey: subject.key,
        authorityText: JSON.stringify({
          plan,
          ...(adminInstructions ? { adminInstructions } : {}),
        }),
      });
      if (autoRepair.changes.length) {
        this.logger.warn(
          `Quiz figure ${figure.id} applied ${autoRepair.changes.length} deterministic source repair(s).`,
        );
      }
      const source = autoRepair.source;
      assertQuizFigureLatexSource(source);
      const sourceHash = QuizFigureJobService.sourceHash(source);
      attemptId = (
        await this.prisma.quizFigureRenderAttempt.create({
          data: {
            quizFigureId: figure.id,
            revisionId: figure.pendingRevision.id,
            backgroundJobId: durableJob.id,
            attemptNumber,
            sourceVersion: figure.pendingRevision.sourceVersion,
            kind:
              operation === "REFINE_CURRENT"
                ? QuizFigureAttemptKind.AI_REFINEMENT
                : QuizFigureAttemptKind.INITIAL,
            status: QuizFigureAttemptStatus.RUNNING,
            sourceHash,
          },
          select: { id: true },
        })
      ).id;
      await this.prisma.$transaction([
        this.prisma.quizFigureRevision.update({
          where: { id: revisionId },
          data: {
            status: QuizFigureRevisionStatus.RENDERING,
            latexSource: source,
            sourceHash,
          },
        }),
        this.prisma.quizFigure.update({
          where: { id: figure.id },
          data: { status: QuizFigureStatus.RENDERING },
        }),
      ]);
      const rendered = await this.renderer.render(source, figure.subjectKey);
      if (!rendered.ok) {
        throw new Error(buildQuizRendererFailureMessage(rendered));
      }
      const svg = sanitizeQuizFigureSvg(rendered.svg);
      await this.prisma.quizFigureRevision.update({
        where: { id: revisionId },
        data: {
          previewSvg: svg,
          sanitizedSvgHash: QuizFigureJobService.sourceHash(svg),
          rendererVersion: rendered.rendererVersion,
          validatorVersion: "quiz-svg-policy-v1",
        },
      });
      await this.artifacts.promoteSvg({
        figureId: figure.id,
        revisionId,
        svg,
        actorUserId: durableJob.ownerUserId,
      });
      await this.finalizeGeneratedFigure({
        figureId: figure.id,
        plan,
        persistPlanSnapshot: metadata.planSnapshot != null,
      });
      await this.prisma.quizFigureRenderAttempt.update({
        where: { id: attemptId },
        data: {
          status: QuizFigureAttemptStatus.SUCCEEDED,
          compileLog: rendered.log,
          durationMs: rendered.durationMs,
          finishedAt: new Date(),
        },
      });
      const result: BackgroundJobBullmqResult = {
        status: "SUCCEEDED",
        queue: BackgroundJobQueue.QUIZ_FIGURE_RENDERING,
        resourceType: "QUIZ_FIGURE",
        resourceId: figure.id,
        action:
          operation === "REFINE_CURRENT" ? "QUIZ_FIGURE_REFINE" : "QUIZ_FIGURE_RENDER",
        message:
          operation === "REFINE_CURRENT"
            ? "Đã tinh chỉnh hình Quiz."
            : "Đã tạo hình Quiz.",
        handledAt: new Date().toISOString(),
        details: { role: figure.role, revisionId },
      };
      await this.prisma.backgroundJob.update({
        where: { id: durableJob.id },
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
      await this.persistFailureState({
        attemptId,
        backgroundJobId: durableJob.id,
        figureId,
        message,
        revisionId,
      });
      this.logger.warn(`Quiz figure job ${durableJob.id} failed: ${message}`);
      throw new UnrecoverableError(message);
    }
  }

  private async persistFailureState(input: {
    attemptId: string | null;
    backgroundJobId: string;
    figureId: string;
    message: string;
    revisionId: string;
  }) {
    const errorCode = firstErrorCode(input.message);
    const finishedAt = new Date();
    const updates: Array<{ label: string; run: () => Promise<unknown> }> = [
      {
        label: "revision",
        run: () =>
          this.prisma.quizFigureRevision.update({
            where: { id: input.revisionId },
            data: {
              status: QuizFigureRevisionStatus.NEEDS_REVIEW,
              lastErrorCategory: "QUIZ_FIGURE_RENDER",
              lastErrorCode: errorCode,
              lastErrorMessage: input.message,
              finishedAt,
            },
            select: { id: true },
          }),
      },
      {
        label: "figure",
        run: () =>
          this.prisma.quizFigure.update({
            where: { id: input.figureId },
            data: {
              status: QuizFigureStatus.NEEDS_REVIEW,
              lastErrorCategory: "QUIZ_FIGURE_RENDER",
              lastErrorCode: errorCode,
              lastErrorMessage: input.message,
            },
            select: { id: true },
          }),
      },
      {
        label: "background-job",
        run: () =>
          this.prisma.backgroundJob.update({
            where: { id: input.backgroundJobId },
            data: {
              status: BackgroundJobStatus.FAILED,
              errorMessage: input.message,
              finishedAt,
            },
            select: { id: true },
          }),
      },
    ];
    if (input.attemptId) {
      updates.unshift({
        label: "render-attempt",
        run: () =>
          this.prisma.quizFigureRenderAttempt.update({
            where: { id: input.attemptId! },
            data: {
              status: QuizFigureAttemptStatus.FAILED,
              errorCategory: "QUIZ_FIGURE_RENDER",
              errorCode,
              compileLog: input.message,
              finishedAt,
            },
            select: { id: true },
          }),
      });
    }

    const results = await Promise.allSettled(updates.map((update) => update.run()));
    const failedTargets = results.flatMap((result, index) =>
      result.status === "rejected" ? [updates[index]!.label] : [],
    );
    if (failedTargets.length > 0) {
      this.logger.error(
        `Quiz figure job ${input.backgroundJobId} could not persist failure state for: ${failedTargets.join(", ")}.`,
      );
    }
  }

  private async createSource(input: {
    figure: {
      id: string;
      role: QuizFigureRole;
      aiGenerationId: string | null;
      quizQuestionId: string;
      pendingRevision: { id: string; sourceVersion: number } | null;
      currentRevision: {
        latexSource: string | null;
        sourceKind: string;
        deliveryFile: { mimeType: string; objectKey: string } | null;
      } | null;
    };
    plan: QuizFigurePlan;
    subject: QuizSubjectSnapshot;
    targetGrade: number | null;
    routeSnapshot?: AiFeatureRoute;
    backgroundJobId: string;
    attempt: number;
    adminInstructions?: string;
    aiMode: "REGENERATE" | "EDIT_CURRENT";
    operation: "GENERATE" | "REFINE_CURRENT";
    systemPrompt?: string;
    userPrompt?: string;
  }) {
    const callContext = {
      feature: AiGenerationType.QUIZ,
      aiGenerationId: input.figure.aiGenerationId,
      backgroundJobId: input.backgroundJobId,
      attempt: input.attempt,
      callSequence: 1,
      operation: resolveQuizFigureUsageOperation(input),
      routeSnapshot: input.routeSnapshot,
      allowProviderFallback: false,
      onResolvedRequest: (request: ResolvedAiStructuredRequestTrace) =>
        this.recordProviderRequestSnapshot({
          backgroundJobId: input.backgroundJobId,
          role: input.figure.role,
          attempt: input.attempt,
          request,
        }),
    } as const;
    if (input.operation === "REFINE_CURRENT") {
      const current = input.figure.currentRevision;
      if (
        !current?.latexSource?.trim() ||
        current.sourceKind !== "AI_TEX" ||
        current.deliveryFile?.mimeType !== "image/svg+xml" ||
        !current.deliveryFile.objectKey
      ) {
        throw new UnrecoverableError("QUIZ_FIGURE_REFINEMENT_SOURCE_REQUIRED");
      }
      const renderedSvg = await this.storage.downloadObject(
        current.deliveryFile.objectKey,
      );
      const currentImageDataUrl =
        await buildQuizFigureRefinementImageDataUrl(renderedSvg);
      const structuredInput = buildQuizFigureRefinementInput({
        subject: input.subject,
        plan: input.plan,
        targetGrade: input.targetGrade,
        adminInstructions: input.adminInstructions,
        currentLatexSource: current.latexSource,
        currentImageDataUrl,
      });
      const output = await this.provider.generateStructured(
        callContext,
        structuredInput,
        generatedQuizFigureRefinementSchema,
      );
      return output.data.latexSource;
    }
    if (input.figure.role === QuizFigureRole.QUESTION) {
      if (input.plan.role !== "QUESTION") {
        throw new UnrecoverableError("QUIZ_QUESTION_FIGURE_PLAN_INVALID");
      }
      const structuredInput = buildQuestionFigureInput({
        subject: input.subject,
        plan: input.plan,
        targetGrade: input.targetGrade,
        adminInstructions: input.adminInstructions,
        mode: input.aiMode,
        currentLatexSource:
          input.aiMode === "EDIT_CURRENT"
            ? input.figure.currentRevision?.latexSource
            : null,
      });
      const output = await this.provider.generateStructured(
        callContext,
        {
          ...structuredInput,
          systemPrompt: resolveQuizFigureSystemPrompt(
            structuredInput.systemPrompt,
            input.systemPrompt,
          ),
          userPrompt: input.userPrompt ?? structuredInput.userPrompt,
        },
        generatedQuizQuestionFigureSchema,
      );
      return output.data.latexSource;
    }
    if (input.plan.role !== "SOLUTION") {
      throw new UnrecoverableError("QUIZ_SOLUTION_FIGURE_PLAN_INVALID");
    }
    const currentSolutionLatexSource =
      input.aiMode === "EDIT_CURRENT" ? input.figure.currentRevision?.latexSource : null;
    const structuredInput = buildSolutionFigureInput({
      subject: input.subject,
      plan: input.plan,
      targetGrade: input.targetGrade,
      adminInstructions: input.adminInstructions,
      mode: input.aiMode,
      currentSolutionLatexSource,
    });
    const output = await this.provider.generateStructured(
      callContext,
      {
        ...structuredInput,
        systemPrompt: resolveQuizFigureSystemPrompt(
          structuredInput.systemPrompt,
          input.systemPrompt,
        ),
        userPrompt: input.userPrompt ?? structuredInput.userPrompt,
      },
      generatedQuizSolutionFigureSchema,
    );
    return output.data.latexSource;
  }

  private async finalizeGeneratedFigure(input: {
    figureId: string;
    plan: QuizFigurePlan;
    persistPlanSnapshot: boolean;
  }) {
    if (!input.persistPlanSnapshot) return;
    await this.prisma.quizFigure.update({
      where: { id: input.figureId },
      data: { planJson: toJobJson(input.plan) },
    });
  }

  private async recordProviderRequestSnapshot(input: {
    backgroundJobId: string;
    role: QuizFigureRole;
    attempt: number;
    request: ResolvedAiStructuredRequestTrace;
  }) {
    await this.prisma.$transaction(async (transaction) => {
      const job = await transaction.backgroundJob.findUniqueOrThrow({
        where: { id: input.backgroundJobId },
        select: { inputMeta: true },
      });
      const metadata = readRecord(job.inputMeta);
      const existing = Array.isArray(metadata.providerRequestSnapshots)
        ? metadata.providerRequestSnapshots
        : [];
      const snapshots = existing.filter((snapshot) => {
        const record = readRecord(snapshot);
        return record.attempt !== input.attempt || record.role !== input.role;
      });
      snapshots.push({
        version: 1,
        role: input.role,
        attempt: input.attempt,
        createdAt: new Date().toISOString(),
        request: input.request,
      });
      await transaction.backgroundJob.update({
        where: { id: input.backgroundJobId },
        data: {
          inputMeta: toJobJson({
            ...metadata,
            providerRequestSnapshots: snapshots.slice(-10),
          }),
        },
      });
    });
  }
}

function readPlan(value: unknown): QuizFigurePlan {
  const parsed = quizFigurePlanSchema.safeParse(omitLegacyAiCaption(value));
  if (!parsed.success) {
    throw new UnrecoverableError("QUIZ_FIGURE_PLAN_INVALID");
  }
  return parsed.data;
}

function omitLegacyAiCaption(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "caption"),
  );
}

function readSubject(value: {
  subjectKey: string;
  subjectName: string;
  subjectSlug: string;
}): QuizSubjectSnapshot {
  const key = ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"].includes(value.subjectKey)
    ? (value.subjectKey as QuizSubjectSnapshot["key"])
    : "GENERAL";
  return { key, name: value.subjectName, slug: value.subjectSlug };
}

function readRouteSnapshot(value: unknown) {
  return Object.keys(readRecord(value)).length > 0
    ? (value as AiFeatureRoute)
    : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRequiredString(value: unknown, field: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new UnrecoverableError(`Quiz figure job is missing ${field}.`);
  }
  return value;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readQuizFigureAiMode(value: unknown): "REGENERATE" | "EDIT_CURRENT" {
  return value === "EDIT_CURRENT" ? "EDIT_CURRENT" : "REGENERATE";
}

function readQuizFigureOperation(value: unknown): "GENERATE" | "REFINE_CURRENT" {
  return value === "REFINE_CURRENT" ? "REFINE_CURRENT" : "GENERATE";
}

function resolveQuizFigureUsageOperation(input: {
  figure: { role: QuizFigureRole };
  aiMode: "REGENERATE" | "EDIT_CURRENT";
  operation: "GENERATE" | "REFINE_CURRENT";
}): ProviderUsageOperation {
  const isQuestion = input.figure.role === QuizFigureRole.QUESTION;
  if (input.operation === "REFINE_CURRENT") {
    return isQuestion
      ? "QUIZ_QUESTION_FIGURE_REFINEMENT"
      : "QUIZ_SOLUTION_FIGURE_REFINEMENT";
  }
  if (input.aiMode === "EDIT_CURRENT") {
    return isQuestion
      ? "QUIZ_QUESTION_FIGURE_EDITING"
      : "QUIZ_SOLUTION_FIGURE_EDITING";
  }
  return isQuestion
    ? "QUIZ_QUESTION_FIGURE_GENERATION"
    : "QUIZ_SOLUTION_FIGURE_GENERATION";
}

function firstErrorCode(message: string) {
  return message.match(/^([A-Z0-9_]+)/u)?.[1] ?? "QUIZ_FIGURE_RENDER_FAILED";
}

export function buildQuizRendererFailureMessage(
  rendered: Extract<QuizTexRendererResult, { ok: false }>,
) {
  const diagnostics = rendered.issues
    .map((issue) => {
      const location = [
        issue.file,
        issue.line == null ? null : `line ${issue.line}`,
        issue.column == null ? null : `column ${issue.column}`,
      ]
        .filter(Boolean)
        .join(":");
      return `${issue.code}${location ? ` (${location})` : ""}: ${issue.message}`;
    })
    .join("\n");
  const logTail = rendered.log.slice(-12_000);
  return [
    rendered.code,
    diagnostics ? `Compiler diagnostics:\n${diagnostics}` : "",
    logTail ? `Compiler log tail:\n${logTail}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
    action: "QUIZ_FIGURE_RENDER",
    message,
    handledAt: new Date().toISOString(),
  };
}
