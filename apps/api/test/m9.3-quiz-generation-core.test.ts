import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeMissingInlineMathClosers } from "@learning-path/shared";
import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildAiStructuredTextFormat,
  resolveAiStructuredTextFormat,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { buildOpenAiStructuredResponseRequest } from "#api/modules/ai/utils/openai-response-request";
import {
  QUIZ_CONCLUSION_PARAGRAPH_POLICY,
  QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY,
  getGeneratedQuizOutputSchema,
  QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY,
  QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
  QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY,
  QUIZ_HINT_QUALITY_POLICY,
  QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY,
  QUIZ_LOGICAL_DERIVATION_POLICY,
  QUIZ_ORIGINAL_FORMULA_STEP_POLICY,
  QUIZ_PROMPT_VERSIONS,
  QUIZ_SCHEMA_VERSION,
  QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY,
  QUIZ_SUBPART_LINEBREAK_POLICY,
  generatedQuizSourceCoverageAuditSchema,
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
  buildExistingQuizQuestionReferences,
  buildQuizStructuredInput,
  buildQuizSubjectSystemPrompt,
} from "#api/modules/quiz/utils/quiz-generation-prompt";
import { validateQuizOutput } from "#api/modules/quiz/utils/quiz-generation-validation";
import {
  buildQuestionFigureInput,
  buildSolutionFigureInput,
  generatedQuizQuestionFigureSchema,
  generatedQuizSolutionFigureSchema,
  resolveQuizFigureSystemPrompt,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import {
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
  it("keeps a custom Quiz system prompt as a complete override", () => {
    const defaultPrompt = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC.",
      },
    }).systemPrompt;

    expect(resolveQuizFigureSystemPrompt(defaultPrompt, "  SYSTEM CUSTOM  ")).toBe(
      "SYSTEM CUSTOM",
    );
    expect(resolveQuizFigureSystemPrompt(defaultPrompt, "   ")).toBe(defaultPrompt);
  });

  it("does not inject default derivation rules into a custom Quiz text prompt", () => {
    const configuration = requestConfiguration();
    const customSystemInstructions = "  System Quiz tùy chỉnh của admin.  ";
    const request = buildQuizStructuredInput({
      lessonId: "lesson-quiz-custom-prompt",
      lessonTitle: "Bài học tùy chỉnh",
      documentIds: [documentId],
      sourceHash,
      packet: {
        filename: "quiz-source.pdf",
        bytes: Buffer.from("pdf-fixture"),
      },
      configuration: {
        ...configuration,
        systemInstructions: customSystemInstructions,
      },
    });

    expect(request.systemPrompt).toBe(customSystemInstructions);
    expect(request.systemPrompt).not.toContain("TÍNH LIÊN TỤC CỦA PHÉP BIẾN ĐỔI");
    expect(request.systemPrompt).not.toContain("KHAI BÁO VÀ ỔN ĐỊNH KÝ HIỆU");
    expect(request.systemPrompt).not.toContain("CĂN CỨ HIỂN THỊ CHO KẾT LUẬN TRUNG GIAN");
    expect(request.systemPrompt).not.toContain("số đo lớn hơn là chiều dài");
    expect(request.systemPrompt).not.toContain(
      "khung nhiệm vụ hoặc mạch suy luận chính chưa xuất hiện",
    );
    expect(request.userPrompt).not.toContain("KIỂM TRA CUỐI VỀ ĐA DẠNG CẤU TRÚC");
    expect(request.userPrompt).not.toContain("KIỂM TRA CUỐI VỀ TÍNH MỚI CẤU TRÚC");
  });

  it("sends every existing Quiz type and compact question-facing content without answers", () => {
    const existingQuestionReferences = buildExistingQuizQuestionReferences([
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Tính   giá trị " },
                { type: "inlineMath", attrs: { latex: "x+1" } },
              ],
            },
          ],
        },
        optionsJson: [
          {
            id: "A",
            richText: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }],
            },
          },
          {
            id: "B",
            richText: {
              type: "doc",
              content: [{ type: "paragraph", content: [{ type: "text", text: "2" }] }],
            },
          },
        ],
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Tính giá trị " },
                { type: "inlineMath", attrs: { latex: "x+1" } },
              ],
            },
          ],
        },
        optionsJson: [
          { id: "A", richText: { type: "doc", content: [{ type: "text", text: "1" }] } },
          { id: "B", richText: { type: "doc", content: [{ type: "text", text: "2" }] } },
        ],
      },
      {
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        questionJson: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Cho số 2." }] },
          ],
        },
        optionsJson: [
          {
            id: "a",
            richText: {
              type: "doc",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "2 là số chẵn." }] },
              ],
            },
          },
        ],
      },
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Trong các số sau, số nào lớn nhất?" }],
            },
          ],
        },
        optionsJson: [
          { id: "A", text: "$1/2$" },
          { id: "B", text: "$3/4$" },
        ],
      },
    ]);

    expect(existingQuestionReferences).toHaveLength(3);
    expect(existingQuestionReferences[0]).toBe(
      JSON.stringify([QuestionType.MULTIPLE_CHOICE, "Tính giá trị x+1"]),
    );
    expect(existingQuestionReferences[1]).toContain(
      JSON.stringify(QuestionType.MULTI_STATEMENT_TRUE_FALSE),
    );
    expect(existingQuestionReferences[2]).toBe(
      JSON.stringify([
        QuestionType.MULTIPLE_CHOICE,
        "Trong các số sau, số nào lớn nhất?",
        ["$1/2$", "$3/4$"],
      ]),
    );
    expect(existingQuestionReferences.join("\n")).not.toContain('"id"');
    expect(existingQuestionReferences.join("\n")).not.toContain("correctAnswer");

    const request = buildQuizStructuredInput({
      lessonId: "lesson-existing-quiz-dedup",
      lessonTitle: "Số hữu tỉ",
      documentIds: [documentId],
      sourceHash,
      packet: { filename: "quiz-source.pdf", bytes: Buffer.from("pdf-fixture") },
      configuration: requestConfiguration(),
      existingQuestionReferences,
    });

    expect(request.userPrompt).toContain("BẮT BUỘC ĐỐI CHIẾU");
    expect(request.systemPrompt).toContain(
      "Loại câu chỉ là định dạng trả lời, không phải dạng bài",
    );
    expect(request.systemPrompt).toContain(
      "Cùng một mẫu biểu thức với toán tử ở các vị trí tương ứng vẫn là cùng dạng",
    );
    expect(request.systemPrompt).toContain(
      "chỉ được tái sử dụng nhóm đó khi candidate đổi thực chất ít nhất hai trong ba trục",
    );
    expect(request.systemPrompt).toContain(
      "Chỉ riêng việc hai câu đều dùng biến, điểm hoặc nhiều mệnh đề chưa đủ kết luận chúng cùng dạng",
    );
    expect(request.userPrompt).not.toContain("Dựa trên đúng ngân hàng vừa đọc");
    expect(request.userPrompt).toContain(existingQuestionReferences[0]!);
    expect(request.userPrompt).toContain(existingQuestionReferences[1]!);
    expect(request.userPrompt).not.toContain("đáp án đúng");
    expect(request.userPrompt).not.toContain("lời giải chi tiết");
  });

  it("keeps existing-question deduplication after a custom user-prompt override", () => {
    const existingQuestionReferences = [
      JSON.stringify([QuestionType.TRUE_FALSE, "Số 2 là số chẵn."]),
    ];
    const request = buildQuizStructuredInput({
      lessonId: "lesson-custom-user-dedup",
      lessonTitle: "Số hữu tỉ",
      documentIds: [documentId],
      sourceHash,
      packet: { filename: "quiz-source.pdf", bytes: Buffer.from("pdf-fixture") },
      configuration: {
        ...requestConfiguration(),
        userPrompt: "Yêu cầu tùy chỉnh của admin.",
      },
      existingQuestionReferences,
    });

    expect(request.userPrompt).toContain("Yêu cầu tùy chỉnh của admin.");
    expect(request.userPrompt).toContain(existingQuestionReferences[0]!);
    expect(
      request.userPrompt.match(/EXISTING_QUIZ_QUESTIONS_JSONL_BEGIN/gu),
    ).toHaveLength(1);
  });

  it("keeps the existing-question list after the stable GPT-5.6 cache breakpoint", () => {
    const buildRequest = (problem: string, promptVersion?: string) => {
      const request = buildQuizStructuredInput({
        lessonId: "lesson-cache-dedup",
        lessonTitle: "Số hữu tỉ",
        documentIds: [documentId],
        sourceHash,
        packet: { filename: "quiz-source.pdf", bytes: Buffer.from("pdf-fixture") },
        configuration: requestConfiguration(),
        existingQuestionReferences: [JSON.stringify([QuestionType.TRUE_FALSE, problem])],
      });
      if (promptVersion) request.promptVersion = promptVersion;
      const structuredTextFormat = resolveAiStructuredTextFormat(
        getGeneratedQuizOutputSchema({
          subjectKey: "MATH",
          targetGrade: 7,
          questionCount: 1,
          questionTypes: [QuestionType.TRUE_FALSE],
          difficulty: Difficulty.EASY,
          includeSourceCoverageAudit: true,
        }),
        request.outputName,
        request.schemaReferenceStrategy,
      ).format;
      return buildOpenAiStructuredResponseRequest({
        request,
        model: "gpt-5.6",
        structuredTextFormat,
      });
    };

    const first = buildRequest("Số 2 là số chẵn.");
    const second = buildRequest("Số 3 là số lẻ.");
    const previousContract = buildRequest(
      "Số 2 là số chẵn.",
      "quiz-math-v77-structural-novelty",
    );

    expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
    expect(first.input[0]).toEqual(second.input[0]);
    expect(JSON.stringify(first.input[0])).toContain("prompt_cache_breakpoint");
    expect(JSON.stringify(first.input[0])).toContain("số đo lớn hơn là chiều dài");
    expect(JSON.stringify(first.input[0])).toContain(
      "khung nhiệm vụ hoặc mạch suy luận chính chưa xuất hiện",
    );
    expect(JSON.stringify(first.input[0])).not.toContain("Số 2 là số chẵn.");
    expect(first.prompt_cache_key).not.toBe(previousContract.prompt_cache_key);
    expect(first.input[1]).not.toEqual(second.input[1]);
    expect(JSON.stringify(first.input[1])).toContain("Số 2 là số chẵn.");
    expect(JSON.stringify(second.input[1])).toContain("Số 3 là số lẻ.");
  });

  it("resolves the original provider question from generation lineage", () => {
    const rawQuestion = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Xét định nghĩa số hữu tỉ.",
      explanation: {
        problem: "Số $1/2$ là số hữu tỉ.",
        solution: "$1/2$ có dạng $a/b$ với $b \\ne 0$.",
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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
            isGeometry: false,
          },
          figure: {
            requiresQuestionFigure: false,
            solutionFigure: false,
          },
          correctAnswer: true,
        },
      ],
    };
    const schema = getGeneratedQuizOutputSchema({ subjectKey: "MATH" });
    expect(schema.safeParse(output).success).toBe(true);
    expect(
      schema.safeParse({
        questions: output.questions.map((question) => ({
          ...question,
          explanation: { ...question.explanation, answer: "Đúng" },
        })),
      }).success,
    ).toBe(false);

    const coverageSchema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      questionCount: 1,
      includeSourceCoverageAudit: true,
    });
    const validCoverageAudit = {
      sourceHasAssessableRealWorldApplication: true,
      sourceApplicationFamily:
        "Dùng quan hệ hình học của lesson để mô hình hóa một nhu cầu đo đạc.",
      realWorldQuestions: [
        {
          questionNumber: 1,
          newContext: "Một phương án đo đạc mới trong đời sống.",
          modelingRole:
            "Dữ kiện đo được phải chuyển thành quan hệ chuyên môn trước khi tính.",
        },
      ],
    };
    expect(
      coverageSchema.safeParse({
        ...output,
        sourceCoverageAudit: validCoverageAudit,
      }).success,
    ).toBe(true);
    expect(
      generatedQuizSourceCoverageAuditSchema.shape.sourceHasAssessableRealWorldApplication
        .description,
    ).toContain("bắt buộc dùng ít nhất một trọng tâm của lesson hiện tại");
    expect(
      generatedQuizSourceCoverageAuditSchema.shape.sourceApplicationFamily.description,
    ).toContain("trọng tâm của lesson hiện tại bắt buộc phải dùng");
    expect(
      generatedQuizSourceCoverageAuditSchema.shape.realWorldQuestions.element.shape
        .modelingRole.description,
    ).toContain("vì sao phải dùng trọng tâm của lesson hiện tại để giải");
    expect(coverageSchema.safeParse(output).success).toBe(false);
    expect(
      coverageSchema.safeParse({
        ...output,
        sourceCoverageAudit: {
          ...validCoverageAudit,
          realWorldQuestions: [],
        },
      }).success,
    ).toBe(false);
    expect(
      coverageSchema.safeParse({
        ...output,
        sourceCoverageAudit: {
          ...validCoverageAudit,
          realWorldQuestions: [
            { ...validCoverageAudit.realWorldQuestions[0], questionNumber: 2 },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      coverageSchema.safeParse({
        ...output,
        sourceCoverageAudit: {
          sourceHasAssessableRealWorldApplication: false,
          sourceApplicationFamily: null,
          realWorldQuestions: [],
        },
      }).success,
    ).toBe(true);
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

  it("forbids question and solution figures for single-statement TRUE_FALSE across every subject", () => {
    const noFigure = {
      requiresQuestionFigure: false as const,
      solutionFigure: false,
    };
    const invalidFigureDecisions = [
      {
        requiresQuestionFigure: true,
        solutionFigure: false,
      },
      {
        requiresQuestionFigure: true,
        solutionFigure: true,
      },
      {
        requiresQuestionFigure: false,
        solutionFigure: true,
      },
    ];

    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const schema = getGeneratedQuizOutputSchema({
        subjectKey,
        questionCount: 1,
        questionTypes: [QuestionType.TRUE_FALSE],
        difficulty: Difficulty.MEDIUM,
      });
      const question = {
        questionType: QuestionType.TRUE_FALSE,
        difficulty: Difficulty.MEDIUM,
        hint: "Đối chiếu mệnh đề với kiến thức đã học.",
        explanation: {
          problem: "Số 2 là số chẵn.",
          solution: "Số 2 chia hết cho 2. Vì vậy, mệnh đề đã cho là đúng.",
          ...(subjectKey === "MATH" ? { isGeometry: false } : {}),
        },
        figure: noFigure,
        correctAnswer: true,
      };

      expect(schema.safeParse({ questions: [question] }).success).toBe(true);
      for (const figure of invalidFigureDecisions) {
        expect(schema.safeParse({ questions: [{ ...question, figure }] }).success).toBe(
          false,
        );
      }

      const prompt = buildQuizSubjectSystemPrompt({
        key: subjectKey,
        name: subjectKey,
        slug: subjectKey.toLowerCase(),
      });
      expect(prompt).toContain("TRUE_FALSE một mệnh đề bắt buộc trả cả hai là false");
      expect(prompt).toContain(
        "ngoại lệ này không áp dụng cho MULTI_STATEMENT_TRUE_FALSE",
      );
    }
  });

  it("requires logically grouped explicit solution paragraphs across every Quiz subject", () => {
    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const prompt = buildQuizSubjectSystemPrompt({
        key: subjectKey,
        name: subjectKey,
        slug: subjectKey.toLowerCase(),
      });

      expect(prompt).toContain(
        "Trong mọi `solution` và `statementSolutions[].solution`, phải tách tường minh theo đơn vị lập luận",
      );
      expect(prompt).toContain(
        "không phụ thuộc lời giải có tính toán, biến đổi hay chỉ dùng văn xuôi, chứng minh hoặc giải thích",
      );
      expect(prompt).toContain("Ranh giới đoạn phải hợp lý về logic và trình bày");
      expect(prompt).toContain("một đơn vị lập luận ngắn thì giữ trong một đoạn");
      expect(prompt).toContain("`\\n\\n`");
      expect(prompt).toContain(
        "dù bắt đầu bằng `Vậy`, `Vì vậy`, `Do đó`, `Suy ra` hay không có từ nối",
      );
      expect(prompt).not.toContain(
        "Không tách riêng các từ nối `vì`, `nên`, `do đó` thành đoạn văn",
      );
    }

    const schemaDescriptions = collectJsonSchemaDescriptions(
      resolveAiStructuredTextFormat(
        getGeneratedQuizOutputSchema({ subjectKey: "GENERAL" }),
        "generated_quiz",
        "ref_v2",
      ).format.schema,
    );
    const solutionDescription = schemaDescriptions.find((description) =>
      description.startsWith("Lời giải đầy đủ cho đúng câu hỏi hiện tại"),
    );

    expect(solutionDescription).toContain("tuân thủ các quy tắc");
    expect(solutionDescription).not.toContain("Ranh giới đoạn phải hợp lý");
  });

  it("keeps source-grounded creativity compatible with every Quiz subject and question type", () => {
    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const prompt = buildQuizSubjectSystemPrompt({
        key: subjectKey,
        name: subjectKey,
        slug: subjectKey.toLowerCase(),
      });

      expect(prompt).toContain("PDF nguồn xác định biên kiến thức và kỹ năng");
      expect(prompt).toContain("không phải danh sách mẫu bài phải sao chép");
      expect(prompt).toContain("Với từ hai câu trở lên, ít nhất một câu");
      expect(prompt).toContain(
        "Phải loại bỏ và biên soạn lại câu dự kiến nếu nó giữ nguyên hoặc tương đương gần như toàn bộ chữ ký này",
      );
      expect(prompt).toContain(
        "Không ánh xạ một-một hoặc chuyển đổi máy móc một ví dụ/bài tập nguồn sang mọi loại câu",
      );
      expect(prompt).toContain(
        "câu kết luận cuối của từng `statementSolutions[i].solution` phải khớp đúng `statements[i].value`",
      );
      expect(prompt).toContain("Bao phủ các phần nội dung và dạng bài đều nhất có thể");
      expect(prompt).toContain("nếu số câu đủ thì mỗi phần và dạng có ít nhất một câu");
      expect(prompt).toContain(
        "nếu số câu không đủ thì không lặp khi vẫn còn phần hoặc dạng phù hợp chưa có câu",
      );
      expect(prompt).toContain(
        "không được làm mất một phần nội dung chính, một dạng bài cần có để bao phủ PDF",
      );
      expect(prompt).toContain(
        "câu ứng dụng thực tế mới được sáng tạo từ họ bài ứng dụng",
      );
      expect(prompt).toContain(
        "câu chỉ nêu một hình, vật, chất, đại lượng hoặc hệ chuyên môn trừu tượng kèm số đo/đơn vị",
      );
      expect(prompt).toContain(
        "chỉ đặt `sourceHasAssessableRealWorldApplication=true` khi họ bài trong nguồn vừa đạt định nghĩa thực tế vừa buộc dùng một trọng tâm của lesson hiện tại",
      );
      expect(prompt).toContain(
        "Mỗi câu chỉ hợp lệ khi buộc dùng ít nhất một trọng tâm của bài hiện tại",
      );
      expect(prompt).toContain(
        "nếu câu vẫn được giải nguyên vẹn chỉ bằng các kiến thức học sinh đã học trước đó thì phải loại",
      );
      expect(prompt).toContain(
        "các mục tiêu ôn tập được nêu trong nguồn chính là trọng tâm hiện tại",
      );
      expect(prompt).toContain(
        "các kiến thức học sinh đã được học trước đó ở cùng khối hoặc khối dưới",
      );
      expect(prompt).toContain(
        "Việc dùng các kiến thức đã được học trước đó không thay thế yêu cầu mỗi câu phải liên quan trực tiếp đến nội dung lesson",
      );
      expect(prompt).toContain("không phải lý do để xóa coverage bắt buộc");
    }
  });

  it("requires real reasoning depth for EASY, MEDIUM, and HARD across every Quiz subject", () => {
    const subjectSpecificHardEvidence = {
      MATH: "một công thức hoặc một định lý rồi thực hiện phép tính quen thuộc không được gắn HARD",
      PHYSICS:
        "một đại lượng, trạng thái hoặc nhận xét trung gian không được cho sẵn trong đề",
      CHEMISTRY:
        "một lượng chất, chất trung gian, điều kiện hoặc nhận xét trung gian không được cho sẵn trong đề",
      GENERAL:
        "chỉ nhớ một sự kiện, định nghĩa hoặc quy tắc rồi kết luận trực tiếp không được gắn HARD",
    } as const;

    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const prompt = buildQuizSubjectSystemPrompt({
        key: subjectKey,
        name: subjectKey,
        slug: subjectKey.toLowerCase(),
      });

      expect(prompt).toContain("cách giải đúng ngắn nhất");
      if (subjectKey !== "GENERAL") {
        expect(prompt).toContain("Một lần thay số rồi tính vẫn là EASY");
      }
      expect(prompt).toContain("ít nhất hai bước suy luận");
      expect(prompt).toContain("bước trước được dùng cho bước sau");
      expect(prompt).toContain("ít nhất ba bước suy luận");
      expect(prompt).toContain(
        "gồm kiến thức của lesson hiện tại cùng các kiến thức học sinh đã được học trước đó",
      );
      expect(prompt).toContain("nhiều mệnh đề dễ");
      expect(prompt).toContain("không giữ nguyên rồi đổi nhãn");
      expect(prompt).toContain(subjectSpecificHardEvidence[subjectKey]);
      expect(prompt).not.toContain(
        "MEDIUM cần kết nối từ hai bước hoặc lựa chọn cách làm",
      );
      expect(prompt).not.toContain("xử lý tình huống dễ nhầm");
    }
  });

  it("keeps figure decisions available for MULTI_STATEMENT_TRUE_FALSE", () => {
    const schema = getGeneratedQuizOutputSchema({
      subjectKey: "GENERAL",
      questionCount: 1,
      questionTypes: [QuestionType.MULTI_STATEMENT_TRUE_FALSE],
      difficulty: Difficulty.MEDIUM,
    });

    expect(
      schema.safeParse({
        questions: [
          {
            questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
            difficulty: Difficulty.MEDIUM,
            hint: "Xét từng mệnh đề theo bối cảnh chung.",
            explanation: {
              problem: "Cho một cấu hình chung cần quan sát.",
              statementSolutions: [
                {
                  statementId: "a",
                  solution: "Lập luận cho câu a.\n\nVậy câu a) đúng.",
                },
                {
                  statementId: "b",
                  solution: "Lập luận cho câu b.\n\nVậy câu b) sai.",
                },
              ],
            },
            figure: {
              requiresQuestionFigure: true,
              solutionFigure: false,
            },
            statements: [
              { id: "a", text: "Mệnh đề thứ nhất.", value: true },
              { id: "b", text: "Mệnh đề thứ hai.", value: false },
            ],
          },
        ],
      }).success,
    ).toBe(true);
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
        isGeometry: false,
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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
        requiresQuestionFigure: false,
        solutionFigure: false,
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
    expect(mapped.explanationBlock).not.toHaveProperty("answer");
    expect(mapped.correctAnswerJson).toEqual([
      { statementId: "a", value: true },
      { statementId: "b", value: false },
    ]);
    expect(JSON.stringify(mapped.explanationJson)).toContain("Đáp án: a) Đúng.");
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
        requiresQuestionFigure: false,
        solutionFigure: false,
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
      }).solution,
    ).toBe("Lập luận.\n\nVậy kết quả cần tìm bằng 4.");
  });

  it("builds the displayed multiple-choice answer from the grading authority", () => {
    const mapped = mapGeneratedQuizQuestion({
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.EASY,
      hint: "Đọc các hệ số của tham số.",
      explanation: {
        problem: "Chọn một vectơ chỉ phương của đường thẳng.",
        solution: "Các hệ số của tham số lần lượt là $4,-1,2$, nên chọn B.",
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
      },
      options: [
        { id: "A", text: "$\\vec{u}=(-2;1;3)$" },
        { id: "B", text: "$\\vec{u}=(4;-1;2)$" },
      ],
      correctOptionId: "B",
    });

    expect(mapped.explanationBlock).not.toHaveProperty("answer");
    expect(mapped.correctAnswerJson).toEqual(["B"]);
    expect(JSON.stringify(mapped.explanationJson)).toContain("Đáp án: B.");
  });

  it("validates exactly two independent figure-decision booleans", () => {
    const bothFigures = {
      requiresQuestionFigure: true,
      solutionFigure: true,
    };
    expect(quizFigureDecisionSchema.safeParse(bothFigures).success).toBe(true);
    expect(
      quizFigureDecisionSchema.safeParse({
        ...bothFigures,
        requiresQuestionFigure: {},
      }).success,
    ).toBe(false);
    expect(
      quizFigureDecisionSchema.safeParse({
        requiresQuestionFigure: true,
        solutionFigure: false,
      }).success,
    ).toBe(true);
    expect(
      quizFigureDecisionSchema.safeParse({
        requiresQuestionFigure: false,
        solutionFigure: true,
      }).success,
    ).toBe(true);
    expect(
      quizFigureDecisionSchema.safeParse({
        requiresQuestionFigure: true,
        solutionFigure: "yes",
      }).success,
    ).toBe(false);
    expect(
      quizFigureDecisionSchema.safeParse({
        ...bothFigures,
        solutionFigurePlan: { addedObjects: ["AH"] },
      }).success,
    ).toBe(false);
    expect(
      quizFigureDecisionSchema.safeParse({
        ...bothFigures,
        solutionFigureMode: "EXTEND_QUESTION",
      }).success,
    ).toBe(false);
  });

  it("migrates legacy reused figures before replacing the database enum", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260824150000_quiz_solution_figure_redraw_mode/migration.sql",
      ),
      "utf8",
    );
    const legacyUpdateIndex = migration.indexOf(
      "WHERE \"solution_figure_mode\" = 'REUSE_QUESTION'",
    );
    const replacementEnumIndex = migration.indexOf(
      'CREATE TYPE "QuizSolutionFigureMode_new"',
    );

    expect(migration.trimStart().startsWith("BEGIN;")).toBe(true);
    expect(legacyUpdateIndex).toBeGreaterThan(-1);
    expect(replacementEnumIndex).toBeGreaterThan(legacyUpdateIndex);
    expect(migration).toContain("'NONE',\n  'EXTEND_QUESTION',\n  'REDRAW_AS_MODEL'");
    expect(migration.trimEnd().endsWith("COMMIT;")).toBe(true);
  });

  it("removes solution modes and question lineage without deleting figure artifacts", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/20260828120000_independent_quiz_solution_figures/migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain("'version', 2");
    expect(migration).toContain("'role', 'SOLUTION'");
    expect(migration).toContain('DROP COLUMN "derived_from_question_revision_id"');
    expect(migration).toContain('DROP COLUMN "solution_figure_mode"');
    expect(migration).toContain('DROP TYPE "QuizSolutionFigureMode"');
    expect(migration).not.toMatch(/DELETE\s+FROM/iu);
    expect(migration).not.toMatch(/DROP\s+TABLE/iu);
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
    expect(request.systemPrompt).toContain(
      "học liệu chính thức và đáng tin cậy của buổi học",
    );
    expect(request.systemPrompt).toContain(
      "nội dung học liệu cần đọc và hiểu theo ngữ cảnh",
    );
    expect(request.systemPrompt).toContain(
      "ví dụ đã giải, bài tập, câu hỏi ôn tập và bài vận dụng",
    );
    expect(request.systemPrompt).toContain("điền lần lượt đúng số vị trí được yêu cầu");
    expect(request.systemPrompt).toContain("chỉ chọn chữ ký chưa dùng");
    expect(request.systemPrompt).toContain(
      "không phải danh sách mẫu bài phải sao chép hoặc ánh xạ một-một",
    );
    expect(request.systemPrompt).toContain(
      "nếu số câu đủ thì mỗi phần và dạng có ít nhất một câu",
    );
    expect(request.systemPrompt).toContain(
      "nếu số câu không đủ thì không lặp khi vẫn còn phần hoặc dạng phù hợp chưa có câu",
    );
    expect(request.systemPrompt).toContain(
      "không trả chữ ký hay kế hoạch phân bổ trong output",
    );
    expect(request.systemPrompt).toContain("không phải lý do để xóa coverage bắt buộc");
    expect(request.systemPrompt).toContain(
      "tự đối chiếu câu dự kiến đó với từng ví dụ đã giải",
    );
    expect(request.systemPrompt).toContain("chữ ký nội dung của mỗi cặp");
    expect(request.systemPrompt).toContain("thêm yêu cầu làm tròn");
    expect(request.systemPrompt).toContain(
      "phải thay đổi thật sự ít nhất hai chiều trong bốn chiều",
    );
    expect(request.systemPrompt).toContain("Ví dụ không hợp lệ theo mẫu tổng quát");
    expect(request.systemPrompt).toContain("Counterexample hợp lệ theo mẫu tổng quát");
    expect(request.systemPrompt).toContain("phải bỏ câu đó và biên soạn một câu mới");
    expect(request.systemPrompt).toContain(
      "Coverage ứng dụng thực tế là một trục độc lập",
    );
    expect(request.systemPrompt).toContain(
      "output bắt buộc phải có ít nhất một câu ứng dụng thực tế mới",
    );
    expect(request.systemPrompt).toContain(
      "Phải giữ trước ít nhất một vị trí cho dạng này",
    );
    expect(request.systemPrompt).toContain(
      "Không được gộp mất bài thực tế vào bài chuẩn",
    );
    expect(request.systemPrompt).toContain("không tái sử dụng bối cảnh đặc thù");
    expect(request.systemPrompt).toContain(
      "quy tắc tính mới không được xóa nghĩa vụ tối thiểu về ứng dụng thực tế",
    );
    expect(request.systemPrompt).toContain(
      "nếu nguồn có bài thực tế phù hợp mà output chưa có câu thực tế",
    );
    expect(request.systemPrompt).toContain(
      "Nếu PDF không có bài ứng dụng thực tế có thể đánh giá",
    );
    expect(request.systemPrompt).toContain(QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY);
    expect(request.systemPrompt).toContain("thuộc khối lớp cao hơn");
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
    expect(request.userPrompt).not.toContain("KIỂM TRA CUỐI VỀ TÍNH MỚI CẤU TRÚC");
    expect(request.userPrompt).not.toContain("candidate");
    expect(request.systemPrompt).toContain("chỉ với mỗi câu đã được chọn vào output");
    expect(request.systemPrompt).toContain("không giải lại riêng cho từng dữ kiện");
    expect(request.systemPrompt).toContain("Không tạo pool ứng viên lớn");
    expect(request.promptVersion).toBe("quiz-math-v85-independent-solution-figure");
    expect(request.schemaVersion).toBe(
      "quiz-pdf-figure-schema-v37-independent-solution-figure",
    );
    expect(request.promptVersion).toBe(QUIZ_PROMPT_VERSIONS.MATH);
    expect(request.schemaVersion).toBe(QUIZ_SCHEMA_VERSION);
    expect(request.systemPrompt).toContain(QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY);
    expect(request.systemPrompt).toContain(
      QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
    );
    expect(request.systemPrompt).toContain(QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY);
    expect(request.systemPrompt).toContain(
      "`requiresQuestionFigure` là cờ boolean quyết định có tạo hình xuất hiện trước khi học sinh trả lời hay không",
    );
    expect(request.systemPrompt).toContain("Phase 1 chỉ trả hai boolean độc lập");
    expect(request.systemPrompt).not.toContain("caption");
    expect(request.systemPrompt).toContain(
      "các `statements` là nội dung cần đánh giá, không phải dữ kiện",
    );
    expect(request.systemPrompt).toContain("kiểm kê nội bộ");
    expect(request.systemPrompt).toContain("Đặt `solutionFigure=true` khi và chỉ khi");
    expect(request.systemPrompt).toContain("solution dựng thêm AH vuông góc BC");
    expect(request.systemPrompt).toContain(
      "điểm/tâm/chân đường mới, đoạn/đường/tia/vector phụ",
    );
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
        "- Loại câu hỏi: chỉ dùng TRUE_FALSE; phân bổ chính xác TRUE_FALSE=1.",
      ].join("\n"),
    );
    expect(request.inputFiles?.[0]).toMatchObject({
      filename: "quiz-source.pdf",
      mimeType: "application/pdf",
      detail: "high",
    });
    expect(request.inputTextItems).toBeUndefined();
    expect(request.systemPrompt).toContain("Phase 1 chỉ trả hai boolean độc lập");
    expect(request.systemPrompt).toContain(
      "Riêng TRUE_FALSE một mệnh đề bắt buộc trả cả hai là false",
    );
    expect(request.systemPrompt).toContain(
      "Nếu `isGeometry=true` và câu có cấu hình cụ thể",
    );
    expect(request.systemPrompt).toContain(
      "mặc định phải đặt `requiresQuestionFigure=true`",
    );
    expect(request.systemPrompt).toContain(
      "không được trả mọi `requiresQuestionFigure=false`",
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
    expect(request.systemPrompt).toContain("`hint` không được bổ sung dữ kiện mới");
    expect(request.systemPrompt).toContain(
      "bắt buộc so sánh trực tiếp solution với problem",
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
      "riêng MULTI_STATEMENT_TRUE_FALSE có `problem` và `statementSolutions`, không có `solution` chung",
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
      "Đáp án cuối được dựng từ `statements[].value`",
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
      "Không trả `explanation.answer` hoặc field `answer`",
    );
    expect(request.systemPrompt).toContain("# SYSTEM PROMPT QUIZ MÔN TOÁN");
    expect(request.systemPrompt).not.toContain("SYSTEM PROMPT QUIZ MÔN VẬT LÝ");
    expect(request.systemPrompt).not.toContain("SYSTEM PROMPT QUIZ MÔN HÓA HỌC");

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
    expect(physicsRequest.systemPrompt).not.toContain("đồ thị hàm số");
    expect(physicsRequest.systemPrompt).not.toContain("bảng biến thiên");
    expect(physicsRequest.systemPrompt).toContain("topology/cực/chiều của mạch");
    expect(physicsRequest.systemPrompt).toContain("# SYSTEM PROMPT QUIZ MÔN VẬT LÝ");
    expect(physicsRequest.systemPrompt).not.toContain("SYSTEM PROMPT QUIZ MÔN TOÁN");
    expect(physicsRequest.systemPrompt).not.toContain("SYSTEM PROMPT QUIZ MÔN HÓA HỌC");
    expect(physicsRequest.systemPrompt).not.toContain("$\\widehat{ABC}$");
    expect(physicsRequest.promptVersion).toBe(
      "quiz-physics-v80-independent-solution-figure",
    );

    const chemistryRequest = buildQuizStructuredInput({
      lessonId: "lesson-chemistry-core",
      lessonTitle: "Phản ứng hóa học",
      documentIds: [documentId],
      sourceHash,
      packet: {
        filename: "chemistry-source.pdf",
        bytes: Buffer.from("pdf-fixture"),
      },
      configuration: {
        ...requestConfiguration(),
        subjectKey: "CHEMISTRY",
        subjectName: "Hóa học",
        subjectSlug: "hoa-hoc",
      },
    });
    expect(chemistryRequest.systemPrompt).toContain("# SYSTEM PROMPT QUIZ MÔN HÓA HỌC");
    expect(chemistryRequest.systemPrompt).not.toContain("SYSTEM PROMPT QUIZ MÔN TOÁN");
    expect(chemistryRequest.systemPrompt).not.toContain("SYSTEM PROMPT QUIZ MÔN VẬT LÝ");
    expect(chemistryRequest.systemPrompt).not.toContain("isGeometry");
    expect(chemistryRequest.systemPrompt).not.toContain("$\\widehat{ABC}$");
    expect(chemistryRequest.systemPrompt).not.toContain("đồ thị hàm số");
    expect(chemistryRequest.systemPrompt).not.toContain("vector hoặc lực");
    expect(chemistryRequest.systemPrompt).toContain("hình học phân tử");
    expect(chemistryRequest.promptVersion).toBe(
      "quiz-chemistry-v80-independent-solution-figure",
    );
  });

  it.each([
    ["Đại số", "Hệ phương trình và bài toán lập hệ"],
    ["Hình học", "Đường tròn và mô hình đo đạc"],
    ["Thống kê", "Thống kê và biểu đồ dữ liệu"],
  ])("keeps source-family coverage invariant for %s", (_domain, lessonTitle) => {
    const request = buildQuizStructuredInput({
      lessonId: `lesson-${_domain}`,
      lessonTitle,
      documentIds: [documentId],
      sourceHash,
      packet: {
        filename: "math-domain-source.pdf",
        bytes: Buffer.from("pdf-fixture"),
      },
      configuration: {
        ...requestConfiguration(),
        questionCount: 6,
        questionTypes: [
          QuestionType.MULTIPLE_CHOICE,
          QuestionType.TRUE_FALSE,
          QuestionType.MULTI_STATEMENT_TRUE_FALSE,
          QuestionType.TEXT_INPUT,
        ],
      },
    });

    expect(request.userPrompt).not.toContain("KIỂM TRA CUỐI VỀ ĐA DẠNG CẤU TRÚC");
    expect(request.userPrompt).not.toContain("candidate");
    expect(request.userPrompt).toContain(
      "phân bổ chính xác MULTIPLE_CHOICE=2, TRUE_FALSE=2, MULTI_STATEMENT_TRUE_FALSE=1, TEXT_INPUT=1",
    );
    expect(request.systemPrompt).toContain("Không tạo pool ứng viên lớn");
    expect(request.systemPrompt).toContain("không so lại toàn bộ mọi cặp");
    expect(request.systemPrompt).toContain(
      "nếu số câu đủ thì mỗi phần và dạng có ít nhất một câu",
    );
    expect(request.systemPrompt).toContain(
      "nếu số câu không đủ thì không lặp khi vẫn còn phần hoặc dạng phù hợp chưa có câu",
    );
    expect(request.systemPrompt).toContain(
      "chỉ gắn tên một vật thể trang trí vào bài thuần túy không đủ",
    );
    expect(request.systemPrompt).toContain(
      "Nếu PDF không có bài ứng dụng thực tế có thể đánh giá",
    );
    expect(request.systemPrompt).toContain(
      "bỏ toàn bộ trọng tâm của bài hiện tại khỏi cách giải",
    );
    expect(request.systemPrompt).toContain(
      "vẫn được giải nguyên vẹn chỉ bằng các kiến thức học sinh đã học trước đó",
    );
    expect(request.systemPrompt).toContain("lesson được nêu rõ là ôn tập hoặc luyện tập");
    expect(request.systemPrompt).toContain(
      "Một bài vận dụng có sẵn trong PDF nhưng vẫn giải được nguyên vẹn chỉ bằng kiến thức đã học trước đó không được tính",
    );
    expect(request.systemPrompt).toContain(
      "chỉ đặt `sourceHasAssessableRealWorldApplication=true` khi họ bài trong nguồn vừa đạt định nghĩa thực tế vừa buộc dùng một trọng tâm của lesson hiện tại",
    );
    expect(request.systemPrompt).toContain(
      "phải viết công thức gốc trước, sau đó biến đổi công thức, rồi mới thay số",
    );
    expect(request.userPrompt).toContain(lessonTitle);
  });

  it("requires structural novelty across every default Quiz subject without forcing it outside the lesson boundary", () => {
    const subjects = [
      { key: "MATH" as const, name: "Toán", slug: "toan" },
      { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly" },
      { key: "CHEMISTRY" as const, name: "Hóa học", slug: "hoa-hoc" },
      { key: "GENERAL" as const, name: "Ngữ văn", slug: "ngu-van" },
    ];

    for (const subject of subjects) {
      const prompt = buildQuizSubjectSystemPrompt(subject);

      expect(prompt).toContain("Với từ hai câu trở lên, ít nhất một câu");
      expect(prompt).toContain("khung nhiệm vụ hoặc mạch suy luận chính chưa xuất hiện");
      expect(prompt).toContain("chỉ chọn chữ ký chưa dùng");
      expect(prompt).toContain("Không tạo pool ứng viên lớn");
      expect(prompt).toContain("không so lại toàn bộ mọi cặp");
      expect(prompt).toContain("chiều hỏi-tìm");
      expect(prompt).toContain("nối thêm phép tính phụ");
      expect(prompt).toContain(
        "Chỉ lặp nhóm khi lesson thật sự không còn nhóm hợp lệ khác",
      );
      expect(prompt).not.toContain("Được chủ động biên soạn dạng bài mới");
    }
  });

  it("requires an independent mathematical verification before grading data is emitted", () => {
    const prompt = buildQuizSubjectSystemPrompt({
      key: "MATH",
      name: "Toán",
      slug: "toan",
    });

    expect(prompt).toContain("CƠ CHẾ KIỂM CHỨNG TOÁN HỌC BẮT BUỘC");
    expect(prompt).toContain("tự giải từng câu từ dữ kiện gốc");
    expect(prompt).toContain(
      "kiểm tra đủ toàn bộ giả thiết của nó trên đúng cấu hình đang xét",
    );
    expect(prompt).toContain("ít nhất một phép kiểm tra độc lập");
    expect(prompt).toContain("kiểm tra cận trên/cận dưới hoặc trường hợp biên");
    expect(prompt).toContain(
      "phải xác định kết quả đúng trước rồi mới đối chiếu với `options`",
    );
    expect(prompt).toContain(
      "không chứng minh chúng đúng nếu tất cả cùng dựa trên một giả định sai",
    );
    expect(prompt).toContain(
      "chỉ vì một số đỉnh của một hình chữ nhật nằm trên đường tròn hoặc cung tròn",
    );
    expect(prompt).toContain("cả bốn đỉnh cùng nằm trên một đường tròn");
    expect(prompt).toContain("số đo lớn hơn là chiều dài");
    expect(prompt).toContain("đường cao, khoảng cách vuông góc");
    expect(prompt).toContain("kích thước của hình khối");
    expect(prompt).not.toContain("10 dm");
    expect(prompt).not.toContain("24 dm");
    expect(prompt).not.toContain("13 dm");
  });

  it("requires Math conclusions to cite numbered intermediate results when reused", () => {
    const prompt = buildQuizSubjectSystemPrompt({
      key: "MATH",
      name: "Toán",
      slug: "toan",
    });

    expect(prompt).toContain("Từ (1) và (2), suy ra");
    expect(prompt).toContain("Từ căn cứ thứ nhất, suy ra $P$.`");
    expect(prompt).not.toContain("Từ căn cứ thứ nhất, suy ra $P$. (1)");
    expect(prompt).toContain("mọi nhãn đã gắn phải được viện dẫn ít nhất một lần");
    expect(prompt).toContain("không đặt hai kết luận mang nhãn cùng dòng");
    expect(prompt).toContain("Nếu mạch là $A\\Rightarrow B$");
    expect(prompt).toContain("bỏ mọi nhãn không có tham chiếu về sau");
    expect(prompt).toContain("Từ căn cứ thứ hai, suy ra $Q=k$. (1)");
    expect(prompt).toContain("Theo định lý, suy ra $Q=R$.");
    expect(prompt).toContain("Từ (1), suy ra $R=k$.");
    expect(prompt).toMatch(/Q=R\$.+`\n\n\s+`Từ \(1\)/u);
    expect(prompt).not.toContain("góc C = D");
  });

  it("keeps rectangle terminology stable while Quiz lesson data remains dynamic", () => {
    const buildRequest = (lessonId: string, lessonTitle: string) =>
      buildQuizStructuredInput({
        lessonId,
        lessonTitle,
        documentIds: [documentId],
        sourceHash,
        packet: {
          filename: "quiz-source.pdf",
          bytes: Buffer.from("pdf-fixture"),
        },
        configuration: {
          ...requestConfiguration(),
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          questionCount: 1,
          difficulty: Difficulty.EASY,
          difficultyCounts: null,
          questionTypes: [QuestionType.TEXT_INPUT],
          style: "student_friendly",
          styleInstructions: "",
        },
      });
    const first = buildRequest("lesson-rectangle-perimeter", "Chu vi hình chữ nhật");
    const second = buildRequest("lesson-rectangle-area", "Diện tích hình chữ nhật");

    expect(first.systemPrompt).toBe(second.systemPrompt);
    expect(first.systemPrompt).toContain("số đo lớn hơn là chiều dài");
    expect(first.userPrompt).not.toBe(second.userPrompt);
    expect(first.promptVersion).toBe("quiz-math-v85-independent-solution-figure");
    expect(second.promptVersion).toBe(first.promptVersion);
  });

  it("requires subject-specific independent verification for every non-Math Quiz prompt", () => {
    const cases = [
      {
        subject: {
          key: "PHYSICS" as const,
          name: "Vật lý",
          slug: "vat-ly",
        },
        heading: "CƠ CHẾ KIỂM CHỨNG VẬT LÝ BẮT BUỘC",
        requiredVocabulary: [
          "hệ quy chiếu",
          "phân tích thứ nguyên và đơn vị",
          "tính khả thi vật lý",
        ],
        forbiddenVocabulary: ["hóa trị/số oxi hóa", "bảo toàn nguyên tố"],
      },
      {
        subject: {
          key: "CHEMISTRY" as const,
          name: "Hóa học",
          slug: "hoa-hoc",
        },
        heading: "CƠ CHẾ KIỂM CHỨNG HÓA HỌC BẮT BUỘC",
        requiredVocabulary: [
          "hóa trị/số oxi hóa",
          "bảo toàn nguyên tố và điện tích",
          "chất giới hạn",
        ],
        forbiddenVocabulary: ["hệ quy chiếu", "phân tích thứ nguyên"],
      },
      {
        subject: {
          key: "GENERAL" as const,
          name: "Ngữ văn",
          slug: "ngu-van",
        },
        heading: "CƠ CHẾ KIỂM CHỨNG CHUYÊN MÔN BẮT BUỘC",
        requiredVocabulary: [
          "đối chiếu ngược từng kết luận với dữ kiện và PDF nguồn",
          "thử một phản ví dụ hoặc trường hợp biên",
          "không biến tương quan thành nhân quả",
        ],
        forbiddenVocabulary: ["hóa trị/số oxi hóa", "hệ quy chiếu"],
      },
    ];

    for (const testCase of cases) {
      const prompt = buildQuizSubjectSystemPrompt(testCase.subject);

      expect(prompt).toContain(testCase.heading);
      expect(prompt).toContain("tự giải từng câu từ dữ kiện gốc");
      expect(prompt).toContain("ít nhất một phép kiểm tra độc lập");
      expect(prompt).toContain("Không chỉ đọc lại");
      expect(prompt).toContain(
        "phải xác định kết quả đúng trước rồi mới đối chiếu với `options`",
      );
      expect(prompt).toContain("phải kiểm chứng riêng từng mệnh đề");
      expect(prompt).toContain(
        "Sự nhất quán giữa `options`, `correctOptionId`, `solution` không chứng minh chúng đúng",
      );
      expect(prompt).toContain("không được trả câu đó");
      for (const vocabulary of testCase.requiredVocabulary) {
        expect(prompt).toContain(vocabulary);
      }
      for (const vocabulary of testCase.forbiddenVocabulary) {
        expect(prompt).not.toContain(vocabulary);
      }
    }

    expect(QUIZ_PROMPT_VERSIONS.PHYSICS).toBe(
      "quiz-physics-v80-independent-solution-figure",
    );
    expect(QUIZ_PROMPT_VERSIONS.CHEMISTRY).toBe(
      "quiz-chemistry-v80-independent-solution-figure",
    );
    expect(QUIZ_PROMPT_VERSIONS.GENERAL).toBe(
      "quiz-general-v80-independent-solution-figure",
    );
  });

  it("shows safe raw-JSON and decoded LaTeX examples in every subject prompt", () => {
    const subjects = [
      { key: "MATH" as const, name: "Toán", slug: "toan" },
      { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly" },
      { key: "CHEMISTRY" as const, name: "Hóa học", slug: "hoa-hoc" },
      { key: "GENERAL" as const, name: "Ngữ văn", slug: "ngu-van" },
    ];

    for (const subject of subjects) {
      const prompt = buildQuizSubjectSystemPrompt(subject);

      expect(prompt).toContain(String.raw`{"problem":"$\\widehat{A}=76^\\circ$"}`);
      expect(prompt).toContain(String.raw`$\widehat{A}=76^\circ$`);
      expect(prompt).toContain(String.raw`\u001cwidehat`);
      expect(prompt).toContain(String.raw`\\u001cwidehat`);
      expect(prompt).toContain("`problem`, `solution`, `statementSolutions[].solution`");
      expect(prompt).not.toContain(String.fromCharCode(28));
    }
  });

  it("shows a correct original-formula example in every subject prompt and solution schema", () => {
    const cases = [
      {
        subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
        requiredRule:
          "phải viết công thức gốc trước, sau đó biến đổi công thức, rồi mới thay số",
        correctExample: String.raw`\widehat{A}+\widehat{C}&=180^\circ`,
        wrongExample: String.raw`\widehat{C}=180^\circ-\widehat{A}`,
      },
      {
        subject: { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly" },
        requiredRule:
          "phải viết công thức gốc trước, sau đó biến đổi công thức, rồi mới thay số",
        correctExample: String.raw`F&=ma\\m&=\frac{F}{a}`,
        wrongExample: String.raw`$m=F/a$`,
      },
      {
        subject: { key: "CHEMISTRY" as const, name: "Hóa học", slug: "hoa-hoc" },
        requiredRule:
          "phải viết công thức hoặc tỉ lệ gốc trước, sau đó biến đổi, rồi mới thay số và đơn vị",
        correctExample: String.raw`\frac{n_A}{a}&=\frac{n_B}{b}`,
        wrongExample: String.raw`$n_B=bn_A/a$`,
      },
      {
        subject: { key: "GENERAL" as const, name: "Môn chung", slug: "general" },
        requiredRule:
          "phải viết công thức gốc trước, sau đó biến đổi công thức, rồi mới thay số",
        correctExample: String.raw`p+q&=s\\q&=s-p`,
        wrongExample: String.raw`$q=s-p$`,
      },
    ];

    for (const testCase of cases) {
      const prompt = buildQuizSubjectSystemPrompt(testCase.subject);

      expect(prompt).toContain("QUY TẮC CỨNG VỀ CÔNG THỨC GỐC");
      expect(prompt).toContain(testCase.requiredRule);
      expect(prompt).toContain("Ví dụ SAI:");
      expect(prompt).toContain("Ví dụ ĐÚNG:");
      expect(prompt).toContain(testCase.correctExample);
      expect(prompt).toContain(testCase.wrongExample);
      expect(prompt).toContain("Nếu công thức gốc đã có sẵn đại lượng cần tìm ở một vế");
    }

    const schemaJson = JSON.stringify(
      buildAiStructuredTextFormat(
        getGeneratedQuizOutputSchema({
          subjectKey: "MATH",
          targetGrade: 9,
          questionCount: 1,
          questionTypes: [QuestionType.MULTIPLE_CHOICE],
          difficulty: Difficulty.MEDIUM,
        }),
        "generated_quiz",
      ).schema,
    );
    expect(schemaJson).not.toContain(QUIZ_ORIGINAL_FORMULA_STEP_POLICY);
    expect(schemaJson).toContain("tuân thủ các quy tắc nội dung, lập luận, định dạng");
  });

  it("keeps Physics and Chemistry provider schemas free of Math-only figure vocabulary", () => {
    for (const subjectKey of ["PHYSICS", "CHEMISTRY"] as const) {
      const schema = JSON.stringify(
        buildAiStructuredTextFormat(
          getGeneratedQuizOutputSchema({
            subjectKey,
            targetGrade: 9,
            questionCount: 1,
            questionTypes: [QuestionType.TRUE_FALSE],
            difficulty: Difficulty.MEDIUM,
          }),
          "generated_quiz",
        ),
      );

      expect(schema).not.toContain("isGeometry");
      expect(schema).not.toContain("Câu Hình học có cấu hình cụ thể");
      expect(schema).not.toContain("Câu Đại số");
      expect(schema).not.toContain("mô hình toán học");
      expect(schema).toContain("policy của đúng môn");
      expect(schema).toContain(
        "TRUE_FALSE chỉ có một mệnh đề nên không tạo hình đề hoặc hình lời giải",
      );
    }
  });

  it("keeps geometry classification and permits no figure for a general-formula counterexample", () => {
    const baseQuestion = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Đối chiếu với công thức diện tích hình tròn theo bán kính.",
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
      },
      correctAnswer: true,
    };
    const geometryExplanation = {
      problem: "Diện tích hình tròn bán kính $r$ được tính bởi $S=\\pi r^2$.",
      solution: "Theo công thức diện tích hình tròn, $S=\\pi r^2$ nên khẳng định đúng.",
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
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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
      "Câu nhập đáp án có đúng một kết quả số chuẩn trong `correctAnswer`",
    );
    expect(providerSchemaJson).not.toContain(
      "`explanation.problem` bắt buộc kết thúc bằng đúng câu",
    );
    expect(
      buildQuizSubjectSystemPrompt({
        key: "GENERAL",
        name: "GENERAL",
        slug: "general",
      }),
    ).toContain("Làm tròn kết quả đến 1 chữ số thập phân.");
    expect(providerSchemaJson).toContain(
      "Đúng một đáp án số chuẩn. Chỉ dùng một trong ba dạng: số nguyên; phân số tối giản `p/q`",
    );
    const generalSystemPrompt = buildQuizSubjectSystemPrompt({
      key: "GENERAL",
      name: "GENERAL",
      slug: "general",
    });
    expect(generalSystemPrompt).toContain("QUY TẮC CỨNG VỀ CHUỖI DẤU BẰNG");
    expect(generalSystemPrompt).toContain("$$A=B=C.$$");
    expect(generalSystemPrompt).toContain("`$A=B=C$`");
    expect(generalSystemPrompt).toContain("\\begin{aligned}A&=B");
    expect(generalSystemPrompt).toContain(
      "Không nhét toàn bộ phép tính nhiều bước vào giữa một đoạn văn",
    );
    expect(providerSchemaJson).not.toContain("QUY TẮC CỨNG VỀ CHUỖI DẤU BẰNG");
    expect(providerSchemaJson).not.toContain(QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY);
    expect(providerSchemaJson).not.toContain(QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY);
    expect(providerSchemaJson).not.toContain(
      QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
    );
    expect(providerSchemaJson).not.toContain(QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY);
    for (const fieldPrefix of [
      "Phần nội dung chính của câu hỏi",
      "Gợi ý cho đúng câu hỏi hiện tại",
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
    expect(providerSchemaDescriptions[0]).not.toContain(QUIZ_SUBPART_LINEBREAK_POLICY);
    expect(providerSchemaDescriptions[0]).not.toContain(QUIZ_LOGICAL_DERIVATION_POLICY);
    expect(providerSchemaJson).not.toContain(QUIZ_CONCLUSION_PARAGRAPH_POLICY);
    expect(providerSchemaJson).not.toContain(QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY);
    expect(providerSchemaJson).not.toContain("QUY TẮC CỨNG VỀ MÔI TRƯỜNG LATEX");
    for (const fieldDescription of [
      "Phần nội dung chính của câu hỏi phải nêu đủ đối tượng, ký hiệu, dữ kiện và yêu cầu chuyên môn nếu dạng câu cần, để học sinh trả lời được mà không cần xem hình minh họa. Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đã được `questionType` thể hiện.",
      "Lời giải đầy đủ cho đúng câu hỏi hiện tại, tự hiểu được khi không xem hình và tuân thủ các quy tắc nội dung, lập luận, định dạng trong system prompt.",
    ]) {
      expect(providerSchemaJson).toContain(fieldDescription);
    }
    expect(providerSchemaDescriptions).not.toContain(QUIZ_HINT_QUALITY_POLICY);
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
    expect(allQuestionTypesProviderSchemaJson).not.toContain(
      QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY,
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Câu trắc nghiệm có đúng một phương án đúng",
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
      description.startsWith("Lời giải đầy đủ cho đúng câu hỏi hiện tại"),
    );
    expect(solutionDescriptions).toHaveLength(1);
    expect(solutionDescriptions[0]).toContain("tuân thủ các quy tắc");
    expect(solutionDescriptions[0]).not.toContain(QUIZ_SUBPART_LINEBREAK_POLICY);
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
    ).toBeGreaterThan(3_000);
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Phase 1 chỉ trả hai quyết định boolean độc lập",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "solution thực sự dùng thêm ít nhất một đối tượng hoặc quan hệ có thể vẽ",
    );
    expect(allQuestionTypesProviderSchemaJson).not.toContain("solutionFigureMode");
    expect(allQuestionTypesProviderSchemaJson).not.toContain("solutionFigurePlan");
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Câu đúng/sai gồm đúng một mệnh đề",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain("Câu đúng/sai nhiều mệnh đề");
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "Một lời giải riêng cho mỗi phần tử trong `statements`",
    );
    expect(allQuestionTypesProviderSchemaJson).toContain(
      "không dùng S1/S2 hoặc số thứ tự",
    );
    expect(allQuestionTypesProviderSchemaJson).not.toContain(
      "không chuyển biểu thức thành đoạn văn dài",
    );
    expect(allQuestionTypesProviderSchemaJson).not.toContain(
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
        requiresQuestionFigure: false,
        solutionFigure: false,
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
              answer: "a) Đúng.\nb) Sai.",
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
    expect(multipleChoiceProviderSchemaJson).toContain('"correctOptionId"');
    expect(multipleChoiceProviderSchemaJson).not.toContain('"answer":{');
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
        requiresQuestionFigure: false,
        solutionFigure: false,
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
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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
      targetGrade: 8,
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
        solution: "Dựng đường cao AH rồi chứng minh hệ thức.",
      },
    });
    expect(JSON.parse(request.userPrompt)).toEqual({
      role: "QUESTION",
      mode: "REGENERATE",
      targetGrade: 8,
      problem: "Cho tam giác ABC vuông tại A.",
    });
    expect(request.userPrompt).not.toContain("caption");
    expect(request.userPrompt).not.toContain("Tam giác ABC đều");
    expect(request.userPrompt).not.toContain("Dựng đường cao AH");
    const editRequest = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC vuông tại A.",
      },
      mode: "EDIT_CURRENT",
      currentLatexSource: "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}",
      adminInstructions: "Đặt nhãn A xa cạnh hơn.",
    });
    expect(editRequest.userPrompt).toContain('"mode":"EDIT_CURRENT"');
    expect(editRequest.userPrompt).toContain('"currentLatexSource"');
    expect(editRequest.userPrompt).toContain("Đặt nhãn A xa cạnh hơn");
    expect(editRequest.systemPrompt).toContain(
      "xóa mọi nét/annotation cũ không truy được về whitelist",
    );
    expect(request.systemPrompt).toContain("tuyệt đối không chứa đáp án");
    expect(request.systemPrompt).toContain(
      "mọi đối tượng, quan hệ, ký hiệu và chú thích mang nghĩa",
    );
    expect(request.systemPrompt).toContain("không tạo ra cách hiểu sai hoặc mơ hồ");
    expect(request.systemPrompt).toContain(
      "problem là nguồn dữ kiện có thẩm quyền duy nhất",
    );
    expect(request.systemPrompt).not.toContain("caption");
    expect(request.systemPrompt).toContain(
      "lập nội bộ whitelist gồm đúng các dữ kiện được phát biểu trực tiếp",
    );
    expect(request.systemPrompt).toContain(
      "Cấm biến hệ quả suy luận thành dữ kiện nhìn thấy",
    );
    expect(request.systemPrompt).toContain(
      "nếu góc vuông chỉ suy ra từ các dữ kiện khác thì tuyệt đối không đánh dấu",
    );
    expect(request.systemPrompt).toContain(
      "đối chiếu lại từng nét mang nghĩa với whitelist của problem",
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
    expect(request.systemPrompt).toContain("gồm Hình học và trực quan Đại số");
    expect(request.systemPrompt).toContain("Cấm marker hoặc ký hiệu đánh dấu");
    expect(request.systemPrompt).toContain(
      "hướng của trục, vector, tia hoặc luồng biến đổi",
    );
    expect(request.systemPrompt).toContain("góc trong đa giác nằm phía trong đa giác");
    expect(request.systemPrompt).toContain("không lặp tên thành `AB = 3 cm`");
    expect(request.systemPrompt).toContain("Tên điểm và số đo là các nhãn riêng");
    expect(request.systemPrompt).toContain(
      "Không viết câu hoặc phương trình quan hệ giữa các đối tượng",
    );
    expect(request.systemPrompt).toContain("`AB \\parallel CD`, `AB // CD`");
    expect(request.systemPrompt).toContain(
      "cấm ghi tên góc dạng chữ như `ABC`, `DAB`, `∠ABC`",
    );
    expect(request.systemPrompt).toContain("đúng một coordinate neo ngữ nghĩa");
    expect(request.systemPrompt).toContain("ưu tiên \\pic với right angle");
    expect(request.systemPrompt).toContain("decorations.markings hoặc coordinate sloped");
    expect(request.systemPrompt).toContain("co giãn x/y không đồng nhất");
    expect(request.systemPrompt).toContain("bounding box của từng nhãn không cắt nét");
    expect(request.systemPrompt).toContain("dùng tích vô hướng cho vuông góc");
    expect(request.systemPrompt).toContain(
      "Cung góc và nhãn số đo là hai phần tử độc lập",
    );
    expect(request.systemPrompt).toContain(
      "toàn bộ bounding box, kể cả ký hiệu độ, phải tách khỏi cung và hai tia",
    );
    expect(request.systemPrompt).toContain("dịch nhãn dọc phân giác");
    expect(request.systemPrompt).toContain("không khóa một offset cho mọi góc");
    expect(request.systemPrompt).toContain(
      "`$(O)$` chỉ là cách gọi đường tròn trong văn bản đề",
    );
    expect(request.systemPrompt).toContain("bắt buộc có đúng một điểm đánh dấu");
    expect(request.systemPrompt).toContain("marker không nhãn");
    expect(request.systemPrompt).toContain(
      "phải neo vào đúng cạnh, đoạn hoặc cung sở hữu",
    );
    expect(request.systemPrompt).toContain("`node[pos=..., ...]`");
    expect(request.systemPrompt).toContain(
      "Midpoint trống là vị trí hợp lệ nhưng không bắt buộc",
    );
    expect(request.systemPrompt).toContain("trượt node dọc chính đối tượng bằng `pos`");
    expect(request.systemPrompt).toContain("bắt buộc dùng leader line mảnh");
    expect(request.systemPrompt).toContain("tuyệt đối không để nhãn đứng tự do");
    expect(request.systemPrompt).not.toContain(
      "các đường song song dùng cùng kiểu mũi tên",
    );
    expect(request.systemPrompt).toContain("Đồ thị/hệ trục/đường số/miền nghiệm");
    expect(request.systemPrompt).toContain("Bảng biến thiên/xét dấu/dữ liệu/biểu đồ");
    expect(request.promptVersion).toBe(
      "quiz-figure-math-question-v61-independent-midpoint-marker-auto-repair",
    );
    expect(request.systemPrompt).toContain("Bắt buộc dựng trước, chú thích sau");
    expect(request.systemPrompt).toContain("thành một hệ ràng buộc duy nhất");
    expect(request.systemPrompt).toContain(
      "cấm hạ một đối tượng đã được định danh thành loại hình khác",
    );
    expect(request.systemPrompt).toContain("kiểm tra lại trên chính tọa độ cuối");
    expect(request.systemPrompt).toContain("dùng thứ tự chiều kim đồng hồ");
    expect(request.systemPrompt).toContain("`angle=Prev--V--Next`");
    expect(request.systemPrompt).toContain("không tạo cạnh cắt nhau");
    expect(request.systemPrompt).toContain("sửa phép dựng, thứ tự biên/tia");
    expect(request.systemPrompt).toContain("không chỉ đổi con số hiển thị");
    expect(request.systemPrompt).toContain("không trả thêm field/báo cáo");
    expect(request.systemPrompt).toContain(
      "ký hiệu quan hệ độc lập không chồng, chạm hoặc tụ sát",
    );
    const mathSelfCheckIndex = request.systemPrompt.indexOf(
      "### CỔNG CUỐI VỀ HÌNH HỌC VÀ KHẢ NĂNG ĐỌC",
    );
    const mathRulesHeadingIndex = request.systemPrompt.indexOf(
      "### QUY TẮC HÌNH TOÁN CỦA QUIZ",
    );
    const requestContractHeadingIndex = request.systemPrompt.indexOf(
      "### HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ",
    );
    expect(mathRulesHeadingIndex).toBeGreaterThan(-1);
    expect(mathSelfCheckIndex).toBeGreaterThan(mathRulesHeadingIndex);
    expect(mathSelfCheckIndex).toBeGreaterThan(requestContractHeadingIndex);
    expect(request.systemPrompt).not.toContain("QUY CHUẨN HÌNH TOÀN HỆ THỐNG");
    expect(request.systemPrompt).toContain(
      "\n\n### QUY TẮC HÌNH TOÁN CỦA QUIZ\n- Phạm vi biểu diễn",
    );
    expect(request.systemPrompt).toContain(
      "\n\n### HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ\n- Chỉ trả structured output",
    );
    expect(
      generatedQuizQuestionFigureSchema.safeParse({
        latexSource: ["\\begin{tikzpicture}", "\\end{tikzpicture}"].join("\n"),
      }).success,
    ).toBe(true);
    expect(
      generatedQuizQuestionFigureSchema.safeParse({
        semanticChecks: [],
        latexSource: [
          "\\begin{tikzpicture}",
          "\\draw (A) -- (B) -- (C) -- cycle;",
          "\\end{tikzpicture}",
        ].join("\n"),
      }).success,
    ).toBe(false);
  });

  it("keeps Quiz figure dynamic data after the stable GPT-5.6 cache breakpoint", () => {
    const buildRequest = (problem: string) =>
      buildQuestionFigureInput({
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        plan: { version: 1, role: "QUESTION", problem },
      });
    const unnamedProblem =
      "Một khung cửa hình chữ nhật có chiều rộng 5 m và chiều dài 12 m. Tính bán kính đường tròn đi qua bốn đỉnh của khung cửa.";
    const namedProblem = "Cho tam giác PQR vuông tại P, biết PQ = 6 cm và PR = 8 cm.";
    const firstRequest = buildRequest(unnamedProblem);
    const secondRequest = buildRequest(namedProblem);
    const structuredTextFormat = {
      type: "json_schema",
      name: firstRequest.outputName,
      strict: true,
      schema: { type: "object" },
    } as const;
    const first = buildOpenAiStructuredResponseRequest({
      request: firstRequest,
      model: "gpt-5.6-luna",
      structuredTextFormat,
    });
    const second = buildOpenAiStructuredResponseRequest({
      request: secondRequest,
      model: "gpt-5.6-luna",
      structuredTextFormat,
    });

    expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
    expect(first.prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" });
    expect(Array.isArray(first.input)).toBe(true);
    expect(Array.isArray(second.input)).toBe(true);
    if (!Array.isArray(first.input) || !Array.isArray(second.input)) return;
    expect(first.input[0]).toEqual(second.input[0]);
    expect(JSON.stringify(first.input[0])).toContain("prompt_cache_breakpoint");
    expect(JSON.stringify(first.input[0])).toContain(
      "Tên hoặc nhãn định danh nhìn thấy là nội dung ngữ nghĩa",
    );
    expect(JSON.stringify(first.input[0])).toContain(
      "cấm tự gán chữ cái, chữ số hoặc tên tiện ích",
    );
    expect(JSON.stringify(first.input[0])).toContain(
      "THÀNH PHẦN TỐI THIỂU THEO HỌ HÌNH TOÁN",
    );
    expect(JSON.stringify(first.input[0])).toContain("parabol có đỉnh và một cặp");
    expect(JSON.stringify(first.input[0])).toContain(
      "một đơn vị số học trên hai trục bắt buộc có cùng độ dài render",
    );
    expect(JSON.stringify(first.input[0])).toContain(
      "chia các đoạn thành từng nhóm quan hệ bằng nhau",
    );
    const previousContract = buildOpenAiStructuredResponseRequest({
      request: {
        ...firstRequest,
        promptVersion: "quiz-figure-math-question-v50-cartesian-equal-units",
      },
      model: "gpt-5.6-luna",
      structuredTextFormat,
    });
    expect(first.prompt_cache_key).not.toBe(previousContract.prompt_cache_key);
    expect(first.input[1]).not.toEqual(second.input[1]);
    expect(JSON.stringify(first.input[1])).toContain(unnamedProblem);
    expect(JSON.stringify(second.input[1])).toContain(namedProblem);
    expect(JSON.parse(firstRequest.userPrompt).problem).toBe(unnamedProblem);
    expect(JSON.parse(secondRequest.userPrompt).problem).toBe(namedProblem);
  });

  it("builds an independent full-source solution figure from solution then problem", () => {
    const request = buildSolutionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      targetGrade: 8,
      plan: {
        version: 2,
        role: "SOLUTION",
        problem: "Cho tam giác ABC.",
        solution: "Dựng AH vuông góc BC rồi xét tam giác vuông ABH.",
      },
    });
    const payload = JSON.parse(request.userPrompt) as Record<string, unknown>;
    expect(payload).toMatchObject({
      role: "SOLUTION",
      problem: "Cho tam giác ABC.",
      solution: "Dựng AH vuông góc BC rồi xét tam giác vuông ABH.",
    });
    expect(payload).not.toHaveProperty("exactQuestionLatexSource");
    expect(payload).not.toHaveProperty("mode");
    expect(request.systemPrompt).toContain("solution là nguồn có độ ưu tiên cao nhất");
    expect(request.systemPrompt).toContain("hoàn toàn độc lập với hình đề");
    expect(request.outputName).toBe("quiz_solution_figure");
    expect(request.promptVersion).toBe(
      "quiz-figure-math-solution-v61-independent-midpoint-marker-auto-repair",
    );
    expect(
      generatedQuizSolutionFigureSchema.safeParse({
        latexSource: "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}",
      }).success,
    ).toBe(true);
  });

  it("accepts complete question and solution sources without an extension marker", () => {
    const questionSource = "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}";
    const solutionSource =
      "\\begin{tikzpicture}\\draw (0,0)--(1,0)--(0,1)--cycle;\\end{tikzpicture}";
    expect(() => assertQuizFigureLatexSource(questionSource)).not.toThrow();
    expect(() => assertQuizFigureLatexSource(solutionSource)).not.toThrow();
  });

  it("keeps solution dynamic data after the stable cache prefix", () => {
    const first = buildSolutionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: { version: 2, role: "SOLUTION", problem: "Đề A", solution: "Dựng AH." },
    });
    const second = buildSolutionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: { version: 2, role: "SOLUTION", problem: "Đề B", solution: "Dựng BK." },
    });
    expect(first.systemPrompt).toBe(second.systemPrompt);
    expect(first.promptVersion).toBe(second.promptVersion);
    expect(first.promptCache).toEqual(second.promptCache);
    expect(first.userPrompt).not.toBe(second.userPrompt);
  });

  it("keeps Math, Physics and Chemistry Quiz figure prompts independent", () => {
    const plan = {
      version: 1 as const,
      role: "QUESTION" as const,
      problem: "Mô tả cấu hình cần minh họa.",
    };
    const physics = buildQuestionFigureInput({
      subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
      plan,
    });
    const chemistry = buildQuestionFigureInput({
      subject: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
      plan,
    });
    const math = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan,
    });
    expect(math.systemPrompt).toContain("### QUY TẮC HÌNH TOÁN CỦA QUIZ");
    expect(math.systemPrompt).toContain("Vạch bằng nhau/trung điểm");
    expect(math.systemPrompt).toContain("bắt buộc có đúng một điểm đánh dấu");
    expect(math.systemPrompt).not.toContain("topology, nút nối, cực tính");
    expect(math.systemPrompt).not.toContain("hóa trị, điện tích");

    expect(physics.systemPrompt).toContain("Vector và lực phải có đúng gốc");
    expect(physics.systemPrompt).toContain("### QUY TẮC HÌNH VẬT LÝ CỦA QUIZ");
    expect(physics.systemPrompt).toContain("topology, nút nối, cực tính");
    expect(physics.systemPrompt).not.toContain("Vạch bằng nhau/trung điểm");
    expect(physics.systemPrompt).not.toContain("hóa trị");
    expect(physics.systemPrompt).not.toContain("angle=X--V--Y");
    expect(physics.systemPrompt).not.toContain("node `$(O)$`");

    expect(chemistry.systemPrompt).toContain("đúng nguyên tố, số liên kết");
    expect(chemistry.systemPrompt).toContain("### QUY TẮC HÌNH HÓA HỌC CỦA QUIZ");
    expect(chemistry.systemPrompt).toContain("dụng cụ/ống nối");
    expect(chemistry.systemPrompt).not.toContain("Vạch bằng nhau/trung điểm");
    expect(chemistry.systemPrompt).not.toContain("Vector và lực");
    expect(chemistry.systemPrompt).not.toContain("angle=X--V--Y");
    expect(chemistry.systemPrompt).not.toContain("node `$(O)$`");

    expect(math.promptVersion).toBe(
      "quiz-figure-math-question-v61-independent-midpoint-marker-auto-repair",
    );
    expect(physics.promptVersion).toBe(
      "quiz-figure-physics-question-v48-independent-no-narrative-callouts",
    );
    expect(chemistry.promptVersion).toBe(
      "quiz-figure-chemistry-question-v47-independent-no-narrative-callouts",
    );
  });

  it("passes targetGrade as context for every Quiz figure subject and mode without grade-band rules", () => {
    const subjects = [
      { key: "MATH", name: "Toán", slug: "toan" },
      { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
      { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
      { key: "GENERAL", name: "Môn khác", slug: "mon-khac" },
    ] as const;
    for (const subject of subjects) {
      const requests = [
        buildQuestionFigureInput({
          subject,
          targetGrade: 8,
          plan: { version: 1, role: "QUESTION", problem: "Nội dung cần minh họa." },
        }),
        buildSolutionFigureInput({
          subject,
          targetGrade: 8,
          plan: {
            version: 2,
            role: "SOLUTION",
            problem: "Nội dung cần minh họa.",
            solution: "Bổ sung một đối tượng.",
          },
        }),
      ];

      for (const request of requests) {
        expect(JSON.parse(request.userPrompt)).toMatchObject({ targetGrade: 8 });
        expect(request.promptVersion).toContain("independent-");
        expect(request.systemPrompt).not.toContain("Lớp 3–5");
        expect(request.systemPrompt).not.toContain("Lớp 6–9");
        expect(request.systemPrompt).not.toContain("Lớp 10–12");
      }
    }

    const unknownGrade = buildQuestionFigureInput({
      subject: subjects[0],
      targetGrade: null,
      plan: { version: 1, role: "QUESTION", problem: "Nội dung cần minh họa." },
    });
    expect(JSON.parse(unknownGrade.userPrompt)).not.toHaveProperty("targetGrade");
  });

  it("keeps admin figure regeneration instructions scoped as presentation data", () => {
    const request = buildQuestionFigureInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      plan: {
        version: 1,
        role: "QUESTION",
        problem: "Cho tam giác ABC.",
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

  it("repairs a missing inline closer before prose without swallowing the next formula", () => {
    const malformed = String.raw`Khung rộng $12\,\text{m}$ và cao $8\,\text{m}. Hai đỉnh nằm trên cung tròn. Lấy $\pi\approx3{,}14$.`;
    const repaired = String.raw`Khung rộng $12\,\text{m}$ và cao $8\,\text{m}$. Hai đỉnh nằm trên cung tròn. Lấy $\pi\approx3{,}14$.`;

    expect(normalizeMissingInlineMathClosers(malformed)).toBe(repaired);
    expect(normalizeMissingInlineMathClosers(repaired)).toBe(repaired);

    const question = {
      questionType: QuestionType.TEXT_INPUT,
      difficulty: Difficulty.HARD,
      hint: String.raw`Tính $R=10. Sau đó dùng công thức độ dài cung.`,
      explanation: {
        problem: malformed,
        solution: String.raw`Bán kính là $R=10\,\text{m}. Tiếp theo tính độ dài cung tròn.`,
        isGeometry: true,
      },
      figure: {
        requiresQuestionFigure: true,
        solutionFigure: false,
      },
      correctAnswer: "31.4",
    };
    const normalized = normalizeGeneratedQuizQuestionLatex(question);
    expect(normalized.explanation.problem).toBe(repaired);
    expect(normalized.hint).toBe(
      String.raw`Tính $R=10$. Sau đó dùng công thức độ dài cung.`,
    );
    expect(normalized.explanation.solution).toBe(
      String.raw`Bán kính là $R=10\,\text{m}$. Tiếp theo tính độ dài cung tròn.`,
    );
    expect(normalizeGeneratedQuizQuestionLatex(normalized)).toEqual(normalized);

    const document = mapGeneratedQuizQuestion(normalized).questionJson;
    expect(document.content?.[0]?.content).toEqual([
      { type: "text", text: "Khung rộng " },
      { type: "inlineMath", attrs: { latex: String.raw`12\,\text{m}` } },
      { type: "text", text: " và cao " },
      { type: "inlineMath", attrs: { latex: String.raw`8\,\text{m}` } },
      { type: "text", text: ". Hai đỉnh nằm trên cung tròn. Lấy " },
      { type: "inlineMath", attrs: { latex: String.raw`\pi\approx3{,}14` } },
      { type: "text", text: "." },
    ]);
  });

  it("keeps ambiguous and valid inline math unchanged", () => {
    const cases = [
      String.raw`Giá trị $x=3.14$ là một số thập phân.`,
      String.raw`Quy ước $A=\text{Đúng}. B=\text{Sai}$ trong bảng mã.`,
      String.raw`Biểu thức $$\begin{aligned}x&=1\\y&=2\end{aligned}$$ giữ nguyên.`,
      "Giữ `price=$5. Hôm nay` trong code span.",
      String.raw`Giá niêm yết là \$5. Hôm nay giảm giá.`,
      String.raw`Trường hợp mơ hồ $x+1`,
    ];
    for (const value of cases) {
      expect(normalizeMissingInlineMathClosers(value)).toBe(value);
    }
  });

  it("normalizes every generated Quiz string while preserving valid content", () => {
    const question = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: String.raw`Dùng $x=1$.`,
      explanation: {
        problem: String.raw`Giá trị $x=1$ thỏa mãn.`,
        solution: String.raw`$$\begin{aligned}x&=1\\&=1.$$`,
        isGeometry: false,
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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
        isGeometry: true,
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
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

  it("repairs decoded control characters across Quiz problem, hint, options, and solution", () => {
    const brokenCommandPrefix = String.fromCharCode(28);
    const unrelatedControlCharacter = String.fromCharCode(30);
    const question = {
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.HARD,
      hint: `Dùng $${brokenCommandPrefix}widehat{A}+${brokenCommandPrefix}widehat{C}=180^\\circ$.`,
      options: [
        { id: "A", text: `$${brokenCommandPrefix}widehat{C}=104^\\circ$` },
        { id: "B", text: `$${brokenCommandPrefix}root{61}$` },
        {
          id: "C",
          text: `$${brokenCommandPrefix}frac{1}{2}+\\u001calpha$`,
        },
      ],
      correctOptionId: "A",
      explanation: {
        problem: `Cho $${brokenCommandPrefix}widehat{A}=76^\\circ$.`,
        solution: `Ký tự${unrelatedControlCharacter}thừa.\n\n$$\\begin{aligned}${brokenCommandPrefix}widehat{A}+${brokenCommandPrefix}widehat{C}&=180^\\circ\\\\\\u001cwidehat{C}&=104^\\circ.\\end{aligned}$$`,
        isGeometry: true,
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
      },
    };

    const normalized = normalizeGeneratedQuizQuestionLatex(question);
    expect(normalized.hint).toBe(String.raw`Dùng $\widehat{A}+\widehat{C}=180^\circ$.`);
    expect(normalized.options[0]?.text).toBe(String.raw`$\widehat{C}=104^\circ$`);
    expect(normalized.options[1]?.text).toBe(String.raw`$\sqrt{61}$`);
    expect(normalized.options[2]?.text).toBe(String.raw`$\frac{1}{2}+\alpha$`);
    expect(normalized.explanation.problem).toBe(String.raw`Cho $\widehat{A}=76^\circ$.`);
    expect(normalized.explanation.solution).toContain(
      String.raw`\widehat{A}+\widehat{C}&=180^\circ`,
    );
    expect(normalized.explanation.solution).not.toContain(brokenCommandPrefix);
    expect(normalized.explanation.solution).not.toContain(unrelatedControlCharacter);
    expect(normalized.explanation.solution).not.toContain("u001c");
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
        requiresQuestionFigure: false,
        solutionFigure: false,
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

  it("repairs escaped closing math delimiters without changing prose currency", () => {
    const question = {
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.MEDIUM,
      hint: String.raw`Giữ nguyên giá viết là \$5 ngoài công thức.`,
      explanation: {
        problem: String.raw`Tính $x+1\$.`,
        solution: String.raw`Ta có:

$$\widehat{A}+\widehat{C}=180^\circ.\$$

Suy ra $\widehat{C}=112^\circ\$.`,
        isGeometry: true,
      },
      figure: {
        requiresQuestionFigure: false,
        solutionFigure: false,
      },
      options: [
        { id: "A" as const, text: String.raw`$112^\circ$` },
        { id: "B" as const, text: String.raw`$68^\circ$` },
      ],
      correctOptionId: "A" as const,
    };

    const normalized = normalizeGeneratedQuizQuestionLatex(question);
    expect(normalized.hint).toBe(question.hint);
    expect(normalized.explanation.problem).toBe(String.raw`Tính $x+1$.`);
    expect(normalized.explanation.solution).toContain(
      String.raw`$$\widehat{A}+\widehat{C}=180^\circ.$$`,
    );
    expect(normalized.explanation.solution).toContain(
      String.raw`$\widehat{C}=112^\circ$.`,
    );
    expect(normalizeGeneratedQuizQuestionLatex(normalized)).toEqual(normalized);
  });
});
