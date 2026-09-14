import { describe, expect, it, vi } from "vitest";

import {
  buildQuizFigureRefinementInput,
  generatedQuizFigureRefinementSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { buildQuizFigureRefinementImageDataUrl } from "#api/modules/quiz-figures/utils/quiz-figure-refinement-image";
import { QuizFigureRenderingProcessor } from "#api/workers/processors/quiz-figure-rendering.processor";

const currentSource = [
  "\\begin{tikzpicture}",
  "\\draw (0,0) -- (2,0) -- (0,2) -- cycle;",
  "\\end{tikzpicture}",
].join("\n");
const currentSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><path d="M5 70L70 70L5 5Z"/></svg>',
);

describe("M9.21 Quiz figure AI refinement", () => {
  it("uses one current image for both independent figure roles", async () => {
    const imageUrl = await buildQuizFigureRefinementImageDataUrl(currentSvg);
    for (const plan of [
      { version: 1 as const, role: "QUESTION" as const, problem: "Cho tam giác ABC." },
      {
        version: 2 as const,
        role: "SOLUTION" as const,
        problem: "Cho tam giác ABC.",
        solution: "Dựng AH vuông góc BC.",
      },
    ]) {
      const input = buildQuizFigureRefinementInput({
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        plan,
        targetGrade: 8,
        adminInstructions: "  Ưu tiên sửa nhãn đang chồng nét.  ",
        currentLatexSource: currentSource,
        currentImageDataUrl: imageUrl,
      });

      expect(input.inputImages).toEqual([{ imageUrl, detail: "high" }]);
      expect(input.schemaVersion).toBe("quiz-figure-refinement-schema-v4-visual-only");
      expect(JSON.parse(input.userPrompt)).toEqual({
        figurePlan: plan,
        targetGrade: 8,
        adminInstructions: "Ưu tiên sửa nhãn đang chồng nét.",
        currentLatexSource: currentSource,
      });
      expect(input.systemPrompt).toContain("TINH CHỈNH TOÀN DIỆN BẰNG AI");
      expect(input.systemPrompt).toContain("Nếu user input có adminInstructions");
      expect(input.systemPrompt).toContain("toàn bộ latexSource hoàn chỉnh");
      expect(input.systemPrompt).not.toContain("extensionLatex");
      expect(input.systemPrompt).not.toContain("exactQuestionLatexSource");
    }
  });

  it("omits blank admin instructions from the dynamic user prompt", () => {
    const input = buildQuizFigureRefinementInput({
      subject: { key: "GENERAL", name: "Sinh học", slug: "sinh-hoc" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Quan sát sơ đồ.",
      },
      adminInstructions: "   ",
      currentLatexSource: currentSource,
      currentImageDataUrl: "data:image/png;base64,aW1hZ2U=",
    });

    expect(JSON.parse(input.userPrompt)).not.toHaveProperty("adminInstructions");
  });

  it("keeps solution as the higher-priority authority without implying sequential inputs", () => {
    const input = buildQuizFigureRefinementInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 2,
        role: "SOLUTION",
        problem: "Cho tam giác ABC.",
        solution: "Dựng AH vuông góc BC.",
      },
      currentLatexSource: currentSource,
      currentImageDataUrl: "data:image/png;base64,aW1hZ2U=",
    });
    expect(input.systemPrompt).toContain("solution là nguồn ưu tiên cao nhất");
    expect(input.systemPrompt).toContain("dùng cả solution và problem");
    expect(input.systemPrompt).not.toContain("sau đó mới đến problem");
    expect(input.promptVersion).toBe(
      "quiz-figure-math-solution-refinement-comprehensive-v41-visual-only-solution",
    );
    expect(input.schemaVersion).toBe("quiz-figure-refinement-schema-v4-visual-only");
  });

  it("uses the same full-source refinement schema in the worker", async () => {
    const refinedSource = currentSource.replace("\\draw", "\\draw[thick]");
    const provider = {
      generateStructured: vi.fn().mockResolvedValue({
        data: { latexSource: refinedSource },
      }),
    };
    const storage = { downloadObject: vi.fn().mockResolvedValue(currentSvg) };
    const processor = new QuizFigureRenderingProcessor(
      {} as never,
      provider as never,
      {} as never,
      {} as never,
      storage as never,
    );
    const createSource = Reflect.get(processor, "createSource") as (
      this: QuizFigureRenderingProcessor,
      input: unknown,
    ) => Promise<string>;

    const result = await createSource.call(processor, {
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      targetGrade: 8,
      backgroundJobId: "11111111-1111-4111-8111-111111111111",
      attempt: 1,
      aiMode: "REGENERATE",
      operation: "REFINE_CURRENT",
      adminInstructions: "Ưu tiên sửa nhãn đang chồng nét.",
      figure: {
        id: "22222222-2222-4222-8222-222222222222",
        role: "SOLUTION",
        aiGenerationId: null,
        quizQuestionId: "33333333-3333-4333-8333-333333333333",
        pendingRevision: {
          id: "44444444-4444-4444-8444-444444444444",
          sourceVersion: 2,
        },
        currentRevision: {
          latexSource: currentSource,
          sourceKind: "AI_TEX",
          deliveryFile: { mimeType: "image/svg+xml", objectKey: "quiz/current.svg" },
        },
      },
      plan: {
        version: 2,
        role: "SOLUTION",
        problem: "Cho tam giác ABC.",
        solution: "Dựng AH vuông góc BC.",
      },
    });

    expect(result).toBe(refinedSource);
    expect(provider.generateStructured.mock.calls[0]?.[2]).toBe(
      generatedQuizFigureRefinementSchema,
    );
    expect(provider.generateStructured.mock.calls[0]?.[1].inputImages).toHaveLength(1);
    expect(
      JSON.parse(provider.generateStructured.mock.calls[0]?.[1].userPrompt),
    ).toMatchObject({
      adminInstructions: "Ưu tiên sửa nhãn đang chồng nét.",
    });
  });
});
