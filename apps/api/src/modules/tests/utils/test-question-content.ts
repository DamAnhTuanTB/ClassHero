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
  textInputGradingSchema,
} from "#api/modules/quiz/types/quiz.types";
import type {
  TestQuestionContentDto,
  UpdateTestQuestionContentDto,
} from "#api/modules/tests/dto/test-content.dto";

export function validateQuestionContent(dto: TestQuestionContentDto) {
  if (getTiptapText(dto.questionJson).trim().length === 0) {
    throw badRequestException(
      "TEST_QUESTION_EMPTY_CONTENT",
      "Nội dung câu hỏi không được để trống",
    );
  }

  const correctAnswer = correctAnswerSchema.safeParse(dto.correctAnswerJson);
  if (!correctAnswer.success) {
    throw badRequestException(
      "TEST_QUESTION_INVALID_CORRECT_ANSWER",
      "Đáp án đúng chưa hợp lệ",
      correctAnswer.error.flatten(),
    );
  }

  if (dto.questionType === QuestionType.MULTIPLE_CHOICE) {
    const options = multipleChoiceOptionsSchema.safeParse(dto.optionsJson);
    if (!options.success) {
      throw badRequestException(
        "TEST_QUESTION_INVALID_OPTIONS",
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
        "TEST_QUESTION_DUPLICATE_OPTIONS",
        "Mã phương án trả lời không được trùng nhau",
      );
    }
    if (optionTexts.some((text) => text.length === 0)) {
      throw badRequestException(
        "TEST_QUESTION_EMPTY_OPTION",
        "Nội dung phương án trả lời không được để trống",
      );
    }
    if (new Set(optionTexts).size !== optionTexts.length) {
      throw badRequestException(
        "TEST_QUESTION_DUPLICATE_OPTION_CONTENT",
        "Nội dung các phương án trả lời không được trùng nhau",
      );
    }
    if (
      !Array.isArray(correctAnswer.data) ||
      correctAnswer.data.some(
        (answerId) => typeof answerId !== "string" || !optionIds.includes(answerId),
      )
    ) {
      throw badRequestException(
        "TEST_QUESTION_CORRECT_OPTION_NOT_FOUND",
        "Đáp án đúng phải thuộc danh sách phương án trả lời",
      );
    }
  }

  if (
    dto.questionType === QuestionType.TRUE_FALSE &&
    typeof correctAnswer.data !== "boolean"
  ) {
    throw badRequestException(
      "TEST_QUESTION_INVALID_TRUE_FALSE_ANSWER",
      "Câu hỏi đúng/sai phải chọn một đáp án đúng",
    );
  }

  if (dto.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
    const statements = multiStatementOptionsSchema.safeParse(dto.optionsJson);
    if (!statements.success) {
      throw badRequestException(
        "TEST_QUESTION_INVALID_STATEMENTS",
        "Câu hỏi đúng/sai nhiều mệnh đề cần ít nhất 2 mệnh đề hợp lệ",
        statements.error.flatten(),
      );
    }

    const statementIds = statements.data.map((statement) => statement.id);
    if (new Set(statementIds).size !== statementIds.length) {
      throw badRequestException(
        "TEST_QUESTION_DUPLICATE_STATEMENT_IDS",
        "Mã mệnh đề không được trùng nhau",
      );
    }
    if (
      statements.data.some(
        (statement) => getTiptapText(statement.richText).trim().length === 0,
      )
    ) {
      throw badRequestException(
        "TEST_QUESTION_EMPTY_STATEMENT",
        "Nội dung mệnh đề không được để trống",
      );
    }

    const answers = multiStatementCorrectAnswerSchema.safeParse(dto.correctAnswerJson);
    if (!answers.success) {
      throw badRequestException(
        "TEST_QUESTION_INVALID_STATEMENT_ANSWERS",
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
        "TEST_QUESTION_STATEMENT_ANSWER_MISMATCH",
        "Đáp án phải ánh xạ đúng một lần cho mọi mệnh đề",
      );
    }
  }

  if (dto.questionType === QuestionType.TEXT_INPUT) {
    if (
      !Array.isArray(correctAnswer.data) ||
      correctAnswer.data.some(
        (answer) => typeof answer !== "string" || answer.trim().length === 0,
      )
    ) {
      throw badRequestException(
        "TEST_QUESTION_INVALID_TEXT_ANSWERS",
        "Câu hỏi nhập đáp án cần ít nhất một câu trả lời hợp lệ",
      );
    }
    const gradingConfig = textInputGradingSchema.safeParse(dto.gradingConfigJson ?? {});
    if (!gradingConfig.success) {
      throw badRequestException(
        "TEST_QUESTION_INVALID_GRADING_CONFIG",
        "Cấu hình chấm câu trả lời chưa hợp lệ",
        gradingConfig.error.flatten(),
      );
    }
  }
}

export function changesExplanationContext(dto: UpdateTestQuestionContentDto) {
  return [
    dto.questionType,
    dto.questionJson,
    dto.optionsJson,
    dto.correctAnswerJson,
    dto.hintJson,
  ].some((value) => value !== undefined);
}

export async function syncExplanation(
  transaction: Prisma.TransactionClient,
  input: {
    currentExplanationId: string | null;
    explanationJson: Record<string, unknown> | null | undefined;
    lessonId: string;
    questionId: string;
  },
) {
  if (input.explanationJson === undefined) {
    return input.currentExplanationId;
  }
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
      targetType: AiExplanationTargetType.TEST_QUESTION,
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

export function calculateEffectivePoints(
  storedPoints: Array<number | null>,
  totalScore: number,
) {
  const explicitTotal = storedPoints.reduce(
    (sum: number, points) => sum + (points ?? 0),
    0,
  );
  const automaticCount = storedPoints.filter((points) => points === null).length;
  const remainingHundredths = Math.max(0, Math.round((totalScore - explicitTotal) * 100));
  const baseHundredths =
    automaticCount === 0 ? 0 : Math.floor(remainingHundredths / automaticCount);
  let remainder = automaticCount === 0 ? 0 : remainingHundredths % automaticCount;

  return storedPoints.map((points) => {
    if (points !== null) {
      return points;
    }
    const hundredths = baseHundredths + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return hundredths / 100;
  });
}

export function toRecord(value: Prisma.JsonValue, fieldName: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequestException(
      "TEST_QUESTION_INVALID_STORED_DATA",
      `Dữ liệu ${fieldName} đang lưu không hợp lệ`,
    );
  }
  return value as Record<string, unknown>;
}

export function toOptionalJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value === null || value === undefined ? undefined : toRecord(value, "richText");
}

export function toOptionalJsonValue<T>(value: Prisma.JsonValue | null | undefined) {
  return value === null || value === undefined ? undefined : (value as T);
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
