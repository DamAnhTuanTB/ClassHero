import { QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  multiStatementQuizSolutionRegenerationOutputSchema,
  multiStatementQuizSolutionRefinementOutputSchema,
  multipleChoiceQuizSolutionRegenerationOutputSchema,
  QUIZ_SOLUTION_REFINEMENT_SCHEMA_VERSION,
  QUIZ_SOLUTION_REGENERATION_SCHEMA_VERSION,
  quizSolutionRefinementJobInputSchema,
  singleQuizSolutionRefinementOutputSchema,
  textInputQuizSolutionRegenerationOutputSchema,
  trueFalseQuizSolutionRegenerationOutputSchema,
} from "#api/modules/quiz/types/quiz-solution-refinement.types";
import {
  buildQuizSolutionRefinementInput,
  buildQuizSolutionRegenerationInput,
} from "#api/modules/quiz/utils/quiz-solution-refinement-prompt";
import {
  resolveQuizSolutionRefinementSystemPrompt,
  resolveQuizSolutionRegenerationSystemPrompt,
} from "#api/modules/quiz/utils/prompts/solution-refinement/quiz-solution-refinement-system-prompt-resolver";

describe("M9.24 Quiz solution AI actions", () => {
  it.each(["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const)(
    "keeps %s refinement answer-locked and regeneration blind",
    (subjectKey) => {
      const refinement = resolveQuizSolutionRefinementSystemPrompt(subjectKey);
      const regeneration = resolveQuizSolutionRegenerationSystemPrompt(subjectKey);
      expect(refinement).toContain("correctAnswer là authority bị khóa");
      expect(refinement).toContain("không sửa đề, đáp án hoặc hint");
      expect(regeneration).toContain("không được xem đáp án, hint hoặc lời giải cũ");
      expect(regeneration).toContain("ảnh hình đề đính kèm");
      expect(regeneration).toContain("không sao chép mù nhãn sai");
      expect(refinement).toContain("cặp delimiter đầy đủ");
      expect(refinement).toContain("đoạn riêng");
      expect(regeneration).toContain("cặp delimiter đầy đủ");
      expect(regeneration).toContain("đoạn riêng");
      expect(regeneration).toContain("Chỉ trả structured output theo schema");
    },
  );

  it("keeps the reusable Math citation rule compact and traceable", () => {
    const prompt = resolveQuizSolutionRefinementSystemPrompt("MATH");
    expect(prompt).toContain("Từ (1) và (2), suy ra");
    expect(prompt).toContain("Mỗi kết luận có nhãn nằm ở đoạn riêng");
    expect(prompt).toContain("Bỏ nhãn không được viện dẫn");
    expect(prompt).toContain("không nhảy cóc");
    expect(prompt).toContain("`\\widehat{ABC}`");
    expect(prompt).toContain("không viết `m\\angle ABC`");
  });

  it("sends current answer and solution only to REFINE", () => {
    const request = buildQuizSolutionRefinementInput(commonInput());
    expect(request.userPrompt).toContain("CURRENT_ANSWER");
    expect(request.userPrompt).toContain("CURRENT_SOLUTION");
    expect(request.userPrompt).not.toContain("CURRENT_HINT");
    expect(request.inputImages).toBeUndefined();
    expect(request.promptVersion).toContain("refinement-math-v6-math-syntax-contract");
  });

  it("sends problem, options and question image but hides old answer content from REGENERATE", () => {
    const request = buildQuizSolutionRegenerationInput({
      ...commonInput(),
      questionImageDataUrl: "data:image/png;base64,AAAA",
    });
    expect(request.userPrompt).toContain("QUESTION_PROBLEM");
    expect(request.userPrompt).toContain("OPTION_TEXT");
    expect(request.userPrompt).not.toContain("CURRENT_ANSWER");
    expect(request.userPrompt).not.toContain("CURRENT_HINT");
    expect(request.userPrompt).not.toContain("CURRENT_SOLUTION");
    expect(request.inputImages).toEqual([
      { imageUrl: "data:image/png;base64,AAAA", detail: "high" },
    ]);
    expect(request.promptVersion).toContain("regeneration-math-v3-math-syntax-contract");
  });

  it.each(["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const)(
    "sends only the old %s solution as an explicitly rejected candidate when enabled",
    (subjectKey) => {
      const request = buildQuizSolutionRegenerationInput({
        ...commonInput(),
        subject: { key: subjectKey, name: subjectKey, slug: subjectKey.toLowerCase() },
        includeCurrentSolutionAsRejected: true,
      });
      expect(request.userPrompt).toContain(
        '"rejectedCurrentSolution": "CURRENT_SOLUTION"',
      );
      expect(request.userPrompt).not.toContain("CURRENT_ANSWER");
      expect(request.userPrompt).not.toContain("CURRENT_HINT");
      expect(request.systemPrompt).toContain("đã bị admin xác nhận sai");
      expect(request.systemPrompt).toContain("không dùng làm căn cứ");
      expect(request.promptVersion).toContain("rejected-candidate");
      expect(request.promptCache?.namespace).toContain("rejected");
    },
  );

  it("uses strict mode-specific refinement output schemas", () => {
    expect(QUIZ_SOLUTION_REFINEMENT_SCHEMA_VERSION).toBe(
      "quiz-solution-refinement-v4-math-syntax-contract",
    );
    expect(QUIZ_SOLUTION_REGENERATION_SCHEMA_VERSION).toBe(
      "quiz-solution-regeneration-v2-math-syntax-contract",
    );
    expect(
      JSON.stringify(singleQuizSolutionRefinementOutputSchema.toJSONSchema()),
    ).toContain("cặp delimiter đầy đủ");
    expect(singleQuizSolutionRefinementOutputSchema.parse({ solution: "Giải." })).toEqual(
      {
        solution: "Giải.",
      },
    );
    expect(
      multiStatementQuizSolutionRefinementOutputSchema
        .parse({
          statementSolutions: [
            { statementId: "a", solution: "Giải a." },
            { statementId: "b", solution: "Giải b." },
          ],
        })
        .statementSolutions.map((item) => item.statementId),
    ).toEqual(["a", "b"]);
    expect(
      singleQuizSolutionRefinementOutputSchema.safeParse({
        solution: "Giải.",
        correctAnswer: "A",
      }).success,
    ).toBe(false);
  });

  it("uses answer + hint + solution schemas tailored to all four question types", () => {
    expect(
      multipleChoiceQuizSolutionRegenerationOutputSchema.parse({
        correctOptionId: "B",
        hint: "Xét quan hệ chính.",
        solution: "Giải mới.",
      }).correctOptionId,
    ).toBe("B");
    expect(
      trueFalseQuizSolutionRegenerationOutputSchema.parse({
        correctAnswer: false,
        hint: "Kiểm tra điều kiện.",
        solution: "Mệnh đề sai.",
      }).correctAnswer,
    ).toBe(false);
    expect(
      textInputQuizSolutionRegenerationOutputSchema.parse({
        correctAnswer: "5",
        hint: "Lập tam giác vuông.",
        solution: "Suy ra $R=5$.",
      }).correctAnswer,
    ).toBe("5");
    expect(
      multiStatementQuizSolutionRegenerationOutputSchema.parse({
        statementAnswers: [
          { statementId: "a", value: true },
          { statementId: "b", value: false },
        ],
        hint: "Xét từng câu.",
        statementSolutions: [
          { statementId: "a", solution: "Giải a." },
          { statementId: "b", solution: "Giải b." },
        ],
      }).statementAnswers,
    ).toHaveLength(2);
  });

  it("snapshots mode, content hash and optional question figure in the durable job", () => {
    const parsed = quizSolutionRefinementJobInputSchema.parse({
      operation: "QUIZ_SOLUTION_REFINEMENT",
      assessmentKind: "QUIZ",
      pipelineVersion: "ASSESSMENT_QUIZ_V1",
      targetQuestionId: "11111111-1111-4111-8111-111111111111",
      mode: "REGENERATE",
      includeCurrentSolutionAsRejected: false,
      questionId: "11111111-1111-4111-8111-111111111111",
      baseContentHash: "a".repeat(64),
      requestHash: "b".repeat(64),
      subjectKey: "MATH",
      subjectName: "Toán",
      subjectSlug: "toan",
      targetGrade: 8,
      adminInstructions: null,
      questionFigure: {
        revisionId: "22222222-2222-4222-8222-222222222222",
        objectKey: "quiz/question.svg",
        checksum: "checksum",
      },
      questionSnapshot: commonInput().question,
    });
    expect(parsed.mode).toBe("REGENERATE");
    expect(parsed.pipelineVersion).toBe("ASSESSMENT_QUIZ_V1");
    expect(parsed.questionFigure?.objectKey).toBe("quiz/question.svg");
  });
});

function commonInput() {
  return {
    subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
    targetGrade: 8,
    adminInstructions: null,
    question: {
      questionType: QuestionType.MULTIPLE_CHOICE,
      problem: "QUESTION_PROBLEM",
      options: [
        { id: "A", text: "OPTION_TEXT" },
        { id: "B", text: "Phương án B" },
      ],
      correctAnswer: ["CURRENT_ANSWER"],
      currentHint: "CURRENT_HINT",
      currentSolution: "CURRENT_SOLUTION",
    },
  };
}
