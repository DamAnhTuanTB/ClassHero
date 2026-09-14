import type {
  AiChatScopeSubject,
  AiChatSubjectKey,
} from "#api/modules/ai-chat/types/ai-chat.types";

const SUBJECT_KEYS_BY_ALIAS: Record<string, AiChatSubjectKey> = {
  toan: "MATH",
  "toan-hoc": "MATH",
  math: "MATH",
  mathematics: "MATH",
  ly: "PHYSICS",
  li: "PHYSICS",
  "vat-ly": "PHYSICS",
  "vat-li": "PHYSICS",
  physics: "PHYSICS",
  hoa: "CHEMISTRY",
  "hoa-hoc": "CHEMISTRY",
  chemistry: "CHEMISTRY",
};

export function resolveAiChatSubject(input: {
  domainName: string;
  domainSlug: string;
}): AiChatSubjectKey {
  return (
    SUBJECT_KEYS_BY_ALIAS[normalizeSubjectAlias(input.domainSlug)] ??
    SUBJECT_KEYS_BY_ALIAS[normalizeSubjectAlias(input.domainName)] ??
    "GENERAL"
  );
}

export function resolveAiChatTurnSubjectKeys(input: {
  scopeSubjects: AiChatScopeSubject[];
  targetLearningPathId?: string;
  sourceLearningPathIds: string[];
}): AiChatSubjectKey[] {
  const byLearningPathId = new Map(
    input.scopeSubjects.map((subject) => [subject.learningPathId, subject.key]),
  );
  const relevantLearningPathIds = input.targetLearningPathId
    ? [input.targetLearningPathId]
    : input.sourceLearningPathIds.length > 0
      ? input.sourceLearningPathIds
      : input.scopeSubjects.length === 1
        ? [input.scopeSubjects[0]!.learningPathId]
        : [];
  const keys = relevantLearningPathIds.flatMap((learningPathId) => {
    const key = byLearningPathId.get(learningPathId);
    return key ? [key] : [];
  });
  const uniqueKeys = [...new Set(keys)].sort(compareAiChatSubjectKeys);
  return uniqueKeys.length > 0 ? uniqueKeys : ["GENERAL"];
}

function compareAiChatSubjectKeys(left: AiChatSubjectKey, right: AiChatSubjectKey) {
  return SUBJECT_ORDER.indexOf(left) - SUBJECT_ORDER.indexOf(right);
}

const SUBJECT_ORDER: AiChatSubjectKey[] = ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"];

function normalizeSubjectAlias(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}
