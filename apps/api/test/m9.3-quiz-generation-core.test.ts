import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAiStructuredTextFormat,
  estimateAiStructuredInputTokens,
  resolveAiStructuredTextFormat,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import {
  QUIZ_CONCLUSION_PARAGRAPH_POLICY,
  QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY,
  getGeneratedQuizOutputSchema,
  QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY,
  QUIZ_FIGURE_SELECTION_POLICY,
  QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
  QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY,
  QUIZ_HINT_QUALITY_POLICY,
  QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY,
  QUIZ_PROMPT_VERSION,
  QUIZ_SCHEMA_VERSION,
  QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY,
  QUIZ_SUBPART_LINEBREAK_POLICY,
  resolveQuizOutputTokenFloor,
  quizExplanationBlockSchema,
  quizFigureDecisionSchema,
} from "#api/modules/quiz/types/quiz-generation.types";
import { mapGeneratedQuizQuestion } from "#api/modules/quiz/utils/quiz-generation-mapper";
import {
  normalizeGeneratedQuizQuestionContent,
  normalizeQuizConclusionParagraph,
  normalizeQuizExplanationBlock,
} from "#api/modules/quiz/utils/quiz-generation-content-normalizer";
import {
  normalizeGeneratedQuizQuestionLatex,
  normalizeQuizDisplayMathEnvironments,
  normalizeQuizInlineMathDelimiters,
} from "#api/modules/quiz/utils/quiz-generation-math-normalizer";
import {
  readQuizGenerationQuestionReference,
  readRawProviderQuizQuestion,
} from "#api/modules/quiz/utils/quiz-generation-output";
import {
  buildQuizStructuredInput,
  QUIZ_REAL_WORLD_APPLICATION_COVERAGE_POLICY,
  QUIZ_SOURCE_NOVELTY_POLICY,
  QUIZ_SYSTEM_PROMPT,
} from "#api/modules/quiz/utils/quiz-generation-prompt";
import { validateQuizOutput } from "#api/modules/quiz/utils/quiz-generation-validation";
import {
  buildQuestionFigureInput,
  buildSolutionFigureExtensionInput,
  generatedQuizQuestionFigureSchema,
  generatedQuizSolutionExtensionSchema,
  QUIZ_FIGURE_EXTENSION_MARKER,
  QUIZ_FIGURE_PROMPT_VERSION,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import {
  applyQuizSolutionExtension,
  assertQuizFigureLatexSource,
  sanitizeQuizFigureSvg,
} from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

const documentId = "00000000-0000-4000-8000-000000000001";
const sourceHash = "a".repeat(64);

function collectJsonSchemaDescriptions(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.description === "string" ? [record.description] : []),
    ...Object.entries(record)
      .filter(([key]) => key !== "description")
      .flatMap(([, child]) => collectJsonSchemaDescriptions(child)),
  ];
}

function requestConfiguration() {
  return {
    requestDraftId: "00000000-0000-4000-8000-000000000099",
    requestHash: "b".repeat(64),
    packetHash: "c".repeat(64),
    manifestHash: "d".repeat(64),
    targetQuizSetId: null,
    documentIds: [documentId],
    sourceHash,
    targetGrade: 7,
    subjectKey: "MATH" as const,
    subjectName: "Toán",
    subjectSlug: "toan",
    questionCount: 1,
    difficulty: Difficulty.EASY,
    difficultyCounts: null,
    questionTypes: [QuestionType.TRUE_FALSE],
    style: "student_friendly" as const,
    styleInstructions: "",
    extraInstructions: "",
    systemInstructions: "",
    userPrompt: "",
    schemaReferenceStrategy: "ref_v2" as const,
    promptCacheKeyEnabled: true,
    promptCacheRetention: "in_memory" as const,
    maxOutputTokens: 12_000,
  };
}

describe("M9.3 Quiz-owned generation core", () => {
  it("resolves the original provider question from generation lineage", () => {
    const rawQuestion = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Xét định nghĩa số hữu tỉ.",
      explanation: {
        problem: "Số $1/2$ là số hữu tỉ.",
        solution: "$1/2$ có dạng $a/b$ với $b \\ne 0$.",
        answer: "Đúng",
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE",
        solutionFigurePlan: null,
      },
      correctAnswer: true,
    };
    const reference = readQuizGenerationQuestionReference({
      aiGenerationId: "generation-1",
      generationQuestionIndex: 1,
    });

    expect(reference).toEqual({
      aiGenerationId: "generation-1",
      generationQuestionIndex: 1,
    });
    expect(
      readRawProviderQuizQuestion(
        { questions: [{ questionType: "IGNORED" }, rawQuestion] },
        reference!.generationQuestionIndex,
      ),
    ).toEqual(rawQuestion);
    expect(readRawProviderQuizQuestion({ questions: [rawQuestion] }, 2)).toBeNull();
  });

  it("owns its structured output and does not expose the Summary example shape", () => {
    const output = {
      questions: [
        {
          questionType: QuestionType.TRUE_FALSE,
          difficulty: Difficulty.EASY,
          hint: "Xét định nghĩa số hữu tỉ.",
          explanation: {
            problem: "Số $1/2$ là số hữu tỉ.",
            solution: "$1/2$ có dạng $a/b$ với $b \\ne 0$.",
            answer: "Đúng",
            isGeometry: false,
          },
          figure: {
            questionFigure: null,
            solutionFigureMode: "NONE",
            solutionFigurePlan: null,
          },
          correctAnswer: true,
        },
      ],
    };
    const schema = getGeneratedQuizOutputSchema({ subjectKey: "MATH" });
    expect(schema.safeParse(output).success).toBe(true);
    expect(
      schema.safeParse({ ...output, title: "Field không được sử dụng" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...output,
        questions: output.questions.map(({ explanation, ...question }) => ({
          ...question,
          example: explanation,
        })),
      }).success,
    ).toBe(false);
  });

  it("builds the ref v2 schema for every Quiz type subset", () => {
    const questionTypes = Object.values(QuestionType);
    const subsets = Array.from({ length: 2 ** questionTypes.length - 1 }, (_, index) =>
      questionTypes.filter((_, typeIndex) => (index + 1) & (1 << typeIndex)),
    );

    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      for (const selectedTypes of subsets) {
        const schema = getGeneratedQuizOutputSchema({
          subjectKey,
          targetGrade: subjectKey === "MATH" ? 8 : null,
          questionCount: 3,
          questionTypes: selectedTypes,
          difficulty: Difficulty.MEDIUM,
        });
        const reference = resolveAiStructuredTextFormat(
          schema,
          "generated_quiz",
          "ref_v2",
        );

        expect(reference.resolvedReferenceStrategy).toBe("ref_v2");
        expect(reference.schemaBytes).toBeGreaterThan(0);
      }
    }
  });

  it("scales the Quiz output budget without lowering the existing baseline", () => {
    expect(
      resolveQuizOutputTokenFloor({
        questionCount: 1,
        questionTypes: [QuestionType.TRUE_FALSE],
      }),
    ).toBe(12_000);
    expect(
      resolveQuizOutputTokenFloor({
        questionCount: 50,
        questionTypes: [QuestionType.MULTI_STATEMENT_TRUE_FALSE],
      }),
    ).toBe(32_000);
  });

  it("maps generated output to the Quiz explanation contract", () => {
    const mapped = mapGeneratedQuizQuestion({
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Xét định nghĩa.",
      explanation: {
        problem: "Số 2 là số chẵn.",
        solution: "2 chia hết cho 2.",
        answer: "Đúng",
        isGeometry: false,
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE",
        solutionFigurePlan: null,
      },
      correctAnswer: true,
    });
    expect(mapped.explanationBlock.type).toBe("quizExplanation");
    expect(quizExplanationBlockSchema.safeParse(mapped.explanationBlock).success).toBe(
      true,
    );
    expect(mapped).not.toHaveProperty("exampleBlock");
  });

  it("maps each multi-statement solution into a separate labeled paragraph", () => {
    const mapped = mapGeneratedQuizQuestion({
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      difficulty: Difficulty.MEDIUM,
      hint: "Xét riêng từng mệnh đề.",
      explanation: {
        problem: "Cho hai mệnh đề liên quan đến số chẵn.",
        statementSolutions: [
          {
            statementId: "a",
            solution: "Ta có: $2=2\\cdot1$.\n\nVậy câu a) đúng.",
          },
          {
            statementId: "b",
            solution: "Ta có: $3=2\\cdot1+1$.\n\nVậy câu b) sai.",
          },
        ],
        isGeometry: false,
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE",
        solutionFigurePlan: null,
      },
      statements: [
        { id: "a", text: "Số 2 là số chẵn.", value: true },
        { id: "b", text: "Số 3 là số chẵn.", value: false },
      ],
    });

    expect(mapped.explanationBlock.solution).toBe(
      [
        "**a)** Ta có: $2=2\\cdot1$.\n\nVậy câu a) đúng.",
        "**b)** Ta có: $3=2\\cdot1+1$.\n\nVậy câu b) sai.",
      ].join("\n\n"),
    );
    expect(mapped.explanationBlock.answer).toBe("a) Đúng.\nb) Sai.");
  });

  it("deterministically separates the final Quiz conclusion paragraph", () => {
    const inlineConclusion = "Giá trị này không bằng 11. Vậy câu b) sai.";
    const normalized = normalizeQuizConclusionParagraph(inlineConclusion);

    expect(normalized).toBe("Giá trị này không bằng 11.\n\nVậy câu b) sai.");
    expect(normalizeQuizConclusionParagraph(normalized)).toBe(normalized);
    expect(normalizeQuizConclusionParagraph("Vậy câu b) sai.")).toBe("Vậy câu b) sai.");
    expect(
      normalizeQuizConclusionParagraph(
        "Nếu kết quả như vậy thì cần kiểm tra lại dữ kiện.",
      ),
    ).toBe("Nếu kết quả như vậy thì cần kiểm tra lại dữ kiện.");
    expect(
      normalizeQuizConclusionParagraph(
        "Ta đặt câu hỏi “Vậy kết quả có đúng không?” rồi tiếp tục kiểm tra.",
      ),
    ).toBe("Ta đặt câu hỏi “Vậy kết quả có đúng không?” rồi tiếp tục kiểm tra.");
  });

  it("normalizes provider and persisted Quiz solution blocks with the same rule", () => {
    const question = {
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      difficulty: Difficulty.MEDIUM,
      hint: "Xét riêng từng câu.",
      explanation: {
        problem: "Cho hai câu cần đánh giá.",
        statementSolutions: [
          {
            statementId: "a" as const,
            solution: "Lập luận thứ nhất. Vậy câu a) đúng.",
          },
          {
            statementId: "b" as const,
            solution: "Lập luận thứ hai. Vậy câu b) sai.",
          },
        ],
        isGeometry: false,
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      statements: [
        { id: "a" as const, text: "Câu thứ nhất.", value: true },
        { id: "b" as const, text: "Câu thứ hai.", value: false },
      ],
    };
    const normalizedQuestion = normalizeGeneratedQuizQuestionContent(question);
    const statementSolutions =
      "statementSolutions" in normalizedQuestion.explanation
        ? normalizedQuestion.explanation.statementSolutions
        : [];

    expect(statementSolutions.map((item) => item.solution)).toEqual([
      "Lập luận thứ nhất.\n\nVậy câu a) đúng.",
      "Lập luận thứ hai.\n\nVậy câu b) sai.",
    ]);
    expect(
      normalizeQuizExplanationBlock({
        type: "quizExplanation",
        problem: "Bài toán tổng quát.",
        solution: "Lập luận. Vậy kết quả cần tìm bằng 4.",
        answer: "4",
      }).solution,
    ).toBe("Lập luận.\n\nVậy kết quả cần tìm bằng 4.");
  });

  it("builds the multiple-choice answer from the correct option ID and content", () => {
    const mapped = mapGeneratedQuizQuestion({
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.EASY,
      hint: "Đọc các hệ số của tham số.",
      explanation: {
        problem: "Chọn một vectơ chỉ phương của đường thẳng.",
        solution: "Các hệ số của tham số lần lượt là $4,-1,2$, nên chọn B.",
        answer: "$\\vec{u}=(4;-1;2)$",
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE",
        solutionFigurePlan: null,
      },
      options: [
        { id: "A", text: "$\\vec{u}=(-2;1;3)$" },
        { id: "B", text: "$\\vec{u}=(4;-1;2)$" },
      ],
      correctOptionId: "B",
    });

    expect(mapped.explanationBlock.answer).toBe("B. $\\vec{u}=(4;-1;2)$");
  });

  it("requires a solution figure plan only for EXTEND_QUESTION", () => {
    const questionFigure = { caption: "Tam giác ABC và tâm O" };
    expect(
      quizFigureDecisionSchema.safeParse({
        questionFigure,
        solutionFigureMode: "EXTEND_QUESTION",
        solutionFigurePlan: null,
      }).success,
    ).toBe(false);
    expect(
      quizFigureDecisionSchema.safeParse({
        questionFigure,
        solutionFigureMode: "EXTEND_QUESTION",
        solutionFigurePlan: {
          addedObjects: ["Các bán kính OA, OB, OC"],
          clarifiedRelations: ["OM vuông góc AB"],
        },
      }).success,
    ).toBe(true);
    expect(
      quizFigureDecisionSchema.safeParse({
        questionFigure,
        solutionFigureMode: "REUSE_QUESTION",
        solutionFigurePlan: {
          addedObjects: ["Đường phụ"],
          clarifiedRelations: ["Quan hệ phụ"],
        },
      }).success,
    ).toBe(false);
  });

  it("builds a prompt with Quiz-owned versions and vocabulary", () => {
    const request = buildQuizStructuredInput({
      lessonId: "lesson-quiz-core",
      lessonTitle: "Số hữu tỉ",
      documentIds: [documentId],
      sourceHash,
      packet: {
        filename: "quiz-source.pdf",
        bytes: Buffer.from("pdf-fixture"),
      },
      configuration: {
        requestDraftId: "00000000-0000-4000-8000-000000000099",
        requestHash: "b".repeat(64),
        packetHash: "c".repeat(64),
        manifestHash: "d".repeat(64),
        targetQuizSetId: null,
        documentIds: [documentId],
        sourceHash,
        targetGrade: 7,
        subjectKey: "MATH",
        subjectName: "Toán",
        subjectSlug: "toan",
        questionCount: 1,
        difficulty: Difficulty.EASY,
        difficultyCounts: null,
        questionTypes: [QuestionType.TRUE_FALSE],
        style: "student_friendly",
        styleInstructions: "",
        extraInstructions: "",
        systemInstructions: "",
        userPrompt: "",
        schemaReferenceStrategy: "ref_v2",
        promptCacheKeyEnabled: true,
        promptCacheRetention: "in_memory",
        maxOutputTokens: 12_000,
      },
    });
    expect(request.systemPrompt).toContain(QUIZ_SYSTEM_PROMPT);
    expect(request.systemPrompt).toContain(
      "học liệu chính thức và đáng tin cậy của buổi học",
    );
    expect(request.systemPrompt).toContain(
      "nội dung học liệu cần đọc và hiểu theo ngữ cảnh",
    );
    expect(request.systemPrompt).toContain(
      "ví dụ đã giải, bài tập, câu hỏi ôn tập và bài vận dụng",
    );
    expect(request.systemPrompt).toContain("câu hỏi mới cùng dạng hoặc biến thể phù hợp");
    expect(request.systemPrompt).toContain(
      "tự lập nội bộ danh sách các dạng bài có thể đánh giá trong PDF",
    );
    expect(request.systemPrompt).toContain(
      "Phân bổ số câu đều nhất có thể giữa các dạng đã nhận diện",
    );
    expect(request.systemPrompt).toContain(
      "số câu giữa hai dạng bất kỳ chênh lệch tối đa một",
    );
    expect(request.systemPrompt).toContain(
      "nếu số câu ít hơn số dạng, ưu tiên tối đa số dạng khác nhau",
    );
    expect(request.systemPrompt).toContain(
      "không trả danh sách phân tích này trong output",
    );
    expect(request.systemPrompt).toContain(
      "tự đối chiếu câu dự kiến đó với từng ví dụ đã giải",
    );
    expect(request.systemPrompt).toContain(QUIZ_SOURCE_NOVELTY_POLICY);
    expect(request.systemPrompt).toContain("chữ ký nội dung của mỗi cặp");
    expect(request.systemPrompt).toContain("thêm yêu cầu làm tròn");
    expect(request.systemPrompt).toContain(
      "phải thay đổi thật sự ít nhất hai chiều trong bốn chiều",
    );
    expect(request.systemPrompt).toContain("Ví dụ không hợp lệ theo mẫu tổng quát");
    expect(request.systemPrompt).toContain("Counterexample hợp lệ theo mẫu tổng quát");
    expect(request.systemPrompt).toContain("phải bỏ câu đó và biên soạn một câu mới");
    expect(request.systemPrompt).toContain(QUIZ_REAL_WORLD_APPLICATION_COVERAGE_POLICY);
    expect(request.systemPrompt).toContain(
      "Coverage ứng dụng thực tế là một trục độc lập",
    );
    expect(request.systemPrompt).toContain(
      "output bắt buộc phải có ít nhất một câu ứng dụng thực tế mới",
    );
    expect(request.systemPrompt).toContain(
      "Không được gộp mất bài thực tế vào bài chuẩn",
    );
    expect(request.systemPrompt).toContain("không tái sử dụng bối cảnh đặc thù");
    expect(request.systemPrompt).toContain(
      "Nếu PDF không có bài ứng dụng thực tế có thể đánh giá",
    );
    expect(request.systemPrompt).toContain(QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY);
    expect(request.systemPrompt).toContain("không vượt quá khối lớp mục tiêu");
    expect(request.systemPrompt).toContain(
      "kể cả khi cách giải đó đúng về mặt chuyên môn",
    );
    expect(request.systemPrompt).not.toContain("dữ liệu tham khảo không đáng tin cậy");
    expect(request.promptVersion).toMatch(/^quiz-/u);
    expect(request.schemaVersion).toMatch(/^quiz-/u);
    expect(request.schemaReferenceStrategy).toBe("ref_v2");
    expect(request.promptCache).toEqual({
      namespace: "quiz",
      keyEnabled: true,
      retention: "in_memory",
    });
    expect(request.maxTokens).toBe(12_000);
    expect(request.promptVersion).toBe("quiz-pdf-figure-prompt-v40-math-visual-need");
    expect(request.schemaVersion).toBe("quiz-pdf-figure-schema-v26-math-visual-need");
    expect(request.promptVersion).toBe(QUIZ_PROMPT_VERSION);
    expect(request.schemaVersion).toBe(QUIZ_SCHEMA_VERSION);
    expect(request.systemPrompt).toContain(QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY);
    expect(request.systemPrompt).toContain(
      QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
    );
    expect(request.systemPrompt).toContain(QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY);
    expect(request.systemPrompt).toContain(
      "mỗi lệnh `\\begin{X}` bắt buộc có đúng lệnh `\\end{X}` tương ứng",
    );
    expect(request.systemPrompt).toContain("$$\\begin{aligned}A&=B\\\\&=C.$$");
    expect(request.systemPrompt).toContain(
      "Câu dẫn mở danh sách, hệ, bảng hoặc công thức display ở dòng sau phải kết thúc bằng dấu `:`",
    );
    expect(request.systemPrompt).toContain(
      "Không đặt `&` ngay trước toán tử suy luận hoặc tương đương đứng đầu dòng",
    );
    expect(request.systemPrompt).toContain("`\\Leftrightarrow`");
    expect(request.systemPrompt).toContain("`\\iff`");
    expect(request.systemPrompt).toContain("`\\impliedby`");
    expect(request.systemPrompt).toContain(
      "bất kể chuỗi ngắn, vừa một dòng, không tràn ngang hoặc ban đầu có thể viết inline",
    );
    expect(request.systemPrompt).toContain("Ví dụ tổng quát SAI");
    expect(request.systemPrompt).toContain("`$A=B=C$`");
    expect(request.systemPrompt).toContain("$$A=B=C.$$");
    expect(request.systemPrompt).toContain("Ví dụ tổng quát ĐÚNG");
    expect(request.systemPrompt).toContain(
      "$$\\begin{aligned}A&=B\\\\&=C.\\end{aligned}$$",
    );
    expect(request.systemPrompt).toContain(
      "phải chuyển chuỗi inline hoặc display một dòng đó thành display nhiều dòng",
    );
    expect(request.systemPrompt).toContain(
      "Không nhét toàn bộ phép tính nhiều bước vào giữa một đoạn văn",
    );
    expect(request.systemPrompt).toContain(
      "không được dùng yêu cầu gọn để gộp phép tính nhiều bước vào câu văn",
    );
    expect(request.userPrompt).toBe(
      [
        "### NHIỆM VỤ TẠO QUIZ",
        "- Bài học: Số hữu tỉ.",
        "- Môn học của khóa: Toán (MATH). Chỉ biên soạn theo đúng môn này, không pha hướng dẫn của môn khác.",
        "- Văn phong và cách trình bày cho học sinh lớp 7: dễ hiểu, gần gũi và phù hợp lứa tuổi.",
        "- Số câu: chính xác 1, không được trả thiếu hoặc thừa.",
        "- Độ khó: EASY; mỗi câu phải có nhãn difficulty đúng yêu cầu.",
        "- Loại câu hỏi: chỉ dùng TRUE_FALSE; phân bổ đều nhất có thể và phải có đủ mọi loại đã chọn.",
      ].join("\n"),
    );
    expect(request.inputFiles?.[0]).toMatchObject({
      filename: "quiz-source.pdf",
      mimeType: "application/pdf",
      detail: "high",
    });
    expect(request.inputTextItems).toBeUndefined();
    expect(request.systemPrompt).toContain(QUIZ_FIGURE_SELECTION_POLICY);
    expect(request.systemPrompt).toContain(
      "Nếu `isGeometry=true` và câu có cấu hình cụ thể",
    );
    expect(request.systemPrompt).toContain("mặc định phải tạo `questionFigure`");
    expect(request.systemPrompt).toContain(
      "không được trả `questionFigure=null` cho tất cả các câu đó",
    );
    expect(request.systemPrompt).toContain("Counterexample được phép không có hình");
    expect(request.systemPrompt).toContain(
      "đồ thị hàm số, hệ trục tọa độ, đường số, miền nghiệm",
    );
    expect(request.systemPrompt).toContain(
      "bảng biến thiên, bảng xét dấu, bảng dữ liệu, biểu đồ hoặc sơ đồ",
    );
    expect(request.systemPrompt).toContain(
      "các câu này giữ `isGeometry=false` nếu không thuộc Hình học",
    );
    expect(request.systemPrompt).not.toContain("khi không chắc chắn, chọn không có hình");
    expect(request.systemPrompt).not.toContain(
      "Quyết định tạo hình độc lập với `isGeometry`",
    );
    expect(request.userPrompt).not.toContain("explanation");
    expect(request.userPrompt).not.toContain("PDF packet");
    expect(request.userPrompt).not.toContain("figure");
    expect(request.userPrompt).not.toContain("prompt hoặc quy trình AI");
    expect(request.systemPrompt).toContain("Quiz không trả bảng giả thiết–kết luận");
    expect(request.systemPrompt).not.toContain("geometryStatement");
    expect(request.systemPrompt).not.toContain("hypotheses");
    expect(request.systemPrompt).not.toContain("conclusions");
    expect(request.systemPrompt).toContain(
      "góc có đỉnh B với hai cạnh BA và BC phải viết là $\\widehat{ABC}$ hoặc $\\widehat{CBA}$",
    );
    expect(request.systemPrompt).toContain(
      "không dùng ký hiệu ∠ABC và không viết $\\widehat{BAC}$",
    );
    expect(request.systemPrompt).toContain(
      "Không trường nào được dùng các chỉ dẫn như `xem hình`, `quan sát hình`",
    );
    expect(request.systemPrompt).toContain(
      "Mọi đối tượng, dữ kiện và quan hệ được đưa vào hình phải phục vụ trực tiếp",
    );
    expect(request.systemPrompt).not.toContain(
      "Mọi đối tượng, dữ kiện và quan hệ trong câu phải cần thiết",
    );
    expect(request.systemPrompt).toContain(
      "`problem` cùng `options[].text` hoặc `statements[].text` nếu có",
    );
    expect(request.systemPrompt).toContain(
      "`hint` và `caption` không được bổ sung dữ kiện mới",
    );
    expect(request.systemPrompt).toContain(
      "việc đề bài tự đủ nghĩa không làm hình trở thành thừa",
    );
    expect(request.systemPrompt).toContain("Không biến chỉ dẫn dành cho AI");
    expect(request.systemPrompt).toContain(
      "một công thức độc lập chỉ có một quan hệ có thể giữ gọn theo vai trò ngữ nghĩa",
    );
    expect(request.systemPrompt).toContain(
      "chuỗi tính/biến đổi có từ hai dấu `=` cấp ngoài cùng trở lên luôn phải thành display nhiều dòng",
    );
    expect(request.systemPrompt).toContain(QUIZ_HINT_QUALITY_POLICY);
    expect(request.systemPrompt).toContain("ít nhất một cầu nối suy luận cụ thể");
    expect(request.systemPrompt).toContain("`Dùng công thức phù hợp`");
    expect(request.systemPrompt).toContain("Counterexample hợp lệ theo mẫu tổng quát");
    expect(request.systemPrompt).toContain(
      "Không dùng các động từ mơ hồ như `ghép`, `nối`, `kết hợp`",
    );
    expect(request.systemPrompt).toContain(
      "`hint` được phép và nên dùng công thức LaTeX",
    );
    expect(request.systemPrompt).toContain(
      "Nếu cần từ hai bước trở lên, mỗi bước phải bắt đầu ở dòng riêng",
    );
    expect(request.systemPrompt).toContain(
      "riêng MULTI_STATEMENT_TRUE_FALSE chỉ có `problem` và `statementSolutions`, không có `solution` hoặc `answer` chung",
    );
    expect(request.systemPrompt).toContain(
      "bắt buộc dùng lần lượt đúng các chữ thường `a`, `b`, `c`, `d`",
    );
    expect(request.systemPrompt).toContain("tuyệt đối không dùng `S1`, `S2`");
    expect(request.systemPrompt).toContain("không chuyển biểu thức thành đoạn văn dài");
    expect(request.systemPrompt).toContain(
      "mỗi ý mang nhãn a), b), c), ... phải bắt đầu ở dòng riêng",
    );
    expect(request.systemPrompt).toContain(
      "hệ thống tự dựng từng dòng `a) Đúng.`, `b) Sai.`",
    );
    expect(request.systemPrompt).toContain(
      "Không nhắc tới PDF nguồn, prompt hoặc quy trình AI",
    );
    expect(request.systemPrompt).toContain("- MULTIPLE_CHOICE:");
    expect(request.systemPrompt).toContain("- TRUE_FALSE:");
    expect(request.systemPrompt).toContain("- MULTI_STATEMENT_TRUE_FALSE:");
    expect(request.systemPrompt).toContain(
      "`explanation.problem` phải bắt đầu trực tiếp bằng đúng một mệnh đề cần xét",
    );
    expect(request.systemPrompt).toContain("Ví dụ SAI: `Mệnh đề: P`");
    expect(request.systemPrompt).toContain("ví dụ ĐÚNG: `P`");
    expect(request.systemPrompt).toContain(
      "Không dùng câu cụt, tách rời ngữ cảnh như `Mệnh đề đúng.`",
    );
    expect(request.systemPrompt).toContain(
      "`explanation.problem` chỉ chứa bối cảnh hoặc dữ kiện dùng chung thực sự cần",
    );
    expect(request.systemPrompt).toContain(
      "Ví dụ SAI: `Cho dữ kiện X. Hãy đánh giá các mệnh đề sau`",
    );
    expect(request.systemPrompt).toContain("ví dụ ĐÚNG: `Cho dữ kiện X`");
    expect(request.systemPrompt).toContain(
      "`explanation.statementSolutions` phải có đúng một phần tử cho mỗi câu con",
    );
    expect(request.systemPrompt).toContain(
      "không viết một lời giải chung, không văn xuôi hóa biểu thức rồi chỉ liệt kê kết quả",
    );
    expect(request.systemPrompt).toContain("- TEXT_INPUT:");
    expect(request.systemPrompt).toContain(
      "`correctAnswer` phải là đúng một chuỗi đáp án chuẩn",
    );
    expect(request.systemPrompt).toContain("Dữ kiện phải đủ để xác định rõ kết quả");
    expect(request.systemPrompt).toContain("Làm tròn kết quả đến 1 chữ số thập phân.");
    expect(request.systemPrompt).toContain("ĐÚNG là `1/2`");
    expect(request.systemPrompt).toContain("`correctAnswer=1.4`");
    expect(request.systemPrompt).toContain(
      "Không dùng TEXT_INPUT khi học sinh phải trả lời bằng câu chữ",
    );
    expect(request.systemPrompt).not.toContain("Không dùng cho câu văn");
    expect(request.systemPrompt).not.toContain("Problem phải nói rõ đơn vị");
    expect(request.systemPrompt).not.toContain("dạng biểu diễn cần nhập");
    expect(request.systemPrompt).toContain(
      "nhận định này đúng không, nếu đúng thì đáp án bao nhiêu",
    );
    expect(request.systemPrompt).not.toContain("quy tắc so khớp");
    expect(request.systemPrompt).not.toContain("hệ thống sở hữu");
    expect(request.systemPrompt).not.toContain("do UI sở hữu");
    expect(request.systemPrompt).not.toContain("không lặp lại answer");
    expect(request.systemPrompt).not.toContain("Phase 1");
    expect(request.systemPrompt).not.toContain("Phase 2");
    expect(request.systemPrompt).not.toContain("structured output");
    expect(request.systemPrompt).toContain(
      "Sau khi đã thực hiện đủ các bước và xác định được kết quả hoặc phương án đúng, hãy kết luận rồi dừng",
    );
    expect(request.systemPrompt).toContain(QUIZ_CONCLUSION_PARAGRAPH_POLICY);
    expect(request.systemPrompt).toContain(QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY);
    expect(request.systemPrompt).toContain(
      "`solution` phải kết luận bằng cách trả lời trực tiếp yêu cầu của đề bài",
    );
    expect(request.systemPrompt).toContain("`Vậy chọn phương án C.`");
    expect(request.systemPrompt).toContain("`Vậy đáp án là C.`");
    expect(request.systemPrompt).toContain(
      "`answer` bắt buộc có dạng `<correctOptionId>. <nội dung đầy đủ của phương án đúng>`",
    );
    expect(request.systemPrompt).toContain("không thêm tiền tố `Đáp án:`");

    const physicsRequest = buildQuizStructuredInput({
      lessonId: "lesson-physics-core",
      lessonTitle: "Chuyển động",
      documentIds: [documentId],
      sourceHash,
      packet: {
        filename: "physics-source.pdf",
        bytes: Buffer.from("pdf-fixture"),
      },
      configuration: {
        ...requestConfiguration(),
        subjectKey: "PHYSICS",
        subjectName: "Vật lý",
        subjectSlug: "vat-ly",
      },
    });
    expect(physicsRequest.systemPrompt).not.toContain("GT–KL");
    expect(physicsRequest.systemPrompt).not.toContain("isGeometry");
  });

  it("keeps geometry classification and permits no figure for a general-formula counterexample", () => {
    const baseQuestion = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Đối chiếu với công thức diện tích hình tròn theo bán kính.",
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      correctAnswer: true,
    };
    const geometryExplanation = {
      problem: "Diện tích hình tròn bán kính $r$ được tính bởi $S=\\pi r^2$.",
      solution: "Theo công thức diện tích hình tròn, $S=\\pi r^2$ nên khẳng định đúng.",
      answer: "Khẳng định đúng.",
      isGeometry: true,
    };
    const grade9Schema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 9,
    });
    expect(
      grade9Schema.safeParse({
        questions: [{ ...baseQuestion, explanation: geometryExplanation }],
      }).success,
    ).toBe(true);
    expect(
      grade9Schema.safeParse({
        questions: [
          {
            ...baseQuestion,
            explanation: {
              ...geometryExplanation,
              geometryStatement: {
                hypotheses: ["Hình tròn có bán kính $r$."],
                conclusions: ["$S=\\pi r^2$."],
              },
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      grade9Schema.safeParse({
        questions: [
          {
            ...baseQuestion,
            explanation: { ...geometryExplanation, isGeometry: false },
          },
        ],
      }).success,
    ).toBe(true);

    const grade12Schema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 12,
    });
    expect(
      grade12Schema.safeParse({
        questions: [
          {
            ...baseQuestion,
            explanation: geometryExplanation,
          },
        ],
      }).success,
    ).toBe(true);

    const unknownGradeSchema = getGeneratedQuizOutputSchema({ subjectKey: "MATH" });
    expect(
      unknownGradeSchema.safeParse({
        questions: [
          {
            ...baseQuestion,
            explanation: geometryExplanation,
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("builds a request-scoped schema for count, type, difficulty and server-owned text grading", () => {
    const textQuestion = {
      questionType: QuestionType.TEXT_INPUT,
      difficulty: Difficulty.HARD,
      hint: "Đưa kết quả về dạng tối giản.",
      explanation: {
        problem: "Tính $1+1$.",
        solution: "$1+1=2$.",
        answer: "$2$",
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      correctAnswer: "2",
    };
    const schema = getGeneratedQuizOutputSchema({
      subjectKey: "GENERAL",
      questionCount: 1,
      questionTypes: [QuestionType.TEXT_INPUT],
      difficulty: Difficulty.HARD,
    });
    expect(schema.safeParse({ questions: [textQuestion] }).success).toBe(true);
    const providerSchema = buildAiStructuredTextFormat(schema, "generated_quiz").schema;
    const providerSchemaJson = JSON.stringify(providerSchema);
    const providerSchemaDescriptions = collectJsonSchemaDescriptions(providerSchema);
    expect(providerSchemaJson).toContain(QuestionType.TEXT_INPUT);
    expect(providerSchemaJson).not.toContain(QuestionType.MULTIPLE_CHOICE);
    expect(providerSchemaJson).toContain('"minItems":1');
    expect(providerSchemaJson).toContain('"maxItems":1');
    expect(providerSchemaJson).not.toContain("quy tắc so khớp");
    expect(providerSchemaJson).toContain(
      "`correctAnswer` phải là đúng một chuỗi đáp án chuẩn",
    );
    expect(providerSchemaJson).toContain(
      "`explanation.problem` bắt buộc kết thúc bằng đúng câu",
    );
    expect(providerSchemaJson).toContain("Làm tròn kết quả đến 1 chữ số thập phân.");
    expect(providerSchemaJson).toContain(
      "Đúng một đáp án số chuẩn. Chỉ dùng một trong ba dạng: số nguyên; phân số tối giản `p/q`",
    );
    expect(providerSchemaJson).toContain("QUY TẮC CỨNG VỀ CHUỖI DẤU BẰNG");
    expect(providerSchemaJson).toContain(
      "bất kể chuỗi ngắn, vừa một dòng, không tràn ngang hoặc ban đầu có thể viết inline",
    );
    expect(providerSchemaJson).toContain("$$A=B=C.$$");
    expect(providerSchemaJson).toContain("`$A=B=C$`");
    expect(providerSchemaJson).toContain("\\\\begin{aligned}A&=B");
    expect(providerSchemaJson).toContain(
      "bất kể chuỗi đang được dự định viết inline hay display",
    );
    expect(providerSchemaJson).toContain(
      "Không nhét toàn bộ phép tính nhiều bước vào giữa một đoạn văn",
    );
    expect(
      providerSchemaDescriptions.some(
        (description) =>
          description.startsWith("Thân lời giải phải đầy đủ và mạch lạc") &&
          description.includes(QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY) &&
          description.includes(QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY) &&
          description.includes(
            "Nếu trường này chứa một chuỗi tính hoặc biến đổi duy nhất",
          ) &&
          description.includes(QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY) &&
          description.includes(QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY),
      ),
    ).toBe(true);
    for (const fieldPrefix of [
      "Phần nội dung chính của câu hỏi",
      "Kết luận ngắn gọn, nhất quán với lời giải",
      "Gợi ý ngắn nhưng phải tự đủ nghĩa",
    ]) {
      const fieldDescription = providerSchemaDescriptions.find((description) =>
        description.startsWith(fieldPrefix),
      );
      expect(fieldDescription).toBeDefined();
      expect(fieldDescription).not.toContain(
        "Nếu trường này chứa một chuỗi tính hoặc biến đổi duy nhất",
      );
      expect(fieldDescription).not.toContain(
        QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
      );
      expect(fieldDescription).not.toContain(QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY);
      expect(fieldDescription).not.toContain(QUIZ_SUBPART_LINEBREAK_POLICY);
    }
    expect(providerSchemaDescriptions[0]).toContain(QUIZ_SUBPART_LINEBREAK_POLICY);
    expect(providerSchemaJson).toContain(QUIZ_CONCLUSION_PARAGRAPH_POLICY);
    expect(providerSchemaJson).not.toContain(QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY);
    expect(providerSchemaJson).toContain("QUY TẮC CỨNG VỀ MÔI TRƯỜNG LATEX");
    expect(providerSchemaJson).toContain(
      "mỗi lệnh `\\\\begin{X}` bắt buộc có đúng lệnh `\\\\end{X}` tương ứng",
    );
    for (const fieldDescription of [
      "Phần nội dung chính của câu hỏi phải nêu đủ đối tượng, ký hiệu, dữ kiện và yêu cầu chuyên môn nếu dạng câu cần, để học sinh trả lời được mà không cần xem hình minh họa. Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đã được `questionType` thể hiện.",
      "Thân lời giải phải đầy đủ và mạch lạc theo phong cách sách giáo khoa: chỉ bỏ diễn giải lặp lại, không gộp phép tính nhiều bước vào câu văn; sau khi thực hiện đủ các bước cần thiết thì kết luận rồi dừng, không viết thêm nhận xét hoặc tính chất tổng quát sau kết luận. Lời giải phải hiểu được mà không cần xem hình minh họa.",
      "Kết luận ngắn gọn, nhất quán với lời giải và không chứa tiền tố `Đáp án:`.",
    ]) {
      expect(providerSchemaJson).toContain(fieldDescription);
    }
    expect(providerSchemaDescriptions).toContain(QUIZ_HINT_QUALITY_POLICY);
    const allQuestionTypesSchema = getGeneratedQuizOutputSchema({
      subjectKey: "GENERAL",
      questionCount: 1,
      difficulty: Difficulty.HARD,
    });
    const allQuestionTypesResolution = resolveAiStructuredTextFormat(
      allQuestionTypesSchema,
      "generated_quiz",
      "ref_v2",
    );
    const allQuestionTypesProviderSchema = allQuestionTypesResolution.format.schema;
    const allQuestionTypesProviderSchemaJson = JSON.stringify(
      allQuestionTypesProviderSchema,
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY,
    );
    const allQuestionTypesDescriptions = collectJsonSchemaDescriptions(
      allQuestionTypesProviderSchema,
    );
    for (const fieldDescription of [
      "Nội dung phương án; phải rõ nghĩa và không chỉ dẫn học sinh xem hình minh họa.",
      "Nội dung một câu con đủ rõ để đánh giá đúng/sai độc lập và không chỉ dẫn học sinh xem hình minh họa.",
    ]) {
      expect(allQuestionTypesProviderSchemaJson).toContain(fieldDescription);
      expect(allQuestionTypesProviderSchemaJson).not.toContain(
        `${fieldDescription} Nếu trường này chứa một chuỗi tính hoặc biến đổi duy nhất`,
      );
    }
    const solutionDescriptions = allQuestionTypesDescriptions.filter((description) =>
      description.startsWith("Thân lời giải phải đầy đủ và mạch lạc"),
    );
    expect(solutionDescriptions).toHaveLength(1);
    expect(solutionDescriptions[0]).toContain(
      "Nếu trường này chứa một chuỗi tính hoặc biến đổi duy nhất",
    );
    expect(solutionDescriptions[0]).toContain(
      QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
    );
    expect(solutionDescriptions[0]).toContain(QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY);
    expect(solutionDescriptions[0]).toContain(QUIZ_SUBPART_LINEBREAK_POLICY);
    expect(solutionDescriptions[0]).toContain(QUIZ_CONCLUSION_PARAGRAPH_POLICY);
    expect(solutionDescriptions[0]).not.toContain(QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY);
    const solutionReferences = [
      ...allQuestionTypesProviderSchemaJson.matchAll(
        /"solution":\{"\$ref":"(#\/\$defs\/[^"]+)"\}/gu,
      ),
    ].map((match) => match[1]);
    expect(solutionReferences).toHaveLength(4);
    expect(new Set(solutionReferences).size).toBe(1);
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Lời giải độc lập cho đúng một câu con",
    );
    const inlineAllQuestionTypesResolution = resolveAiStructuredTextFormat(
      allQuestionTypesSchema,
      "generated_quiz",
      "inline",
    );
    expect(
      inlineAllQuestionTypesResolution.schemaBytes -
        allQuestionTypesResolution.schemaBytes,
    ).toBeGreaterThan(10_000);
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Quyết định có dùng hình hay không và cách dùng hình đề trong lời giải",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Các đối tượng trực quan mới, thiết yếu phải thêm trên đúng hình đề",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "`explanation.problem` phải bắt đầu trực tiếp bằng đúng một mệnh đề cần xét",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đúng/sai",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "`explanation.problem` chỉ chứa bối cảnh hoặc dữ kiện dùng chung thực sự cần",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "phải dừng ngay sau bối cảnh đó",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "`explanation.statementSolutions` phải có đúng một phần tử cho mỗi câu con",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "không dùng S1/S2 hoặc số thứ tự",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "không chuyển biểu thức thành đoạn văn dài",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Không dùng câu cụt, tách rời ngữ cảnh như `Mệnh đề đúng.`",
    );
    const multiStatementSchema = getGeneratedQuizOutputSchema({
      subjectKey: "GENERAL",
      questionCount: 1,
      questionTypes: [QuestionType.MULTI_STATEMENT_TRUE_FALSE],
      difficulty: Difficulty.HARD,
    });
    const multiStatementQuestion = {
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      difficulty: Difficulty.HARD,
      hint: "Xét riêng từng mệnh đề.",
      explanation: {
        problem: "Cho hai mệnh đề về số chẵn.",
        statementSolutions: [
          {
            statementId: "a",
            solution: "Ta có: $2=2\\cdot1$. Vậy câu a) đúng.",
          },
          {
            statementId: "b",
            solution: "Ta có: $3=2\\cdot1+1$. Vậy câu b) sai.",
          },
        ],
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      statements: [
        { id: "a", text: "Số 2 là số chẵn.", value: true },
        { id: "b", text: "Số 3 là số chẵn.", value: false },
      ],
    };
    expect(
      multiStatementSchema.safeParse({ questions: [multiStatementQuestion] }).success,
    ).toBe(true);
    expect(
      multiStatementSchema.safeParse({
        questions: [
          {
            ...multiStatementQuestion,
            explanation: {
              problem: multiStatementQuestion.explanation.problem,
              solution: "Một lời giải chung cho cả hai mệnh đề.",
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      multiStatementSchema.safeParse({
        questions: [
          {
            ...multiStatementQuestion,
            statements: [
              { id: "b", text: "Số 2 là số chẵn.", value: true },
              { id: "c", text: "Số 3 là số chẵn.", value: false },
            ],
            explanation: {
              ...multiStatementQuestion.explanation,
              statementSolutions: [
                { statementId: "b", solution: "Lời giải câu b)." },
                { statementId: "c", solution: "Lời giải câu c)." },
              ],
            },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      multiStatementSchema.safeParse({
        questions: [
          {
            ...multiStatementQuestion,
            statements: [
              { id: "S1", text: "Số 2 là số chẵn.", value: true },
              { id: "S2", text: "Số 3 là số chẵn.", value: false },
            ],
            explanation: {
              ...multiStatementQuestion.explanation,
              statementSolutions: [
                { statementId: "S1", solution: "Lời giải câu thứ nhất." },
                { statementId: "S2", solution: "Lời giải câu thứ hai." },
              ],
            },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      multiStatementSchema.safeParse({
        questions: [
          {
            ...multiStatementQuestion,
            explanation: {
              ...multiStatementQuestion.explanation,
              answer: "Mệnh đề 1 đúng; mệnh đề 2 sai.",
            },
          },
        ],
      }).success,
    ).toBe(false);
    const multipleChoiceProviderSchemaJson = JSON.stringify(
      buildAiStructuredTextFormat(
        getGeneratedQuizOutputSchema({
          subjectKey: "GENERAL",
          questionCount: 1,
          questionTypes: [QuestionType.MULTIPLE_CHOICE],
          difficulty: Difficulty.HARD,
        }),
        "generated_quiz",
      ).schema,
    );
    expect(multipleChoiceProviderSchemaJson).toContain(
      "`explanation.answer` phải có dạng `<correctOptionId>. <nội dung đầy đủ của phương án đúng>`",
    );
    expect(
      schema.safeParse({
        questions: [{ ...textQuestion, difficulty: Difficulty.EASY }],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        questions: [textQuestion, textQuestion],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        questions: [
          {
            ...textQuestion,
            acceptedAnswers: ["2", "$2$"],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        questions: [
          {
            ...textQuestion,
            correctAnswer: "Đáp án là hai",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        questions: [{ ...textQuestion, correctAnswer: "1/0" }],
      }).success,
    ).toBe(false);
    for (const invalidCorrectAnswer of [
      "1/2; 0.5",
      "1/2\n0.5",
      "36\\pi",
      "\\sqrt{2}",
      "0,5",
      "5e-1",
    ]) {
      expect(
        schema.safeParse({
          questions: [{ ...textQuestion, correctAnswer: invalidCorrectAnswer }],
        }).success,
      ).toBe(false);
    }
    for (const validCorrectAnswer of ["2", "1/2", "1.4"]) {
      expect(
        schema.safeParse({
          questions: [{ ...textQuestion, correctAnswer: validCorrectAnswer }],
        }).success,
      ).toBe(true);
    }

    const mapped = mapGeneratedQuizQuestion(textQuestion);
    expect(mapped.correctAnswerJson).toEqual(["2"]);
    expect(mapped.gradingConfigJson).toBeNull();
  });

  it("keeps semantic validation issues as non-blocking admin warnings", () => {
    const common = {
      difficulty: Difficulty.MEDIUM,
      hint: "Kiểm tra từng ý.",
      explanation: {
        problem: "Đánh giá các mệnh đề.",
        statementSolutions: [
          {
            statementId: "a",
            solution: "Ta có: $2=2\\cdot1$. Vậy câu a) đúng.",
          },
          {
            statementId: "a",
            solution: "Ta có: $3=2\\cdot1+1$. Vậy câu a) sai.",
          },
        ],
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
    };
    const duplicateStatements = {
      ...common,
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      statements: [
        { id: "a", text: "Mệnh đề thứ nhất", value: true },
        { id: "a", text: "Mệnh đề thứ hai", value: false },
      ],
    };
    const invalidStatements = validateQuizOutput({
      questions: [duplicateStatements],
      requestedCount: 1,
      requestedTypes: [QuestionType.MULTI_STATEMENT_TRUE_FALSE],
      requestedDifficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
    });
    expect(invalidStatements.metadata.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "REVIEWABLE",
          code: "STATEMENT_ID_DUPLICATED",
          blocking: false,
        }),
      ]),
    );
    expect(invalidStatements.questions).toEqual([duplicateStatements]);

    const validStatements = validateQuizOutput({
      questions: [
        {
          ...duplicateStatements,
          statements: [
            { id: "a", text: "Mệnh đề thứ nhất", value: true },
            { id: "b", text: "Mệnh đề thứ hai", value: false },
          ],
          explanation: {
            ...duplicateStatements.explanation,
            statementSolutions: [
              {
                statementId: "a",
                solution: "Ta có: $2=2\\cdot1$. Vậy câu a) đúng.",
              },
              {
                statementId: "b",
                solution: "Ta có: $3=2\\cdot1+1$. Vậy câu b) sai.",
              },
            ],
          },
        },
      ],
      requestedCount: 1,
      requestedTypes: [QuestionType.MULTI_STATEMENT_TRUE_FALSE],
      requestedDifficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
    });
    expect(validStatements.metadata.issues).toEqual([]);

    const nonSequentialStatements = validateQuizOutput({
      questions: [
        {
          ...duplicateStatements,
          statements: [
            { id: "b", text: "Câu thứ nhất", value: true },
            { id: "c", text: "Câu thứ hai", value: false },
          ],
          explanation: {
            ...duplicateStatements.explanation,
            statementSolutions: [
              {
                statementId: "b",
                solution: "Ta có: $2=2\\cdot1$. Vậy câu b) đúng.",
              },
              {
                statementId: "c",
                solution: "Ta có: $3=2\\cdot1+1$. Vậy câu c) sai.",
              },
            ],
          },
        },
      ],
      requestedCount: 1,
      requestedTypes: [QuestionType.MULTI_STATEMENT_TRUE_FALSE],
      requestedDifficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
    });
    expect(nonSequentialStatements.metadata.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "REVIEWABLE",
          code: "STATEMENT_ID_SEQUENCE_MISMATCH",
          blocking: false,
        }),
      ]),
    );
  });

  it("warns without dropping questions when selected types are uneven", () => {
    const trueFalseQuestion = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.MEDIUM,
      hint: "Xét mệnh đề.",
      explanation: {
        problem: "Số 2 là số chẵn.",
        solution: "Số 2 chia hết cho 2.",
        answer: "Đúng.",
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      correctAnswer: true,
    };
    const textInputQuestion = {
      questionType: QuestionType.TEXT_INPUT,
      difficulty: Difficulty.MEDIUM,
      hint: "Thực hiện phép tính.",
      explanation: {
        problem: "Tính $1+1$.",
        solution: "$1+1=2$.",
        answer: "2",
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      correctAnswer: "2",
    };
    const questions = [
      trueFalseQuestion,
      trueFalseQuestion,
      trueFalseQuestion,
      trueFalseQuestion,
      textInputQuestion,
    ];
    const validation = validateQuizOutput({
      questions,
      requestedCount: 5,
      requestedTypes: [QuestionType.TRUE_FALSE, QuestionType.TEXT_INPUT],
      requestedDifficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
    });

    expect(validation.questions).toEqual(questions);
    expect(validation.metadata.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "QUESTION_TYPE_DISTRIBUTION_MISMATCH",
          blocking: false,
        }),
      ]),
    );

    const balanced = validateQuizOutput({
      questions: [
        trueFalseQuestion,
        trueFalseQuestion,
        trueFalseQuestion,
        textInputQuestion,
        textInputQuestion,
      ],
      requestedCount: 5,
      requestedTypes: [QuestionType.TRUE_FALSE, QuestionType.TEXT_INPUT],
      requestedDifficulty: Difficulty.MEDIUM,
      difficultyCounts: null,
    });
    expect(balanced.metadata.issues).toEqual([]);
  });

  it("prevents Quiz runtime files from importing Summary or lesson-content core", () => {
    const files = [
      "src/modules/quiz/controllers/admin-quiz.controller.ts",
      "src/modules/quiz/services/quiz-generation-context.service.ts",
      "src/modules/quiz/services/quiz-generation-job.service.ts",
      "src/modules/quiz/types/quiz-generation.types.ts",
      "src/modules/quiz/utils/quiz-generation-mapper.ts",
      "src/modules/quiz/utils/quiz-generation-prompt.ts",
      "src/modules/quiz-figures/types/quiz-figure-generation.types.ts",
      "src/modules/quiz-figures/services/quiz-figure-job.service.ts",
      "src/workers/processors/quiz-figure-rendering.processor.ts",
      "src/workers/services/quiz-generation.service.ts",
      "../web/features/admin/quiz/components/admin-quiz-generation-dialog.tsx",
      "../web/components/common/content/quiz-explanation-content.tsx",
    ];
    const source = files
      .map((file) => readFileSync(resolve(process.cwd(), file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/lesson-summary|LessonSummary/iu);
    expect(source).not.toMatch(/lesson-content-generation/iu);
    expect(source).not.toContain("exampleBlock");
    expect(source).not.toContain("explanationExampleBlock");
    expect(source).not.toMatch(/modules\/stem-figures/iu);

    const rendererSource = readFileSync(
      resolve(
        process.cwd(),
        "../web/components/common/content/quiz-explanation-content.tsx",
      ),
      "utf8",
    );
    expect(rendererSource).not.toMatch(/>\s*Lời giải\s*<\/div>/u);
    expect(rendererSource).toContain(
      "aria-label={`Phương án ${answerDisplay.optionLabel}`}",
    );
    expect(rendererSource).toContain("Đáp án:");
    expect(rendererSource).toContain('contentAlignment="left"');

    const mathpixRendererCss = readFileSync(
      resolve(process.cwd(), "../web/components/shared/mathpix-markdown-renderer.css"),
      "utf8",
    );
    expect(mathpixRendererCss).toContain(".mmd-content--left-aligned");
    expect(mathpixRendererCss).toContain(
      'mjx-container[jax="SVG"][display="true"] > svg',
    );
    expect(mathpixRendererCss).toMatch(
      /\.mmd-content--left-aligned\s+mjx-container\[jax="SVG"\]\[display="true"\]\s*>\s*svg\s*\{\s*margin:\s*0;/u,
    );
  });

  it("keeps the question-figure request free of solution and answer content", () => {
    const request = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
        solution: "Dựng đường cao AH rồi chứng minh hệ thức.",
        caption: "Tam giác ABC đều",
      },
    });
    expect(request.userPrompt).toContain("Cho tam giác ABC vuông tại A");
    expect(request.userPrompt).toContain("Tam giác ABC đều");
    expect(request.userPrompt).not.toContain("Dựng đường cao AH");
    const editRequest = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
        caption: "Tam giác ABC vuông tại A",
      },
      mode: "EDIT_CURRENT",
      currentLatexSource:
        "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}",
      adminInstructions: "Đặt nhãn A xa cạnh hơn.",
    });
    expect(editRequest.userPrompt).toContain('"mode":"EDIT_CURRENT"');
    expect(editRequest.userPrompt).toContain('"currentLatexSource"');
    expect(editRequest.userPrompt).toContain("Đặt nhãn A xa cạnh hơn");
    expect(editRequest.systemPrompt).toContain("sửa tối thiểu currentLatexSource");
    expect(request.systemPrompt).toContain("tuyệt đối không chứa đáp án");
    expect(request.systemPrompt).toContain(
      "mọi đối tượng, quan hệ, ký hiệu và chú thích mang nghĩa",
    );
    expect(request.systemPrompt).toContain("không tạo ra cách hiểu sai hoặc mơ hồ");
    expect(request.systemPrompt).toContain(
      "problem là nguồn dữ kiện có thẩm quyền duy nhất",
    );
    expect(request.systemPrompt).toContain(
      "caption chỉ mô tả trọng tâm minh họa",
    );
    expect(request.systemPrompt).toContain(
      "Nếu caption mâu thuẫn, mơ hồ hoặc vượt quá problem",
    );
    expect(request.systemPrompt).toContain(
      "đối chiếu lại từng nét mang nghĩa với problem",
    );
    expect(request.systemPrompt).not.toContain("problem/caption");
    expect(request.systemPrompt).not.toContain("semanticChecks");
    expect(request.systemPrompt).not.toContain("readabilityChecks");
    expect(request.systemPrompt).not.toContain("GT–KL");
    expect(request.schemaReferenceStrategy).toBe("auto");
    expect(request.promptCache).toEqual({
      namespace: "quiz-figure-question",
      keyEnabled: true,
      retention: "in_memory",
    });
    const questionFormat = resolveAiStructuredTextFormat(
      generatedQuizQuestionFigureSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );
    expect(questionFormat.resolvedReferenceStrategy).toBe("inline");
    expect(questionFormat.schemaBytes).toBeLessThan(350);
    expect(JSON.stringify(questionFormat.format.schema)).not.toMatch(
      /semanticChecks|readabilityChecks/u,
    );
    expect(
      estimateAiStructuredInputTokens({
        systemPrompt: request.systemPrompt,
        inputPrompt: buildAiUserPrompt(request),
        structuredTextFormat: questionFormat.format,
      }).textInputTokens,
    ).toBeLessThan(1_250);
    expect(request.systemPrompt).toContain("bao phủ Hình học và trực quan Đại số");
    expect(request.systemPrompt).toContain("Cấm tuyệt đối marker mũi tên hoặc chevron");
    expect(request.systemPrompt).toContain(
      "hướng của trục, vector, lực, tia hoặc luồng truyền",
    );
    expect(request.systemPrompt).toContain(
      "góc trong đa giác phải nằm phía trong đa giác",
    );
    expect(request.systemPrompt).not.toContain(
      "các đường song song dùng cùng kiểu mũi tên",
    );
    expect(request.systemPrompt).toContain("Đồ thị/hệ trục/đường số/miền nghiệm");
    expect(request.systemPrompt).toContain("Bảng biến thiên/xét dấu/dữ liệu/biểu đồ");
    expect(request.promptVersion).toBe(
      "quiz-figure-prompt-v20-problem-authoritative-caption-advisory",
    );
    expect(request.promptVersion).toBe(QUIZ_FIGURE_PROMPT_VERSION);
    expect(request.systemPrompt).toContain("không ký hiệu kết luận học sinh cần tìm");
    expect(request.systemPrompt).toContain("Bắt buộc dựng trước, chú thích sau");
    expect(request.systemPrompt).toContain(
      "tính lại từng số đo nhìn thấy từ tọa độ/phép dựng",
    );
    expect(request.systemPrompt).toContain(
      "angle=X--V--Y, tính miền quét ngược chiều kim đồng hồ",
    );
    expect(request.systemPrompt).toContain(
      "dựng lại tọa độ hoặc đổi thứ tự tia",
    );
    expect(request.systemPrompt).toContain("cấm chỉ sửa nhãn");
    expect(request.systemPrompt).toContain("không trả thêm field/báo cáo");
    expect(request.systemPrompt).toContain(
      "ký hiệu quan hệ độc lập không chồng, chạm hoặc tụ sát",
    );
    expect(
      generatedQuizQuestionFigureSchema.safeParse({
        latexSource: [
          "\\begin{tikzpicture}",
          QUIZ_FIGURE_EXTENSION_MARKER,
          "\\end{tikzpicture}",
        ].join("\n"),
      }).success,
    ).toBe(true);
    expect(
      generatedQuizQuestionFigureSchema.safeParse({
        semanticChecks: [],
        latexSource: [
          "\\begin{tikzpicture}",
          "\\draw (A) -- (B) -- (C) -- cycle;",
          QUIZ_FIGURE_EXTENSION_MARKER,
          "\\end{tikzpicture}",
        ].join("\n"),
      }).success,
    ).toBe(false);
  });

  it("builds the solution figure by inserting commands into the exact question source", () => {
    const base = [
      "\\begin{tikzpicture}",
      "\\draw (0,0) -- (2,0) -- (0,2) -- cycle;",
      QUIZ_FIGURE_EXTENSION_MARKER,
      "\\end{tikzpicture}",
    ].join("\n");
    assertQuizFigureLatexSource(base);
    const extended = applyQuizSolutionExtension(base, "\\draw[dashed] (0,0) -- (1,1);");
    expect(extended).toContain(base.split(QUIZ_FIGURE_EXTENSION_MARKER)[0]);
    expect(extended).toContain("\\draw[dashed] (0,0) -- (1,1);");
    expect((extended.match(/\\begin\{tikzpicture\}/gu) ?? []).length).toBe(1);

    const request = buildSolutionFigureExtensionInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "SOLUTION",
        mode: "EXTEND_QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
        solution: "Dựng đường cao AH.",
        addedObjects: ["Đường cao AH"],
        clarifiedRelations: ["AH vuông góc BC"],
        caption: null,
      },
      exactQuestionLatexSource: base,
    });
    const requestPayload = JSON.parse(request.userPrompt) as {
      exactQuestionLatexSource: string;
      requiredAddedObjects: string[];
      requiredClarifiedRelations: string[];
    };
    expect(requestPayload.exactQuestionLatexSource).toBe(base);
    expect(requestPayload.requiredAddedObjects).toEqual(["Đường cao AH"]);
    expect(requestPayload.requiredClarifiedRelations).toEqual(["AH vuông góc BC"]);
    expect(request.systemPrompt).toContain("không trả lại toàn bộ hình");
    expect(request.systemPrompt).not.toContain("extensionPlan");
    expect(request.systemPrompt).not.toContain("readabilityChecks");
    expect(request.systemPrompt).toContain("requiredAddedObjects");
    expect(request.systemPrompt).toContain("requiredClarifiedRelations");
    expect(request.schemaReferenceStrategy).toBe("auto");
    expect(request.promptCache).toEqual({
      namespace: "quiz-figure-solution",
      keyEnabled: true,
      retention: "in_memory",
    });
    const solutionFormat = resolveAiStructuredTextFormat(
      generatedQuizSolutionExtensionSchema,
      request.outputName,
      request.schemaReferenceStrategy,
    );
    expect(solutionFormat.resolvedReferenceStrategy).toBe("inline");
    expect(solutionFormat.schemaBytes).toBeLessThan(350);
    expect(JSON.stringify(solutionFormat.format.schema)).not.toMatch(
      /extensionPlan|readabilityChecks/u,
    );
    expect(
      estimateAiStructuredInputTokens({
        systemPrompt: request.systemPrompt,
        inputPrompt: buildAiUserPrompt(request),
        structuredTextFormat: solutionFormat.format,
      }).textInputTokens,
    ).toBeLessThan(1_250);
    expect(
      generatedQuizSolutionExtensionSchema.safeParse({
        extensionLatex: "\\draw[dashed] (0,0) -- (1,1);",
      }).success,
    ).toBe(true);
    expect(
      generatedQuizSolutionExtensionSchema.safeParse({
        extensionPlan: {},
        extensionLatex: "\\draw[dashed] (A) -- (H);",
      }).success,
    ).toBe(false);
  });

  it("uses separate reusable visual grammar for Physics and Chemistry", () => {
    const plan = {
      version: 1 as const,
      role: "QUESTION" as const,
      problem: "Mô tả cấu hình cần minh họa.",
      caption: null,
    };
    const physics = buildQuestionFigureInput({
      subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
      plan,
    });
    const chemistry = buildQuestionFigureInput({
      subject: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
      plan,
    });
    expect(physics.systemPrompt).toContain("Cấm tuyệt đối marker mũi tên hoặc chevron");
    expect(physics.systemPrompt).toContain("vector phải có đúng gốc");
    expect(physics.systemPrompt).not.toContain("hóa trị");
    expect(chemistry.systemPrompt).toContain("Cấm tuyệt đối marker mũi tên hoặc chevron");
    expect(chemistry.systemPrompt).toContain("đúng liên kết, hóa trị và điện tích");
    expect(chemistry.systemPrompt).not.toContain("lực gắn đúng vật");
  });

  it("keeps admin figure regeneration instructions scoped as presentation data", () => {
    const request = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC.",
        caption: "Tam giác ABC",
      },
      adminInstructions: "Đặt nhãn thoáng hơn.",
    });
    expect(JSON.parse(request.userPrompt)).toMatchObject({
      adminInstructions: "Đặt nhãn thoáng hơn.",
    });
    expect(request.systemPrompt).toContain("cấm thêm dữ kiện, lộ đáp án");
  });

  it("accepts the XML declaration and generator comment emitted by dvisvgm", () => {
    const rendered = [
      "<?xml version='1.0' encoding='UTF-8'?>",
      "<!-- This file was generated by dvisvgm -->",
      "<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0'/></svg>",
    ].join("\n");
    expect(sanitizeQuizFigureSvg(rendered)).toBe(
      "<svg xmlns='http://www.w3.org/2000/svg'><path d='M0 0'/></svg>",
    );
  });

  it("auto-closes missing LaTeX environments before the display delimiter", () => {
    const malformed = String.raw`Ta có:
$$\begin{aligned}V&=\pi\int_3^5(25-x^2)\,dx\\&=\frac{52\pi}{3}.$$`;
    const normalized = normalizeQuizDisplayMathEnvironments(malformed);

    expect(normalized).toBe(String.raw`Ta có:
$$\begin{aligned}V&=\pi\int_3^5(25-x^2)\,dx\\&=\frac{52\pi}{3}.\end{aligned}$$`);
    expect(normalizeQuizDisplayMathEnvironments(normalized)).toBe(normalized);
  });

  it("repairs misplaced, nested and orphan LaTeX environment closers without throwing", () => {
    expect(
      normalizeQuizDisplayMathEnvironments(
        String.raw`$$\begin{aligned}x&=1$$\end{aligned}$$`,
      ),
    ).toBe(String.raw`$$\begin{aligned}x&=1\end{aligned}$$`);
    expect(
      normalizeQuizDisplayMathEnvironments(
        String.raw`$$\begin{aligned}\begin{cases}x=1\end{aligned}$$`,
      ),
    ).toBe(String.raw`$$\begin{aligned}\begin{cases}x=1\end{cases}\end{aligned}$$`);
    expect(normalizeQuizDisplayMathEnvironments(String.raw`$$x=1\end{aligned}$$`)).toBe(
      String.raw`$$x=1$$`,
    );
  });

  it("repairs inline math closed by a backtick without changing Markdown code", () => {
    expect(
      normalizeQuizInlineMathDelimiters(
        "Trên trục $Ox$ tại $x=1`. Diện tích tại $x$ là $S(x)$.",
      ),
    ).toBe("Trên trục $Ox$ tại $x=1$. Diện tích tại $x$ là $S(x)$.");
    expect(
      normalizeQuizInlineMathDelimiters(
        "Hàm số liên tục trên đoạn $[0,1]`. Vậy câu b) đúng.",
      ),
    ).toBe("Hàm số liên tục trên đoạn $[0,1]$. Vậy câu b) đúng.");
    expect(normalizeQuizInlineMathDelimiters("Tại vị trí $x`, ta có kết quả.")).toBe(
      "Tại vị trí $x$, ta có kết quả.",
    );
    expect(
      normalizeQuizInlineMathDelimiters(
        "Vì $\\dfrac{\\pi}{2}\\approx 1.5708`, nên làm tròn được $1.6$.",
      ),
    ).toBe("Vì $\\dfrac{\\pi}{2}\\approx 1.5708$, nên làm tròn được $1.6$.");
    expect(
      normalizeQuizInlineMathDelimiters(
        "Trên đoạn $[0,4]`. Hai đường thẳng $x=0$, $x=4`; quay quanh $Ox$.",
      ),
    ).toBe("Trên đoạn $[0,4]$. Hai đường thẳng $x=0$, $x=4$; quay quanh $Ox$.");
    expect(normalizeQuizInlineMathDelimiters("Giữ `price=$5` và $x=1$.")).toBe(
      "Giữ `price=$5` và $x=1$.",
    );
  });

  it("normalizes every generated Quiz string while preserving valid content", () => {
    const question = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: String.raw`Dùng $x=1$.`,
      explanation: {
        problem: String.raw`Giá trị $x=1$ thỏa mãn.`,
        solution: String.raw`$$\begin{aligned}x&=1\\&=1.$$`,
        answer: "Đúng",
        isGeometry: false,
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      correctAnswer: true,
    };

    expect(normalizeGeneratedQuizQuestionLatex(question).explanation.solution).toBe(
      String.raw`$$\begin{aligned}x&=1\\&=1.\end{aligned}$$`,
    );
    expect(normalizeGeneratedQuizQuestionLatex(question).hint).toBe(question.hint);
  });

  it("repairs missing backslashes for known LaTeX commands only inside math", () => {
    const question = {
      questionType: QuestionType.TEXT_INPUT,
      difficulty: Difficulty.EASY,
      hint: String.raw`Nhận diện quan hệ $ widehat{X}+\widehat{Y}=180^circ$ rồi lập phép tính.`,
      explanation: {
        problem: String.raw`Biết $ widehat{X}=m^circ$. Tính $\widehat{Y}$.`,
        solution: String.raw`Dòng chữ widehat{X} giữ nguyên. Ký hiệu $xwidehat{Y}$ không phải lệnh.`,
        answer: "n",
        isGeometry: true,
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      correctAnswer: "1",
    };

    const normalized = normalizeGeneratedQuizQuestionLatex(question);
    expect(normalized.hint).toBe(
      String.raw`Nhận diện quan hệ $ \widehat{X}+\widehat{Y}=180^\circ$ rồi lập phép tính.`,
    );
    expect(normalized.explanation.problem).toBe(
      String.raw`Biết $ \widehat{X}=m^\circ$. Tính $\widehat{Y}$.`,
    );
    expect(normalized.explanation.solution).toContain("Dòng chữ widehat{X}");
    expect(normalized.explanation.solution).toContain("$xwidehat{Y}$");
    expect(normalizeGeneratedQuizQuestionLatex(normalized)).toEqual(normalized);
  });

  it("repairs mistyped inline delimiters across generated Quiz problem and solutions", () => {
    const question = {
      questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
      difficulty: Difficulty.HARD,
      hint: "Xét từng câu.",
      explanation: {
        problem: "Một vật thể trên đoạn $[0,1]`.",
        statementSolutions: [
          {
            statementId: "a" as const,
            solution: "Hàm số liên tục trên $[0,1]`.\n\nVậy câu a) đúng.",
          },
          {
            statementId: "b" as const,
            solution: "Giá trị $S(1)=4$.\n\nVậy câu b) đúng.",
          },
        ],
        isGeometry: false,
      },
      figure: {
        questionFigure: null,
        solutionFigureMode: "NONE" as const,
        solutionFigurePlan: null,
      },
      statements: [
        { id: "a" as const, text: "Câu a.", value: true },
        { id: "b" as const, text: "Câu b.", value: true },
      ],
    };

    const normalized = normalizeGeneratedQuizQuestionLatex(question);
    expect(normalized.explanation.problem).toBe("Một vật thể trên đoạn $[0,1]$.");
    expect(normalized.explanation.statementSolutions[0]?.solution).toContain(
      "trên $[0,1]$.",
    );
    expect(normalized.explanation.statementSolutions[1]?.solution).toContain("$S(1)=4$.");
  });
});
