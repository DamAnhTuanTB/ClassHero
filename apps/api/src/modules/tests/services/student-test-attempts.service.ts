import { Inject, Injectable } from "@nestjs/common";
import {
  AttemptStatus,
  LessonProgressStatus,
  Prisma,
  ReviewStatus,
} from "@prisma/client";
import {
  assertCompleteStudentAnswer,
  createPendingAnswerJson,
  gradeQuestionAnswer,
  isUnansweredAnswerJson,
} from "#api/common/assessment/question-grading";
import {
  badRequestException,
  conflictException,
  forbiddenException,
  notFoundException,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import { QuizAttemptScopeDto } from "#api/modules/quiz/dto/student-quiz-attempt.dto";
import { StudentLearningPrerequisitesService } from "#api/modules/student-learning/services/student-learning-prerequisites.service";
import type { StudentTestAnswerDto } from "#api/modules/tests/dto/student-test-attempt.dto";
import { calculateEffectivePoints } from "#api/modules/tests/utils/test-question-content";

const studentTestQuestionSelect = {
  id: true,
  questionType: true,
  questionJson: true,
  optionsJson: true,
  correctAnswerJson: true,
  gradingConfigJson: true,
  sourceMetadataJson: true,
  points: true,
  difficulty: true,
  sortOrder: true,
  explanation: {
    select: {
      contentJson: true,
      reviewStatus: true,
      staleAt: true,
    },
  },
} satisfies Prisma.TestQuestionSelect;

type StudentTestQuestionRecord = Prisma.TestQuestionGetPayload<{
  select: typeof studentTestQuestionSelect;
}>;

@Injectable()
export class StudentTestAttemptsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudentLessonAccessService)
    private readonly studentLessonAccessService: StudentLessonAccessService,
    @Inject(StudentLearningPrerequisitesService)
    private readonly prerequisitesService: StudentLearningPrerequisitesService,
  ) {}

  async getLessonHistory(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);

    const approvedSetWhere = {
      lessonId,
      deletedAt: null,
      isReserve: false,
      reviewStatus: ReviewStatus.APPROVED,
      questions: {
        some: {
          deletedAt: null,
          reviewStatus: ReviewStatus.APPROVED,
        },
      },
    } satisfies Prisma.TestSetWhereInput;
    const completedAttemptWhere = {
      lessonId,
      studentUserId,
      status: {
        in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED],
      },
      testSet: approvedSetWhere,
    } satisfies Prisma.TestAttemptWhereInput;
    const [sets, previousAttempts, completedAttempts, completedTotal] = await Promise.all(
      [
        this.prisma.testSet.findMany({
          where: approvedSetWhere,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            title: true,
            durationSeconds: true,
            _count: {
              select: {
                questions: {
                  where: {
                    deletedAt: null,
                    reviewStatus: ReviewStatus.APPROVED,
                  },
                },
              },
            },
          },
        }),
        this.prisma.testAttempt.findMany({
          where: { lessonId, studentUserId },
          orderBy: { startedAt: "desc" },
          select: { testSetId: true },
        }),
        this.prisma.testAttempt.findMany({
          where: completedAttemptWhere,
          orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
          take: 50,
          select: {
            id: true,
            testSetId: true,
            startedAt: true,
            submittedAt: true,
            durationSeconds: true,
            score: true,
            correctCount: true,
            totalCount: true,
          },
        }),
        this.prisma.testAttempt.count({
          where: completedAttemptWhere,
        }),
      ],
    );
    const currentSet = selectNextTestSet(sets, previousAttempts);
    const currentCompletedAttempt = currentSet
      ? completedAttempts.find((attempt) => attempt.testSetId === currentSet.id)
      : undefined;
    const pendingItemId =
      currentSet && !currentCompletedAttempt ? `not-started:${currentSet.id}` : null;
    const currentItemId = pendingItemId ?? completedAttempts[0]?.id ?? null;
    const sequenceByAttemptId = new Map(
      [...completedAttempts]
        .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
        .map((attempt, index) => [
          attempt.id,
          completedTotal - completedAttempts.length + index + 1,
        ]),
    );
    const completedItems = completedAttempts.map((attempt) => ({
      id: attempt.id,
      attemptId: attempt.id,
      setId: attempt.testSetId,
      displayName: `Bài thi ${sequenceByAttemptId.get(attempt.id) ?? 1}`,
      state: "COMPLETED" as const,
      startedAt: attempt.startedAt,
      completedAt: attempt.submittedAt,
      durationSeconds: attempt.durationSeconds,
      score: attempt.score === null ? null : Number(attempt.score),
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
    }));
    const pendingItem =
      currentSet && pendingItemId
        ? {
            id: pendingItemId,
            attemptId: null,
            setId: currentSet.id,
            displayName: `Bài thi ${completedTotal + 1}`,
            state: "NOT_STARTED" as const,
            startedAt: null,
            completedAt: null,
            durationSeconds: currentSet.durationSeconds,
            score: null,
            correctCount: 0,
            totalCount: currentSet._count.questions,
          }
        : null;

    return {
      total: completedTotal + (pendingItem ? 1 : 0),
      currentItemId,
      items: pendingItem ? [pendingItem, ...completedItems] : completedItems,
    };
  }

  async startAttempt(lessonId: string, studentUserId: string) {
    const prerequisites = await this.prerequisitesService.getTestPrerequisites(
      lessonId,
      studentUserId,
    );
    if (!prerequisites.canStart) {
      if (prerequisites.lockReason === "TRIAL_NOT_ALLOWED") {
        throw forbiddenException(
          "TEST_NOT_AVAILABLE_FOR_TRIAL",
          "Bài kiểm tra không mở trong chế độ học thử",
        );
      }
      if (prerequisites.lockReason === "BEFORE_OPEN_TIME") {
        throw forbiddenException("TEST_NOT_OPEN_YET", "Bài kiểm tra chưa đến giờ mở", {
          examOpenAt: prerequisites.examOpenAt,
        });
      }
      throw forbiddenException(
        "TEST_PREREQUISITES_INCOMPLETE",
        "Hoàn thành xong quiz và flashcard để mở khóa bài kiểm tra.",
        {
          quiz: prerequisites.quiz,
          flashcard: prerequisites.flashcard,
        },
      );
    }

    const sets = await this.prisma.testSet.findMany({
      where: {
        lessonId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
        questions: {
          some: {
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        durationSeconds: true,
        totalScore: true,
        questions: {
          where: {
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: studentTestQuestionSelect,
        },
      },
    });
    if (sets.length === 0) {
      throw notFoundException("TEST_SET_NOT_FOUND", "Buổi học chưa có bộ đề được duyệt");
    }
    const previousAttempts = await this.prisma.testAttempt.findMany({
      where: { studentUserId, lessonId },
      orderBy: { startedAt: "desc" },
      select: { testSetId: true },
    });
    const set = selectNextTestSet(sets, previousAttempts);
    if (!set) {
      throw notFoundException("TEST_SET_NOT_FOUND", "Buổi học chưa có bộ đề được duyệt");
    }

    const attempt = await this.prisma.testAttempt.create({
      data: {
        studentUserId,
        lessonId,
        testSetId: set.id,
        totalCount: set.questions.length,
        answers: {
          create: set.questions.map((question) => ({
            questionId: question.id,
            answerJson: createPendingAnswerJson(),
            isCorrect: false,
          })),
        },
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        totalCount: true,
      },
    });

    return {
      ...attempt,
      testSet: {
        id: set.id,
        title: set.title,
        durationSeconds: set.durationSeconds,
        totalScore: Number(set.totalScore),
      },
      questions: set.questions.map(serializeTestRunnerQuestion),
    };
  }

  async submitAttempt(
    attemptId: string,
    studentUserId: string,
    submittedAnswers: StudentTestAnswerDto[],
  ) {
    const attempt = await this.prisma.testAttempt.findFirst({
      where: { id: attemptId, studentUserId },
      select: {
        id: true,
        lessonId: true,
        status: true,
        startedAt: true,
        totalCount: true,
        testSet: {
          select: {
            durationSeconds: true,
            totalScore: true,
          },
        },
        answers: {
          select: {
            id: true,
            questionId: true,
            question: {
              select: studentTestQuestionSelect,
            },
          },
        },
      },
    });
    if (!attempt) {
      throw notFoundException("TEST_ATTEMPT_NOT_FOUND", "Không tìm thấy lượt kiểm tra");
    }
    await this.studentLessonAccessService.assertCanRead(attempt.lessonId, studentUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw conflictException(
        "TEST_ATTEMPT_NOT_IN_PROGRESS",
        "Bài kiểm tra này đã được nộp",
      );
    }
    const submittedByQuestionId = new Map(
      submittedAnswers.map((answer) => [answer.questionId, answer.answerJson]),
    );
    if (
      submittedByQuestionId.size !== submittedAnswers.length ||
      attempt.answers.length !== attempt.totalCount ||
      submittedByQuestionId.size !== attempt.answers.length ||
      attempt.answers.some((answer) => !submittedByQuestionId.has(answer.questionId))
    ) {
      throw badRequestException(
        "TEST_ATTEMPT_INCOMPLETE",
        "Bạn cần trả lời đầy đủ các câu thuộc bài kiểm tra",
      );
    }

    const effectivePoints = calculateEffectivePoints(
      attempt.answers.map((answer) =>
        answer.question.points === null ? null : Number(answer.question.points),
      ),
      Number(attempt.testSet.totalScore),
    );
    const gradedAnswers = attempt.answers.map((answer, index) => {
      const answerJson = toJsonValue(submittedByQuestionId.get(answer.questionId));
      if (!isUnansweredAnswerJson(answerJson)) {
        assertCompleteStudentAnswer({
          answerJson,
          optionsJson: answer.question.optionsJson,
          questionType: answer.question.questionType,
        });
      }
      const grade = isUnansweredAnswerJson(answerJson)
        ? {
            isCorrect: false,
            pointsAwarded: 0,
            statementResults: null,
          }
        : gradeQuestionAnswer({
            answerJson,
            correctAnswerJson: answer.question.correctAnswerJson,
            effectivePoints: effectivePoints[index],
            gradingConfigJson: answer.question.gradingConfigJson,
            optionsJson: answer.question.optionsJson,
            questionType: answer.question.questionType,
          });
      return {
        ...answer,
        answerJson,
        grade,
      };
    });
    const earnedPoints = gradedAnswers.reduce(
      (sum, answer) => sum + answer.grade.pointsAwarded,
      0,
    );
    const totalScore = Number(attempt.testSet.totalScore);
    const score = totalScore <= 0 ? 0 : roundScore((earnedPoints / totalScore) * 10);
    const correctCount = gradedAnswers.filter((answer) => answer.grade.isCorrect).length;
    const submittedAt = new Date();
    const durationSeconds = Math.min(
      attempt.testSet.durationSeconds,
      Math.max(
        0,
        Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000),
      ),
    );

    const result = await this.prisma.$transaction(async (transaction) => {
      for (const answer of gradedAnswers) {
        await transaction.testAttemptAnswer.update({
          where: { id: answer.id },
          data: {
            answerJson: toInputJson(answer.answerJson),
            isCorrect: answer.grade.isCorrect,
            pointsAwarded: answer.grade.pointsAwarded,
          },
        });
      }
      const submittedAttempt = await transaction.testAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.SUBMITTED,
          submittedAt,
          durationSeconds,
          score,
          correctCount,
          wrongCount: attempt.totalCount - correctCount,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          durationSeconds: true,
          score: true,
          correctCount: true,
          wrongCount: true,
          totalCount: true,
          lesson: {
            select: { completionMinScore: true },
          },
        },
      });

      const completionMinScore = Number(submittedAttempt.lesson.completionMinScore);
      if (Number(submittedAttempt.score) >= completionMinScore) {
        await this.applyPassingResult(transaction, {
          attemptId: submittedAttempt.id,
          durationSeconds,
          lessonId: attempt.lessonId,
          score: Number(submittedAttempt.score),
          studentUserId,
        });
      }

      return submittedAttempt;
    });

    const { lesson, ...submittedAttempt } = result;
    const completionMinScore = Number(lesson.completionMinScore);

    return {
      ...submittedAttempt,
      score: Number(result.score),
      completionMinScore,
      passed: Number(result.score) >= completionMinScore,
    };
  }

  async reviewAttempt(
    attemptId: string,
    studentUserId: string,
    scope: QuizAttemptScopeDto,
  ) {
    if (!Object.values(QuizAttemptScopeDto).includes(scope)) {
      throw badRequestException(
        "TEST_REVIEW_SCOPE_INVALID",
        "Phạm vi xem lại không hợp lệ",
      );
    }
    const attempt = await this.prisma.testAttempt.findFirst({
      where: {
        id: attemptId,
        studentUserId,
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
      },
      select: {
        id: true,
        lessonId: true,
        testSetId: true,
        durationSeconds: true,
        score: true,
        correctCount: true,
        wrongCount: true,
        totalCount: true,
        lesson: { select: { completionMinScore: true } },
        testSet: {
          select: {
            totalScore: true,
            questions: {
              where: {
                reviewStatus: ReviewStatus.APPROVED,
                deletedAt: null,
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
                points: true,
              },
            },
          },
        },
        answers: {
          where: scope === QuizAttemptScopeDto.INCORRECT ? { isCorrect: false } : {},
          orderBy: { question: { sortOrder: "asc" } },
          select: {
            answerJson: true,
            isCorrect: true,
            pointsAwarded: true,
            question: { select: studentTestQuestionSelect },
          },
        },
      },
    });
    if (!attempt) {
      throw notFoundException(
        "TEST_ATTEMPT_REVIEW_NOT_FOUND",
        "Chưa thể xem lại bài kiểm tra này",
      );
    }
    await this.studentLessonAccessService.assertCanRead(attempt.lessonId, studentUserId);
    const effectivePoints = calculateEffectivePoints(
      attempt.testSet.questions.map((question) =>
        question.points === null ? null : Number(question.points),
      ),
      Number(attempt.testSet.totalScore),
    );
    const effectivePointsByQuestionId = new Map(
      attempt.testSet.questions.map((question, index) => [
        question.id,
        effectivePoints[index],
      ]),
    );

    return {
      id: attempt.id,
      testSetId: attempt.testSetId,
      scope,
      durationSeconds: attempt.durationSeconds,
      score: Number(attempt.score),
      completionMinScore: Number(attempt.lesson.completionMinScore),
      passed: Number(attempt.score) >= Number(attempt.lesson.completionMinScore),
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      totalCount: attempt.totalCount,
      questions: attempt.answers.map((answer) => {
        const grade = isUnansweredAnswerJson(answer.answerJson)
          ? {
              isCorrect: false,
              pointsAwarded: 0,
              statementResults: null,
            }
          : gradeQuestionAnswer({
              answerJson: answer.answerJson,
              correctAnswerJson: answer.question.correctAnswerJson,
              effectivePoints:
                effectivePointsByQuestionId.get(answer.question.id) ??
                Number(answer.pointsAwarded ?? 0),
              gradingConfigJson: answer.question.gradingConfigJson,
              optionsJson: answer.question.optionsJson,
              questionType: answer.question.questionType,
            });
        return {
          ...serializeTestRunnerQuestion(answer.question),
          answerJson: answer.answerJson,
          isCorrect: answer.isCorrect,
          correctAnswerJson: answer.question.correctAnswerJson,
          pointsAwarded: Number(answer.pointsAwarded ?? 0),
          statementResults: grade.statementResults,
          explanationJson: serializeApprovedExplanation(answer.question),
          explanationExampleBlock: serializeApprovedExplanationExample(answer.question),
        };
      }),
    };
  }

  private async applyPassingResult(
    transaction: Prisma.TransactionClient,
    input: {
      attemptId: string;
      durationSeconds: number;
      lessonId: string;
      score: number;
      studentUserId: string;
    },
  ) {
    const currentProgress = await transaction.lessonProgress.findUnique({
      where: {
        studentUserId_lessonId: {
          studentUserId: input.studentUserId,
          lessonId: input.lessonId,
        },
      },
      select: {
        bestTestAttemptId: true,
        bestScore: true,
        bestDurationSeconds: true,
        completedAt: true,
      },
    });
    const currentBestScore =
      currentProgress?.bestScore === null || currentProgress?.bestScore === undefined
        ? null
        : Number(currentProgress.bestScore);
    const isBetter = isCandidateBetter(
      input.score,
      input.durationSeconds,
      currentBestScore,
      currentProgress?.bestDurationSeconds ?? null,
    );

    if (isBetter && currentProgress?.bestTestAttemptId !== input.attemptId) {
      await transaction.testAttempt.updateMany({
        where: {
          studentUserId: input.studentUserId,
          lessonId: input.lessonId,
          isBestForLesson: true,
        },
        data: { isBestForLesson: false },
      });
      await transaction.testAttempt.update({
        where: { id: input.attemptId },
        data: {
          isBestForLesson: true,
          status: AttemptStatus.GRADED,
        },
      });
    }

    const completedAt = currentProgress?.completedAt ?? new Date();
    await transaction.lessonProgress.upsert({
      where: {
        studentUserId_lessonId: {
          studentUserId: input.studentUserId,
          lessonId: input.lessonId,
        },
      },
      create: {
        studentUserId: input.studentUserId,
        lessonId: input.lessonId,
        status: LessonProgressStatus.COMPLETED,
        bestTestAttemptId: input.attemptId,
        bestScore: input.score,
        bestDurationSeconds: input.durationSeconds,
        completedAt,
      },
      update: {
        status: LessonProgressStatus.COMPLETED,
        completedAt,
        ...(isBetter
          ? {
              bestTestAttemptId: input.attemptId,
              bestScore: input.score,
              bestDurationSeconds: input.durationSeconds,
            }
          : {}),
      },
    });
  }

  async getLeaderboard(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const attempts = await this.prisma.testAttempt.findMany({
      where: {
        lessonId,
        isBestForLesson: true,
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        score: { not: null },
        durationSeconds: { not: null },
      },
      orderBy: [{ score: "desc" }, { durationSeconds: "asc" }, { submittedAt: "asc" }],
      take: 5,
      select: {
        id: true,
        studentUserId: true,
        score: true,
        durationSeconds: true,
        studentUser: {
          select: {
            fullName: true,
            username: true,
          },
        },
      },
    });
    return {
      entries: attempts.map((attempt, index) => ({
        rank: index + 1,
        attemptId: attempt.id,
        studentName:
          attempt.studentUser.fullName?.trim() ||
          attempt.studentUser.username ||
          "Học sinh",
        score: Number(attempt.score),
        durationSeconds: attempt.durationSeconds,
        isCurrentStudent: attempt.studentUserId === studentUserId,
      })),
    };
  }
}

function selectNextTestSet<T extends { id: string }>(
  sets: T[],
  previousAttempts: Array<{ testSetId: string }>,
) {
  if (sets.length === 0) return undefined;
  const attemptedIds = new Set(previousAttempts.map((attempt) => attempt.testSetId));
  return (
    sets.find((candidate) => !attemptedIds.has(candidate.id)) ??
    sets[previousAttempts.length % sets.length]
  );
}

function serializeTestRunnerQuestion(question: StudentTestQuestionRecord) {
  return {
    id: question.id,
    questionType: question.questionType,
    questionJson: question.questionJson,
    optionsJson: question.optionsJson,
    difficulty: question.difficulty,
    sortOrder: question.sortOrder,
  };
}

function serializeApprovedExplanation(question: StudentTestQuestionRecord) {
  return question.explanation?.reviewStatus === ReviewStatus.APPROVED &&
    question.explanation.staleAt === null
    ? question.explanation.contentJson
    : null;
}

function serializeApprovedExplanationExample(question: StudentTestQuestionRecord) {
  if (
    question.explanation?.reviewStatus !== ReviewStatus.APPROVED ||
    question.explanation.staleAt !== null
  ) {
    return null;
  }
  const metadata = question.sourceMetadataJson;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const exampleBlock = metadata.exampleBlock;
  return exampleBlock && typeof exampleBlock === "object" && !Array.isArray(exampleBlock)
    ? exampleBlock
    : null;
}

function isCandidateBetter(
  candidateScore: number,
  candidateDuration: number,
  bestScore: number | null,
  bestDuration: number | null,
) {
  if (bestScore === null) return true;
  if (candidateScore > bestScore) return true;
  if (candidateScore < bestScore) return false;
  return bestDuration === null || candidateDuration < bestDuration;
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw badRequestException("ASSESSMENT_ANSWER_INVALID", "Câu trả lời chưa hợp lệ");
  }
  return JSON.parse(serialized) as Prisma.JsonValue;
}

function toInputJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
