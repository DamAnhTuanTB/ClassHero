import { Prisma, QuestionType } from "@prisma/client";
import { badRequestException } from "#api/common/errors/api-exception";

const pendingAnswerMarker = "__pending";
const unansweredMarker = "__unanswered";

export type StatementGradeResult = {
  statementId: string;
  selectedValue: boolean;
  correctValue: boolean;
  isCorrect: boolean;
  pointsAwarded: number;
};

export type QuestionGradeResult = {
  isCorrect: boolean;
  pointsAwarded: number;
  statementResults: StatementGradeResult[] | null;
};

export function createPendingAnswerJson(): Prisma.InputJsonObject {
  return { [pendingAnswerMarker]: true };
}

export function isPendingAnswerJson(value: Prisma.JsonValue): boolean {
  return (
    isRecord(value) &&
    value[pendingAnswerMarker] === true &&
    Object.keys(value).length === 1
  );
}

export function createUnansweredAnswerJson(): Prisma.InputJsonObject {
  return { [unansweredMarker]: true };
}

export function isUnansweredAnswerJson(value: Prisma.JsonValue): boolean {
  return (
    isRecord(value) && value[unansweredMarker] === true && Object.keys(value).length === 1
  );
}

export function assertCompleteStudentAnswer(input: {
  answerJson: unknown;
  optionsJson: Prisma.JsonValue | null;
  questionType: QuestionType;
}) {
  const { answerJson, optionsJson, questionType } = input;

  if (questionType === QuestionType.MULTIPLE_CHOICE) {
    if (
      !Array.isArray(answerJson) ||
      answerJson.length === 0 ||
      answerJson.some((value) => typeof value !== "string")
    ) {
      throw invalidAnswer("Bạn cần chọn ít nhất một phương án");
    }
    const optionIds = readOptionIds(optionsJson);
    if (
      new Set(answerJson).size !== answerJson.length ||
      answerJson.some((value) => !optionIds.includes(value))
    ) {
      throw invalidAnswer("Phương án trả lời chưa hợp lệ");
    }
    return;
  }

  if (questionType === QuestionType.TRUE_FALSE) {
    if (typeof answerJson !== "boolean") {
      throw invalidAnswer("Bạn cần chọn Đúng hoặc Sai");
    }
    return;
  }

  if (questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    const optionIds = readOptionIds(optionsJson);
    if (
      !Array.isArray(answerJson) ||
      answerJson.length !== optionIds.length ||
      answerJson.some(
        (value) =>
          !isRecord(value) ||
          typeof value.statementId !== "string" ||
          typeof value.value !== "boolean",
      )
    ) {
      throw invalidAnswer("Bạn cần trả lời đầy đủ mọi mệnh đề");
    }
    const answerIds = answerJson.map(
      (value) => (value as { statementId: string }).statementId,
    );
    if (
      new Set(answerIds).size !== answerIds.length ||
      answerIds.some((statementId) => !optionIds.includes(statementId))
    ) {
      throw invalidAnswer("Đáp án mệnh đề chưa hợp lệ");
    }
    return;
  }

  if (typeof answerJson !== "string" || answerJson.trim().length === 0) {
    throw invalidAnswer("Bạn cần nhập câu trả lời");
  }
}

export function gradeQuestionAnswer(input: {
  answerJson: Prisma.JsonValue;
  correctAnswerJson: Prisma.JsonValue;
  effectivePoints?: number;
  gradingConfigJson: Prisma.JsonValue | null;
  optionsJson: Prisma.JsonValue | null;
  questionType: QuestionType;
}): QuestionGradeResult {
  const { answerJson, correctAnswerJson, gradingConfigJson, optionsJson, questionType } =
    input;
  const effectivePoints = input.effectivePoints ?? 1;

  assertCompleteStudentAnswer({ answerJson, optionsJson, questionType });

  if (questionType === QuestionType.MULTIPLE_CHOICE) {
    const selected = readStringArray(answerJson, "đáp án đã chọn");
    const expected = readStringArray(correctAnswerJson, "đáp án đúng");
    const isCorrect = equalStringSets(selected, expected);
    return simpleResult(isCorrect, effectivePoints);
  }

  if (questionType === QuestionType.TRUE_FALSE) {
    if (typeof correctAnswerJson !== "boolean") {
      throw invalidStoredAnswer();
    }
    return simpleResult(answerJson === correctAnswerJson, effectivePoints);
  }

  if (questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    const selected = readStatementAnswers(answerJson);
    const expected = readStatementAnswers(correctAnswerJson);
    const expectedById = new Map(
      expected.map((answer) => [answer.statementId, answer.value]),
    );
    const pointsPerStatement =
      expected.length === 0 ? 0 : effectivePoints / expected.length;
    const statementResults = selected.map((answer) => {
      const correctValue = expectedById.get(answer.statementId);
      if (correctValue === undefined) {
        throw invalidStoredAnswer();
      }
      const isCorrect = answer.value === correctValue;
      return {
        statementId: answer.statementId,
        selectedValue: answer.value,
        correctValue,
        isCorrect,
        pointsAwarded: isCorrect ? roundScore(pointsPerStatement) : 0,
      };
    });
    const isCorrect =
      statementResults.length === expected.length &&
      statementResults.every((result) => result.isCorrect);
    return {
      isCorrect,
      pointsAwarded: roundScore(
        statementResults.reduce((sum, result) => sum + result.pointsAwarded, 0),
      ),
      statementResults,
    };
  }

  const acceptedAnswers = readStringArray(correctAnswerJson, "đáp án đúng");
  const gradingConfig = isRecord(gradingConfigJson) ? gradingConfigJson : {};
  const caseSensitive = gradingConfig.caseSensitive === true;
  const exactMatch = gradingConfig.exactMatch !== false;
  const selected = normalizeTextAnswer(String(answerJson), caseSensitive);
  const isCorrect = acceptedAnswers.some((answer) => {
    const expected = normalizeTextAnswer(answer, caseSensitive);
    return exactMatch ? selected === expected : selected.includes(expected);
  });

  return simpleResult(isCorrect, effectivePoints);
}

function simpleResult(isCorrect: boolean, effectivePoints: number): QuestionGradeResult {
  return {
    isCorrect,
    pointsAwarded: isCorrect ? roundScore(effectivePoints) : 0,
    statementResults: null,
  };
}

function readOptionIds(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) {
    throw invalidStoredAnswer();
  }
  const ids = value.flatMap((option) =>
    isRecord(option) && typeof option.id === "string" ? [option.id] : [],
  );
  if (ids.length !== value.length) {
    throw invalidStoredAnswer();
  }
  return ids;
}

function readStringArray(value: Prisma.JsonValue, fieldName: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw badRequestException(
      "ASSESSMENT_INVALID_STORED_CONTENT",
      `Dữ liệu ${fieldName} đang lưu không hợp lệ`,
    );
  }
  return value as string[];
}

function readStatementAnswers(value: Prisma.JsonValue) {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !isRecord(item) ||
        typeof item.statementId !== "string" ||
        typeof item.value !== "boolean",
    )
  ) {
    throw invalidStoredAnswer();
  }
  return value as Array<{ statementId: string; value: boolean }>;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidAnswer(message: string) {
  return badRequestException("ASSESSMENT_ANSWER_INCOMPLETE", message);
}

function invalidStoredAnswer() {
  return badRequestException(
    "ASSESSMENT_INVALID_STORED_CONTENT",
    "Dữ liệu câu hỏi đang lưu không hợp lệ",
  );
}
