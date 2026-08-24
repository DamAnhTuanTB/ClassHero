import type {
  CheckedAnswer,
  StudentAnswer,
  StudentAssessmentQuestion,
} from "@/features/student/lessons/types/student-lesson-types";
import { areEquivalentNumericAnswers } from "@learning-path/shared";

export function isStudentAnswerComplete(
  question: StudentAssessmentQuestion,
  answer: StudentAnswer | undefined,
) {
  if (question.questionType === "MULTIPLE_CHOICE") {
    return Array.isArray(answer) && answer.length === 1 && typeof answer[0] === "string";
  }
  if (question.questionType === "TRUE_FALSE") {
    return typeof answer === "boolean";
  }
  if (question.questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    return (
      Array.isArray(answer) &&
      answer.length === (question.optionsJson?.length ?? 0) &&
      answer.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "statementId" in item &&
          "value" in item,
      )
    );
  }
  if (typeof answer !== "string") {
    return false;
  }
  const normalizedAnswer = answer.trim();
  return normalizedAnswer.length > 0 && !normalizedAnswer.includes("\\placeholder");
}

export function isStudentAnswerSkipped(
  answer: StudentAnswer | undefined,
): answer is { __unanswered: true } {
  return (
    typeof answer === "object" &&
    answer !== null &&
    !Array.isArray(answer) &&
    answer.__unanswered === true &&
    Object.keys(answer).length === 1
  );
}

export function createSkippedQuizFeedback(
  question: StudentAssessmentQuestion,
): CheckedAnswer {
  if (question.correctAnswerJson === undefined) {
    throw new Error("Quiz chưa có dữ liệu đáp án để bỏ qua câu.");
  }

  const statementResults =
    question.questionType === "MULTI_STATEMENT_TRUE_FALSE"
      ? readStatementAnswers(question.correctAnswerJson).map((statement) => ({
          statementId: statement.statementId,
          selectedValue: null,
          correctValue: statement.value,
          isCorrect: false,
          pointsAwarded: 0,
        }))
      : null;

  return {
    isCorrect: false,
    isSkipped: true,
    correctAnswerJson: question.correctAnswerJson,
    statementResults,
    explanationJson: question.explanationJson ?? null,
    explanationBlock: question.explanationBlock ?? null,
  };
}

export function gradeStudentQuizAnswer(
  question: StudentAssessmentQuestion,
  answer: StudentAnswer,
): CheckedAnswer {
  const correctAnswer = question.correctAnswerJson;
  if (correctAnswer === undefined) {
    throw new Error("Quiz chưa có dữ liệu chấm ở trình duyệt.");
  }

  if (question.questionType === "MULTIPLE_CHOICE") {
    const selected = readStringAnswers(answer);
    const expected = readStringAnswers(correctAnswer);
    return createFeedback(equalStringSets(selected, expected), question, null);
  }

  if (question.questionType === "TRUE_FALSE") {
    return createFeedback(answer === correctAnswer, question, null);
  }

  if (question.questionType === "MULTI_STATEMENT_TRUE_FALSE") {
    const selected = readStatementAnswers(answer);
    const expected = readStatementAnswers(correctAnswer);
    const expectedById = new Map(
      expected.map((statement) => [statement.statementId, statement.value]),
    );
    const pointsPerStatement = expected.length === 0 ? 0 : 1 / expected.length;
    const statementResults = selected.map((statement) => {
      const correctValue = expectedById.get(statement.statementId);
      if (correctValue === undefined) {
        throw new Error("Đáp án mệnh đề của Quiz chưa hợp lệ.");
      }
      const isCorrect = statement.value === correctValue;
      return {
        statementId: statement.statementId,
        selectedValue: statement.value,
        correctValue,
        isCorrect,
        pointsAwarded: isCorrect ? roundScore(pointsPerStatement) : 0,
      };
    });
    return createFeedback(
      statementResults.length === expected.length &&
        statementResults.every((result) => result.isCorrect),
      question,
      statementResults,
    );
  }

  if (question.gradingConfigJson?.numericComparison === true) {
    const isCorrect = readStringAnswers(correctAnswer).some((expectedAnswer) =>
      areEquivalentNumericAnswers(String(answer), expectedAnswer),
    );
    return createFeedback(isCorrect, question, null);
  }

  const selected = normalizeTextAnswer(
    String(answer),
    question.gradingConfigJson?.caseSensitive === true,
  );
  const exactMatch = question.gradingConfigJson?.exactMatch !== false;
  const isCorrect = readStringAnswers(correctAnswer).some((expectedAnswer) => {
    const expected = normalizeTextAnswer(
      expectedAnswer,
      question.gradingConfigJson?.caseSensitive === true,
    );
    return exactMatch ? selected === expected : selected.includes(expected);
  });
  return createFeedback(isCorrect, question, null);
}

function createFeedback(
  isCorrect: boolean,
  question: StudentAssessmentQuestion,
  statementResults: CheckedAnswer["statementResults"],
): CheckedAnswer {
  return {
    isCorrect,
    correctAnswerJson: question.correctAnswerJson as StudentAnswer,
    statementResults,
    explanationJson: question.explanationJson ?? null,
    explanationBlock: question.explanationBlock ?? null,
  };
}

function readStringAnswers(answer: StudentAnswer) {
  if (!Array.isArray(answer) || answer.some((value) => typeof value !== "string")) {
    throw new Error("Đáp án Quiz chưa hợp lệ.");
  }
  return answer as string[];
}

function readStatementAnswers(answer: StudentAnswer) {
  if (
    !Array.isArray(answer) ||
    answer.some(
      (value) =>
        typeof value !== "object" ||
        value === null ||
        !("statementId" in value) ||
        !("value" in value) ||
        typeof value.statementId !== "string" ||
        typeof value.value !== "boolean",
    )
  ) {
    throw new Error("Đáp án mệnh đề của Quiz chưa hợp lệ.");
  }
  return answer as Array<{ statementId: string; value: boolean }>;
}

function equalStringSets(left: string[], right: string[]) {
  const normalizedLeft = [...new Set(left)].sort();
  const normalizedRight = [...new Set(right)].sort();
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function normalizeTextAnswer(value: string, caseSensitive: boolean) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return caseSensitive ? normalized : normalized.toLocaleLowerCase("vi");
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatDuration(seconds: number | null | undefined) {
  const safeSeconds = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}
