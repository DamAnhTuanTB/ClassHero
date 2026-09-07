import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { LessonSummarySubjectSnapshot } from "#api/modules/ai/types/lesson-summary-subject.types";
import {
  LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT,
  LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT,
  LESSON_SUMMARY_MAX_OUTPUT_TOKENS,
  LESSON_SUMMARY_PROMPT_VERSIONS,
  resolveLessonSummaryOutputTokenFloor,
  LESSON_SUMMARY_SCHEMA_VERSION,
  type LessonSummaryJobInput,
} from "#api/modules/ai/types/lesson-summary.types";
import type { LessonSourcePacketModelManifest } from "#api/modules/ai/types/lesson-source-packet.types";
import { buildLessonSummarySubjectSystemPrompt } from "#api/modules/ai/utils/prompts/lesson-summary/lesson-summary-system-prompt-resolver";

export { buildLessonSummarySubjectSystemPrompt };

export function resolveLessonSummaryPromptVersion(
  subjectKey: LessonSummarySubjectSnapshot["key"],
) {
  return LESSON_SUMMARY_PROMPT_VERSIONS[subjectKey];
}

export function buildLessonSummaryUserPrompt(input: {
  lessonTitle: string;
  targetGrade: number | null;
  subject: LessonSummarySubjectSnapshot;
  configuration: Pick<
    LessonSummaryJobInput,
    "style" | "styleInstructions" | "length" | "targetWordCount" | "extraInstructions"
  > &
    Partial<
      Pick<LessonSummaryJobInput, "standardExerciseCount" | "realWorldExerciseCount">
    >;
}) {
  const configuration = input.configuration;
  const standardExerciseCount =
    configuration.standardExerciseCount ?? LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT;
  const realWorldExerciseCount =
    configuration.realWorldExerciseCount ??
    LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT;
  const resolvedStyleInstruction = (
    configuration.styleInstructions || styleInstructions[configuration.style]
  ).replace(/\.+$/, "");
  const resolvedLengthInstruction = lengthInstructions[configuration.length];
  return [
    "### NHIỆM VỤ SINH KIẾN THỨC",
    `- Bài học: ${input.lessonTitle}.`,
    `- Môn học của khóa: ${input.subject.name} (${input.subject.key}). Chỉ biên soạn theo đúng môn này, không pha hướng dẫn của môn khác.`,
    input.targetGrade
      ? `- Văn phong và cách trình bày cho học sinh lớp ${input.targetGrade}: ${resolvedStyleInstruction}. ${gradePresentationInstruction(input.targetGrade)}`
      : `- Văn phong và cách trình bày: ${resolvedStyleInstruction}. Chưa xác định khối lớp mục tiêu nên dùng mức diễn đạt trung tính và không tự thêm cấu trúc chuyên môn ngoài hồ sơ môn học.`,
    configuration.targetWordCount
      ? `- Độ dài: ${resolvedLengthInstruction}; mục tiêu khoảng ${configuration.targetWordCount} từ và có thể dao động hợp lý để bảo đảm nội dung đầy đủ, dễ đọc.`
      : `- Độ dài: ${resolvedLengthInstruction}; không cần bám theo một số từ cố định.`,
    `- Bài tập vận dụng cuối bài: tạo đúng ${standardExerciseCount} bài không thuộc dạng ứng dụng thực tế và đúng ${realWorldExerciseCount} bài ứng dụng thực tế; không gộp hai nhóm, không trả thiếu hoặc vượt số lượng.`,
    "- Mỗi bài phải bắt buộc dùng kiến thức trọng tâm của lesson. Với các bài tự tạo, nếu bỏ bối cảnh và số liệu mà mạch giải chính vẫn giống nhau thì phải thay bài.",
    ...(configuration.extraInstructions
      ? [`- Yêu cầu bổ sung của admin: ${configuration.extraInstructions}`]
      : []),
    "- Ưu tiên bao phủ đầy đủ kiến thức trọng tâm nhưng vẫn giữ đúng từng unit theory–illustration.",
    "- Không nhắc tới phần dữ liệu nguồn, mã tài liệu, prompt hoặc quy trình AI trong nội dung học tập.",
  ].join("\n");
}

export function buildLessonSummaryStructuredInput(input: {
  lessonId: string;
  lessonTitle: string;
  targetGrade?: number | null;
  subject: LessonSummarySubjectSnapshot;
  documentIds: string[];
  sourceHash: string;
  packet: {
    filename: string;
    bytes: Buffer;
    modelManifest: LessonSourcePacketModelManifest;
  };
  configuration: Parameters<typeof buildLessonSummaryUserPrompt>[0]["configuration"] &
    Partial<
      Pick<
        LessonSummaryJobInput,
        "schemaReferenceStrategy" | "promptCacheKeyEnabled" | "promptCacheRetention"
      >
    >;
  systemInstructions?: string;
  userPrompt?: string;
}): AiStructuredInput {
  const baseUserPrompt = buildLessonSummaryUserPrompt({
    lessonTitle: input.lessonTitle,
    targetGrade: input.targetGrade ?? null,
    subject: input.subject,
    configuration: input.configuration,
  });
  const customSystemInstructions = input.systemInstructions;
  const customUserPrompt = input.userPrompt;
  const defaultSystemPrompt = buildLessonSummarySubjectSystemPrompt(input.subject);
  const defaultUserPrompt = baseUserPrompt;

  const promptCacheKeyEnabled = input.configuration.promptCacheKeyEnabled ?? false;
  const promptCacheRetention = input.configuration.promptCacheRetention ?? "in_memory";

  return {
    systemPrompt:
      customSystemInstructions && customSystemInstructions.trim().length > 0
        ? customSystemInstructions
        : defaultSystemPrompt,
    userPrompt:
      customUserPrompt && customUserPrompt.trim().length > 0
        ? customUserPrompt
        : defaultUserPrompt,
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
        text: JSON.stringify(input.packet.modelManifest),
      },
    ],
    temperature: 0.1,
    maxTokens: Math.max(
      LESSON_SUMMARY_MAX_OUTPUT_TOKENS,
      resolveLessonSummaryOutputTokenFloor({
        length: input.configuration.length,
        targetWordCount: input.configuration.targetWordCount,
        standardExerciseCount: input.configuration.standardExerciseCount,
        realWorldExerciseCount: input.configuration.realWorldExerciseCount,
      }),
    ),
    metadata: {
      lessonId: input.lessonId,
      targetGrade: input.targetGrade ?? null,
      subject: input.subject,
      documentIds: input.documentIds,
      sourceHash: input.sourceHash,
    },
    outputName: "lesson_summary_provider_contract",
    promptVersion: resolveLessonSummaryPromptVersion(input.subject.key),
    schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
    schemaReferenceStrategy: input.configuration.schemaReferenceStrategy ?? "inline",
    ...(promptCacheKeyEnabled || promptCacheRetention === "24h"
      ? {
          promptCache: {
            namespace: "ls",
            keyEnabled: promptCacheKeyEnabled,
            retention: promptCacheRetention,
          },
        }
      : {}),
  };
}

const styleInstructions: Record<LessonSummaryJobInput["style"], string> = {
  student_friendly: "dễ hiểu, gần gũi và phù hợp với học sinh",
  concise:
    "đi thẳng vào ý chính và bỏ lặp, nhưng vẫn giữ đầy đủ nội dung sư phạm có trong nguồn",
  academic: "chặt chẽ, có cấu trúc học thuật và dùng thuật ngữ chính xác",
};

const lengthInstructions: Record<LessonSummaryJobInput["length"], string> = {
  short: "ngắn, chỉ giữ kiến thức thiết yếu",
  standard: "vừa đủ để học sinh học và ôn tập",
  detailed: "chi tiết, giải thích đầy đủ các ý quan trọng trong dữ liệu nguồn",
};

function gradePresentationInstruction(grade: number) {
  if (grade <= 4) {
    return "Ưu tiên câu ngắn, hoạt động quan sát–nhận biết phù hợp lứa tuổi và một mạch giải thích đơn giản.";
  }
  if (grade <= 6) {
    return "Trình bày ngắn, nêu rõ dữ kiện, thao tác và kết luận bằng thuật ngữ phù hợp lứa tuổi.";
  }
  if (grade <= 9) {
    return `Trình bày chặt chẽ theo chuẩn sách giáo khoa lớp ${grade}, nêu căn cứ cho từng kết luận quan trọng và tuân theo đúng cấu trúc của hồ sơ môn học.`;
  }
  return "Dùng văn phong học thuật chặt chẽ theo khối lớp, thuật ngữ và quy ước của hồ sơ môn học.";
}
