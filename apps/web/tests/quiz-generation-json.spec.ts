import { expect, test } from "@playwright/test";

import type { AdminQuizQuestion } from "@/features/admin/quiz/api/admin-quiz-api";
import { isQuizExplanationBlockData } from "@/components/common/content/quiz-explanation-content";
import {
  buildQuizQuestionPreviewFromGenerationJson,
  isProtectedQuizGenerationJsonEdit,
} from "@/features/admin/quiz/utils/quiz-generation-json";
import { resolveQuizExplanationEditorContent } from "@/features/admin/quiz/utils/quiz-explanation-editor";
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
    expect(normalizeLatexCommandBackslashes("muối muốn mu\u0301")).toBe(
      "muối muốn mu\u0301",
    );
    expect(normalizeLatexCommandBackslashes("mu + phi")).toBe(String.raw`\mu + \phi`);
  });

  test("repairs decoded provider control characters before rendering Quiz math", () => {
    const brokenCommandPrefix = String.fromCharCode(28);

    expect(
      normalizeLatexCommandBackslashes(
        `${brokenCommandPrefix}widehat{A}+${brokenCommandPrefix}root{61}+${brokenCommandPrefix}frac{1}{2}`,
      ),
    ).toBe(String.raw`\widehat{A}+\sqrt{61}+\frac{1}{2}`);
    expect(
      normalizeLatexCommandBackslashes(
        String.raw`\u001cwidehat{A}+u001cwidehat{C}+\\u001croot{61}+u001calpha`,
      ),
    ).toBe(String.raw`\widehat{A}+\widehat{C}+\sqrt{61}+\alpha`);
    expect(
      normalizeMathTextLatexCommands(
        `Giữ nguyên văn bản; công thức $${brokenCommandPrefix}widehat{A}=76^\\circ$.`,
      ),
    ).toBe(String.raw`Giữ nguyên văn bản; công thức $\widehat{A}=76^\circ$.`);
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
        solutionFigure: false,
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
    expect(preview.sourceMetadataJson?.quizExplanationBlock).not.toHaveProperty("answer");
    expect(preview.generationQuestionJson).toEqual({
      ...generationQuestionJson,
      explanation: {
        problem: "Câu hỏi mới",
        solution: "Lời giải mới",
        isGeometry: false,
      },
    });
  });

  test("uses TEXT_INPUT correctAnswer as the only answer authority in the preview", () => {
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
    expect(preview.sourceMetadataJson?.quizExplanationBlock).not.toHaveProperty("answer");
    expect(JSON.stringify(preview.explanation?.contentJson)).not.toContain("Đáp án:");
    expect(JSON.stringify(preview.explanation?.contentJson)).toContain(
      "Thể tích tính được là",
    );
  });

  test("projects multi-statement labels as Tiptap bold marks without literal stars", () => {
    const preview = buildQuizQuestionPreviewFromGenerationJson(currentQuestion, {
      questionType: "MULTI_STATEMENT_TRUE_FALSE",
      difficulty: "MEDIUM",
      hint: "Xét riêng từng mệnh đề.",
      statements: [
        { id: "a", text: "Số 2 là số chẵn.", value: true },
        { id: "b", text: "Số 3 là số chẵn.", value: false },
      ],
      explanation: {
        problem: "Xét hai mệnh đề.",
        statementSolutions: [
          { statementId: "a", solution: "Số 2 chia hết cho 2." },
          { statementId: "b", solution: "Số 3 không chia hết cho 2." },
        ],
      },
    });

    const serializedExplanation = JSON.stringify(preview.explanation?.contentJson);
    expect(serializedExplanation).not.toContain("**a)**");
    expect(serializedExplanation).not.toContain("**b)**");
    expect(serializedExplanation).not.toContain("Đáp án:");
    expect(serializedExplanation).toContain(
      JSON.stringify({ type: "text", text: "b)", marks: [{ type: "bold" }] }),
    );
  });

  test("normalizes three-point angle notation across Quiz fields before Tiptap edit", () => {
    const preview = buildQuizQuestionPreviewFromGenerationJson(currentQuestion, {
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      hint: String.raw`Dùng $m\angle DAB$.`,
      options: [
        { id: "A", text: String.raw`$\angle DAB=70^\circ$` },
        { id: "B", text: String.raw`$m\widehat{DAB}=110^\circ$` },
      ],
      correctOptionId: "A",
      explanation: {
        problem: String.raw`Cho $m\angle DAB=70^\circ$.`,
        solution: String.raw`Vậy $\angle DAB=70^\circ$.`,
      },
    });

    expect(JSON.stringify(preview.questionJson)).toContain("widehat{DAB}");
    expect(JSON.stringify(preview.optionsJson)).toContain("widehat{DAB}");
    expect(JSON.stringify(preview.hintJson)).toContain("widehat{DAB}");
    expect(JSON.stringify(preview.explanation?.contentJson)).toContain("widehat{DAB}");
    expect(JSON.stringify(preview)).not.toContain('"latex":"\\\\angle DAB');
    expect(JSON.stringify(preview)).not.toContain("m\\\\widehat");
  });

  test("loads only the structured solution into Edit for previously stored Quiz data", () => {
    const editorContent = resolveQuizExplanationEditorContent({
      ...currentQuestion,
      explanation: {
        id: "explanation-1",
        contentJson: createTextTiptapDocument(
          "**b)** Lập luận của mệnh đề b.\nĐáp án: a) Đúng; b) Sai.",
        ),
        reviewStatus: "NEEDS_REVIEW",
        staleAt: null,
      },
      sourceMetadataJson: {
        aiGenerationId: "generation-1",
        generationQuestionIndex: 0,
        quizExplanationBlock: {
          type: "quizExplanation",
          problem: "Xét hai mệnh đề.",
          solution: "**b)** Lập luận của mệnh đề b.",
        },
      },
    });

    const serializedEditorContent = JSON.stringify(editorContent);
    expect(serializedEditorContent).not.toContain("Đáp án:");
    expect(serializedEditorContent).not.toContain("**b)**");
    expect(serializedEditorContent).toContain(
      JSON.stringify({ type: "text", text: "b)", marks: [{ type: "bold" }] }),
    );
  });

  test("normalizes three-point angles from stored Quiz explanation metadata", () => {
    const editorContent = resolveQuizExplanationEditorContent({
      ...currentQuestion,
      sourceMetadataJson: {
        quizExplanationBlock: {
          type: "quizExplanation",
          problem: String.raw`Cho $\angle DAB=70^\circ$.`,
          solution: String.raw`Suy ra $\angle DAB+\angle BCD=180^\circ$.`,
        },
      },
    });

    expect(JSON.stringify(editorContent)).toContain("widehat{DAB}");
    expect(JSON.stringify(editorContent)).toContain("widehat{BCD}");
    expect(JSON.stringify(editorContent)).not.toContain('"latex":"\\\\angle ');
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

  test("sửa delimiter đóng bị escape nhầm trước khi dựng preview lời giải", () => {
    const preview = buildQuizQuestionPreviewFromGenerationJson(currentQuestion, {
      questionType: "MULTIPLE_CHOICE",
      difficulty: "MEDIUM",
      options: [
        { id: "A", text: String.raw`$112^\circ$.` },
        { id: "B", text: String.raw`$68^\circ$.` },
      ],
      correctOptionId: "A",
      explanation: {
        problem: "Tính số đo góc.",
        solution: String.raw`Ta có:

$$\widehat{A}+\widehat{C}=180^\circ.\$$

Suy ra $\widehat{C}=112^\circ\$.`,
        answer: "A",
        isGeometry: true,
      },
    });

    const explanationNodes = preview.explanation?.contentJson.content ?? [];
    expect(explanationNodes.map((node) => node.type)).toEqual([
      "paragraph",
      "blockMath",
      "paragraph",
    ]);
    expect(explanationNodes[1]?.attrs?.latex).toBe(
      String.raw`\widehat{A}+\widehat{C}=180^\circ.`,
    );
    expect(JSON.stringify(explanationNodes)).not.toContain("\\$$");
  });

  test("auto-repair delimiter đóng bị thiếu trong JSON preview và dữ liệu lưu", () => {
    const malformedProblem = String.raw`Khung rộng $12\,\text{m}$ và cao $8\,\text{m}. Hai đỉnh trên nằm trên nửa đường tròn. Lấy $\pi\approx3,14$.`;
    const repairedProblem = String.raw`Khung rộng $12\,\text{m}$ và cao $8\,\text{m}$. Hai đỉnh trên nằm trên nửa đường tròn. Lấy $\pi\approx3,14$.`;
    const preview = buildQuizQuestionPreviewFromGenerationJson(currentQuestion, {
      questionType: "TEXT_INPUT",
      difficulty: "HARD",
      hint: String.raw`Dùng $d=\sqrt{12^2+8^2}. Sau đó tính bán kính.`,
      correctAnswer: "31.4",
      explanation: {
        problem: malformedProblem,
        solution: String.raw`Ta có $d=4\sqrt{13}$. Suy ra đáp án.`,
        isGeometry: true,
      },
    });

    expect(preview.generationQuestionJson).toMatchObject({
      explanation: { problem: repairedProblem },
    });
    expect(preview.sourceMetadataJson?.quizExplanationBlock).toMatchObject({
      problem: repairedProblem,
    });
    expect(JSON.stringify(preview.questionJson)).toContain(
      String.raw`"latex":"8\\,\\text{m}"`,
    );
    expect(JSON.stringify(preview.questionJson)).toContain(
      "Hai đỉnh trên nằm trên nửa đường tròn.",
    );
    expect(JSON.stringify(preview.questionJson)).not.toContain(
      String.raw`"latex":"8\\,\\text{m}. Hai đỉnh`,
    );
  });
});
