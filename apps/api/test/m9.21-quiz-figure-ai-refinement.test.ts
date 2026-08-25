import { describe, expect, it, vi } from "vitest";

import {
  buildQuizFigureRefinementInput,
  generatedQuizFigureRefinementSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { QuizFiguresService } from "#api/modules/quiz-figures/services/quiz-figures.service";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { QuizFigureRenderingProcessor } from "#api/workers/processors/quiz-figure-rendering.processor";

const backgroundJobId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const figureId = "33333333-3333-4333-8333-333333333333";
const revisionId = "44444444-4444-4444-8444-444444444444";
const currentRevisionId = "55555555-5555-4555-8555-555555555555";
const attemptId = "66666666-6666-4666-8666-666666666666";
const currentSource = [
  "\\begin{tikzpicture}",
  "\\draw (0,0) -- (2,0) -- (0,2) -- cycle;",
  "% QUIZ_SOLUTION_EXTENSION",
  "\\end{tikzpicture}",
].join("\n");
const refinedSource = currentSource.replace("(0,2)", "(0,2.4)");
const currentSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><path d="M5 70L70 70L5 5Z" fill="none" stroke="black"/></svg>',
);

describe("M9.21 Quiz figure AI refinement", () => {
  it("builds a subject-owned multimodal request from the original plan", async () => {
    const imageUrl = await buildQuizFigureRefinementImageDataUrl(currentSvg);
    const input = buildQuizFigureRefinementInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: { version: 1, role: "QUESTION", problem: "Cho tam giác ABC vuông tại A." },
      targetGrade: 8,
      currentLatexSource: currentSource,
      currentImageDataUrl: imageUrl,
    });

    expect(input.inputImages).toEqual([{ imageUrl, detail: "high" }]);
    expect(input.systemPrompt).toContain("TINH CHỈNH TOÀN DIỆN BẰNG AI");
    expect(input.systemPrompt).toContain("không phải danh sách đóng");
    expect(input.systemPrompt).toContain("phải neo vào đúng path sở hữu");
    expect(input.systemPrompt).toContain("trượt dọc path bằng `pos`");
    expect(input.systemPrompt).toContain("nếu buộc phải đặt xa thì dùng leader line");
    expect(input.systemPrompt).not.toContain("REGENERATE");
    expect(input.systemPrompt).not.toContain("EDIT_CURRENT");
    expect(input.systemPrompt).not.toContain("extensionLatex");
    expect(JSON.parse(input.userPrompt)).toEqual({
      figurePlan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
      },
      targetGrade: 8,
      currentLatexSource: currentSource,
    });
    expect(Object.keys(JSON.parse(input.userPrompt))).toEqual([
      "figurePlan",
      "targetGrade",
      "currentLatexSource",
    ]);
    expect(input.promptVersion).toContain("refinement-v6-target-grade-context");
    expect(imageUrl).toMatch(/^data:image\/png;base64,/u);
  });

  it("previews the exact multimodal request and estimated cost without enqueueing", async () => {
    const prisma = {
      quizFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figureId,
          role: "QUESTION",
          status: "SUCCEEDED",
          planJson: {
            version: 1,
            role: "QUESTION",
            problem: "Cho tam giác ABC vuông tại A.",
          },
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          aiGeneration: { inputMetaJson: { targetGrade: 8 } },
          currentRevisionId,
          currentRevision: {
            status: "SUCCEEDED",
            sourceKind: "AI_TEX",
            latexSource: currentSource,
            deliveryFileId: "77777777-7777-4777-8777-777777777777",
            deliveryFile: {
              mimeType: "image/svg+xml",
              objectKey: "quiz/current.svg",
            },
          },
        }),
      },
    };
    const artifacts = {
      readDeliveryObject: vi.fn().mockResolvedValue(currentSvg),
    };
    const jobs = { enqueue: vi.fn() };
    const provider = {
      previewStructuredRequest: vi.fn().mockResolvedValue({
        provider: "OPENAI",
        model: "gpt-test",
        temperature: 0.1,
        reasoningEffort: "medium",
        maxOutputTokens: 12_000,
        systemPrompt: "system refinement",
        userPrompt: JSON.stringify({
          figurePlan: { role: "QUESTION" },
          currentLatexSource: currentSource,
        }),
        textFormat: {
          type: "json_schema",
          name: "quiz_figure_refinement",
          strict: true,
          schema: { type: "object", additionalProperties: false },
        },
        inputTokenEstimate: {
          textInputTokens: 100,
          imageInputTokens: 200,
          estimatedTokens: 300,
        },
        estimatedCost: {
          available: true,
          inputUpperBoundUsd: 0.01,
          inputUpperBoundVnd: 250,
          outputUpperBoundUsd: 0.02,
          outputUpperBoundVnd: 500,
          upperBoundUsd: 0.03,
          upperBoundVnd: 750,
          fxRateVndPerUsd: 25_000,
        },
      }),
    };
    const modelRouting = {
      resolve: vi.fn().mockResolvedValue({
        feature: "QUIZ",
        purpose: "IMAGE",
        model: "gpt-test",
        temperature: null,
        reasoningEffort: "medium",
        maxInputTokens: 20_000,
        maxOutputTokens: 12_000,
        candidates: [{ provider: "OPENAI", model: "gpt-test", available: true }],
        hasConfiguration: true,
      }),
      getAllActiveModels: vi.fn().mockResolvedValue([]),
    };
    const service = new QuizFiguresService(
      prisma as never,
      artifacts as never,
      {} as never,
      jobs as never,
      provider as never,
      modelRouting as never,
    );

    const preview = await service.previewRefinement(questionId, figureId, {
      baseRevisionId: currentRevisionId,
    });

    expect(preview).toMatchObject({
      operation: "REFINE_CURRENT",
      configuration: { resolvedModel: "gpt-test" },
      context: { imageInputTokens: 200 },
      estimatedCost: { upperBoundVnd: 750 },
    });
    expect(preview.currentImageDataUrl).toMatch(/^data:image\/png;base64,/u);
    expect(JSON.stringify(preview.providerInput)).toContain(
      "<binary data omitted from preview>",
    );
    expect(artifacts.readDeliveryObject).toHaveBeenCalledWith("quiz/current.svg");
    const previewInput = provider.previewStructuredRequest.mock.calls[0]?.[1];
    expect(JSON.parse(previewInput?.userPrompt ?? "{}")).toMatchObject({
      targetGrade: 8,
    });
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("sends the rendered current image and full TikZ source before promoting", async () => {
    const prisma = {
      backgroundJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: backgroundJobId,
          queue: "QUIZ_FIGURE_RENDERING",
          status: "QUEUED",
          ownerUserId: null,
          resourceType: "QUIZ_FIGURE",
          resourceId: figureId,
          inputMeta: {
            figureId,
            revisionId,
            operation: "REFINE_CURRENT",
            routeSnapshot: { feature: "QUIZ", model: "gpt-test", candidates: [] },
          },
          attempts: 0,
          maxAttempts: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRenderAttempt: {
        aggregate: vi.fn().mockResolvedValue({ _max: { attemptNumber: null } }),
        create: vi.fn().mockResolvedValue({ id: attemptId }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigure: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: figureId,
          role: "QUESTION",
          aiGenerationId: null,
          quizQuestionId: questionId,
          planJson: {
            version: 1,
            role: "QUESTION",
            problem: "Cho tam giác ABC vuông tại A.",
          },
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          aiGeneration: { inputMetaJson: { targetGrade: 8 } },
          pendingRevision: {
            id: revisionId,
            sourceVersion: 2,
            latexSource: null,
            sourceHash: null,
          },
          currentRevision: {
            id: currentRevisionId,
            latexSource: currentSource,
            sourceKind: "AI_TEX",
            deliveryFile: {
              mimeType: "image/svg+xml",
              objectKey: "quiz/current.svg",
            },
          },
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRevision: { update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const provider = {
      generateStructured: vi.fn().mockResolvedValue({
        data: { latexSource: refinedSource },
      }),
    };
    const renderer = {
      render: vi.fn().mockResolvedValue({
        ok: true,
        svg: currentSvg.toString("utf8"),
        log: "ok",
        durationMs: 4,
        rendererVersion: "test-renderer",
      }),
    };
    const artifacts = { promoteSvg: vi.fn().mockResolvedValue({}) };
    const storage = { downloadObject: vi.fn().mockResolvedValue(currentSvg) };
    const processor = new QuizFigureRenderingProcessor(
      prisma as never,
      provider as never,
      renderer as never,
      artifacts as never,
      {} as never,
      storage as never,
    );

    await processor.process({
      id: "bull-job-refine",
      data: { backgroundJobId },
    } as never);

    const request = provider.generateStructured.mock.calls[0]?.[1];
    expect(request.inputImages?.[0]?.imageUrl).toMatch(/^data:image\/png;base64,/u);
    expect(JSON.parse(request.userPrompt)).toEqual({
      figurePlan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
      },
      targetGrade: 8,
      currentLatexSource: currentSource,
    });
    expect(provider.generateStructured.mock.calls[0]?.[2]).toBe(
      generatedQuizFigureRefinementSchema,
    );
    expect(prisma.quizFigureRenderAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "AI_REFINEMENT" }),
      }),
    );
    expect(renderer.render).toHaveBeenCalledWith(refinedSource, "MATH");
    expect(artifacts.promoteSvg).toHaveBeenCalledWith(
      expect.objectContaining({ figureId, revisionId }),
    );
  });
});
