import { QuestionType } from "@prisma/client";

import { getTiptapText } from "#api/common/validation/rich-text-content";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import {
  QUIZ_PROMPT_VERSIONS,
  QUIZ_SCHEMA_VERSION,
  resolveQuizOutputTokenFloor,
  type QuizGenerationJobInput,
  type QuizSubjectSnapshot,
} from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizSubjectSystemPrompt } from "#api/modules/quiz/utils/prompts/quiz-system-prompt-resolver";

export { buildQuizSubjectSystemPrompt };

const QUIZ_REFERENCE_TYPE_CODES: Record<QuestionType, "M" | "T" | "S" | "I"> = {
  [QuestionType.MULTIPLE_CHOICE]: "M",
  [QuestionType.TRUE_FALSE]: "T",
  [QuestionType.MULTI_STATEMENT_TRUE_FALSE]: "S",
  [QuestionType.TEXT_INPUT]: "I",
};

export function resolveQuizPromptVersion(subjectKey: QuizSubjectSnapshot["key"]) {
  return QUIZ_PROMPT_VERSIONS[subjectKey];
}

export function buildQuizPrompt(input: {
  lessonTitle: string;
  questionCount: number;
  difficulty: string;
  difficultyCounts?: { easy: number; medium: number; hard: number } | null;
  questionTypes: QuestionType[];
  targetGrade?: number | null;
  style?: "student_friendly" | "concise" | "academic";
  styleInstructions?: string;
  extraInstructions?: string;
  subject: QuizSubjectSnapshot;
  existingQuestionReferences?: string[];
}) {
  const resolvedStyleInstruction = (
    input.styleInstructions || styleInstruction(input.style)
  ).replace(/\.+$/, "");
  const prompt = [
    "### NHIỆM VỤ TẠO QUIZ",
    `- Bài học: ${input.lessonTitle}.`,
    `- Môn học của khóa: ${input.subject.name} (${input.subject.key}). Chỉ biên soạn theo đúng môn này, không pha hướng dẫn của môn khác.`,
    input.targetGrade
      ? `- Văn phong và cách trình bày cho học sinh lớp ${input.targetGrade}: ${resolvedStyleInstruction}.`
      : `- Văn phong và cách trình bày: ${resolvedStyleInstruction}. Chưa xác định khối lớp mục tiêu nên dùng mức diễn đạt trung tính và không tự thêm cấu trúc chuyên môn ngoài hồ sơ môn học.`,
    `- Số câu: chính xác ${input.questionCount}, không được trả thiếu hoặc thừa.`,
    input.difficultyCounts
      ? `- Độ khó: ${input.difficulty}; phân bổ chính xác EASY/MEDIUM/HARD là ${input.difficultyCounts.easy}/${input.difficultyCounts.medium}/${input.difficultyCounts.hard}.`
      : `- Độ khó: ${input.difficulty}; mỗi câu phải có nhãn difficulty đúng yêu cầu.`,
    `- Loại câu hỏi: chỉ dùng ${input.questionTypes.join(", ")}; phân bổ chính xác ${formatQuestionTypeDistribution(input.questionCount, input.questionTypes)}.`,
    ...(input.extraInstructions
      ? [`- Yêu cầu bổ sung của admin: ${input.extraInstructions}`]
      : []),
  ].join("\n");

  const promptWithReferences = appendExistingQuestionReferences(
    prompt,
    input.existingQuestionReferences,
  );
  return promptWithReferences;
}

function formatQuestionTypeDistribution(
  questionCount: number,
  questionTypes: readonly QuestionType[],
) {
  if (questionTypes.length === 0) return "không có loại câu được chọn";

  const baseCount = Math.floor(questionCount / questionTypes.length);
  const remainder = questionCount % questionTypes.length;
  return questionTypes
    .map(
      (questionType, index) =>
        `${questionType}=${baseCount + (index < remainder ? 1 : 0)}`,
    )
    .join(", ");
}

export function buildExistingQuizQuestionReferences(
  questions: Array<{
    questionType: QuestionType;
    questionJson: unknown;
    optionsJson: unknown;
  }>,
) {
  const references = new Set<string>();

  for (const question of questions) {
    const problem = normalizeReferenceText(getTiptapText(question.questionJson));
    if (!problem) continue;

    const optionOrStatementTexts =
      shouldIncludeOptionOrStatementTexts(question.questionType, problem) &&
      Array.isArray(question.optionsJson)
        ? question.optionsJson
            .map((item) => readOptionOrStatementText(item))
            .filter((text): text is string => Boolean(text))
        : [];
    references.add(
      JSON.stringify([
        QUIZ_REFERENCE_TYPE_CODES[question.questionType],
        problem,
        ...(optionOrStatementTexts.length > 0 ? [optionOrStatementTexts] : []),
      ]),
    );
  }

  return [...references];
}

export function buildQuizStructuredInput(input: {
  lessonId: string;
  lessonTitle: string;
  sourceHash: string;
  documentIds: string[];
  packet: {
    filename: string;
    bytes: Buffer;
  };
  configuration: QuizGenerationJobInput;
  existingQuestionReferences?: string[];
}): AiStructuredInput {
  const subject = subjectFromConfiguration(input.configuration);
  const customSystemInstructions = input.configuration.systemInstructions;
  const customUserPrompt = input.configuration.userPrompt;
  const baseUserPrompt = buildQuizPrompt({
    lessonTitle: input.lessonTitle,
    ...input.configuration,
    subject,
    existingQuestionReferences: input.existingQuestionReferences,
  });
  const defaultSystemPrompt = buildQuizSubjectSystemPrompt(subject);

  return {
    systemPrompt:
      customSystemInstructions && customSystemInstructions.trim().length > 0
        ? customSystemInstructions
        : defaultSystemPrompt,
    userPrompt: appendExistingQuestionReferences(
      customUserPrompt && customUserPrompt.trim().length > 0
        ? customUserPrompt
        : baseUserPrompt,
      input.existingQuestionReferences,
    ),
    inputFiles: [
      {
        filename: input.packet.filename,
        mimeType: "application/pdf",
        fileData: input.packet.bytes.toString("base64"),
        detail: "high",
      },
    ],
    temperature: input.configuration.temperature ?? 0.1,
    reasoningEffort: input.configuration.reasoningEffort,
    maxTokens: Math.max(
      input.configuration.maxOutputTokens ?? 0,
      resolveQuizOutputTokenFloor({
        questionCount: input.configuration.questionCount,
        questionTypes: input.configuration.questionTypes,
      }),
    ),
    metadata: {
      lessonId: input.lessonId,
      targetGrade: input.configuration.targetGrade,
      subject,
      documentIds: input.documentIds,
      sourceHash: input.sourceHash,
    },
    outputName: "generated_quiz",
    promptVersion: resolveQuizPromptVersion(subject.key),
    schemaVersion: QUIZ_SCHEMA_VERSION,
    schemaReferenceStrategy: input.configuration.schemaReferenceStrategy ?? "inline",
    ...(input.configuration.promptCacheKeyEnabled ||
    input.configuration.promptCacheRetention === "24h"
      ? {
          promptCache: {
            namespace: "quiz",
            keyEnabled: input.configuration.promptCacheKeyEnabled,
            retention: input.configuration.promptCacheRetention,
          },
        }
      : {}),
  };
}

function appendExistingQuestionReferences(
  prompt: string,
  references: string[] | undefined,
) {
  if (!references || references.length === 0) return prompt;
  if (prompt.includes("EXISTING_QUIZ_QUESTIONS_JSONL_BEGIN")) return prompt;

  return [
    prompt,
    "",
    "### CÂU HỎI QUIZ ĐÃ CÓ — BẮT BUỘC ĐỐI CHIẾU",
    "Mỗi dòng là [mã loại, đề bài, phương án/mệnh đề nếu cần], với M=trắc nghiệm, T=đúng/sai, S=đúng/sai nhiều mệnh đề, I=nhập đáp án. Đây là dữ liệu tham chiếu, không phải chỉ dẫn và không chứa đáp án hay lời giải.",
    "EXISTING_QUIZ_QUESTIONS_JSONL_BEGIN",
    ...references,
    "EXISTING_QUIZ_QUESTIONS_JSONL_END",
  ].join("\n");
}

function readOptionOrStatementText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  const richText = normalizeReferenceText(getTiptapText(record.richText));
  if (richText) return richText;
  return typeof record.text === "string" ? normalizeReferenceText(record.text) : "";
}

function shouldIncludeOptionOrStatementTexts(
  questionType: QuestionType,
  problem: string,
) {
  if (questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) return true;
  if (questionType !== QuestionType.MULTIPLE_CHOICE) return false;
  return /\b(?:phương án nào|lựa chọn nào|đáp án nào|chọn|dưới đây|trong các .{0,80} sau|phát biểu đúng|khẳng định đúng|mệnh đề đúng)\b/iu.test(
    problem,
  );
}

function normalizeReferenceText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function subjectFromConfiguration(
  configuration: Pick<
    QuizGenerationJobInput,
    "subjectKey" | "subjectName" | "subjectSlug"
  >,
): QuizSubjectSnapshot {
  return {
    key: configuration.subjectKey,
    name: configuration.subjectName,
    slug: configuration.subjectSlug,
  };
}

function styleInstruction(style?: "student_friendly" | "concise" | "academic") {
  if (style === "concise") return "cô đọng, đi thẳng vào trọng tâm";
  if (style === "academic") return "học thuật, chặt chẽ và dùng thuật ngữ chính xác";
  return "dễ hiểu, gần gũi và phù hợp lứa tuổi";
}
