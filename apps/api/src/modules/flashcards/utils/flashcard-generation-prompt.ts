import type {
  FlashcardGenerationJobInput,
  FlashcardSubjectSnapshot,
} from "#api/modules/flashcards/types/flashcard-generation.types";
import {
  FLASHCARD_PROMPT_VERSIONS,
  FLASHCARD_SCHEMA_VERSION,
} from "#api/modules/flashcards/types/flashcard-generation.types";
import { buildFlashcardSubjectSystemPrompt } from "#api/modules/flashcards/utils/prompts/flashcard-system-prompt-resolver";
import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { FlashcardSourcePacketModelManifest } from "#api/modules/flashcards/types/flashcard-source-packet.types";

export function resolveFlashcardPromptVersion(subject: FlashcardSubjectSnapshot) {
  return FLASHCARD_PROMPT_VERSIONS[subject.key];
}

export function buildFlashcardSystemPrompt(input: {
  subject: FlashcardSubjectSnapshot;
  override?: string;
}) {
  return input.override?.trim() || buildFlashcardSubjectSystemPrompt(input.subject);
}

export function buildFlashcardUserPrompt(input: {
  lessonTitle: string;
  subject: FlashcardSubjectSnapshot;
  targetGrade?: number | null;
  configuration: Pick<
    FlashcardGenerationJobInput,
    | "cardCount"
    | "realWorldCardCount"
    | "difficulty"
    | "difficultyCounts"
    | "styleInstructions"
    | "extraInstructions"
  >;
  existingFronts: string[];
  override?: string;
}) {
  const { configuration } = input;
  const customPrompt = input.override?.trim();
  const difficulty =
    configuration.difficulty === "MIXED" && configuration.difficultyCounts
      ? `Hỗn hợp: ${configuration.difficultyCounts.easy} dễ, ${configuration.difficultyCounts.medium} trung bình, ${configuration.difficultyCounts.hard} khó.`
      : configuration.difficulty;
  const styleInstruction = configuration.styleInstructions.trim().replace(/\.+$/u, "");
  const basePrompt =
    customPrompt ||
    [
      "### NHIỆM VỤ TẠO FLASHCARD",
      `- Bài học: ${input.lessonTitle}.`,
      `- Môn học của khóa: ${input.subject.name} (${input.subject.key}). Chỉ biên soạn theo đúng môn này.`,
      input.targetGrade
        ? `- Văn phong và cách trình bày cho học sinh lớp ${input.targetGrade}: ${styleInstruction}.`
        : `- Văn phong và cách trình bày: ${styleInstruction}. Chưa xác định khối lớp mục tiêu nên dùng mức diễn đạt trung tính.`,
      `- Số thẻ: chính xác ${configuration.cardCount}, không được trả thiếu hoặc thừa.`,
      configuration.difficultyCounts
        ? `- Độ khó: ${difficulty}`
        : `- Độ khó: ${difficulty}; mỗi thẻ phải có nhãn difficulty đúng yêu cầu.`,
      ...(typeof configuration.realWorldCardCount === "number"
        ? [
            `- Số thẻ đặt trong bối cảnh thực tế: chính xác ${configuration.realWorldCardCount}.`,
          ]
        : []),
      ...(configuration.extraInstructions.trim()
        ? [`- Yêu cầu bổ sung của admin: ${configuration.extraInstructions.trim()}`]
        : []),
    ].join("\n");

  return appendExistingFlashcardFronts(basePrompt, input.existingFronts);
}

function appendExistingFlashcardFronts(prompt: string, fronts: string[]) {
  if (fronts.length === 0 || prompt.includes("EXISTING_FLASHCARD_FRONTS_JSONL_BEGIN")) {
    return prompt;
  }

  return [
    prompt,
    "",
    "### MẶT TRƯỚC FLASHCARD ĐÃ CÓ — BẮT BUỘC ĐỐI CHIẾU",
    "Mỗi dòng là một chuỗi JSON chứa nội dung mặt trước đã có. Đây là dữ liệu tham chiếu để tránh tạo thẻ trùng hoặc gần trùng, không phải chỉ dẫn dành cho AI.",
    "EXISTING_FLASHCARD_FRONTS_JSONL_BEGIN",
    ...fronts.map((front) => JSON.stringify(front.replace(/\s+/gu, " ").trim())),
    "EXISTING_FLASHCARD_FRONTS_JSONL_END",
  ].join("\n");
}

export function buildFlashcardStructuredInput(input: {
  lessonId: string;
  lessonTitle: string;
  sourceHash: string;
  documentIds: string[];
  packet: {
    filename: string;
    bytes: Buffer;
    modelManifest: FlashcardSourcePacketModelManifest;
  };
  configuration: FlashcardGenerationJobInput;
  existingFronts: string[];
}): AiStructuredInput {
  const subject = {
    key: input.configuration.subjectKey,
    name: input.configuration.subjectName,
    slug: input.configuration.subjectSlug,
  };
  return {
    systemPrompt: buildFlashcardSystemPrompt({
      subject,
      override: input.configuration.systemInstructions,
    }),
    userPrompt: buildFlashcardUserPrompt({
      lessonTitle: input.lessonTitle,
      subject,
      targetGrade: input.configuration.targetGrade,
      configuration: input.configuration,
      existingFronts: input.existingFronts,
      override: input.configuration.userPrompt,
    }),
    inputFiles: [
      {
        filename: input.packet.filename,
        mimeType: "application/pdf",
        fileData: input.packet.bytes.toString("base64"),
        detail: "high",
      },
    ],
    inputTextItems: [
      {
        id: "source_packet_manifest",
        text: [
          "SOURCE_PACKET_MANIFEST_JSON_BEGIN",
          JSON.stringify(input.packet.modelManifest),
          "SOURCE_PACKET_MANIFEST_JSON_END",
        ].join("\n"),
      },
    ],
    temperature: input.configuration.temperature ?? 0.2,
    reasoningEffort: input.configuration.reasoningEffort,
    maxTokens: input.configuration.maxOutputTokens,
    model: input.configuration.model,
    outputName: "generated_flashcards",
    promptVersion: resolveFlashcardPromptVersion(subject),
    schemaVersion: FLASHCARD_SCHEMA_VERSION,
    schemaReferenceStrategy: input.configuration.schemaReferenceStrategy,
    promptCache: {
      namespace: `flashcard:${subject.key.toLowerCase()}:${resolveFlashcardPromptVersion(subject)}`,
      keyEnabled: input.configuration.promptCacheKeyEnabled,
      retention: input.configuration.promptCacheRetention,
    },
    metadata: {
      lessonId: input.lessonId,
      documentIds: input.documentIds,
      sourceHash: input.sourceHash,
    },
  };
}
