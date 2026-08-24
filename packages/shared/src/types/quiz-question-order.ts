export const QUIZ_QUESTION_TYPE_ORDER = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "MULTI_STATEMENT_TRUE_FALSE",
  "TEXT_INPUT",
] as const;

export type OrderedQuizQuestionType = (typeof QUIZ_QUESTION_TYPE_ORDER)[number];

const quizQuestionTypeRank = new Map<string, number>(
  QUIZ_QUESTION_TYPE_ORDER.map((questionType, index) => [questionType, index]),
);

/**
 * Groups Quiz questions by the student-facing type order while preserving the
 * existing order inside each type. Callers should provide their normal stable
 * database order (sortOrder, createdAt, id) before using this helper.
 */
export function orderQuizQuestionsByType<T extends { questionType: string }>(
  questions: readonly T[],
): T[] {
  return questions
    .map((question, sourceIndex) => ({ question, sourceIndex }))
    .sort((left, right) => {
      const typeDifference =
        getQuizQuestionTypeRank(left.question.questionType) -
        getQuizQuestionTypeRank(right.question.questionType);

      return typeDifference || left.sourceIndex - right.sourceIndex;
    })
    .map(({ question }) => question);
}

function getQuizQuestionTypeRank(questionType: string) {
  return quizQuestionTypeRank.get(questionType) ?? Number.MAX_SAFE_INTEGER;
}
