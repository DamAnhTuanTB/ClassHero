import type { QuestionType } from "@prisma/client";

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
}) {
  const mustCoverEveryType = input.questionCount >= input.questionTypes.length;
  const resolvedStyleInstruction = (
    input.styleInstructions || styleInstruction(input.style)
  ).replace(/\.+$/, "");
  return [
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
    `- Loại câu hỏi: chỉ dùng ${input.questionTypes.join(", ")}; phân bổ đều nhất có thể${mustCoverEveryType ? " và phải có đủ mọi loại đã chọn" : ""}.`,
    ...(input.extraInstructions
      ? [`- Yêu cầu bổ sung của admin: ${input.extraInstructions}`]
      : []),
  ].join("\n");
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
}): AiStructuredInput {
  const subject = subjectFromConfiguration(input.configuration);
  const baseUserPrompt = buildQuizPrompt({
    lessonTitle: input.lessonTitle,
    ...input.configuration,
    subject,
  });
  const customSystemInstructions = input.configuration.systemInstructions;
  const customUserPrompt = input.configuration.userPrompt;
  const defaultSystemPrompt = buildQuizSubjectSystemPrompt(subject);

  return {
    systemPrompt:
      customSystemInstructions && customSystemInstructions.trim().length > 0
        ? customSystemInstructions
        : defaultSystemPrompt,
    userPrompt:
      customUserPrompt && customUserPrompt.trim().length > 0
        ? customUserPrompt
        : baseUserPrompt,
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
