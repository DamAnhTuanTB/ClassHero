import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  Prisma,
  StemFigureRevisionOrigin,
  StemFigureAttemptKind,
  StemFigureAttemptStatus,
  StemFigureRevisionStatus,
  StemFigureStatus,
} from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getJobErrorMessage } from "#api/jobs/job-error";
import { toJobJson } from "#api/jobs/job-json";
import { isTransientProviderError } from "#api/modules/ai/services/ai-provider-call.service";
import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";
import { lessonSummaryOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { AiOutputValidationError } from "#api/modules/ai/utils/ai-output-validation";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";
import { isProviderBudgetError } from "#api/modules/provider-operations/utils/provider-budget-error";
import { StemFigureArtifactService } from "#api/modules/stem-figures/services/stem-figure-artifact.service";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import {
  StemFigureRepairService,
  resolveStemFigureProviderReferenceAssets,
  type StemFigureRepairKind,
} from "#api/modules/stem-figures/services/stem-figure-repair.service";
import { SvgValidatorService } from "#api/modules/stem-figures/services/svg-validator.service";
import { TexRendererClientService } from "#api/modules/stem-figures/services/tex-renderer-client.service";
import { stemFigureGenerationBriefSchema } from "#api/modules/stem-figures/types/stem-figure-generation.types";
import type {
  StemFigureProviderRequestSnapshot,
  StemFigureProviderRequestSnapshotCollection,
} from "#api/modules/stem-figures/types/stem-figure-provider-request.types";
import { buildStemFigureGenerationBrief } from "#api/modules/stem-figures/utils/stem-figure-generation-brief";
import {
  createStemFigureDiagnosticBatch,
  parseStemFigureDiagnosticBatch,
} from "#api/modules/stem-figures/utils/stem-figure-diagnostics";
import { validateTexSourcePolicy } from "#api/modules/stem-figures/utils/tex-source-policy";
import { prepareStemFigureProviderReferenceImages } from "#api/modules/stem-figures/utils/stem-figure-reference-images";

const renderJobSelect = {
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

type RenderJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof renderJobSelect;
}>;

type RenderRevision = {
  id: string;
  stemFigureId: string;
  origin: StemFigureRevisionOrigin;
  status: StemFigureRevisionStatus;
  latexSource: string | null;
  sourceHash: string | null;
  sourceVersion: number;
  altText: string;
  caption: string | null;
  repairCount: number;
  maxRepairAttempts: number;
  providerRequestSnapshotsJson: Prisma.JsonValue | null;
};

class PermanentStemFigureError extends Error {}

@Injectable()
export class StemFigureRenderingProcessor {
  private readonly logger = new Logger(StemFigureRenderingProcessor.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TexRendererClientService)
    private readonly renderer: TexRendererClientService,
    @Inject(SvgValidatorService)
    private readonly validator: SvgValidatorService,
    @Inject(StemFigureRepairService)
    private readonly repairService: StemFigureRepairService,
    @Inject(StemFigureArtifactService)
    private readonly artifacts: StemFigureArtifactService,
    @Inject(ObjectStorageService)
    private readonly storage: ObjectStorageService,
  ) {}

  async process(
    job: Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>,
  ): Promise<BackgroundJobBullmqResult> {
    const durableJob = await this.prisma.backgroundJob.findUnique({
      where: { id: job.data.backgroundJobId },
      select: renderJobSelect,
    });
    if (!durableJob) {
      throw new UnrecoverableError(
        `Render job ${job.data.backgroundJobId} was not found.`,
      );
    }
    this.assertJob(durableJob);
    if (durableJob.status === BackgroundJobStatus.SUCCEEDED) {
      return this.skipped(durableJob, "Durable render job already succeeded.");
    }
    const metadata = readJobMetadata(durableJob.inputMeta);
    const figure = await this.prisma.stemFigure.findFirst({
      where: { id: metadata.figureId, deletedAt: null },
      select: {
        id: true,
        aiGenerationId: true,
        lessonId: true,
        lessonSummaryId: true,
        blockPath: true,
        subjectKey: true,
        subjectName: true,
        subjectSlug: true,
        currentRevisionId: true,
        pendingRevisionId: true,
      },
    });
    if (!figure) {
      await this.markJobSkipped(durableJob.id, "Figure was deleted.");
      return this.skipped(durableJob, "Figure was deleted.");
    }
    const foundRevision = await this.prisma.stemFigureRevision.findFirst({
      where: { id: metadata.revisionId, stemFigureId: figure.id },
      select: revisionSelect,
    });
    if (!foundRevision) {
      await this.markJobSkipped(durableJob.id, "Revision was deleted.");
      return this.skipped(durableJob, "Revision was deleted.");
    }
    let revision: RenderRevision = foundRevision;
    if (revision.status === StemFigureRevisionStatus.SUCCEEDED) {
      await this.markJobSkipped(durableJob.id, "Revision already succeeded.");
      return this.skipped(durableJob, "Revision already succeeded.");
    }
    if (
      figure.pendingRevisionId !== revision.id &&
      figure.currentRevisionId !== revision.id
    ) {
      await this.markJobSkipped(durableJob.id, "A newer revision superseded this job.");
      return this.skipped(durableJob, "A newer revision superseded this job.");
    }

    const jobAttempt = job.attemptsMade + 1;
    await this.prisma.backgroundJob.update({
      where: { id: durableJob.id },
      data: {
        status: BackgroundJobStatus.RUNNING,
        bullmqJobId: String(job.id ?? durableJob.id),
        attempts: jobAttempt,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null,
      },
    });

    try {
      revision = await this.preparePaidSourceIfNeeded({
        durableJob,
        figure,
        revision,
        metadata,
        jobAttempt,
      });
      return await this.renderRevision({
        durableJob,
        figure,
        revision,
        jobAttempt,
      });
    } catch (error) {
      const budgetBlocked = isProviderBudgetError(error);
      const invalidProviderOutput = error instanceof AiOutputValidationError;
      const permanent =
        error instanceof PermanentStemFigureError ||
        budgetBlocked ||
        invalidProviderOutput;
      const message = getJobErrorMessage(error).slice(0, 20_000);
      const maxJobAttempts = Math.max(
        1,
        typeof job.opts.attempts === "number"
          ? job.opts.attempts
          : durableJob.maxAttempts,
      );
      const retrying =
        !permanent && isTransientProviderError(error) && jobAttempt < maxJobAttempts;
      if (budgetBlocked) {
        await this.markSourceGenerationFailure({
          durableJob,
          figureId: figure.id,
          revision,
          jobAttempt,
          message,
          code: error.code,
          category: "BUDGET",
        });
      } else if (invalidProviderOutput) {
        await this.markSourceGenerationFailure({
          durableJob,
          figureId: figure.id,
          revision,
          jobAttempt,
          message,
          code: error.code,
          category: "PROVIDER_OUTPUT",
        });
      } else if (!permanent) {
        await this.markInfrastructureFailure({
          durableJob,
          figureId: figure.id,
          revision,
          jobAttempt,
          retrying,
          message,
        });
      }
      if (retrying) {
        this.logger.warn(
          `STEM figure ${figure.id} revision ${revision.id} attempt ${jobAttempt}/${maxJobAttempts} hit transient infrastructure failure and will retry: ${message}`,
        );
        throw error instanceof Error ? error : new Error(message);
      }
      this.logger.warn(
        `STEM figure ${figure.id} revision ${revision.id} attempt ${jobAttempt}/${maxJobAttempts} failed permanently: ${message}`,
      );
      throw new UnrecoverableError(message);
    }
  }

  private async renderRevision(input: {
    durableJob: RenderJobRecord;
    figure: {
      id: string;
      aiGenerationId: string | null;
      subjectKey: string;
      subjectName: string;
      subjectSlug: string;
    };
    revision: RenderRevision;
    jobAttempt: number;
  }): Promise<BackgroundJobBullmqResult> {
    let revision = input.revision;
    let nextKind = resolveInitialAttemptKind(
      input.durableJob.inputMeta,
      input.jobAttempt,
    );
    let firstCompilePassed: boolean | null = null;
    let providerOutputPassed = Boolean(revision.latexSource?.trim());
    for (;;) {
      const source = requireSource(revision);
      await this.setRenderingState(input.figure.id, revision.id);
      const attempt = await this.createAttempt(
        input.figure.id,
        revision,
        input.durableJob.id,
        nextKind,
      );
      const policyIssues = validateTexSourcePolicy(
        source,
        undefined,
        parseSubjectKey(input.figure.subjectKey),
      );
      if (policyIssues.length > 0) {
        firstCompilePassed ??= false;
        const batch = createStemFigureDiagnosticBatch({
          attemptId: attempt.id,
          sourceVersion: revision.sourceVersion,
          sourceHash: requireSourceHash(revision),
          category: "SOURCE_POLICY",
          issues: policyIssues.map((issue) => ({
            code: issue.code,
            message: issue.message,
          })),
          rawLogExcerpt: JSON.stringify(policyIssues),
          collectionComplete: true,
        });
        await this.failAttempt(attempt.id, batch, "TEX_SOURCE_POLICY_REJECTED");
        await this.markNeedsReviewWithoutAutomaticRepair({
          figureId: input.figure.id,
          revision,
          category: "SOURCE_POLICY",
          errorCode: "TEX_SOURCE_POLICY_REJECTED",
          message: batch.rawLogExcerpt,
        });
        return this.completeJob(input.durableJob, input.figure.id, {
          message: "Figure source policy failed and requires review.",
          details: {
            status: "NEEDS_REVIEW",
            sourceVersion: revision.sourceVersion,
            issueCount: batch.issues.length,
            providerOutputPassed,
            sourcePolicyPassed: false,
            compilerInvoked: false,
            firstCompilePassed,
            firstPassSucceeded: false,
          },
        });
      }
      const rendered = await this.renderer.render(
        source,
        parseSubjectKey(input.figure.subjectKey),
      );
      if (!rendered.ok) {
        firstCompilePassed ??= false;
        const isCompilerFailure =
          rendered.category === "SOURCE" && rendered.code === "TEX_COMPILE_FAILED";
        const category =
          rendered.category === "INFRASTRUCTURE"
            ? "INFRASTRUCTURE"
            : isCompilerFailure
              ? "COMPILER"
              : "SOURCE_POLICY";
        const batch = createStemFigureDiagnosticBatch({
          attemptId: attempt.id,
          sourceVersion: revision.sourceVersion,
          sourceHash: requireSourceHash(revision),
          category,
          issues: rendered.issues,
          rawLogExcerpt: rendered.log,
          collectionComplete: rendered.collectionComplete,
        });
        await this.failAttempt(attempt.id, batch, rendered.code, rendered.durationMs);
        if (rendered.category === "INFRASTRUCTURE") {
          throw new Error(`${rendered.code}: ${rendered.log}`);
        }
        if (!isCompilerFailure || !batch.collectionComplete) {
          const errorCode = isCompilerFailure
            ? "TEX_COMPILER_DIAGNOSTICS_INCOMPLETE"
            : rendered.code;
          await this.markNeedsReviewWithoutAutomaticRepair({
            figureId: input.figure.id,
            revision,
            category: isCompilerFailure ? "COMPILER" : "SOURCE_POLICY",
            errorCode,
            message: batch.rawLogExcerpt,
          });
          return this.completeJob(input.durableJob, input.figure.id, {
            message: isCompilerFailure
              ? "Compiler diagnostics were incomplete; automatic repair was not attempted."
              : "Figure failed outside the compiler-repair path and requires review.",
            details: {
              status: "NEEDS_REVIEW",
              sourceVersion: revision.sourceVersion,
              issueCount: batch.issues.length,
              providerOutputPassed,
              sourcePolicyPassed: true,
              compilerInvoked: true,
              firstCompilePassed,
              firstPassSucceeded: false,
            },
          });
        }
        revision = await this.autoRepairOrFail(input, revision, batch);
        providerOutputPassed = true;
        nextKind = StemFigureAttemptKind.AI_REPAIR;
        continue;
      }
      firstCompilePassed ??= true;

      const validation = this.validator.validate(rendered.svg);
      if (!validation.ok) {
        const batch = createStemFigureDiagnosticBatch({
          attemptId: attempt.id,
          sourceVersion: revision.sourceVersion,
          sourceHash: requireSourceHash(revision),
          category: "VALIDATOR",
          issues: validation.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            element: null,
          })),
          rawLogExcerpt: JSON.stringify(validation.issues),
          collectionComplete: true,
        });
        await this.failAttempt(
          attempt.id,
          batch,
          "SVG_VALIDATION_FAILED",
          rendered.durationMs,
        );
        await this.prisma.$transaction([
          this.prisma.stemFigureRevision.update({
            where: { id: revision.id },
            data: {
              status: StemFigureRevisionStatus.NEEDS_REVIEW,
              rendererVersion: rendered.rendererVersion,
              validatorVersion: validation.validatorVersion,
              lastErrorCategory: "VALIDATOR",
              lastErrorCode: "SVG_VALIDATION_FAILED",
              lastErrorMessage: trimLog(JSON.stringify(validation.issues)),
              finishedAt: new Date(),
            },
          }),
          this.prisma.stemFigure.update({
            where: { id: input.figure.id },
            data: {
              status: StemFigureStatus.NEEDS_REVIEW,
              lastErrorCategory: "VALIDATOR",
              lastErrorCode: "SVG_VALIDATION_FAILED",
              lastErrorMessage: trimLog(JSON.stringify(validation.issues)),
            },
          }),
        ]);
        return this.completeJob(input.durableJob, input.figure.id, {
          message: "Figure compiled but needs validator review.",
          details: {
            status: "NEEDS_REVIEW",
            sourceVersion: revision.sourceVersion,
            issueCount: batch.issues.length,
            providerOutputPassed,
            sourcePolicyPassed: true,
            compilerInvoked: true,
            firstCompilePassed,
            firstPassSucceeded: false,
          },
        });
      }

      await this.prisma.$transaction([
        this.prisma.stemFigureRenderAttempt.update({
          where: { id: attempt.id },
          data: {
            status: StemFigureAttemptStatus.SUCCEEDED,
            compileLog: trimLog(rendered.log),
            durationMs: rendered.durationMs,
            finishedAt: new Date(),
          },
        }),
        this.prisma.stemFigureRevision.update({
          where: { id: revision.id },
          data: {
            status: StemFigureRevisionStatus.RENDERING,
            previewSvg: validation.sanitizedSvg,
            sanitizedSvgHash: validation.sha256,
            rendererVersion: rendered.rendererVersion,
            validatorVersion: validation.validatorVersion,
            lastErrorCategory: null,
            lastErrorCode: null,
            lastErrorMessage: null,
          },
        }),
      ]);
      await this.artifacts.promoteSvg({
        figureId: input.figure.id,
        revisionId: revision.id,
        svg: validation.sanitizedSvg,
        actorUserId: input.durableJob.ownerUserId,
        automatic: true,
      });
      return this.completeJob(input.durableJob, input.figure.id, {
        message: "Figure compiled, validated, and was promoted automatically.",
        details: {
          status: "SUCCEEDED",
          sourceVersion: revision.sourceVersion,
          repairCount: revision.repairCount,
          providerOutputPassed,
          sourcePolicyPassed: true,
          compilerInvoked: true,
          firstCompilePassed,
          firstPassSucceeded:
            providerOutputPassed &&
            firstCompilePassed === true &&
            revision.repairCount === 0,
          rendererVersion: rendered.rendererVersion,
          validatorVersion: validation.validatorVersion,
        },
      });
    }
  }

  private async preparePaidSourceIfNeeded(input: {
    durableJob: RenderJobRecord;
    figure: {
      id: string;
      aiGenerationId: string | null;
      lessonId: string;
      lessonSummaryId: string | null;
      blockPath: string;
      subjectKey: string;
      subjectName: string;
      subjectSlug: string;
    };
    revision: RenderRevision;
    metadata: ReturnType<typeof readJobMetadata>;
    jobAttempt: number;
  }) {
    const sourceMissing = !input.revision.latexSource?.trim();
    const sourceHashMissing = !input.revision.sourceHash;
    if (sourceMissing !== sourceHashMissing) {
      throw new PermanentStemFigureError("STEM_FIGURE_SOURCE_STATE_INCONSISTENT");
    }
    if (sourceMissing && sourceHashMissing) {
      if (
        input.revision.origin !== StemFigureRevisionOrigin.INITIAL_AI &&
        input.revision.origin !== StemFigureRevisionOrigin.ADMIN_REGENERATE
      ) {
        throw new PermanentStemFigureError("STEM_FIGURE_SOURCE_MISSING");
      }
      const brief =
        input.metadata.generationBrief ??
        (await this.buildRegenerationBrief(input.figure));
      const preparedReferences = await prepareStemFigureProviderReferenceImages({
        assets: resolveStemFigureProviderReferenceAssets(brief),
        downloadObject: (objectKey) => this.storage.downloadObject(objectKey),
      });
      const providerBrief = {
        ...brief,
        referenceAssets: preparedReferences.assets,
      };
      const source = await this.repairService.createNew({
        figureId: input.figure.id,
        revisionId: input.revision.id,
        aiGenerationId: input.figure.aiGenerationId,
        backgroundJobId: input.durableJob.id,
        jobAttempt: input.jobAttempt,
        subject: subjectSnapshot(input.figure),
        brief: providerBrief,
        referenceImages: preparedReferences.images,
        routeSnapshot: input.metadata.routeSnapshot,
        systemPrompt: input.metadata.systemPrompt,
        userPrompt: input.metadata.userPrompt,
        onRequestPrepared: (snapshot) =>
          this.appendProviderRequestSnapshot(input.revision.id, snapshot),
      });
      return this.updateRevisionSource(input.figure.id, input.revision, source, 0, false);
    }
    if (
      input.metadata.trigger === "MANUAL_COMPILER_RETRY" ||
      input.metadata.trigger === "MANUAL_VALIDATOR_RETRY"
    ) {
      const latestAttempt = await this.prisma.stemFigureRenderAttempt.findFirst({
        where: { revisionId: input.revision.id },
        orderBy: { createdAt: "desc" },
        select: { diagnosticBatch: true, diagnosticBatchHash: true },
      });
      const batch = parseRequiredBatch(
        latestAttempt?.diagnosticBatch,
        latestAttempt?.diagnosticBatchHash,
        input.metadata.diagnosticBatchHash,
      );
      const source = requireSource(input.revision);
      const repairKind: StemFigureRepairKind =
        input.metadata.trigger === "MANUAL_VALIDATOR_RETRY"
          ? "MANUAL_VALIDATOR"
          : "MANUAL_COMPILER";
      const repaired = await this.repairService.repair({
        figureId: input.figure.id,
        revisionId: input.revision.id,
        aiGenerationId: input.figure.aiGenerationId,
        backgroundJobId: input.durableJob.id,
        jobAttempt: input.jobAttempt,
        repairNumber: 0,
        repairKind,
        latexSource: source,
        diagnosticBatch: batch,
        subject: subjectSnapshot(input.figure),
        routeSnapshot: input.metadata.routeSnapshot,
        onRequestPrepared: (snapshot) =>
          this.appendProviderRequestSnapshot(input.revision.id, snapshot),
      });
      return this.updateRevisionSource(input.figure.id, input.revision, repaired, 0);
    }
    return input.revision;
  }

  private async buildRegenerationBrief(figure: {
    lessonSummaryId: string | null;
    blockPath: string;
  }) {
    const summary = figure.lessonSummaryId
      ? await this.prisma.lessonSummary.findUnique({
          where: { id: figure.lessonSummaryId },
          select: { contentJson: true },
        })
      : null;
    const envelope = readRecord(summary?.contentJson);
    const output = lessonSummaryOutputSchema.safeParse(envelope?.data);
    if (!output.success) {
      throw new PermanentStemFigureError(
        "STEM_FIGURE_LOCAL_CONTEXT_MISSING: Không đọc được block sở hữu hình.",
      );
    }
    return buildStemFigureGenerationBrief({
      output: output.data,
      blockPath: figure.blockPath,
      targetGrade: output.data.targetGrade ?? null,
      plan: {
        figurePlanContractVersion: 3,
        localId: "F000",
        figureOrigin: "GENERATED_FROM_BRIEF",
        sourceReferences: [],
      },
    });
  }

  private async autoRepairOrFail(
    input: {
      durableJob: RenderJobRecord;
      figure: {
        id: string;
        aiGenerationId: string | null;
        subjectKey: string;
        subjectName: string;
        subjectSlug: string;
      };
      jobAttempt: number;
    },
    revision: RenderRevision,
    diagnosticBatch: ReturnType<typeof createStemFigureDiagnosticBatch>,
  ) {
    if (diagnosticBatch.category !== "COMPILER" || !diagnosticBatch.collectionComplete) {
      throw new PermanentStemFigureError(
        "STEM_FIGURE_AUTO_REPAIR_REQUIRES_COMPLETE_COMPILER_BATCH",
      );
    }
    if (revision.repairCount >= revision.maxRepairAttempts) {
      await this.markCompilerFailed(
        input.durableJob,
        input.figure.id,
        revision,
        diagnosticBatch,
      );
      throw new PermanentStemFigureError(
        `TEX_SOURCE_REPAIR_EXHAUSTED: ${diagnosticBatch.rawLogExcerpt}`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.stemFigureRevision.update({
        where: { id: revision.id },
        data: { status: StemFigureRevisionStatus.REPAIRING },
      }),
      this.prisma.stemFigure.update({
        where: { id: input.figure.id },
        data: { status: StemFigureStatus.REPAIRING },
      }),
    ]);
    const repairCount = revision.repairCount + 1;
    const source = await this.repairService.repair({
      figureId: input.figure.id,
      revisionId: revision.id,
      aiGenerationId: input.figure.aiGenerationId,
      backgroundJobId: input.durableJob.id,
      jobAttempt: input.jobAttempt,
      repairNumber: repairCount,
      repairKind: "AUTO_COMPILER",
      latexSource: requireSource(revision),
      diagnosticBatch,
      subject: subjectSnapshot(input.figure),
      routeSnapshot: readJobMetadata(input.durableJob.inputMeta).routeSnapshot,
      onRequestPrepared: (snapshot) =>
        this.appendProviderRequestSnapshot(revision.id, snapshot),
    });
    return this.updateRevisionSource(input.figure.id, revision, source, repairCount);
  }

  private async markNeedsReviewWithoutAutomaticRepair(input: {
    figureId: string;
    revision: RenderRevision;
    category: "COMPILER" | "SOURCE_POLICY";
    errorCode: string;
    message: string;
  }) {
    const message = trimLog(input.message);
    await this.prisma.$transaction([
      this.prisma.stemFigureRevision.update({
        where: { id: input.revision.id },
        data: {
          status: StemFigureRevisionStatus.NEEDS_REVIEW,
          lastErrorCategory: input.category,
          lastErrorCode: input.errorCode,
          lastErrorMessage: message,
          finishedAt: new Date(),
        },
      }),
      this.prisma.stemFigure.update({
        where: { id: input.figureId },
        data: {
          status: StemFigureStatus.NEEDS_REVIEW,
          lastErrorCategory: input.category,
          lastErrorCode: input.errorCode,
          lastErrorMessage: message,
        },
      }),
    ]);
  }

  private async appendProviderRequestSnapshot(
    revisionId: string,
    snapshot: StemFigureProviderRequestSnapshot,
  ) {
    await this.prisma.$transaction(async (transaction) => {
      const revision = await transaction.stemFigureRevision.findUniqueOrThrow({
        where: { id: revisionId },
        select: { providerRequestSnapshotsJson: true },
      });
      const collection = readProviderRequestSnapshotCollection(
        revision.providerRequestSnapshotsJson,
      );
      const calls = collection.calls.filter(
        (call) => call.idempotencyKey !== snapshot.idempotencyKey,
      );
      calls.push(snapshot);
      await transaction.stemFigureRevision.update({
        where: { id: revisionId },
        data: {
          providerRequestSnapshotsJson: toJobJson({ version: 1, calls }),
        },
      });
    });
  }

  private async updateRevisionSource(
    figureId: string,
    revision: RenderRevision,
    source: string,
    repairCount: number,
    advanceSourceVersion = true,
  ) {
    const sourceHash = StemFigureJobService.sourceHash(source);
    const sourceVersion = advanceSourceVersion
      ? revision.sourceVersion + 1
      : revision.sourceVersion;
    const updated = await this.prisma.stemFigureRevision.update({
      where: { id: revision.id },
      data: {
        latexSource: source,
        sourceHash,
        sourceVersion,
        repairCount,
        status: StemFigureRevisionStatus.RENDERING,
        lastErrorCategory: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      select: revisionSelect,
    });
    await this.prisma.stemFigure.update({
      where: { id: figureId },
      data: {
        status: StemFigureStatus.RENDERING,
      },
    });
    return updated;
  }

  private async createAttempt(
    figureId: string,
    revision: RenderRevision,
    backgroundJobId: string,
    kind: StemFigureAttemptKind,
  ) {
    const aggregate = await this.prisma.stemFigureRenderAttempt.aggregate({
      where: { stemFigureId: figureId },
      _max: { attemptNumber: true },
    });
    return this.prisma.stemFigureRenderAttempt.create({
      data: {
        stemFigureId: figureId,
        revisionId: revision.id,
        backgroundJobId,
        attemptNumber: (aggregate._max.attemptNumber ?? 0) + 1,
        sourceVersion: revision.sourceVersion,
        sourceHash: requireSourceHash(revision),
        kind,
      },
      select: { id: true },
    });
  }

  private failAttempt(
    attemptId: string,
    batch: ReturnType<typeof createStemFigureDiagnosticBatch>,
    errorCode: string,
    durationMs?: number,
  ) {
    return this.prisma.stemFigureRenderAttempt.update({
      where: { id: attemptId },
      data: {
        status: StemFigureAttemptStatus.FAILED,
        compileLog: trimLog(batch.rawLogExcerpt),
        errorCategory: batch.category,
        errorCode,
        validatorIssues:
          batch.category === "VALIDATOR" ? toJobJson(batch.issues) : undefined,
        diagnosticBatch: toJobJson(batch),
        diagnosticBatchHash: batch.batchHash,
        collectionComplete: batch.collectionComplete,
        durationMs,
        finishedAt: new Date(),
      },
    });
  }

  private setRenderingState(figureId: string, revisionId: string) {
    return this.prisma.$transaction([
      this.prisma.stemFigureRevision.update({
        where: { id: revisionId },
        data: { status: StemFigureRevisionStatus.RENDERING },
      }),
      this.prisma.stemFigure.update({
        where: { id: figureId },
        data: { status: StemFigureStatus.RENDERING },
      }),
    ]);
  }

  private async markCompilerFailed(
    durableJob: RenderJobRecord,
    figureId: string,
    revision: RenderRevision,
    batch: ReturnType<typeof createStemFigureDiagnosticBatch>,
  ) {
    const message = trimLog(batch.rawLogExcerpt);
    await this.prisma.$transaction([
      this.prisma.stemFigureRevision.update({
        where: { id: revision.id },
        data: {
          status: StemFigureRevisionStatus.FAILED,
          lastErrorCategory: "COMPILER",
          lastErrorCode: "TEX_SOURCE_REPAIR_EXHAUSTED",
          lastErrorMessage: message,
          finishedAt: new Date(),
        },
      }),
      this.prisma.stemFigure.update({
        where: { id: figureId },
        data: {
          status: StemFigureStatus.FAILED,
          lastErrorCategory: "COMPILER",
          lastErrorCode: "TEX_SOURCE_REPAIR_EXHAUSTED",
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
  }

  private async markInfrastructureFailure(input: {
    durableJob: RenderJobRecord;
    figureId: string;
    revision: RenderRevision;
    jobAttempt: number;
    retrying: boolean;
    message: string;
  }) {
    const latestAttempt = await this.prisma.stemFigureRenderAttempt.findFirst({
      where: { revisionId: input.revision.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, errorCategory: true },
    });
    if (
      latestAttempt?.errorCategory !== "INFRASTRUCTURE" &&
      input.revision.latexSource?.trim() &&
      input.revision.sourceHash
    ) {
      const attempt = await this.createAttempt(
        input.figureId,
        input.revision,
        input.durableJob.id,
        StemFigureAttemptKind.INFRA_RETRY,
      );
      const batch = createStemFigureDiagnosticBatch({
        attemptId: attempt.id,
        sourceVersion: input.revision.sourceVersion,
        sourceHash: requireSourceHash(input.revision),
        category: "INFRASTRUCTURE",
        issues: [{ code: "TEX_RENDER_INFRASTRUCTURE_FAILURE", message: input.message }],
        rawLogExcerpt: input.message,
        collectionComplete: false,
      });
      await this.failAttempt(attempt.id, batch, "TEX_RENDER_INFRASTRUCTURE_FAILURE");
    }
    await this.prisma.$transaction([
      this.prisma.backgroundJob.update({
        where: { id: input.durableJob.id },
        data: {
          status: input.retrying
            ? BackgroundJobStatus.QUEUED
            : BackgroundJobStatus.FAILED,
          attempts: input.jobAttempt,
          errorMessage: input.message,
          finishedAt: input.retrying ? null : new Date(),
        },
      }),
      this.prisma.stemFigureRevision.update({
        where: { id: input.revision.id },
        data: {
          status: input.retrying
            ? StemFigureRevisionStatus.QUEUED
            : StemFigureRevisionStatus.FAILED,
          lastErrorCategory: "INFRASTRUCTURE",
          lastErrorCode: input.revision.sourceHash
            ? "TEX_RENDER_INFRASTRUCTURE_FAILURE"
            : "STEM_FIGURE_SOURCE_GENERATION_FAILURE",
          lastErrorMessage: input.message,
          finishedAt: input.retrying ? null : new Date(),
        },
      }),
      this.prisma.stemFigure.update({
        where: { id: input.figureId },
        data: {
          status: input.retrying ? StemFigureStatus.QUEUED : StemFigureStatus.FAILED,
          lastErrorCategory: "INFRASTRUCTURE",
          lastErrorCode: input.revision.sourceHash
            ? "TEX_RENDER_INFRASTRUCTURE_FAILURE"
            : "STEM_FIGURE_SOURCE_GENERATION_FAILURE",
          lastErrorMessage: input.message,
        },
      }),
    ]);
  }

  private async markSourceGenerationFailure(input: {
    durableJob: RenderJobRecord;
    figureId: string;
    revision: RenderRevision;
    jobAttempt: number;
    message: string;
    code: string;
    category: string;
  }) {
    await this.prisma.$transaction([
      this.prisma.backgroundJob.update({
        where: { id: input.durableJob.id },
        data: {
          status: BackgroundJobStatus.FAILED,
          attempts: input.jobAttempt,
          errorMessage: input.message,
          finishedAt: new Date(),
        },
      }),
      this.prisma.stemFigureRevision.update({
        where: { id: input.revision.id },
        data: {
          status: StemFigureRevisionStatus.FAILED,
          lastErrorCategory: input.category,
          lastErrorCode: input.code,
          lastErrorMessage: input.message,
          finishedAt: new Date(),
        },
      }),
      this.prisma.stemFigure.update({
        where: { id: input.figureId },
        data: {
          status: StemFigureStatus.FAILED,
          lastErrorCategory: input.category,
          lastErrorCode: input.code,
          lastErrorMessage: input.message,
        },
      }),
    ]);
  }

  private async completeJob(
    job: RenderJobRecord,
    figureId: string,
    input: { message: string; details: Record<string, unknown> },
  ) {
    const result: BackgroundJobBullmqResult = {
      status: "SUCCEEDED",
      queue: BackgroundJobQueue.DIAGRAM_RENDERING,
      resourceType: "STEM_FIGURE",
      resourceId: figureId,
      action: "STEM_FIGURE_RENDER",
      message: input.message,
      handledAt: new Date().toISOString(),
      details: input.details,
    };
    await this.prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: BackgroundJobStatus.SUCCEEDED,
        result: toJobJson(result),
        errorMessage: null,
        finishedAt: new Date(),
      },
    });
    return result;
  }

  private assertJob(job: RenderJobRecord) {
    if (job.queue !== BackgroundJobQueue.DIAGRAM_RENDERING) {
      throw new UnrecoverableError(`Job ${job.id} is not a STEM figure job.`);
    }
    if (job.status === BackgroundJobStatus.CANCELLED) {
      throw new UnrecoverableError(`Render job ${job.id} was cancelled.`);
    }
  }

  private async markJobSkipped(jobId: string, message: string) {
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: BackgroundJobStatus.SUCCEEDED,
        result: toJobJson({ status: "SKIPPED", message }),
        errorMessage: null,
        finishedAt: new Date(),
      },
    });
  }

  private skipped(record: RenderJobRecord, message: string): BackgroundJobBullmqResult {
    return {
      status: "SKIPPED",
      queue: record.queue,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      action: "STEM_FIGURE_RENDER",
      message,
      handledAt: new Date().toISOString(),
    };
  }
}

const revisionSelect = {
  id: true,
  stemFigureId: true,
  origin: true,
  status: true,
  latexSource: true,
  sourceHash: true,
  sourceVersion: true,
  altText: true,
  caption: true,
  repairCount: true,
  maxRepairAttempts: true,
  providerRequestSnapshotsJson: true,
} satisfies Prisma.StemFigureRevisionSelect;

function readProviderRequestSnapshotCollection(
  value: Prisma.JsonValue | null,
): StemFigureProviderRequestSnapshotCollection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 1, calls: [] };
  }
  const calls = (value as Record<string, unknown>).calls;
  return {
    version: 1,
    calls: Array.isArray(calls) ? (calls as StemFigureProviderRequestSnapshot[]) : [],
  };
}

function readJobMetadata(inputMeta: Prisma.JsonValue) {
  if (!inputMeta || typeof inputMeta !== "object" || Array.isArray(inputMeta)) {
    throw new UnrecoverableError("STEM figure job metadata is missing.");
  }
  const figureId = typeof inputMeta.figureId === "string" ? inputMeta.figureId : null;
  const revisionId =
    typeof inputMeta.revisionId === "string" ? inputMeta.revisionId : null;
  const trigger = typeof inputMeta.trigger === "string" ? inputMeta.trigger : "INITIAL";
  if (!figureId || !revisionId) {
    throw new UnrecoverableError("STEM figure job metadata is invalid.");
  }
  return {
    figureId,
    revisionId,
    trigger,
    diagnosticBatchHash:
      typeof inputMeta.diagnosticBatchHash === "string"
        ? inputMeta.diagnosticBatchHash
        : null,
    generationBrief: (() => {
      if (inputMeta.generationBrief === null || inputMeta.generationBrief === undefined) {
        return null;
      }
      const parsed = stemFigureGenerationBriefSchema.safeParse(inputMeta.generationBrief);
      if (!parsed.success) {
        throw new UnrecoverableError("STEM_FIGURE_GENERATION_BRIEF_CONTRACT_INVALID");
      }
      return parsed.data;
    })(),
    routeSnapshot:
      inputMeta.routeSnapshot &&
      typeof inputMeta.routeSnapshot === "object" &&
      !Array.isArray(inputMeta.routeSnapshot)
        ? (inputMeta.routeSnapshot as AiFeatureRoute)
        : undefined,
    systemPrompt:
      typeof inputMeta.systemPrompt === "string" ? inputMeta.systemPrompt : undefined,
    userPrompt:
      typeof inputMeta.userPrompt === "string" ? inputMeta.userPrompt : undefined,
  };
}

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolveInitialAttemptKind(
  inputMeta: Prisma.JsonValue,
  jobAttempt: number,
): StemFigureAttemptKind {
  if (jobAttempt > 1) return StemFigureAttemptKind.INFRA_RETRY;
  const trigger = readJobMetadata(inputMeta).trigger;
  if (trigger === "ADMIN_EDIT") return StemFigureAttemptKind.ADMIN_EDIT;
  if (trigger === "ADMIN_REGENERATE") {
    return StemFigureAttemptKind.ADMIN_REGENERATE;
  }
  if (trigger === "MANUAL_COMPILER_RETRY") {
    return StemFigureAttemptKind.MANUAL_COMPILER_REPAIR;
  }
  if (trigger === "MANUAL_VALIDATOR_RETRY") {
    return StemFigureAttemptKind.MANUAL_VALIDATOR_REPAIR;
  }
  return StemFigureAttemptKind.INITIAL;
}

function parseRequiredBatch(
  value: unknown,
  storedHash: string | null | undefined,
  expectedHash: string | null,
) {
  const batch = parseStemFigureDiagnosticBatch(value);
  if (!batch || !storedHash || batch.batchHash !== storedHash) {
    throw new PermanentStemFigureError("STEM_FIGURE_RETRY_DIAGNOSTICS_MISSING");
  }
  if (!expectedHash || expectedHash !== batch.batchHash) {
    throw new PermanentStemFigureError("STEM_FIGURE_RETRY_DIAGNOSTICS_STALE");
  }
  return batch;
}

function requireSource(revision: RenderRevision) {
  if (!revision.latexSource?.trim()) {
    throw new PermanentStemFigureError("STEM_FIGURE_SOURCE_MISSING");
  }
  return revision.latexSource;
}

function requireSourceHash(revision: RenderRevision) {
  if (!revision.sourceHash) {
    throw new PermanentStemFigureError("STEM_FIGURE_SOURCE_HASH_MISSING");
  }
  return revision.sourceHash;
}

function parseSubjectKey(value: string) {
  const subjectKey = lessonSummarySubjectKeySchema.safeParse(value);
  if (subjectKey.success) return subjectKey.data;
  throw new PermanentStemFigureError(`Unsupported STEM figure subject key: ${value}`);
}

function subjectSnapshot(input: {
  subjectKey: string;
  subjectName: string;
  subjectSlug: string;
}) {
  return {
    key: parseSubjectKey(input.subjectKey),
    name: input.subjectName,
    slug: input.subjectSlug,
  };
}

function trimLog(value: string) {
  return value.replaceAll(/[^\S\r\n]+$/gmu, "").slice(-80_000);
}
