import { describe, expect, it, vi } from "vitest";

import {
  QuizFiguresService,
  readQuizFigurePendingAiTargetMode,
} from "#api/modules/quiz-figures/services/quiz-figures.service";
import { buildSolutionFigureInput } from "#api/modules/quiz-figures/types/quiz-figure-generation.types";

const questionId = "11111111-1111-4111-8111-111111111111";

describe("M9.22 Quiz figure AI authoring", () => {
  it("reads the active solution target from the standalone plan", () => {
    expect(
      readQuizFigurePendingAiTargetMode({
        planSnapshot: {
          version: 2,
          role: "SOLUTION",
          problem: "Đề bài",
          solution: "Lời giải",
        },
      }),
    ).toBe("SOLUTION");
  });

  it("ignores pending jobs without a question-level authoring plan", () => {
    expect(readQuizFigurePendingAiTargetMode({ planSnapshot: null })).toBeNull();
  });

  it("builds a complete solution figure from problem and solution only", () => {
    const input = buildSolutionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 2,
        role: "SOLUTION",
        problem: "Cho hình chữ nhật có chiều dài 6 m và chiều rộng 4 m.",
        solution: "Chia hình thành hai phần để tính diện tích.",
      },
    });

    expect(JSON.parse(input.userPrompt)).toMatchObject({
      role: "SOLUTION",
    });
    expect(JSON.parse(input.userPrompt)).not.toHaveProperty("exactQuestionLatexSource");
  });

  it.each(["MULTIPLE_CHOICE", "TRUE_FALSE"] as const)(
    "previews an independent solution figure for %s without a persisted question figure or provider call",
    async (questionType) => {
      const prisma = {
        quizQuestion: {
          findFirst: vi.fn().mockResolvedValue(questionFixture(questionType)),
        },
      };
      const provider = {
        previewStructuredRequest: vi.fn().mockResolvedValue({
          provider: "OPENAI",
          model: "gpt-test",
          temperature: null,
          reasoningEffort: "medium",
          maxOutputTokens: 12_000,
          systemPrompt: "solution system",
          userPrompt: JSON.stringify({
            role: "SOLUTION",
            problem: "Đề bài hiện tại",
            solution: "Lời giải hiện tại",
          }),
          textFormat: {
            type: "json_schema",
            name: "quiz_solution_figure",
            strict: true,
            schema: { type: "object", additionalProperties: false },
          },
          inputTokenEstimate: { textInputTokens: 120, estimatedTokens: 120 },
          estimatedCost: { available: true, upperBoundVnd: 500 },
        }),
      };
      const jobs = { enqueue: vi.fn() };
      const modelRouting = {
        resolve: vi.fn().mockResolvedValue({
          version: 1,
          feature: "QUIZ",
          purpose: "IMAGE",
          model: "gpt-test",
          temperature: null,
          reasoningEffort: "medium",
          maxInputTokens: 20_000,
          maxOutputTokens: 12_000,
          candidates: [
            {
              provider: "OPENAI",
              model: "gpt-test",
              available: true,
              capabilitiesJson: {
                aiConfiguration: "REASONING_EFFORT",
                reasoningEffortLevels: ["medium"],
              },
            },
          ],
          hasConfiguration: true,
        }),
        getAllActiveModels: vi.fn().mockResolvedValue([]),
      };
      const service = new QuizFiguresService(
        prisma as never,
        {} as never,
        {} as never,
        jobs as never,
        provider as never,
        modelRouting as never,
      );

      const preview = await service.previewForQuestion(questionId, {
        targetMode: "SOLUTION",
        baseRevisionId: null,
        mode: "REGENERATE",
      });

      const request = provider.previewStructuredRequest.mock.calls[0]?.[1];
      expect(JSON.parse(request?.userPrompt ?? "{}")).not.toHaveProperty(
        "exactQuestionLatexSource",
      );
      expect(preview).toMatchObject({
        mode: "REGENERATE",
        configuration: { resolvedModel: "gpt-test" },
      });
      expect(jobs.enqueue).not.toHaveBeenCalled();
    },
  );
});

function questionFixture(
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" = "MULTIPLE_CHOICE",
) {
  return {
    id: questionId,
    lessonId: "22222222-2222-4222-8222-222222222222",
    questionType,
    questionJson: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Đề bài hiện tại" }] },
      ],
    },
    sourceMetadataJson: {
      quizExplanationBlock: {
        type: "quizExplanation",
        answer: "Đáp án",
        solution: "Lời giải hiện tại",
      },
    },
    explanation: null,
    lesson: {
      learningPath: {
        domain: { name: "Toán", slug: "toan" },
        targetAudiences: [{ targetAudience: { grade: 8 } }],
      },
    },
    figures: [],
  };
}
