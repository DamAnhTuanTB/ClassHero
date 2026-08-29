import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toTiptap } from "#api/modules/ai/utils/lesson-content-generation-mapper";
import { normalizeGeneratedQuizQuestionLatex } from "#api/modules/quiz/utils/quiz-generation-math-normalizer";
import { toQuizTiptap } from "#api/modules/quiz/utils/quiz-generation-mapper";

describe("STEM content formatting regression", () => {
  it.each([
    ["Quiz", toQuizTiptap],
    ["Test and Flashcard", toTiptap],
  ])("preserves spaces adjacent to inline math in %s", (_label, convert) => {
    expect(convert(String.raw`$\mathrm{NaCl}$ nóng chảy`)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "inlineMath", attrs: { latex: String.raw`\mathrm{NaCl}` } },
            { type: "text", text: " nóng chảy" },
          ],
        },
      ],
    });

    expect(convert(String.raw`Vận tốc $v=\dfrac{s}{t}$ có đơn vị`)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Vận tốc " },
            { type: "inlineMath", attrs: { latex: String.raw`v=\dfrac{s}{t}` } },
            { type: "text", text: " có đơn vị" },
          ],
        },
      ],
    });
  });

  it.each([
    ["Quiz", toQuizTiptap],
    ["Test and Flashcard", toTiptap],
  ])("keeps escaped dollars and STEM commands in %s", (_label, convert) => {
    const document = convert(
      String.raw`Giá $P=\$5$; $\ce{SO4^2-}$; $\pu{9.81 m//s2}$; H₂O, ΔT, Ω.`,
    );
    const serialized = JSON.stringify(document);

    expect(serialized).toContain(String.raw`P=\\$5`);
    expect(serialized).toContain(String.raw`\\ce{SO4^2-}`);
    expect(serialized).toContain(String.raw`\\pu{9.81 m//s2}`);
    expect(serialized).toContain("H₂O, ΔT, Ω.");
  });

  it.each([
    ["Quiz", toQuizTiptap],
    ["Test and Flashcard", toTiptap],
  ])("preserves command-like prose in %s", (_label, convert) => {
    const prose =
      "Khi kim loại kết hợp với phi kim tạo thành muối, chất tan trong nước, nội dung được in đậm và ghi vào log.";

    expect(convert(prose)).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: prose }] }],
    });

    expect(convert(String.raw`Phi kim có góc $phi=theta$.`)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Phi kim có góc " },
            { type: "inlineMath", attrs: { latex: String.raw`\phi=\theta` } },
            { type: "text", text: "." },
          ],
        },
      ],
    });
  });

  it("repairs lost Chemistry and Physics command slashes in legacy generation", () => {
    const document = toTiptap(String.raw`$ce{NaCl}$ và $pu{9.81 m//s2}$`);
    const serialized = JSON.stringify(document);

    expect(serialized).toContain(String.raw`\\ce{NaCl}`);
    expect(serialized).toContain(String.raw`\\pu{9.81 m//s2}`);
  });

  it("repairs lost Chemistry and Physics command slashes in active Quiz generation", () => {
    const normalized = normalizeGeneratedQuizQuestionLatex({
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: String.raw`Xét $ce{NaCl}$.`,
      explanation: {
        problem: String.raw`Đơn vị là $pu{9.81 m//s2}$.`,
        solution: String.raw`Công thức $ce{Na+ + Cl-}$.`,
        isGeometry: false,
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
      },
      correctAnswer: true,
    });

    expect(normalized.hint).toBe(String.raw`Xét $\ce{NaCl}$.`);
    expect(normalized.explanation.problem).toBe(String.raw`Đơn vị là $\pu{9.81 m//s2}$.`);
    expect(normalized.explanation.solution).toBe(String.raw`Công thức $\ce{Na+ + Cl-}$.`);
  });
});
