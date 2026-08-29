import { Difficulty, QuestionType } from "@prisma/client";

import {
  getGeneratedQuizStatementSolutions,
  QUIZ_SUBQUESTION_IDS,
  type GeneratedQuizQuestion,
  type GeneratedQuizSourceCoverageAudit,
} from "#api/modules/quiz/types/quiz-generation.types";

export type GenerationRecoveryIssue = {
  classification: "VALID" | "AUTO_FIXED" | "REVIEWABLE";
  code: string;
  message: string;
  questionIndex?: number;
  blocking: boolean;
  technicalDetails?: string;
};

export function validateQuizOutput(input: {
  questions: GeneratedQuizQuestion[];
  sourceCoverageAudit?: GeneratedQuizSourceCoverageAudit;
  requestedCount: number;
  requestedTypes: QuestionType[];
  requestedDifficulty: Difficulty;
  difficultyCounts: { easy: number; medium: number; hard: number } | null;
}) {
  const issues: GenerationRecoveryIssue[] = [];
  if (input.sourceCoverageAudit) {
    const audit = input.sourceCoverageAudit;
    const questionNumbers = audit.realWorldQuestions.map((item) => item.questionNumber);
    if (
      audit.sourceHasAssessableRealWorldApplication &&
      (!audit.sourceApplicationFamily || questionNumbers.length === 0)
    ) {
      issues.push({
        classification: "REVIEWABLE",
        code: "REAL_WORLD_SOURCE_COVERAGE_MISSING",
        message:
          "Nguồn có họ bài ứng dụng thực tế nhưng output chưa chỉ ra câu ứng dụng mới tương ứng.",
        blocking: true,
      });
    }
    if (
      questionNumbers.some(
        (questionNumber) => questionNumber < 1 || questionNumber > input.questions.length,
      ) ||
      new Set(questionNumbers).size !== questionNumbers.length
    ) {
      issues.push({
        classification: "REVIEWABLE",
        code: "REAL_WORLD_QUESTION_REFERENCE_INVALID",
        message: "Audit ứng dụng thực tế tham chiếu câu không tồn tại hoặc bị lặp.",
        blocking: true,
      });
    }
  }
  input.questions.forEach((question, questionIndex) => {
    if (!input.requestedTypes.includes(question.questionType)) {
      issues.push({
        classification: "REVIEWABLE",
        code: "QUESTION_TYPE_NOT_REQUESTED",
        message: "Câu hỏi có loại nằm ngoài cấu hình admin đã chọn.",
        questionIndex,
        blocking: false,
      });
    }

    if (question.questionType === QuestionType.MULTIPLE_CHOICE) {
      const optionIds = question.options.map((option) => option.id);
      if (
        new Set(optionIds).size !== optionIds.length ||
        !optionIds.includes(question.correctOptionId)
      ) {
        issues.push({
          classification: "REVIEWABLE",
          code: "ANSWER_INVALID",
          message: "Đáp án trắc nghiệm không khớp các lựa chọn có ID duy nhất.",
          questionIndex,
          blocking: false,
        });
      }
    }

    if (question.questionType === QuestionType.MULTI_STATEMENT_TRUE_FALSE) {
      const statementIds = question.statements.map((statement) => statement.id);
      const expectedStatementIds = QUIZ_SUBQUESTION_IDS.slice(
        0,
        question.statements.length,
      );
      const statementSolutions = getGeneratedQuizStatementSolutions(question) ?? [];
      const solutionIds = statementSolutions.map(
        (statementSolution) => statementSolution.statementId,
      );
      if (new Set(statementIds).size !== statementIds.length) {
        issues.push({
          classification: "REVIEWABLE",
          code: "STATEMENT_ID_DUPLICATED",
          message: "Các mệnh đề đúng/sai phải có ID duy nhất trong câu hỏi.",
          questionIndex,
          blocking: false,
        });
      }
      if (
        statementIds.some(
          (statementId, index) => statementId !== expectedStatementIds[index],
        )
      ) {
        issues.push({
          classification: "REVIEWABLE",
          code: "STATEMENT_ID_SEQUENCE_MISMATCH",
          message:
            "Các câu đúng/sai phải dùng nhãn liên tiếp a, b, c, d, ... theo đúng thứ tự.",
          questionIndex,
          blocking: false,
        });
      }
      if (
        new Set(solutionIds).size !== solutionIds.length ||
        statementIds.length !== solutionIds.length ||
        statementIds.some((statementId, index) => statementId !== solutionIds[index])
      ) {
        issues.push({
          classification: "REVIEWABLE",
          code: "STATEMENT_SOLUTION_COVERAGE_MISMATCH",
          message:
            "Lời giải đúng/sai nhiều câu phải có đúng một phần riêng cho từng câu a), b), c), ... và giữ nguyên thứ tự.",
          questionIndex,
          blocking: false,
        });
      }
    }
  });
  const questions = input.questions;

  if (input.questions.length !== input.requestedCount) {
    issues.push({
      classification: "REVIEWABLE",
      code: "INITIAL_COUNT_MISMATCH",
      message: `AI trả ${input.questions.length}/${input.requestedCount} câu ở lượt tạo ban đầu.`,
      blocking: false,
    });
  }
  if (
    input.requestedCount >= input.requestedTypes.length &&
    input.requestedTypes.some(
      (type) => !questions.some((question) => question.questionType === type),
    )
  ) {
    issues.push({
      classification: "REVIEWABLE",
      code: "QUESTION_TYPE_COVERAGE_MISMATCH",
      message: "Bộ câu hỏi chưa bao phủ đủ các loại câu đã chọn.",
      blocking: false,
    });
  }
  const typeCounts = input.requestedTypes.map(
    (type) => questions.filter((question) => question.questionType === type).length,
  );
  if (typeCounts.length > 1 && Math.max(...typeCounts) - Math.min(...typeCounts) > 1) {
    issues.push({
      classification: "REVIEWABLE",
      code: "QUESTION_TYPE_DISTRIBUTION_MISMATCH",
      message: "Các loại câu hỏi chưa được phân bổ đều nhất có thể.",
      blocking: false,
    });
  }
  if (
    input.requestedDifficulty !== Difficulty.MIXED &&
    questions.some((question) => question.difficulty !== input.requestedDifficulty)
  ) {
    issues.push({
      classification: "REVIEWABLE",
      code: "DIFFICULTY_MISMATCH",
      message: "Một số câu có độ khó khác cấu hình admin đã chọn.",
      blocking: false,
    });
  }
  if (input.difficultyCounts) {
    const actual = {
      easy: questions.filter((question) => question.difficulty === Difficulty.EASY)
        .length,
      medium: questions.filter((question) => question.difficulty === Difficulty.MEDIUM)
        .length,
      hard: questions.filter((question) => question.difficulty === Difficulty.HARD)
        .length,
    };
    if (
      actual.easy !== input.difficultyCounts.easy ||
      actual.medium !== input.difficultyCounts.medium ||
      actual.hard !== input.difficultyCounts.hard
    ) {
      issues.push({
        classification: "REVIEWABLE",
        code: "DIFFICULTY_DISTRIBUTION_MISMATCH",
        message: "Phân bổ Dễ/Trung bình/Khó chưa đúng số lượng đã cấu hình.",
        blocking: false,
      });
    }
  }

  return {
    questions,
    metadata: {
      initialGeneratedCount: input.questions.length,
      validQuestionCount: questions.length,
      issues,
    },
  };
}
