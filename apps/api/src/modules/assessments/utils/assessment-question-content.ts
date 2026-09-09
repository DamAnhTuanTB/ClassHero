import {
  AiExplanationTargetType,
  ContentSource,
  Prisma,
  QuestionType,
  ReviewStatus,
} from "@prisma/client";
import { badRequestException } from "#api/common/errors/api-exception";
import { getTiptapText } from "#api/common/validation/rich-text-content";
import {
  correctAnswerSchema,
  multiStatementCorrectAnswerSchema,
  multiStatementOptionsSchema,
  multipleChoiceOptionsSchema,
  textInputCorrectAnswerSchema,
  type QuizCorrectAnswer,
  type TextInputGradingConfig,
} from "#api/modules/quiz/types/quiz.types";

export type AssessmentAdminKind = "QUIZ" | "TEST";

export interface AssessmentQuestionContent {
  questionType: QuestionType;
  difficulty: unknown;
  questionJson: Record<string, unknown>;
  optionsJson?: Array<{ id: string; richText: Record<string, unknown> }> | null;
  correctAnswerJson: QuizCorrectAnswer;
  hintJson?: Record<string, unknown> | null;
  gradingConfigJson?: TextInputGradingConfig;
  explanationJson?: Record<string, unknown> | null;
}

export interface AssessmentQuestionPatch {
  questionType?: QuestionType;
  questionJson?: Record<string, unknown>;
  optionsJson?: Array<{ id: string; richText: Record<string, unknown> }> | null;
  correctAnswerJson?: QuizCorrectAnswer;
  hintJson?: Record<string, unknown> | null;
}

export function validateAssessmentQuestionContent(
  dto: AssessmentQuestionContent,
  kind: AssessmentAdminKind,
) {
  const prefix = kind === "QUIZ" ? "QUIZ" : "TEST";
  const label = kind === "QUIZ" ? "Câu trắc nghiệm" : "Đáp án đúng";

  if (getTiptapText(dto.questionJson).trim().length === 0) {
    throw badRequestException(
      `${prefix}_QUESTION_EMPTY_CONTENT`,
      "Nội dung câu hỏi không được để trống",
    );
  }

  const correctAnswer = correctAnswerSchema.safeParse(dto.correctAnswerJson);
  if (!correctAnswer.success) {
    throw badRequestException(
      `${prefix}_QUESTION_INVALID_CORRECT_ANSWER`,
      "Đáp án đúng chưa hợp lệ",
      correctAnswer.error.flatten(),
    );
  }

  if (dto.questionType === QuestionType.MULTIPLE_CHOICE) {
    const options = multipleChoiceOptionsSchema.safeParse(dto.optionsJson);
    if (!options.success) {
      throw badRequestException(
        `${prefix}_QUESTION_INVALID_OPTIONS`,
        "Câu hỏi trắc nghiệm cần ít nhất 2 phương án hợp lệ",
        options.error.flatten(),
      );
    }
    const optionIds = options.data.map((option) => option.id);
    const optionTexts = options.data.map((option) =>
      getTiptapText(option.richText).trim().toLocaleLowerCase("vi"),
    );
    if (new Set(optionIds).size !== optionIds.length) {
      throw badRequestException(
        `${prefix}_QUESTION_DUPLICATE_OPTIONS`,
        "Mã phương án trả lời không được trùng nhau",
      );
    }
    if (optionTexts.some((text) => text.length === 0)) {
      throw badRequestException(
        `${prefix}_QUESTION_EMPTY_OPTION`,
        "Nội dung phương án trả lời không được để trống",
      );
    }
    if (new Set(optionTexts).size !== optionTexts.length) {
      throw badRequestException(
        `${prefix}_QUESTION_DUPLICATE_OPTION_CONTENT`,
        "Nội dung các phương án trả lời không được trùng nhau",
      );
    }
    if (
      !Array.isArray(correctAnswer.data) ||
      correctAnswer.data.length !== 1 ||
      correctAnswer.data.some(
        (answerId) => typeof answerId !== "string" || !optionIds.includes(answerId),
      )
    ) {
      throw badRequestException(
        `${prefix}_QUESTION_CORRECT_OPTION_NOT_FOUND`,
        kind === "QUIZ"
          ? "Câu trắc nghiệm phải có đúng một đáp án và đáp án đó phải thuộc danh sách phương án"
          : `${label} phải thuộc danh sách phương án trả lời`,
      );
    }
  }

  if (
    dto.questionType === QuestionType.TRUE_FALSE &&
    typeof correctAnswer.data !== "boolean"
  ) {
    throw badRequestException(
      `${prefix}_QUESTION_INVALID_TRUE_FALSE_ANSWER`,
      "Câu hỏi đúng/sai phải chọn một đáp án đúng",
    );
  }

  if (dto.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    const statements = multiStatementOptionsSchema.safeParse(dto.optionsJson);
    if (!statements.success) {
      throw badRequestException(
        `${prefix}_QUESTION_INVALID_STATEMENTS`,
        "Câu hỏi đúng/sai nhiều mệnh đề cần ít nhất 2 mệnh đề hợp lệ",
        statements.error.flatten(),
      );
    }
    const statementIds = statements.data.map((statement) => statement.id);
    if (new Set(statementIds).size !== statementIds.length) {
      throw badRequestException(
        `${prefix}_QUESTION_DUPLICATE_STATEMENT_IDS`,
        "Mã mệnh đề không được trùng nhau",
      );
    }
    if (
      statements.data.some(
        (statement) => getTiptapText(statement.richText).trim().length === 0,
      )
    ) {
      throw badRequestException(
        `${prefix}_QUESTION_EMPTY_STATEMENT`,
        "Nội dung mệnh đề không được để trống",
      );
    }
    const answers = multiStatementCorrectAnswerSchema.safeParse(dto.correctAnswerJson);
    if (!answers.success) {
      throw badRequestException(
        `${prefix}_QUESTION_INVALID_STATEMENT_ANSWERS`,
        "Mỗi mệnh đề phải có một đáp án Đúng hoặc Sai",
        answers.error.flatten(),
      );
    }
    const answerIds = answers.data.map((answer) => answer.statementId);
    if (
      new Set(answerIds).size !== answerIds.length ||
      answerIds.length !== statementIds.length ||
      answerIds.some((statementId) => !statementIds.includes(statementId))
    ) {
      throw badRequestException(
        `${prefix}_QUESTION_STATEMENT_ANSWER_MISMATCH`,
        "Đáp án phải ánh xạ đúng một lần cho mọi mệnh đề",
      );
    }
  }

  if (dto.questionType === QuestionType.TEXT_INPUT) {
    const textAnswer = textInputCorrectAnswerSchema.safeParse(dto.correctAnswerJson);
    if (!textAnswer.success) {
      throw badRequestException(
        `${prefix}_QUESTION_INVALID_TEXT_ANSWERS`,
        "Câu hỏi nhập đáp án cần đúng một đáp án chuẩn hợp lệ",
        textAnswer.error.flatten(),
      );
    }
  }
}

export function changesAssessmentExplanationContext(dto: AssessmentQuestionPatch) {
  return [
    dto.questionType,
    dto.questionJson,
    dto.optionsJson,
    dto.correctAnswerJson,
    dto.hintJson,
  ].some((value) => value !== undefined);
}

export async function syncAssessmentExplanation(
  transaction: Prisma.TransactionClient,
  input: {
    currentExplanationId: string | null;
    explanationJson: Record<string, unknown> | null | undefined;
    lessonId: string;
    questionId: string;
    targetType: AiExplanationTargetType;
  },
) {
  if (input.explanationJson === undefined) return input.currentExplanationId;

  if (
    input.explanationJson === null ||
    getTiptapText(input.explanationJson).trim().length === 0
  ) {
    if (input.currentExplanationId) {
      await transaction.aiExplanation.delete({
        where: { id: input.currentExplanationId },
      });
    }
    return null;
  }

  if (input.currentExplanationId) {
    const explanation = await transaction.aiExplanation.update({
      where: { id: input.currentExplanationId },
      data: {
        contentJson: toInputJson(input.explanationJson),
        source: ContentSource.ADMIN,
        reviewStatus: ReviewStatus.APPROVED,
        staleAt: null,
      },
      select: { id: true },
    });
    return explanation.id;
  }

  const explanation = await transaction.aiExplanation.create({
    data: {
      targetType: input.targetType,
      targetId: input.questionId,
      lessonId: input.lessonId,
      contentJson: toInputJson(input.explanationJson),
      source: ContentSource.ADMIN,
      reviewStatus: ReviewStatus.APPROVED,
    },
    select: { id: true },
  });
  return explanation.id;
}

export function validateAssessmentDurationSeconds(value: number | undefined) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 60 ||
    value > 14_400
  ) {
    throw badRequestException(
      "TEST_SET_INVALID_DURATION",
      "Thời gian làm bài phải từ 60 đến 14400 giây",
    );
  }
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toNullableInputJson(
  value: unknown | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return toInputJson(value);
}

export function toRecord(
  value: Prisma.JsonValue,
  fieldName: string,
  kind: AssessmentAdminKind,
) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequestException(
      `${kind}_QUESTION_INVALID_STORED_DATA`,
      `Dữ liệu ${fieldName} đang lưu không hợp lệ`,
    );
  }
  return value as Record<string, unknown>;
}

export function toOptionalJsonRecord(
  value: Prisma.JsonValue | null | undefined,
  kind: AssessmentAdminKind,
) {
  return value === null || value === undefined
    ? undefined
    : toRecord(value, "richText", kind);
}

export function toOptionalJsonValue<T>(value: Prisma.JsonValue | null | undefined) {
  return value === null || value === undefined ? undefined : (value as T);
}
