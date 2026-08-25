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
import { QuizTexRendererClientService } from "#api/modules/quiz-figures/services/quiz-tex-renderer-client.service";
import {
  buildQuestionFigureInput,
  buildQuizFigureRefinementInput,
  buildSolutionFigureExtensionInput,
  buildSolutionFigureRedrawInput,
  generatedQuizQuestionFigureSchema,
  generatedQuizFigureRefinementSchema,
  generatedQuizSolutionExtensionSchema,
  generatedQuizSolutionRedrawSchema,
  quizFigurePlanSchema,
  readQuizFigureTargetGrade,
  resolveQuizFigureSystemPrompt,
  type QuizFigurePlan,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import {
  applyQuizSolutionExtension,
  assertQuizFigureLatexSource,
  sanitizeQuizFigureSvg,
} from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
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
    @Inject(QuizFigureJobService)
    private readonly jobs: QuizFigureJobService,
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
      const plan = readPlan(figure.planJson);
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
      const source =
        figure.pendingRevision.latexSource?.trim() ||
        (await this.createSource({
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
        }));
      assertQuizFigureLatexSource(source, {
        requireExtensionMarker:
          figure.role === QuizFigureRole.QUESTION ||
          (operation === "REFINE_CURRENT" &&
            Boolean(
              figure.currentRevision?.latexSource?.includes("% QUIZ_SOLUTION_EXTENSION"),
            )),
      });
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
        throw new Error(`${rendered.code}: ${rendered.log}`);
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
      if (figure.role === QuizFigureRole.QUESTION) {
        await this.enqueueDependentSolutionFigure(
          figure.quizQuestionId,
          revisionId,
          durableJob.ownerUserId,
          routeSnapshot,
        );
      }
      return result;
    } catch (error) {
      const message = getJobErrorMessage(error).slice(0, 2_000);
      if (attemptId) {
        await this.prisma.quizFigureRenderAttempt.update({
          where: { id: attemptId },
          data: {
            status: QuizFigureAttemptStatus.FAILED,
            errorCategory: "QUIZ_FIGURE_RENDER",
            errorCode: firstErrorCode(message),
            compileLog: message,
            finishedAt: new Date(),
          },
        });
      }
      await this.prisma.$transaction([
        this.prisma.quizFigureRevision.update({
          where: { id: revisionId },
          data: {
            status: QuizFigureRevisionStatus.NEEDS_REVIEW,
            lastErrorCategory: "QUIZ_FIGURE_RENDER",
            lastErrorCode: firstErrorCode(message),
            lastErrorMessage: message,
            finishedAt: new Date(),
          },
        }),
        this.prisma.quizFigure.update({
          where: { id: figureId },
          data: {
            status: QuizFigureStatus.NEEDS_REVIEW,
            lastErrorCategory: "QUIZ_FIGURE_RENDER",
            lastErrorCode: firstErrorCode(message),
            lastErrorMessage: message,
          },
        }),
        this.prisma.backgroundJob.update({
          where: { id: durableJob.id },
          data: {
            status: BackgroundJobStatus.FAILED,
            errorMessage: message,
            finishedAt: new Date(),
          },
        }),
      ]);
      await this.markDependentSolutionFigureBlocked(figureId, message);
      this.logger.warn(`Quiz figure job ${durableJob.id} failed: ${message}`);
      throw new UnrecoverableError(message);
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
    const questionFigure = await this.prisma.quizFigure.findFirst({
      where: {
        quizQuestionId: input.figure.quizQuestionId,
        role: QuizFigureRole.QUESTION,
        deletedAt: null,
      },
      select: {
        currentRevision: { select: { id: true, latexSource: true, status: true } },
      },
    });
    const baseRevision = questionFigure?.currentRevision;
    if (!baseRevision?.latexSource || baseRevision.status !== "SUCCEEDED") {
      throw new UnrecoverableError(
        "QUIZ_SOLUTION_FIGURE_BASE_NOT_READY: Hình đề chưa sẵn sàng.",
      );
    }
    if (input.plan.role !== "SOLUTION") {
      throw new UnrecoverableError("QUIZ_SOLUTION_FIGURE_PLAN_INVALID");
    }
    const currentSolutionLatexSource =
      input.aiMode === "EDIT_CURRENT" ? input.figure.currentRevision?.latexSource : null;
    await this.prisma.quizFigureRevision.update({
      where: { id: input.figure.pendingRevision!.id },
      data: { derivedFromQuestionRevisionId: baseRevision.id },
    });
    if (input.plan.mode === "REDRAW_AS_MODEL") {
      const structuredInput = buildSolutionFigureRedrawInput({
        subject: input.subject,
        plan: input.plan,
        targetGrade: input.targetGrade,
        exactQuestionLatexSource: baseRevision.latexSource,
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
        generatedQuizSolutionRedrawSchema,
      );
      return output.data.latexSource;
    }
    const structuredInput = buildSolutionFigureExtensionInput({
      subject: input.subject,
      plan: input.plan,
      targetGrade: input.targetGrade,
      exactQuestionLatexSource: baseRevision.latexSource,
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
      generatedQuizSolutionExtensionSchema,
    );
    return applyQuizSolutionExtension(
      baseRevision.latexSource,
      output.data.extensionLatex,
    );
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

  private async enqueueDependentSolutionFigure(
    quizQuestionId: string,
    questionRevisionId: string,
    ownerUserId: string | null,
    routeSnapshot?: AiFeatureRoute,
  ) {
    const solution = await this.prisma.quizFigure.findFirst({
      where: {
        quizQuestionId,
        role: QuizFigureRole.SOLUTION,
        status: QuizFigureStatus.QUEUED,
        deletedAt: null,
      },
      select: { id: true, pendingRevisionId: true },
    });
    if (!solution?.pendingRevisionId) return;
    await this.prisma.quizFigureRevision.update({
      where: { id: solution.pendingRevisionId },
      data: { derivedFromQuestionRevisionId: questionRevisionId },
    });
    await this.jobs.enqueue(solution.id, ownerUserId, routeSnapshot);
  }

  private async markDependentSolutionFigureBlocked(
    failedFigureId: string,
    message: string,
  ) {
    const failedFigure = await this.prisma.quizFigure.findUnique({
      where: { id: failedFigureId },
      select: { role: true, quizQuestionId: true },
    });
    if (failedFigure?.role !== QuizFigureRole.QUESTION) return;
    const solution = await this.prisma.quizFigure.findFirst({
      where: {
        quizQuestionId: failedFigure.quizQuestionId,
        role: QuizFigureRole.SOLUTION,
        status: QuizFigureStatus.QUEUED,
        deletedAt: null,
      },
      select: { id: true, pendingRevisionId: true },
    });
    if (!solution) return;
    await this.prisma.$transaction([
      this.prisma.quizFigure.update({
        where: { id: solution.id },
        data: {
          status: QuizFigureStatus.NEEDS_REVIEW,
          lastErrorCategory: "QUIZ_SOLUTION_BASE",
          lastErrorCode: "QUIZ_SOLUTION_FIGURE_BASE_FAILED",
          lastErrorMessage: message,
        },
      }),
      ...(solution.pendingRevisionId
        ? [
            this.prisma.quizFigureRevision.update({
              where: { id: solution.pendingRevisionId },
              data: {
                status: QuizFigureRevisionStatus.NEEDS_REVIEW,
                lastErrorCategory: "QUIZ_SOLUTION_BASE",
                lastErrorCode: "QUIZ_SOLUTION_FIGURE_BASE_FAILED",
                lastErrorMessage: message,
                finishedAt: new Date(),
              },
            }),
          ]
        : []),
    ]);
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

function firstErrorCode(message: string) {
  return message.match(/^([A-Z0-9_]+)/u)?.[1] ?? "QUIZ_FIGURE_RENDER_FAILED";
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
