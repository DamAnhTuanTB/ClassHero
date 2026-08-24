import { expect, test } from "@playwright/test";

import type { AdminQuizQuestion } from "@/features/admin/quiz/api/admin-quiz-api";
import { isQuizExplanationBlockData } from "@/components/common/content/quiz-explanation-content";
import {
  buildQuizQuestionPreviewFromGenerationJson,
  isProtectedQuizGenerationJsonEdit,
} from "@/features/admin/quiz/utils/quiz-generation-json";
import { createTextTiptapDocument } from "@/lib/tiptap-rich-content";
import {
  normalizeLatexCommandBackslashes,
  normalizeMathTextLatexCommands,
} from "@learning-path/shared";

const currentQuestion: AdminQuizQuestion = {
  id: "question-1",
  quizSetId: "set-1",
  questionType: "MULTIPLE_CHOICE",
  difficulty: "EASY",
  questionJson: createTextTiptapDocument("Câu cũ"),
  optionsJson: [
    { id: "A", richText: createTextTiptapDocument("A cũ") },
    { id: "B", richText: createTextTiptapDocument("B cũ") },
  ],
  correctAnswerJson: ["A"],
  hintJson: null,
  gradingConfigJson: null,
  explanation: null,
  sourceMetadataJson: {
    aiGenerationId: "generation-1",
    generationQuestionIndex: 0,
  },
  generationQuestionJson: null,
  reviewStatus: "NEEDS_REVIEW",
  solutionFigureMode: "NONE",
  figures: [],
};

test.describe("Quiz mutable generation JSON preview", () => {
  test("repairs missing LaTeX command backslashes without changing prose", () => {
    expect(normalizeLatexCommandBackslashes("widehat{X}+\\widehat{Y}=180^circ")).toBe(
      "\\widehat{X}+\\widehat{Y}=180^\\circ",
    );
    expect(
      normalizeMathTextLatexCommands(
        String.raw`Dòng chữ widehat{X}; công thức $ widehat{X}=m^circ$; biểu thức $xwidehat{Y}$.`,
      ),
    ).toBe(
      String.raw`Dòng chữ widehat{X}; công thức $ \widehat{X}=m^\circ$; biểu thức $xwidehat{Y}$.`,
    );
    expect(normalizeLatexCommandBackslashes(String.raw`\text{widehat{X} in prose}`)).toBe(
      String.raw`\text{widehat{X} in prose}`,
    );
  });

  test("projects edited working JSON into the local Quiz preview", () => {
    const generationQuestionJson = {
      questionType: "MULTIPLE_CHOICE",
      difficulty: "HARD",
      hint: "Gợi ý mới",
      options: [
        { id: "A", text: "Phương án A mới" },
        { id: "B", text: "Phương án B mới" },
      ],
      correctOptionId: "B",
      explanation: {
        problem: "Câu hỏi mới",
        solution: "Lời giải mới",
        answer: "B. Phương án B mới",
        isGeometry: false,
        geometryStatement: {
          hypotheses: ["Dữ liệu cũ"],
          conclusions: ["Kết luận cũ"],
        },
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE",
        solutionFigurePlan: null,
      },
    };

    const preview = buildQuizQuestionPreviewFromGenerationJson(
      currentQuestion,
      generationQuestionJson,
    );

    expect(preview.difficulty).toBe("HARD");
    expect(preview.correctAnswerJson).toEqual(["B"]);
    expect(preview.optionsJson?.map((option) => option.id)).toEqual(["A", "B"]);
    expect(preview.sourceMetadataJson?.aiGenerationId).toBe("generation-1");
    expect(preview.sourceMetadataJson?.quizExplanationBlock).not.toHaveProperty(
      "geometryStatement",
    );
    expect(preview.generationQuestionJson).toEqual({
      ...generationQuestionJson,
      explanation: {
        problem: "Câu hỏi mới",
        solution: "Lời giải mới",
        answer: "B. Phương án B mới",
        isGeometry: false,
      },
    });
  });

  test("uses TEXT_INPUT correctAnswer instead of explanation answer in the preview", () => {
    const preview = buildQuizQuestionPreviewFromGenerationJson(currentQuestion, {
      questionType: "TEXT_INPUT",
      difficulty: "EASY",
      correctAnswer: "2.1",
      explanation: {
        problem: "Tính thể tích và làm tròn đến một chữ số thập phân.",
        solution: "Thể tích tính được là $2.1$.",
        answer: "Thể tích xấp xỉ bằng $2.1$.",
        isGeometry: false,
      },
    });

    expect(preview.correctAnswerJson).toEqual(["2.1"]);
    expect(preview.sourceMetadataJson?.quizExplanationBlock).toMatchObject({
      answer: "2.1",
    });
  });

  test("protects the figure subtree from direct JSON editing", () => {
    expect(isProtectedQuizGenerationJsonEdit({ name: "figure", namespace: [] })).toBe(
      true,
    );
    expect(
      isProtectedQuizGenerationJsonEdit({
        name: "caption",
        namespace: ["figure", "questionFigure"],
      }),
    ).toBe(true);
    expect(
      isProtectedQuizGenerationJsonEdit({
        name: "solution",
        namespace: ["explanation"],
      }),
    ).toBe(false);
  });

  test("tách display math khỏi paragraph trong preview lời giải", () => {
    const preview = buildQuizQuestionPreviewFromGenerationJson(currentQuestion, {
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      options: [
        { id: "A", text: "$1$" },
        { id: "B", text: "$\\frac{1}{3}$" },
      ],
      correctOptionId: "A",
      explanation: {
        problem: "Tính diện tích hình phẳng.",
        solution: String.raw`Vì $3x^2 \\ge 0$ trên đoạn $[0;1]$, diện tích cần tìm là:

$$\\begin{aligned}S&=\\int_0^1 3x^2\\,dx\\\\&=[x^3]_0^1\\\\&=1.\\end{aligned}$$

Vậy chọn phương án A.`,
        answer: "A. $1$",
        isGeometry: false,
      },
    });

    const explanationNodes = preview.explanation?.contentJson.content ?? [];
    expect(explanationNodes.map((node) => node.type)).toEqual([
      "paragraph",
      "blockMath",
      "paragraph",
      "paragraph",
    ]);
    expect(explanationNodes[1]?.attrs?.latex).toContain("\\begin{aligned}");
    expect(
      isQuizExplanationBlockData(preview.sourceMetadataJson?.quizExplanationBlock),
    ).toBe(true);
    expect(
      explanationNodes
        .filter((node) => node.type === "paragraph")
        .some((node) => node.content?.some((child) => child.type === "blockMath")),
    ).toBe(false);
  });
});
