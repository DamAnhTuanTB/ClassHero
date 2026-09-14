import { LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION } from "@learning-path/shared";
import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import {
  getLessonSummaryProviderTransportOutputSchema,
  LESSON_SUMMARY_PROVIDER_ROOT_FORMATTING_DESCRIPTION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  resolveAiStructuredTextFormat,
  type AiStructuredTextFormatResolution,
} from "#api/modules/ai/utils/ai-structured-output-format";
import { buildOpenAiStructuredResponseRequest } from "#api/modules/ai/utils/openai-response-request";
import {
  FLASHCARD_PROMPT_VERSIONS,
  generatedFlashcardOutputSchema,
} from "#api/modules/flashcards/types/flashcard-generation.types";
import { buildFlashcardSystemPrompt } from "#api/modules/flashcards/utils/flashcard-generation-prompt";
import { buildVideoSummaryProviderOutputSchema } from "#api/modules/learning-paths/utils/video-summary-output";
import {
  buildVideoSummaryPrompts,
  buildVideoSummarySystemPrompt,
  VIDEO_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
  VIDEO_SUMMARY_PROMPT_VERSION,
  VIDEO_SUMMARY_SEMANTIC_LAYOUT_INSTRUCTION,
  VIDEO_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION,
} from "#api/modules/learning-paths/utils/video-summary-prompt";
import {
  buildQuestionFigureStructuredInput,
  generatedQuestionFigureSchema,
} from "#api/modules/question-figures/types/question-figure-generation.types";
import {
  getGeneratedQuizOutputSchema,
  QUIZ_PROMPT_VERSIONS,
  QUIZ_SCHEMA_VERSION,
  quizGenerationJobInputSchema,
} from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizStructuredInput } from "#api/modules/quiz/utils/quiz-generation-prompt";
import {
  buildQuizFigureRefinementInput,
  generatedQuizFigureRefinementSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import {
  buildSolutionFigureStructuredInput,
  generatedSolutionFigureSchema,
} from "#api/modules/solution-figures/types/solution-figure-generation.types";

type JsonObject = Record<string, unknown>;
type ResolvedFormat = AiStructuredTextFormatResolution<unknown>;

const subjectFixtures = {
  MATH: { key: "MATH", name: "Toán", slug: "toan" },
  PHYSICS: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
  CHEMISTRY: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
  GENERAL: { key: "GENERAL", name: "Sinh học", slug: "sinh-hoc" },
} as const;

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveFormats(schema: unknown, outputName: string) {
  return Object.fromEntries(
    (["inline", "ref", "ref_v2", "auto"] as const).map((strategy) => [
      strategy,
      resolveAiStructuredTextFormat(
        schema as never,
        outputName,
        strategy,
      ) as ResolvedFormat,
    ]),
  ) as Record<"inline" | "ref" | "ref_v2" | "auto", ResolvedFormat>;
}

function dereferenceSchema(schema: unknown) {
  if (!isJsonObject(schema)) return schema;
  const definitions = isJsonObject(schema.$defs) ? schema.$defs : {};

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isJsonObject(value)) return value;
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/$defs/")) {
      const target = definitions[value.$ref.slice("#/$defs/".length)];
      expect(target, `Missing definition for ${value.$ref}`).toBeDefined();
      const siblings = Object.fromEntries(
        Object.entries(value).filter(([key]) => key !== "$ref"),
      );
      return visit({ ...(target as JsonObject), ...siblings });
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "$defs" && key !== "$schema")
        .map(([key, child]) => [key, visit(child)]),
    );
  };

  return visit(schema);
}

function collectDescriptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectDescriptions);
  if (!isJsonObject(value)) return [];
  return [
    ...(typeof value.description === "string" ? [value.description] : []),
    ...Object.entries(value)
      .filter(([key]) => key !== "description")
      .flatMap(([, child]) => collectDescriptions(child)),
  ];
}

function collectPropertyReferences(value: unknown, propertyName: string): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child) => collectPropertyReferences(child, propertyName));
  }
  if (!isJsonObject(value)) return [];
  const properties = isJsonObject(value.properties) ? value.properties : {};
  const property = properties[propertyName];
  return [
    ...(isJsonObject(property) && typeof property.$ref === "string"
      ? [property.$ref]
      : []),
    ...Object.values(value).flatMap((child) =>
      collectPropertyReferences(child, propertyName),
    ),
  ];
}

function countDescriptionOccurrences(schema: unknown, policy: string) {
  return collectDescriptions(schema).reduce((total, description) => {
    let count = 0;
    let offset = 0;
    while ((offset = description.indexOf(policy, offset)) >= 0) {
      count += 1;
      offset += policy.length;
    }
    return total + count;
  }, 0);
}

function assertStrictOpenAiSchema(schema: unknown, definitions?: JsonObject) {
  if (Array.isArray(schema)) {
    for (const child of schema) assertStrictOpenAiSchema(child, definitions);
    return;
  }
  if (!isJsonObject(schema)) return;
  const rootDefinitions = definitions ?? (isJsonObject(schema.$defs) ? schema.$defs : {});
  expect(schema).not.toHaveProperty("oneOf");
  if (typeof schema.$ref === "string") {
    expect(schema.$ref).toMatch(/^#\/\$defs\//u);
    expect(rootDefinitions[schema.$ref.slice("#/$defs/".length)]).toBeDefined();
  }
  if (isJsonObject(schema.properties)) {
    expect(schema.additionalProperties).toBe(false);
    expect([...(schema.required as string[])].sort()).toEqual(
      Object.keys(schema.properties).sort(),
    );
  }
  for (const child of Object.values(schema)) {
    assertStrictOpenAiSchema(child, rootDefinitions);
  }
}

function buildQuizOrTestInput(
  subjectKey: keyof typeof subjectFixtures,
  assessmentKind: "QUIZ" | "TEST",
) {
  const subject = subjectFixtures[subjectKey];
  const configuration = quizGenerationJobInputSchema.parse({
    requestDraftId: "00000000-0000-4000-8000-000000000001",
    requestHash: "a".repeat(64),
    packetHash: "b".repeat(64),
    manifestHash: "c".repeat(64),
    documentIds: ["00000000-0000-4000-8000-000000000002"],
    sourceHash: "d".repeat(64),
    targetGrade: 8,
    subjectKey,
    subjectName: subject.name,
    subjectSlug: subject.slug,
    assessmentKind,
    pipelineVersion: "ASSESSMENT_QUIZ_V1",
    targetQuizSetId: assessmentKind === "QUIZ" ? null : undefined,
    targetTestSetId:
      assessmentKind === "TEST" ? "00000000-0000-4000-8000-000000000003" : undefined,
    durationSeconds: assessmentKind === "TEST" ? 2_700 : undefined,
    questionCount: 1,
    realWorldQuestionCount: 0,
    difficulty: Difficulty.EASY,
    difficultyCounts: null,
    questionTypes: [QuestionType.TRUE_FALSE],
    style: "student_friendly",
    styleInstructions: "Rõ ràng",
    extraInstructions: "",
    systemInstructions: "",
    userPrompt: "",
    reasoningEffort: "high",
    schemaReferenceStrategy: "ref_v2",
    promptCacheKeyEnabled: true,
    promptCacheRetention: "in_memory",
  });

  return buildQuizStructuredInput({
    lessonId: "00000000-0000-4000-8000-000000000004",
    lessonTitle: "Bài đại diện",
    sourceHash: "d".repeat(64),
    documentIds: ["00000000-0000-4000-8000-000000000002"],
    packet: { filename: "lesson.pdf", bytes: Buffer.from("fixture") },
    configuration,
  });
}

describe("M9 effective prompt and structured-schema deduplication", () => {
  it("keeps ref/ref_v2 semantically equal to inline and auto selects the smallest", () => {
    const quizSchema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 8,
      questionCount: 10,
      questionTypes: Object.values(QuestionType),
      difficulty: Difficulty.MIXED,
    });
    const cases = [
      {
        name: "summary",
        schema: getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL", 8, {
          standardExerciseCount: 2,
          realWorldExerciseCount: 2,
        }),
        bytes: [73_649, 17_450, 16_346, 16_346],
        autoStrategy: "ref_v2",
      },
      {
        name: "quiz",
        schema: quizSchema,
        bytes: [11_654, 8_787, 8_555, 8_555],
        autoStrategy: "ref_v2",
      },
      {
        name: "flashcard",
        schema: generatedFlashcardOutputSchema,
        bytes: [1_974, 1_979, 1_990, 1_974],
        autoStrategy: "inline",
      },
      {
        name: "video",
        schema: buildVideoSummaryProviderOutputSchema([]),
        bytes: [5_912, 5_917, 5_928, 5_912],
        autoStrategy: "inline",
      },
      {
        name: "question_figure",
        schema: generatedQuestionFigureSchema,
        bytes: [205, 210, 221, 205],
        autoStrategy: "inline",
      },
      {
        name: "solution_figure",
        schema: generatedSolutionFigureSchema,
        bytes: [477, 482, 493, 477],
        autoStrategy: "inline",
      },
      {
        name: "quiz_figure_refinement",
        schema: generatedQuizFigureRefinementSchema,
        bytes: [389, 394, 405, 389],
        autoStrategy: "inline",
      },
    ] as const;

    for (const schemaCase of cases) {
      const formats = resolveFormats(schemaCase.schema, schemaCase.name);
      expect([
        formats.inline.schemaBytes,
        formats.ref.schemaBytes,
        formats.ref_v2.schemaBytes,
        formats.auto.schemaBytes,
      ]).toEqual(schemaCase.bytes);
      expect(formats.auto.schemaBytes).toBe(
        Math.min(
          formats.inline.schemaBytes,
          formats.ref.schemaBytes,
          formats.ref_v2.schemaBytes,
        ),
      );
      expect(formats.auto.resolvedReferenceStrategy).toBe(schemaCase.autoStrategy);
      expect(dereferenceSchema(formats.ref.format.schema)).toEqual(
        dereferenceSchema(formats.inline.format.schema),
      );
      expect(dereferenceSchema(formats.ref_v2.format.schema)).toEqual(
        dereferenceSchema(formats.inline.format.schema),
      );
      for (const strategy of ["inline", "ref", "ref_v2", "auto"] as const) {
        assertStrictOpenAiSchema(formats[strategy].format.schema);
      }
    }
  });

  it("emits the shared Quiz isGeometry policy once through one ref_v2 definition", () => {
    const schema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 8,
      questionCount: 2,
      questionTypes: Object.values(QuestionType),
      difficulty: Difficulty.MIXED,
    });
    const formats = resolveFormats(schema, "generated_quiz");
    const description = "Đặt true nếu đây là câu Hình học; ngược lại đặt false.";
    const references = collectPropertyReferences(
      formats.ref_v2.format.schema,
      "isGeometry",
    );

    expect(references).toHaveLength(4);
    expect(new Set(references).size).toBe(1);
    expect(countDescriptionOccurrences(formats.inline.format.schema, description)).toBe(
      4,
    );
    expect(countDescriptionOccurrences(formats.ref.format.schema, description)).toBe(1);
    expect(countDescriptionOccurrences(formats.ref_v2.format.schema, description)).toBe(
      1,
    );
    expect(formats.auto.resolvedReferenceStrategy).toBe("ref_v2");
  });

  it("preserves the Algebra/Geometry discriminator and parse acceptance for every serializer", () => {
    const schema = getGeneratedQuizOutputSchema({
      subjectKey: "MATH",
      targetGrade: 8,
      questionCount: 1,
      questionTypes: [QuestionType.TRUE_FALSE],
      difficulty: Difficulty.EASY,
    });
    const baseQuestion = {
      questionType: QuestionType.TRUE_FALSE,
      difficulty: Difficulty.EASY,
      hint: "Xét trực tiếp biểu thức.",
      figure: { requiresQuestionFigure: false, solutionFigure: false },
      correctAnswer: true,
    };
    const algebra = {
      questions: [
        {
          ...baseQuestion,
          explanation: {
            problem: "$x+1=2$ là một phương trình bậc nhất.",
            solution: "Ta có $x=1$. Vì vậy, mệnh đề đã cho là đúng.",
            isGeometry: false,
          },
        },
      ],
    };
    const geometry = {
      questions: [
        {
          ...baseQuestion,
          explanation: {
            problem: "Tam giác đều có ba góc bằng nhau.",
            solution:
              "Theo tính chất tam giác đều, ba góc bằng nhau. Vì vậy, mệnh đề đã cho là đúng.",
            isGeometry: true,
          },
        },
      ],
    };
    const missingDiscriminator = structuredClone(algebra);
    delete (missingDiscriminator.questions[0]?.explanation as { isGeometry?: boolean })
      .isGeometry;

    for (const resolution of Object.values(resolveFormats(schema, "generated_quiz"))) {
      const parseRaw = (
        resolution.format as unknown as {
          $parseRaw: (content: string) => unknown;
        }
      ).$parseRaw;
      expect(parseRaw(JSON.stringify(algebra))).toEqual(algebra);
      expect(parseRaw(JSON.stringify(geometry))).toEqual(geometry);
      expect(() => parseRaw(JSON.stringify(missingDiscriminator))).toThrow();
    }
  });

  it("consolidates global schema policies at the root without weakening custom overrides", () => {
    const summarySchema = resolveFormats(
      getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL", 8),
      "lesson_summary",
    ).ref_v2.format.schema;
    expect((summarySchema as JsonObject).description).toBe(
      LESSON_SUMMARY_PROVIDER_ROOT_FORMATTING_DESCRIPTION,
    );
    expect(
      countDescriptionOccurrences(
        summarySchema,
        LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION,
      ),
    ).toBe(1);
    expect(
      countDescriptionOccurrences(summarySchema, LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION),
    ).toBe(1);

    const videoSchema = resolveFormats(
      buildVideoSummaryProviderOutputSchema([]),
      "video_summary",
    ).auto.format.schema;
    for (const policy of [
      VIDEO_SUMMARY_SEMANTIC_LAYOUT_INSTRUCTION,
      VIDEO_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
      VIDEO_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION,
      LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION,
    ]) {
      expect(countDescriptionOccurrences(videoSchema, policy)).toBe(1);
    }
    const custom = buildVideoSummaryPrompts({
      lessonTitle: "Bài tùy chỉnh",
      targetGrade: 8,
      subject: subjectFixtures.MATH,
      configuration: {
        style: "concise",
        styleInstructions: "Ngắn gọn",
        length: "short",
        targetWordCount: null,
        extraInstructions: null,
        systemInstructions: "CUSTOM SYSTEM",
        userPrompt: "CUSTOM USER",
      },
    });
    expect(custom.systemPrompt).toBe("CUSTOM SYSTEM");
    expect(custom.userPrompt).toBe("CUSTOM USER");
    expect((videoSchema as JsonObject).description).toContain(
      VIDEO_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
    );
  });

  it("keeps Quiz and Test on the same HIGH Phase 1 contract for every subject", () => {
    for (const subject of Object.values(subjectFixtures)) {
      const quiz = buildQuizOrTestInput(subject.key, "QUIZ");
      const test = buildQuizOrTestInput(subject.key, "TEST");
      for (const request of [quiz, test]) {
        expect(request.reasoningEffort).toBe("high");
        expect(request.schemaReferenceStrategy).toBe("ref_v2");
        expect(request.promptVersion).toBe(QUIZ_PROMPT_VERSIONS[subject.key]);
        expect(request.schemaVersion).toBe(QUIZ_SCHEMA_VERSION);
        expect(request.systemPrompt).toContain("đúng lượt cục bộ của candidate này");
        expect(request.systemPrompt).toContain(
          "soạn candidate thay thế rồi mới thêm chữ ký",
        );
        expect(request.systemPrompt).toContain("tập con hoặc tập cha chặt");
        expect(request.systemPrompt).toContain(
          "phần chung đã tự quyết định đáp án hoặc scaffold lời giải thiết yếu",
        );
        expect(request.systemPrompt).toContain(
          "thêm một ràng buộc thực sự đổi điều kiện đánh giá hoặc bắt buộc một scaffold thiết yếu khác thì không phải trùng",
        );
        expect(request.systemPrompt).toContain("đảo công thức chỉ để hỏi đại lượng khác");
        expect(request.systemPrompt).toContain(
          "cùng quan hệ chi phối theo cùng scaffold",
        );
        expect(request.systemPrompt).toContain("rút bớt bước từ cùng chuỗi chứng minh");
        expect(request.systemPrompt).toContain(
          "Mỗi premise, dữ kiện chuyên môn hoặc định lượng",
        );
        expect(request.systemPrompt).not.toContain(
          "LƯỢT KIỂM TRA NHẤT QUÁN CUỐI CHO CẢ BỘ",
        );
      }
      expect(test.systemPrompt).toBe(quiz.systemPrompt);
      expect(test.userPrompt).toBe(quiz.userPrompt);
      expect(test.promptCache).toEqual(quiz.promptCache);
      if (subject.key === "MATH") {
        expect(quiz.systemPrompt).toContain("$(ax+b)^\\circ$");
        expect(quiz.systemPrompt).toContain("không viết $ax+b^\\circ$");
      }
    }
    expect(QUIZ_SCHEMA_VERSION).toBe("quiz-pdf-figure-schema-v41-no-self-audit");
    expect(LESSON_SUMMARY_SCHEMA_VERSION).toBe(
      "lesson-summary-pdf-packet-six-block-schema-v35-local-figure-policy",
    );
  });

  it("keeps concise Flashcard answers distinct from full solutions", () => {
    for (const subject of Object.values(subjectFixtures)) {
      const prompt = buildFlashcardSystemPrompt({ subject });
      expect(prompt).toContain("`back` là câu trả lời trực tiếp, ngắn gọn");
      expect(prompt).toContain("`solution` là lời giải đầy đủ");
      expect(prompt).toContain("trình bày đủ các mắt xích");
      expect(prompt).toContain("Câu định nghĩa chỉ cần một căn cứ trực tiếp");
      expect(prompt).toContain("không lấy `back` làm tiền đề");
      expect(FLASHCARD_PROMPT_VERSIONS[subject.key]).toBeTruthy();
    }
  });

  it("keeps Question and Solution authority separate and deduplicates Math refinement", () => {
    for (const subject of Object.values(subjectFixtures)) {
      const question = buildQuestionFigureStructuredInput({
        subject,
        problem: "Cho tam giác ABC cân tại A.",
        mode: "EDIT_CURRENT",
        currentQuestionLatexSource:
          "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}",
      });
      const solution = buildSolutionFigureStructuredInput({
        subject,
        problem: "Cho tam giác ABC cân tại A.",
        solution: "Kẻ đường cao AH.",
        mode: "EDIT_CURRENT",
        currentSolutionLatexSource:
          "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}",
      });
      expect(JSON.parse(question.userPrompt)).toMatchObject({
        role: "QUESTION",
        problem: "Cho tam giác ABC cân tại A.",
      });
      expect(JSON.parse(question.userPrompt)).not.toHaveProperty("solution");
      expect(JSON.parse(solution.userPrompt)).toMatchObject({
        role: "SOLUTION",
        problem: "Cho tam giác ABC cân tại A.",
        solution: "Kẻ đường cao AH.",
      });
      expect(question.schemaReferenceStrategy).toBe("auto");
      expect(solution.schemaReferenceStrategy).toBe("auto");
    }

    const markerPolicy =
      "Không gộp hai nhóm chỉ vì mỗi nhóm đều phát sinh từ quan hệ trung điểm.";
    for (const role of ["QUESTION", "SOLUTION"] as const) {
      const refinement = buildQuizFigureRefinementInput({
        subject: subjectFixtures.MATH,
        plan:
          role === "QUESTION"
            ? { version: 1, role, problem: "Cho tam giác ABC." }
            : {
                version: 2,
                role,
                problem: "Cho tam giác ABC.",
                solution: "M là trung điểm AB.",
              },
        currentLatexSource: "\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}",
        currentImageDataUrl: "data:image/png;base64,aW1hZ2U=",
      });
      expect(refinement.promptVersion).toBe(
        role === "SOLUTION"
          ? "quiz-figure-math-solution-refinement-comprehensive-v41-visual-only-solution"
          : "quiz-figure-math-question-refinement-comprehensive-v40-marker-policy-dedup",
      );
      expect(refinement.systemPrompt.split(markerPolicy)).toHaveLength(2);
      expect(refinement.schemaReferenceStrategy).toBe("auto");
    }
  });

  it("keeps HIGH stable prefixes cacheable while dynamic source stays after the breakpoint", () => {
    const format = resolveFormats(
      buildVideoSummaryProviderOutputSchema([]),
      "video_summary_output",
    ).auto.format;
    const createRequest = (
      userPrompt: string,
      sourceText: string,
    ): AiStructuredInput => ({
      systemPrompt: buildVideoSummarySystemPrompt("MATH"),
      userPrompt,
      inputTextItems: [{ id: "video_source", text: sourceText }],
      outputName: "video_summary_output",
      promptVersion: VIDEO_SUMMARY_PROMPT_VERSION,
      schemaVersion: "9",
      schemaReferenceStrategy: "auto",
      reasoningEffort: "high",
      promptCache: {
        namespace: "video-summary",
        keyEnabled: true,
        retention: "in_memory",
      },
    });
    const firstRequest = createRequest("Yêu cầu A", "Transcript A");
    const secondRequest = createRequest("Yêu cầu B", "Transcript B");
    const first = buildOpenAiStructuredResponseRequest({
      request: firstRequest,
      model: "gpt-5.6",
      structuredTextFormat: format,
    });
    const second = buildOpenAiStructuredResponseRequest({
      request: secondRequest,
      model: "gpt-5.6",
      structuredTextFormat: format,
    });
    const changedSchema = buildOpenAiStructuredResponseRequest({
      request: { ...firstRequest, schemaVersion: "10" },
      model: "gpt-5.6",
      structuredTextFormat: format,
    });
    const changedPrompt = buildOpenAiStructuredResponseRequest({
      request: { ...firstRequest, promptVersion: `${VIDEO_SUMMARY_PROMPT_VERSION}-next` },
      model: "gpt-5.6",
      structuredTextFormat: format,
    });
    const firstInput = first.input as Exclude<typeof first.input, string>;
    const secondInput = second.input as Exclude<typeof second.input, string>;

    expect(first.reasoning).toEqual({ effort: "high" });
    expect(first.instructions).toBeUndefined();
    expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
    expect(first.prompt_cache_key).not.toBe(changedSchema.prompt_cache_key);
    expect(first.prompt_cache_key).not.toBe(changedPrompt.prompt_cache_key);
    expect(firstInput[0]).toEqual(secondInput[0]);
    expect(firstInput[0]).toMatchObject({
      role: "developer",
      content: [
        {
          type: "input_text",
          text: firstRequest.systemPrompt,
          prompt_cache_breakpoint: { mode: "explicit" },
        },
      ],
    });
    expect(firstInput.slice(1)).not.toEqual(secondInput.slice(1));
  });
});
