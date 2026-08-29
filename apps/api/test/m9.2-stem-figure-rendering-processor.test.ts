import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  StemFigureAttemptStatus,
  StemFigureRevisionOrigin,
  StemFigureRevisionStatus,
  StemFigureStatus,
} from "@prisma/client";
import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { createStemFigureDiagnosticBatch } from "#api/modules/stem-figures/utils/stem-figure-diagnostics";
import { prepareStemFigureProviderReferenceImages } from "#api/modules/stem-figures/utils/stem-figure-reference-images";
import { AiProviderOutputError } from "#api/modules/ai/utils/ai-output-validation";
import {
  ProviderBudgetError,
  providerBudgetErrorCodes,
} from "#api/modules/provider-operations/utils/provider-budget-error";
import { StemFigureRenderingProcessor } from "#api/workers/processors/stem-figure-rendering.processor";

const figureId = "00000000-0000-4000-8000-000000000011";
const backgroundJobId = "00000000-0000-4000-8000-000000000012";
const aiGenerationId = "00000000-0000-4000-8000-000000000013";
const revisionId = "00000000-0000-4000-8000-000000000014";
const badSource = String.raw`\begin{tikzpicture}
\draw (0,0)--(1,;
\end{tikzpicture}`;
const repairedSource = String.raw`\begin{tikzpicture}
\draw (0,0)--(1,1);
\end{tikzpicture}`;
const missingFillBetweenDependencySource = String.raw`\begin{tikzpicture}
\begin{axis}
\addplot[name path=curve]{x};
\addplot[name path=axis]{0};
\addplot fill between[of=curve and axis];
\end{axis}
\end{tikzpicture}`;
const validSvg = `<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>`;

function createGenerationBrief(input: {
  blockContent: Record<string, unknown>;
  targetGrade?: number;
  adminInstructions?: string | null;
}) {
  return {
    figurePlanContractVersion: 3,
    figureOrigin: "GENERATED_FROM_BRIEF",
    targetGrade: input.targetGrade ?? 12,
    blockPath: "sections.0.blocks.1",
    blockContent: input.blockContent,
    sourceReferences: [],
    referenceAssets: [],
    referenceImageMode: "NONE",
    adminInstructions: input.adminInstructions ?? null,
  };
}

describe("M9.2 STEM figure rendering processor", () => {
  it("resizes reference images, keeps high detail, and removes exact duplicate content", async () => {
    const first = await sharp({
      create: { width: 3_000, height: 1_000, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const second = await sharp({
      create: { width: 900, height: 600, channels: 3, background: "#000000" },
    })
      .png()
      .toBuffer();
    const storage = {
      downloadObject: vi.fn(async (objectKey: string) =>
        objectKey === "distinct.png" ? second : first,
      ),
    };
    const prepared = await prepareStemFigureProviderReferenceImages({
      assets: [
        referenceAsset("first.png"),
        referenceAsset("duplicate.png"),
        referenceAsset("distinct.png"),
      ],
      downloadObject: storage.downloadObject,
    });

    expect(prepared.assets.map((asset) => asset.objectKey)).toEqual([
      "first.png",
      "distinct.png",
    ]);
    expect(prepared.assets.every((asset) => asset.mimeType === "image/png")).toBe(true);
    expect(prepared.images.every((image) => image.detail === "high")).toBe(true);
    const firstPrepared = Buffer.from(
      prepared.images[0]!.imageUrl.split(",")[1]!,
      "base64",
    );
    const metadata = await sharp(firstPrepared).metadata();
    expect(metadata.width).toBe(2_048);
    expect(metadata.height).toBeLessThanOrEqual(2_048);
  });

  it("generates one figure from its exact local brief before the first compile", async () => {
    const generationBrief = createGenerationBrief({
      blockContent: {
        type: "example",
        problem: "Vẽ đường thẳng đi qua A(0;0) và B(1;1).",
      },
    });
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 0,
      sourcePending: true,
      generationBrief,
    });
    const renderer = { render: vi.fn(async () => renderSuccess()) };
    const repair = {
      createNew: vi.fn(async () => repairedSource),
      repair: vi.fn(),
    };
    const processor = createProcessor(
      prisma,
      renderer,
      { validate: vi.fn(() => validationSuccess()) },
      repair,
      createArtifactsMock(),
    );

    const result = await processor.process(createJob(0, 3));

    expect(repair.createNew).toHaveBeenCalledWith(
      expect.objectContaining({
        figureId,
        revisionId,
        aiGenerationId,
        backgroundJobId,
        jobAttempt: 1,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        brief: expect.objectContaining({
          blockPath: generationBrief.blockPath,
          blockContent: generationBrief.blockContent,
        }),
      }),
    );
    expect(renderer.render).toHaveBeenCalledOnce();
    expect(renderer.render).toHaveBeenCalledWith(repairedSource, "MATH");
    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: {
        firstCompilePassed: true,
        sourceVersion: 1,
        repairCount: 0,
      },
    });
  });

  it("regenerates a source-pending ADMIN revision from its origin even when legacy job metadata says INITIAL", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 0,
      sourcePending: true,
      revisionOrigin: StemFigureRevisionOrigin.ADMIN_REGENERATE,
      trigger: "INITIAL",
      generationBrief: createGenerationBrief({
        blockContent: {
          type: "example",
          problem: "Vẽ hình chóp S.ABCD.",
        },
      }),
    });
    const repair = {
      createNew: vi.fn(async () => repairedSource),
      repair: vi.fn(),
    };
    const processor = createProcessor(
      prisma,
      { render: vi.fn(async () => renderSuccess()) },
      { validate: vi.fn(() => validationSuccess()) },
      repair,
      createArtifactsMock(),
    );

    const result = await processor.process(createJob(0, 3));

    expect(repair.createNew).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: { firstCompilePassed: true },
    });
  });

  it("preserves a pre-compile source generation error instead of masking it as a missing source hash", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 0,
      sourcePending: true,
      revisionOrigin: StemFigureRevisionOrigin.ADMIN_REGENERATE,
      generationBrief: createGenerationBrief({
        blockContent: {
          type: "example",
          problem: "Vẽ hình chóp S.ABCD.",
        },
      }),
    });
    const repair = {
      createNew: vi.fn(async () => {
        throw new Error("PROVIDER_ROUTE_UNAVAILABLE");
      }),
      repair: vi.fn(),
    };
    const processor = createProcessor(
      prisma,
      { render: vi.fn() },
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(0, 3))).rejects.toThrow(
      "PROVIDER_ROUTE_UNAVAILABLE",
    );

    expect(prisma.stemFigureRenderAttempt.create).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BackgroundJobStatus.FAILED,
          errorMessage: "PROVIDER_ROUTE_UNAVAILABLE",
        }),
      }),
    );
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastErrorCode: "STEM_FIGURE_SOURCE_GENERATION_FAILURE",
        }),
      }),
    );
  });

  it("marks a budget rejection final before source generation and disables BullMQ retry", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 0,
      sourcePending: true,
      revisionOrigin: StemFigureRevisionOrigin.ADMIN_REGENERATE,
      generationBrief: createGenerationBrief({
        blockContent: {
          type: "example",
          problem: "Vẽ hình chóp S.ABCD.",
        },
      }),
    });
    const repair = {
      createNew: vi.fn(async () => {
        throw new ProviderBudgetError(
          providerBudgetErrorCodes.HARD_LIMIT,
          "Đã đạt giới hạn ngân sách.",
        );
      }),
      repair: vi.fn(),
    };
    const processor = createProcessor(
      prisma,
      { render: vi.fn() },
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(0, 3))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(prisma.stemFigureRenderAttempt.create).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BackgroundJobStatus.FAILED,
          attempts: 1,
        }),
      }),
    );
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.FAILED,
          lastErrorCategory: "BUDGET",
          lastErrorCode: providerBudgetErrorCodes.HARD_LIMIT,
        }),
      }),
    );
  });

  it("marks a deterministic provider output limit final instead of paying for an identical retry", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 0,
      sourcePending: true,
      generationBrief: createGenerationBrief({
        blockContent: {
          type: "example",
          problem: "Vẽ khối tròn xoay.",
        },
      }),
    });
    const repair = {
      createNew: vi.fn(async () => {
        throw new AiProviderOutputError(
          "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
          "OpenAI chạm giới hạn token đầu ra.",
          {
            provider: "OPENAI",
            model: "gpt-5.6-terra",
            responseStatus: "incomplete",
            incompleteReason: "max_output_tokens",
            hasRefusal: false,
            maxOutputTokens: 8_000,
          },
        );
      }),
      repair: vi.fn(),
    };
    const processor = createProcessor(
      prisma,
      { render: vi.fn() },
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(0, 3))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );

    expect(prisma.stemFigureRenderAttempt.create).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BackgroundJobStatus.FAILED,
          attempts: 1,
        }),
      }),
    );
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.FAILED,
          lastErrorCategory: "PROVIDER_OUTPUT",
          lastErrorCode: "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS",
        }),
      }),
    );
  });

  it("sends the raw compiler batch to AI repair without local dependency injection", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 1,
      latexSource: missingFillBetweenDependencySource,
    });
    const renderer = {
      render: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          category: "SOURCE",
          code: "TEX_COMPILE_FAILED",
          log: "Package pgfplots Error: fill between library is not loaded",
          durationMs: 20,
          rendererVersion: "test-renderer",
          issues: [
            compilerIssue(
              "TEX_UNDEFINED_CONTROL_SEQUENCE",
              "fill between library is not loaded",
              8,
            ),
          ],
          collectionComplete: true,
        })
        .mockResolvedValueOnce(renderSuccess()),
    };
    const repairedDependencySource = String.raw`\usepgfplotslibrary{fillbetween}
\begin{tikzpicture}
\begin{axis}
\addplot[name path=curve]{x};
\addplot[name path=axis]{0};
\addplot fill between[of=curve and axis];
\end{axis}
\end{tikzpicture}`;
    const repair = { repair: vi.fn(async () => repairedDependencySource) };
    const processor = createProcessor(
      prisma,
      renderer,
      { validate: vi.fn(() => validationSuccess()) },
      repair,
      createArtifactsMock(),
    );

    const result = await processor.process(createJob(0, 3));

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: {
        status: "SUCCEEDED",
        firstCompilePassed: false,
        repairCount: 1,
      },
    });
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenNthCalledWith(
      1,
      missingFillBetweenDependencySource,
      "MATH",
    );
    expect(renderer.render).toHaveBeenNthCalledWith(2, repairedDependencySource, "MATH");
    expect(repair.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        latexSource: missingFillBetweenDependencySource,
        repairKind: "AUTO_COMPILER",
        diagnosticBatch: expect.objectContaining({ category: "COMPILER" }),
      }),
    );
    expect(prisma.stemFigureRenderAttempt.create).toHaveBeenCalledTimes(2);
    expect(prisma.stemFigureRenderAttempt.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "AI_REPAIR",
        }),
      }),
    );
  });

  it("repairs the complete compiler batch and auto-promotes a valid LIGHT revision", async () => {
    const authoritativeAdminInstructions =
      "Bỏ tam giác cũ và giữ đường tròn tâm O mà admin vừa yêu cầu.";
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 2,
      generationBrief: createGenerationBrief({
        targetGrade: 9,
        blockContent: { type: "example", problem: "Vẽ tam giác ABC." },
        adminInstructions: authoritativeAdminInstructions,
      }),
    });
    const renderer = {
      render: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          category: "SOURCE",
          code: "TEX_COMPILE_FAILED",
          log: "main.tex:5: Missing number\nmain.tex:5: Illegal unit of measure",
          durationMs: 20,
          rendererVersion: "test-renderer",
          issues: [
            compilerIssue("TEX_MISSING_NUMBER", "Missing number", 5),
            compilerIssue("TEX_ILLEGAL_UNIT", "Illegal unit of measure", 5),
          ],
          collectionComplete: true,
        })
        .mockResolvedValueOnce(renderSuccess()),
    };
    const repair = { repair: vi.fn(async () => repairedSource) };
    const validator = { validate: vi.fn(() => validationSuccess()) };
    const artifacts = createArtifactsMock();
    const processor = createProcessor(prisma, renderer, validator, repair, artifacts);

    const result = await processor.process(createJob(0, 3));

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      action: "STEM_FIGURE_RENDER",
      resourceId: figureId,
      details: { status: "SUCCEEDED", repairCount: 1 },
    });
    expect(repair.repair).toHaveBeenCalledTimes(1);
    expect(repair.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        figureId,
        revisionId,
        repairKind: "AUTO_COMPILER",
        latexSource: badSource,
        diagnosticBatch: expect.objectContaining({
          category: "COMPILER",
          collectionComplete: true,
          issues: [
            expect.objectContaining({ code: "TEX_MISSING_NUMBER", line: 5 }),
            expect.objectContaining({ code: "TEX_ILLEGAL_UNIT", line: 5 }),
          ],
        }),
        subject: { key: "MATH", name: "Toán", slug: "toan" },
      }),
    );
    expect(renderer.render).toHaveBeenNthCalledWith(2, repairedSource, "MATH");
    expect(artifacts.promoteSvg).toHaveBeenCalledWith(
      expect.objectContaining({
        figureId,
        revisionId,
        automatic: true,
        svg: validSvg,
      }),
    );
    expect(
      prisma.stemFigureRenderAttempt.update.mock.calls.some(
        ([args]) =>
          args.data.status === StemFigureAttemptStatus.FAILED &&
          args.data.errorCategory === "COMPILER" &&
          args.data.diagnosticBatch.issues.length === 2,
      ),
    ).toBe(true);
  });

  it("stops at NEEDS_REVIEW for validator issues without spending an AI call", async () => {
    const prisma = createPrismaMock({ repairCount: 0, maxRepairAttempts: 2 });
    const repair = { repair: vi.fn() };
    const artifacts = createArtifactsMock();
    const processor = createProcessor(
      prisma,
      { render: vi.fn(async () => renderSuccess()) },
      {
        validate: vi.fn(() => ({
          ok: false,
          validatorVersion: "validator-v2",
          issues: [
            {
              code: "SVG_EXTERNAL_REFERENCE",
              message: "SVG references an external asset.",
              repairableBySource: true,
            },
            {
              code: "SVG_NODE_LIMIT",
              message: "SVG contains too many nodes.",
              repairableBySource: true,
            },
          ],
        })),
      },
      repair,
      artifacts,
    );

    const result = await processor.process(createJob(0, 3));

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: { status: "NEEDS_REVIEW", issueCount: 2 },
    });
    expect(repair.repair).not.toHaveBeenCalled();
    expect(artifacts.promoteSvg).not.toHaveBeenCalled();
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: revisionId },
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.NEEDS_REVIEW,
          lastErrorCategory: "VALIDATOR",
        }),
      }),
    );
  });

  it("uses one manual validator repair request for the full batch, then stops on validator failure", async () => {
    const priorBatch = createStemFigureDiagnosticBatch({
      attemptId: "20000000-0000-4000-8000-000000000001",
      sourceVersion: 1,
      sourceHash: "a".repeat(64),
      category: "VALIDATOR",
      issues: [
        { code: "SVG_EXTERNAL_REFERENCE", message: "External reference" },
        { code: "SVG_NODE_LIMIT", message: "Too many nodes" },
      ],
      rawLogExcerpt: "validator failed",
      collectionComplete: true,
    });
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 2,
      trigger: "MANUAL_VALIDATOR_RETRY",
      diagnosticBatchHash: priorBatch.batchHash,
      seededAttempt: {
        id: priorBatch.attemptId,
        attemptNumber: 1,
        sourceVersion: 1,
        sourceHash: "a".repeat(64),
        diagnosticBatch: priorBatch,
        diagnosticBatchHash: priorBatch.batchHash,
        errorCategory: "VALIDATOR",
      },
    });
    const repair = { repair: vi.fn(async () => repairedSource) };
    const artifacts = createArtifactsMock();
    const processor = createProcessor(
      prisma,
      { render: vi.fn(async () => renderSuccess()) },
      {
        validate: vi.fn(() => ({
          ok: false,
          validatorVersion: "validator-v2",
          issues: [
            {
              code: "SVG_NODE_LIMIT",
              message: "Still too many nodes",
              repairableBySource: true,
            },
          ],
        })),
      },
      repair,
      artifacts,
    );

    const result = await processor.process(createJob(0, 3));

    expect(result).toMatchObject({ details: { status: "NEEDS_REVIEW" } });
    expect(repair.repair).toHaveBeenCalledTimes(1);
    expect(repair.repair).toHaveBeenCalledWith(
      expect.objectContaining({
        repairKind: "MANUAL_VALIDATOR",
        diagnosticBatch: expect.objectContaining({
          batchHash: priorBatch.batchHash,
          issues: expect.arrayContaining([
            expect.objectContaining({ code: "SVG_EXTERNAL_REFERENCE" }),
            expect.objectContaining({ code: "SVG_NODE_LIMIT" }),
          ]),
        }),
      }),
    );
    expect(artifacts.promoteSvg).not.toHaveBeenCalled();
  });

  it("requeues a transient renderer failure while BullMQ attempts remain", async () => {
    const prisma = createPrismaMock({ repairCount: 0, maxRepairAttempts: 2 });
    const repair = { repair: vi.fn() };
    const processor = createProcessor(
      prisma,
      {
        render: vi.fn(async () => ({
          ok: false,
          category: "INFRASTRUCTURE",
          code: "TEX_RENDERER_UNAVAILABLE",
          log: "connect ECONNREFUSED",
          issues: [
            {
              code: "TEX_RENDERER_UNAVAILABLE",
              severity: "ERROR",
              message: "connect ECONNREFUSED",
              file: null,
              line: null,
              column: null,
              element: null,
              path: null,
            },
          ],
          collectionComplete: false,
        })),
      },
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(0, 3))).rejects.toThrow(
      "TEX_RENDERER_UNAVAILABLE",
    );

    expect(repair.repair).not.toHaveBeenCalled();
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BackgroundJobStatus.QUEUED }),
      }),
    );
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.QUEUED,
          lastErrorCategory: "INFRASTRUCTURE",
        }),
      }),
    );
  });

  it("requeues a transient provider connection error before source generation", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 0,
      sourcePending: true,
      generationBrief: createGenerationBrief({
        blockContent: { type: "knowledge", content: "Vẽ sơ đồ minh họa." },
      }),
    });
    const processor = createProcessor(
      prisma,
      { render: vi.fn() },
      { validate: vi.fn() },
      {
        createNew: vi.fn(async () => {
          throw new Error("Connection error.");
        }),
        repair: vi.fn(),
      },
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(0, 3))).rejects.toThrow("Connection error.");
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: BackgroundJobStatus.QUEUED,
          attempts: 1,
        }),
      }),
    );
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.QUEUED,
          lastErrorCategory: "INFRASTRUCTURE",
        }),
      }),
    );
  });

  it("marks a transient infrastructure failure final after the last attempt", async () => {
    const prisma = createPrismaMock({ repairCount: 0, maxRepairAttempts: 2 });
    const processor = createProcessor(
      prisma,
      {
        render: vi.fn(async () => ({
          ok: false,
          category: "INFRASTRUCTURE",
          code: "TEX_RENDERER_REQUEST_TIMEOUT",
          log: "Request timed out.",
          issues: [],
          collectionComplete: false,
        })),
      },
      { validate: vi.fn() },
      { repair: vi.fn() },
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(2, 3))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(prisma.backgroundJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BackgroundJobStatus.FAILED }),
      }),
    );
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: StemFigureRevisionStatus.FAILED }),
      }),
    );
  });

  it("does not auto-repair a source-policy rejection before compiler invocation", async () => {
    const prisma = createPrismaMock({
      repairCount: 0,
      maxRepairAttempts: 2,
      latexSource: String.raw`\documentclass{article}
\begin{tikzpicture}
\draw (0,0)--(1,1);
\end{tikzpicture}`,
    });
    const renderer = { render: vi.fn() };
    const repair = { repair: vi.fn() };
    const processor = createProcessor(
      prisma,
      renderer,
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    const result = await processor.process(createJob(0, 3));

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: {
        status: "NEEDS_REVIEW",
        sourcePolicyPassed: false,
        compilerInvoked: false,
      },
    });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(repair.repair).not.toHaveBeenCalled();
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.NEEDS_REVIEW,
          lastErrorCategory: "SOURCE_POLICY",
          lastErrorCode: "TEX_SOURCE_POLICY_REJECTED",
        }),
      }),
    );
  });

  it("does not auto-repair when the compiler log batch is incomplete", async () => {
    const prisma = createPrismaMock({ repairCount: 0, maxRepairAttempts: 2 });
    const repair = { repair: vi.fn() };
    const processor = createProcessor(
      prisma,
      {
        render: vi.fn(async () => ({
          ok: false,
          category: "SOURCE",
          code: "TEX_COMPILE_FAILED",
          log: "compiler output was truncated",
          issues: [compilerIssue("TEX_COMPILE_ERROR", "Missing control sequence", 5)],
          collectionComplete: false,
        })),
      },
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    const result = await processor.process(createJob(0, 3));

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: { status: "NEEDS_REVIEW", firstCompilePassed: false },
    });
    expect(repair.repair).not.toHaveBeenCalled();
    expect(prisma.stemFigureRevision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureRevisionStatus.NEEDS_REVIEW,
          lastErrorCategory: "COMPILER",
          lastErrorCode: "TEX_COMPILER_DIAGNOSTICS_INCOMPLETE",
        }),
      }),
    );
  });

  it("fails permanently after the bounded compiler repair budget is exhausted", async () => {
    const prisma = createPrismaMock({ repairCount: 2, maxRepairAttempts: 2 });
    const repair = { repair: vi.fn() };
    const processor = createProcessor(
      prisma,
      {
        render: vi.fn(async () => ({
          ok: false,
          category: "SOURCE",
          code: "TEX_COMPILE_FAILED",
          log: "still invalid",
          issues: [compilerIssue("TEX_COMPILE_FAILED", "still invalid", 5)],
          collectionComplete: true,
        })),
      },
      { validate: vi.fn() },
      repair,
      createArtifactsMock(),
    );

    await expect(processor.process(createJob(0, 3))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(repair.repair).not.toHaveBeenCalled();
    expect(prisma.stemFigure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StemFigureStatus.FAILED,
          lastErrorCode: "TEX_SOURCE_REPAIR_EXHAUSTED",
        }),
      }),
    );
  });
});

function createProcessor(
  prisma: ReturnType<typeof createPrismaMock>,
  renderer: { render: ReturnType<typeof vi.fn> },
  validator: { validate: ReturnType<typeof vi.fn> },
  repair: {
    repair: ReturnType<typeof vi.fn>;
    createNew?: ReturnType<typeof vi.fn>;
  },
  artifacts: ReturnType<typeof createArtifactsMock>,
  storage: { downloadObject: ReturnType<typeof vi.fn> } = {
    downloadObject: vi.fn(),
  },
) {
  return new StemFigureRenderingProcessor(
    prisma as never,
    renderer as never,
    validator as never,
    repair as never,
    artifacts as never,
    storage as never,
  );
}

function referenceAsset(objectKey: string) {
  return {
    objectKey,
    mimeType: "image/png",
    label: objectKey,
    packetPageNumber: 1,
    source: "OCR_CROP",
  };
}

function createPrismaMock(input: {
  repairCount: number;
  maxRepairAttempts: number;
  latexSource?: string;
  trigger?: string;
  diagnosticBatchHash?: string;
  seededAttempt?: Record<string, unknown>;
  sourcePending?: boolean;
  revisionOrigin?: StemFigureRevisionOrigin;
  generationBrief?: Record<string, unknown>;
  providerRequestSnapshotsJson?: Record<string, unknown>;
}) {
  const figure = {
    id: figureId,
    aiGenerationId,
    lessonId: "00000000-0000-4000-8000-000000000015",
    lessonSummaryId: "00000000-0000-4000-8000-000000000016",
    blockPath: "sections.0.blocks.1",
    subjectKey: "MATH",
    subjectName: "Toán",
    subjectSlug: "toan",
    currentRevisionId: null,
    pendingRevisionId: revisionId,
    status: StemFigureStatus.QUEUED,
  };
  const revision = {
    id: revisionId,
    stemFigureId: figureId,
    origin: input.revisionOrigin ?? StemFigureRevisionOrigin.INITIAL_AI,
    status: StemFigureRevisionStatus.QUEUED,
    latexSource: input.sourcePending ? null : (input.latexSource ?? badSource),
    sourceHash: input.sourcePending ? null : "a".repeat(64),
    sourceVersion: 1,
    altText: "Đường thẳng đi lên",
    caption: "Đường thẳng",
    repairCount: input.repairCount,
    maxRepairAttempts: input.maxRepairAttempts,
    providerRequestSnapshotsJson: input.providerRequestSnapshotsJson ?? null,
  };
  const backgroundJob = {
    id: backgroundJobId,
    queue: BackgroundJobQueue.DIAGRAM_RENDERING,
    status: BackgroundJobStatus.QUEUED,
    ownerUserId: null,
    resourceType: "STEM_FIGURE",
    resourceId: figureId,
    inputMeta: {
      figureId,
      revisionId,
      sourceHash: revision.sourceHash,
      sourceVersion: revision.sourceVersion,
      trigger: input.trigger ?? "INITIAL",
      diagnosticBatchHash: input.diagnosticBatchHash ?? null,
      generationBrief: input.generationBrief ?? null,
    },
    attempts: 0,
    maxAttempts: 3,
  };
  const attempts: Array<Record<string, unknown>> = input.seededAttempt
    ? [{ ...input.seededAttempt }]
    : [];
  const stemFigureUpdate = vi.fn(async (args: { data: Record<string, unknown> }) => {
    Object.assign(figure, args.data);
    return { ...figure };
  });
  const revisionUpdate = vi.fn(async (args: { data: Record<string, unknown> }) => {
    Object.assign(revision, args.data);
    return { ...revision };
  });
  const attemptUpdate = vi.fn(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const attempt = attempts.find((item) => item.id === args.where.id);
      if (attempt) Object.assign(attempt, args.data);
      return attempt ?? args;
    },
  );
  return {
    backgroundJob: {
      findUnique: vi.fn(async () => ({ ...backgroundJob })),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        Object.assign(backgroundJob, args.data);
        return { ...backgroundJob };
      }),
    },
    lessonSummary: {
      findUnique: vi.fn(async () => ({ contentJson: {} })),
    },
    stemFigure: {
      findFirst: vi.fn(async () => ({ ...figure })),
      update: stemFigureUpdate,
    },
    stemFigureRevision: {
      findFirst: vi.fn(async () => ({ ...revision })),
      update: revisionUpdate,
    },
    stemFigureRenderAttempt: {
      aggregate: vi.fn(async () => ({ _max: { attemptNumber: attempts.length } })),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        const id = `10000000-0000-4000-8000-${String(attempts.length + 1).padStart(12, "0")}`;
        const attempt = { id, ...args.data };
        attempts.push(attempt);
        return { id };
      }),
      update: attemptUpdate,
      findFirst: vi.fn(async () => attempts.at(-1) ?? null),
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
  };
}

function createArtifactsMock() {
  return {
    promoteSvg: vi.fn(async () => ({
      fileId: "00000000-0000-4000-8000-000000000023",
      checksum: "b".repeat(64),
    })),
  };
}

function compilerIssue(code: string, message: string, line: number) {
  return {
    code,
    severity: "ERROR" as const,
    message,
    file: "fragment.tex",
    line,
    column: null,
    element: null,
    path: null,
  };
}

function renderSuccess() {
  return {
    ok: true as const,
    svg: validSvg,
    log: "compiled",
    durationMs: 25,
    rendererVersion: "test-renderer",
  };
}

function validationSuccess() {
  return {
    ok: true as const,
    sanitizedSvg: validSvg,
    sha256: "b".repeat(64),
    width: null,
    height: null,
    viewBox: [0, 0, 10, 10] as [number, number, number, number],
    nodeCount: 2,
    validatorVersion: "validator-v2",
  };
}

function createJob(attemptsMade: number, attempts: number) {
  return {
    id: "bullmq-render-job",
    data: { backgroundJobId },
    attemptsMade,
    opts: { attempts },
  } as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
}
