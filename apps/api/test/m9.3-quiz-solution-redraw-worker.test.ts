import { describe, expect, it, vi } from "vitest";

import { generatedQuizSolutionFigureSchema } from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import {
  buildQuizRendererFailureMessage,
  QuizFigureRenderingProcessor,
} from "#api/workers/processors/quiz-figure-rendering.processor";

const backgroundJobId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const solutionFigureId = "33333333-3333-4333-8333-333333333333";
const solutionRevisionId = "44444444-4444-4444-8444-444444444444";
const attemptId = "66666666-6666-4666-8666-666666666666";

const redrawnSource = [
  "\\begin{tikzpicture}",
  "\\draw (0,0) rectangle (4,2);",
  "\\draw (0,2) rectangle (2,4);",
  "\\node at (2,1) {$S_1$};",
  "\\node at (1,3) {$S_2$};",
  "\\end{tikzpicture}",
].join("\n");

describe("M9.3 independent Quiz solution figure worker", () => {
  it("keeps structured compiler issues ahead of the TeX log preamble", () => {
    const message = buildQuizRendererFailureMessage({
      ok: false,
      category: "SOURCE",
      code: "TEX_COMPILE_FAILED",
      log: `${"LuaHBTeX compiler preamble\n".repeat(200)}fragment.tex:25: Dimension too large.`,
      issues: [
        {
          code: "TEX_DIMENSION_TOO_LARGE",
          severity: "ERROR",
          message: "Dimension too large.",
          file: "fragment.tex",
          line: 25,
          column: null,
        },
      ],
    });

    expect(message.slice(0, 2_000)).toContain(
      "TEX_DIMENSION_TOO_LARGE (fragment.tex:line 25): Dimension too large.",
    );
    expect(message.indexOf("Compiler diagnostics:")).toBeLessThan(
      message.indexOf("Compiler log tail:"),
    );
  });

  it("renders a complete new source without depending on a question figure", async () => {
    const prisma = {
      backgroundJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: backgroundJobId,
          queue: "QUIZ_FIGURE_RENDERING",
          status: "QUEUED",
          ownerUserId: null,
          resourceType: "QUIZ_FIGURE",
          resourceId: solutionFigureId,
          inputMeta: {
            figureId: solutionFigureId,
            revisionId: solutionRevisionId,
            aiMode: "REGENERATE",
            systemPrompt: "CUSTOM FIGURE PROMPT",
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
          id: solutionFigureId,
          role: "SOLUTION",
          aiGenerationId: null,
          quizQuestionId: questionId,
          planJson: {
            version: 2,
            role: "SOLUTION",
            problem: "Mảnh đất ABCDEF có các kích thước đã cho.",
            solution:
              "Kẻ CE vuông góc DE để chia mảnh đất thành hai hình chữ nhật S1 và S2.",
            caption: "Caption lịch sử không được gửi lại cho OpenAI.",
          },
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          aiGeneration: { inputMetaJson: { targetGrade: 8 } },
          pendingRevision: {
            id: solutionRevisionId,
            sourceVersion: 1,
            latexSource: null,
            sourceHash: null,
          },
          currentRevision: null,
        }),
        findFirst: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          role: "SOLUTION",
          quizQuestionId: questionId,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRevision: {
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const provider = {
      generateStructured: vi.fn().mockResolvedValue({
        data: { latexSource: redrawnSource },
      }),
    };
    const renderer = {
      render: vi.fn().mockResolvedValue({
        ok: true,
        svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
        log: "ok",
        durationMs: 5,
        rendererVersion: "test-renderer",
      }),
    };
    const artifacts = { promoteSvg: vi.fn().mockResolvedValue({}) };
    const processor = new QuizFigureRenderingProcessor(
      prisma as never,
      provider as never,
      renderer as never,
      artifacts as never,
      {} as never,
    );

    await processor.process({
      id: "bull-job-1",
      data: { backgroundJobId },
    } as never);

    const providerCall = provider.generateStructured.mock.calls[0];
    expect(providerCall?.[0]).toEqual(expect.objectContaining({ feature: "QUIZ" }));
    expect(providerCall?.[1]).toEqual(
      expect.objectContaining({ outputName: "solution_figure" }),
    );
    expect(providerCall?.[1]?.systemPrompt).toBe("CUSTOM FIGURE PROMPT");
    expect(providerCall?.[1]?.systemPrompt).not.toContain("QUY CHUẨN HÌNH TOÀN HỆ THỐNG");
    expect(JSON.parse(providerCall?.[1]?.userPrompt ?? "{}")).toMatchObject({
      role: "SOLUTION",
      targetGrade: 8,
    });
    expect(JSON.parse(providerCall?.[1]?.userPrompt ?? "{}")).not.toHaveProperty(
      "exactQuestionLatexSource",
    );
    expect(providerCall?.[1]?.userPrompt).not.toContain("Caption lịch sử");
    expect(providerCall?.[1]?.userPrompt).not.toContain('"caption"');
    expect(providerCall?.[2]).toBe(generatedQuizSolutionFigureSchema);
    expect(renderer.render).toHaveBeenCalledWith(redrawnSource, "MATH");
    expect(prisma.quizFigure.findFirst).not.toHaveBeenCalled();
    expect(artifacts.promoteSvg).toHaveBeenCalledWith(
      expect.objectContaining({
        figureId: solutionFigureId,
        revisionId: solutionRevisionId,
      }),
    );
  });

  it("keeps the original error and terminal job state when one failure update breaks", async () => {
    const originalError = new Error("OPENAI_REQUEST_ABORTED");
    const backgroundJobUpdate = vi.fn().mockResolvedValue({});
    const figureUpdate = vi.fn().mockResolvedValue({});
    const revisionUpdate = vi
      .fn()
      .mockRejectedValue(
        new Error("The column quiz_figure_revisions.legacy_column does not exist."),
      );
    const prisma = {
      backgroundJob: {
        findUnique: vi.fn().mockResolvedValue({
          id: backgroundJobId,
          queue: "QUIZ_FIGURE_RENDERING",
          status: "QUEUED",
          ownerUserId: null,
          resourceType: "QUIZ_FIGURE",
          resourceId: solutionFigureId,
          inputMeta: {
            figureId: solutionFigureId,
            revisionId: solutionRevisionId,
          },
          attempts: 0,
          maxAttempts: 1,
        }),
        update: backgroundJobUpdate,
      },
      quizFigureRenderAttempt: {
        aggregate: vi.fn().mockResolvedValue({ _max: { attemptNumber: null } }),
      },
      quizFigure: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: solutionFigureId,
          role: "SOLUTION",
          aiGenerationId: null,
          quizQuestionId: questionId,
          planJson: {
            version: 2,
            role: "SOLUTION",
            problem: "Cho tam giác ABC.",
            solution: "Dựng AH vuông góc BC.",
          },
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          aiGeneration: { inputMetaJson: { targetGrade: 8 } },
          pendingRevision: {
            id: solutionRevisionId,
            origin: "INITIAL_AI",
            sourceVersion: 1,
            latexSource: null,
            sourceHash: null,
          },
          currentRevision: null,
        }),
        update: figureUpdate,
      },
      quizFigureRevision: {
        update: revisionUpdate,
      },
    };
    const provider = {
      generateStructured: vi.fn().mockRejectedValue(originalError),
    };
    const processor = new QuizFigureRenderingProcessor(
      prisma as never,
      provider as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      processor.process({
        id: "bull-job-failure",
        data: { backgroundJobId },
      } as never),
    ).rejects.toThrow("OPENAI_REQUEST_ABORTED");

    expect(revisionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true } }),
    );
    expect(figureUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "NEEDS_REVIEW" }),
        select: { id: true },
      }),
    );
    expect(backgroundJobUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: "OPENAI_REQUEST_ABORTED",
        }),
        select: { id: true },
      }),
    );
  });
});
