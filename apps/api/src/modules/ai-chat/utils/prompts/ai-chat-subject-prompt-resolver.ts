import type { AiChatSubjectKey } from "#api/modules/ai-chat/types/ai-chat.types";
import { CHEMISTRY_AI_CHAT_SUBJECT_PROMPT } from "#api/modules/ai-chat/utils/prompts/chemistry-ai-chat-subject-prompt";
import { GENERAL_AI_CHAT_SUBJECT_PROMPT } from "#api/modules/ai-chat/utils/prompts/general-ai-chat-subject-prompt";
import { MATH_AI_CHAT_SUBJECT_PROMPT } from "#api/modules/ai-chat/utils/prompts/math-ai-chat-subject-prompt";
import { PHYSICS_AI_CHAT_SUBJECT_PROMPT } from "#api/modules/ai-chat/utils/prompts/physics-ai-chat-subject-prompt";

type AiChatSubjectPromptProfile = {
  sectionLabel: string;
  rules: readonly string[];
};

const SUBJECT_PROMPTS: Record<AiChatSubjectKey, AiChatSubjectPromptProfile> = {
  MATH: MATH_AI_CHAT_SUBJECT_PROMPT,
  PHYSICS: PHYSICS_AI_CHAT_SUBJECT_PROMPT,
  CHEMISTRY: CHEMISTRY_AI_CHAT_SUBJECT_PROMPT,
  GENERAL: GENERAL_AI_CHAT_SUBJECT_PROMPT,
};

export function resolveAiChatSubjectPrompt(subjectKeys: AiChatSubjectKey[]) {
  const uniqueKeys = [
    ...new Set(subjectKeys.length > 0 ? subjectKeys : (["GENERAL"] as const)),
  ];
  const profiles = uniqueKeys.map((key) => SUBJECT_PROMPTS[key]);

  if (profiles.length === 1) {
    const profile = profiles[0]!;
    return {
      sectionTitle: `HỒ SƠ CHUYÊN MÔN — ${profile.sectionLabel}`,
      content: formatRules(profile.rules),
    };
  }

  return {
    sectionTitle: "HỒ SƠ CHUYÊN MÔN THEO MÔN",
    content: [
      "Lượt này có nhiều môn. Xác định môn của từng phần và chỉ áp dụng hồ sơ tương ứng.",
      ...profiles.map((profile) =>
        [`### ${profile.sectionLabel}`, formatRules(profile.rules)].join("\n"),
      ),
    ].join("\n\n"),
  };
}

function formatRules(rules: readonly string[]) {
  return rules.map((rule) => `- ${rule}`).join("\n");
}
