import { describe, expect, it, vi } from "vitest";

import { generatedQuizSolutionRedrawSchema } from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { QuizFigureRenderingProcessor } from "#api/workers/processors/quiz-figure-rendering.processor";

const backgroundJobId = "11111111-1111-4111-8111-111111111111";
const questionId = "22222222-2222-4222-8222-222222222222";
const solutionFigureId = "33333333-3333-4333-8333-333333333333";
const solutionRevisionId = "44444444-4444-4444-8444-444444444444";
const questionRevisionId = "55555555-5555-4555-8555-555555555555";
const attemptId = "66666666-6666-4666-8666-666666666666";

const questionSource = [
  "\\begin{tikzpicture}",
  "\\draw[fill=green!15] (0,0) -- (4,0) -- (4,2) -- (2,2) -- (2,4) -- (0,4) -- cycle;",
  "% QUIZ_SOLUTION_EXTENSION",
  "\\end{tikzpicture}",
].join("\n");

const redrawnSource = [
  "\\begin{tikzpicture}",
  "\\draw (0,0) rectangle (4,2);",
  "\\draw (0,2) rectangle (2,4);",
  "\\node at (2,1) {$S_1$};",
  "\\node at (1,3) {$S_2$};",
  "\\end{tikzpicture}",
].join("\n");

describe("M9.3 redrawn Quiz solution figure worker", () => {
  it("renders a complete new source while keeping question revision provenance", async () => {
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
            version: 1,
            role: "SOLUTION",
            mode: "REDRAW_AS_MODEL",
            problem: "Mảnh đất ABCDEF có các kích thước đã cho.",
            solution:
              "Kẻ CE vuông góc DE để chia mảnh đất thành hai hình chữ nhật S1 và S2.",
            modelingGoal: "Vẽ lại mảnh đất thành hai miền chữ nhật.",
            modeledObjects: ["Đa giác ABCDEF", "Đoạn CE", "Hai miền S1 và S2"],
            clarifiedRelations: ["CE vuông góc DE"],
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
        findFirst: vi.fn().mockResolvedValue({
          currentRevision: {
            id: questionRevisionId,
            latexSource: questionSource,
            status: "SUCCEEDED",
          },
        }),
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
      {} as never,
    );

    await processor.process({
      id: "bull-job-1",
      data: { backgroundJobId },
    } as never);

    const providerCall = provider.generateStructured.mock.calls[0];
    expect(providerCall?.[0]).toEqual(expect.objectContaining({ feature: "QUIZ" }));
    expect(providerCall?.[1]).toEqual(
      expect.objectContaining({ outputName: "quiz_solution_figure_redraw" }),
    );
    expect(providerCall?.[1]?.systemPrompt).toBe("CUSTOM FIGURE PROMPT");
    expect(providerCall?.[1]?.systemPrompt).not.toContain("QUY CHUẨN HÌNH TOÀN HỆ THỐNG");
    expect(JSON.parse(providerCall?.[1]?.userPrompt ?? "{}")).toMatchObject({
      mode: "REDRAW_AS_MODEL",
      targetGrade: 8,
      exactQuestionLatexSource: questionSource,
    });
    expect(providerCall?.[1]?.userPrompt).not.toContain("Caption lịch sử");
    expect(providerCall?.[1]?.userPrompt).not.toContain('"caption"');
    expect(providerCall?.[2]).toBe(generatedQuizSolutionRedrawSchema);
    expect(renderer.render).toHaveBeenCalledWith(redrawnSource, "MATH");
    expect(renderer.render).not.toHaveBeenCalledWith(
      expect.stringContaining(questionSource),
      "MATH",
    );
    expect(prisma.quizFigureRevision.update).toHaveBeenCalledWith({
      where: { id: solutionRevisionId },
      data: { derivedFromQuestionRevisionId: questionRevisionId },
    });
    expect(artifacts.promoteSvg).toHaveBeenCalledWith(
      expect.objectContaining({
        figureId: solutionFigureId,
        revisionId: solutionRevisionId,
      }),
    );
  });
});
