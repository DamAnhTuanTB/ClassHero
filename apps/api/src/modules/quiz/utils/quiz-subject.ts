import type {
  QuizSubjectKey,
  QuizSubjectSnapshot,
} from "#api/modules/quiz/types/quiz-generation.types";

const SUBJECT_KEYS_BY_ALIAS: Record<string, QuizSubjectKey> = {
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

export function resolveQuizSubject(input: {
  domainName: string;
  domainSlug: string;
}): QuizSubjectSnapshot {
  const slug = input.domainSlug.trim().toLowerCase();
  const slugAlias = normalizeSubjectAlias(slug);
  const nameAlias = normalizeSubjectAlias(input.domainName);
  return {
    key:
      SUBJECT_KEYS_BY_ALIAS[slugAlias] ?? SUBJECT_KEYS_BY_ALIAS[nameAlias] ?? "GENERAL",
    name: input.domainName.trim(),
    slug,
  };
}
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
