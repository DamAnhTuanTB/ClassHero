import { Inject, Injectable } from "@nestjs/common";
import { AttemptStatus, Prisma, ReviewStatus } from "@prisma/client";
import {
  assertCompleteStudentAnswer,
  createPendingAnswerJson,
  gradeQuestionAnswer,
  isPendingAnswerJson,
  validateStudentAnswerDraft,
} from "#api/common/assessment/question-grading";
import {
  badRequestException,
  conflictException,
  notFoundException,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import {
  QuizAttemptScopeDto,
  type SaveStudentQuizProgressDto,
  type StartStudentQuizAttemptDto,
  type StudentQuizAnswerDto,
} from "#api/modules/quiz/dto/student-quiz-attempt.dto";

const studentQuizQuestionSelect = {
  id: true,
  questionType: true,
  questionJson: true,
  optionsJson: true,
  correctAnswerJson: true,
  hintJson: true,
  gradingConfigJson: true,
  difficulty: true,
  sortOrder: true,
  explanation: {
    select: {
      contentJson: true,
      reviewStatus: true,
      staleAt: true,
    },
  },
} satisfies Prisma.QuizQuestionSelect;

@Injectable()
export class StudentQuizAttemptsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudentLessonAccessService)
    private readonly studentLessonAccessService: StudentLessonAccessService,
  ) {}

  async getLessonHistory(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);

    const where = {
      lessonId,
      studentUserId,
      sourceAttemptId: null,
      status: {
        in: [AttemptStatus.IN_PROGRESS, AttemptStatus.SUBMITTED, AttemptStatus.GRADED],
      },
      quizSet: {
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
    } satisfies Prisma.QuizAttemptWhereInput;
    const [attempts, completedTotal] = await Promise.all([
      this.prisma.quizAttempt.findMany({
        where,
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          quizSetId: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          correctCount: true,
          wrongCount: true,
          totalCount: true,
          _count: {
            select: {
              answers: {
                where: {
                  isAnswered: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.quizAttempt.count({
        where: {
          ...where,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        },
      }),
    ]);
    const latestSubmittedAtBySetId = new Map<string, Date>();
    attempts.forEach((attempt) => {
      if (!attempt.submittedAt) return;
      const current = latestSubmittedAtBySetId.get(attempt.quizSetId);
      if (!current || attempt.submittedAt > current) {
        latestSubmittedAtBySetId.set(attempt.quizSetId, attempt.submittedAt);
      }
    });
    const currentAttempt = attempts
      .filter((attempt) => {
        if (attempt.status !== AttemptStatus.IN_PROGRESS) return false;
        const latestSubmittedAt = latestSubmittedAtBySetId.get(attempt.quizSetId);
        return !latestSubmittedAt || attempt.startedAt > latestSubmittedAt;
      })
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];
    const historyAttempts = attempts
      .filter(
        (attempt) =>
          attempt.status !== AttemptStatus.IN_PROGRESS ||
          attempt.id === currentAttempt?.id,
      )
      .sort((left, right) => {
        if (left.status === AttemptStatus.IN_PROGRESS) return -1;
        if (right.status === AttemptStatus.IN_PROGRESS) return 1;
        return right.startedAt.getTime() - left.startedAt.getTime();
      })
      .slice(0, 50);
    const total = completedTotal + (currentAttempt ? 1 : 0);

    const sequenceByAttemptId = new Map(
      [...historyAttempts]
        .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime())
        .map((attempt, index) => [
          attempt.id,
          total - historyAttempts.length + index + 1,
        ]),
    );

    return {
      total,
      items: historyAttempts.map((attempt) => ({
        id: attempt.id,
        setId: attempt.quizSetId,
        displayName: `Bộ ${sequenceByAttemptId.get(attempt.id) ?? 1}`,
        state:
          attempt.status === AttemptStatus.IN_PROGRESS
            ? ("IN_PROGRESS" as const)
            : ("COMPLETED" as const),
        startedAt: attempt.startedAt,
        completedAt: attempt.submittedAt,
        answeredCount: attempt._count.answers,
        correctCount: attempt.correctCount,
        wrongCount: attempt.wrongCount,
        totalCount: attempt.totalCount,
        accuracyPercent:
          attempt.totalCount === 0
            ? 0
            : Math.round((attempt.correctCount / attempt.totalCount) * 100),
      })),
    };
  }

  async getAttemptStatus(quizSetId: string, studentUserId: string) {
    const quizSet = await this.prisma.quizSet.findFirst({
      where: {
        id: quizSetId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
      select: {
        id: true,
        lessonId: true,
      },
    });
    if (!quizSet) {
      throw notFoundException("QUIZ_SET_NOT_FOUND", "Không tìm thấy bộ Quiz");
    }
    await this.studentLessonAccessService.assertCanRead(quizSet.lessonId, studentUserId);

    const [currentAttempt, latestSubmittedAttempt] = await Promise.all([
      this.prisma.quizAttempt.findFirst({
        where: {
          quizSetId,
          studentUserId,
          sourceAttemptId: null,
          status: AttemptStatus.IN_PROGRESS,
        },
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          startedAt: true,
          answers: {
            select: {
              isAnswered: true,
              isChecked: true,
            },
          },
        },
      }),
      this.prisma.quizAttempt.findFirst({
        where: {
          quizSetId,
          studentUserId,
          sourceAttemptId: null,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          submittedAt: true,
          correctCount: true,
          wrongCount: true,
          totalCount: true,
        },
      }),
    ]);

    const latestSummary = latestSubmittedAttempt
      ? {
          id: latestSubmittedAttempt.id,
          correctCount: latestSubmittedAttempt.correctCount,
          wrongCount: latestSubmittedAttempt.wrongCount,
          totalCount: latestSubmittedAttempt.totalCount,
          accuracyPercent:
            latestSubmittedAttempt.totalCount === 0
              ? 0
              : Math.round(
                  (latestSubmittedAttempt.correctCount /
                    latestSubmittedAttempt.totalCount) *
                    100,
                ),
        }
      : null;
    const hasNewerCurrentAttempt =
      currentAttempt !== null &&
      (latestSubmittedAttempt?.submittedAt === null ||
        latestSubmittedAttempt?.submittedAt === undefined ||
        currentAttempt.startedAt > latestSubmittedAttempt.submittedAt);

    if (currentAttempt && hasNewerCurrentAttempt) {
      return {
        state: "IN_PROGRESS" as const,
        currentAttemptId: currentAttempt.id,
        answeredCount: currentAttempt.answers.filter((answer) => answer.isAnswered)
          .length,
        checkedCount: currentAttempt.answers.filter((answer) => answer.isChecked).length,
        latestSubmittedAttempt: latestSummary,
      };
    }

    return latestSummary
      ? {
          state: "COMPLETED" as const,
          currentAttemptId: null,
          answeredCount: latestSummary.totalCount,
          checkedCount: latestSummary.totalCount,
          latestSubmittedAttempt: latestSummary,
        }
      : {
          state: "NOT_STARTED" as const,
          currentAttemptId: null,
          answeredCount: 0,
          checkedCount: 0,
          latestSubmittedAttempt: null,
        };
  }

  async getCurrentAttempt(quizSetId: string, studentUserId: string) {
    const quizSet = await this.prisma.quizSet.findFirst({
      where: {
        id: quizSetId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
      select: {
        id: true,
        lessonId: true,
        title: true,
        questions: {
          where: {
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
          },
        },
      },
    });
    if (!quizSet) {
      throw notFoundException("QUIZ_SET_NOT_FOUND", "Không tìm thấy bộ Quiz");
    }
    await this.studentLessonAccessService.assertCanRead(quizSet.lessonId, studentUserId);

    const [attempt, latestSubmittedAttempt] = await Promise.all([
      this.prisma.quizAttempt.findFirst({
        where: {
          quizSetId,
          studentUserId,
          status: AttemptStatus.IN_PROGRESS,
        },
        orderBy: [{ startedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          startedAt: true,
          status: true,
          sourceAttemptId: true,
          totalCount: true,
          currentQuestionIndex: true,
          answers: {
            orderBy: { question: { sortOrder: "asc" } },
            select: {
              answerJson: true,
              isChecked: true,
              question: {
                select: studentQuizQuestionSelect,
              },
            },
          },
        },
      }),
      this.prisma.quizAttempt.findFirst({
        where: {
          quizSetId,
          studentUserId,
          sourceAttemptId: null,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        select: {
          submittedAt: true,
        },
      }),
    ]);
    if (!attempt) return null;
    if (
      latestSubmittedAttempt?.submittedAt &&
      attempt.startedAt <= latestSubmittedAttempt.submittedAt
    ) {
      return null;
    }

    const questionNumberById = createQuestionNumberById(quizSet.questions);
    const rootAttempt = attempt.sourceAttemptId
      ? await this.resolveRootAttempt(attempt.sourceAttemptId, studentUserId, quizSetId)
      : null;

    return {
      id: attempt.id,
      startedAt: attempt.startedAt,
      status: attempt.status,
      sourceAttemptId: attempt.sourceAttemptId,
      totalCount: attempt.totalCount,
      originalTotalCount: rootAttempt?.totalCount ?? quizSet.questions.length,
      currentQuestionIndex: Math.min(
        Math.max(0, attempt.currentQuestionIndex),
        Math.max(0, attempt.totalCount - 1),
      ),
      quizSet: {
        id: quizSet.id,
        title: quizSet.title,
      },
      questions: attempt.answers.map((answer) =>
        serializeRunnerQuestion(
          answer.question,
          questionNumberById.get(answer.question.id),
        ),
      ),
      savedAnswers: attempt.answers
        .filter((answer) => !isPendingAnswerJson(answer.answerJson))
        .map((answer) => ({
          questionId: answer.question.id,
          answerJson: answer.answerJson,
        })),
      checkedAnswers: attempt.answers
        .filter((answer) => answer.isChecked && !isPendingAnswerJson(answer.answerJson))
        .map((answer) => ({
          questionId: answer.question.id,
          answerJson: answer.answerJson,
          feedback: serializeCheckedAnswer(answer.question, answer.answerJson),
        })),
    };
  }

  async startAttempt(
    quizSetId: string,
    studentUserId: string,
    input: StartStudentQuizAttemptDto,
  ) {
    const quizSet = await this.prisma.quizSet.findFirst({
      where: {
        id: quizSetId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
      select: {
        id: true,
        lessonId: true,
        title: true,
        questions: {
          where: {
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: studentQuizQuestionSelect,
        },
      },
    });
    if (!quizSet) {
      throw notFoundException("QUIZ_SET_NOT_FOUND", "Không tìm thấy bộ Quiz");
    }
    await this.studentLessonAccessService.assertCanRead(quizSet.lessonId, studentUserId);

    const scope = input.scope ?? QuizAttemptScopeDto.ALL;
    let allowedQuestionIds = quizSet.questions.map((question) => question.id);
    let sourceAttemptId: string | null = null;
    let originalTotalCount = quizSet.questions.length;
    if (scope === QuizAttemptScopeDto.INCORRECT && !input.sourceAttemptId) {
      throw badRequestException(
        "QUIZ_SOURCE_ATTEMPT_REQUIRED",
        "Cần chọn lượt làm Quiz trước đó để làm lại câu sai",
      );
    }
    if (input.sourceAttemptId) {
      const source = await this.prisma.quizAttempt.findFirst({
        where: {
          id: input.sourceAttemptId,
          studentUserId,
          quizSetId,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        },
        select: {
          id: true,
          answers: {
            where: scope === QuizAttemptScopeDto.INCORRECT ? { isCorrect: false } : {},
            select: { questionId: true },
          },
        },
      });
      if (!source) {
        throw notFoundException(
          "QUIZ_SOURCE_ATTEMPT_NOT_FOUND",
          "Không tìm thấy lượt Quiz nguồn",
        );
      }
      const rootAttempt = await this.resolveRootAttempt(
        source.id,
        studentUserId,
        quizSetId,
      );
      sourceAttemptId = source.id;
      originalTotalCount = rootAttempt.totalCount;
      const approvedQuestionIds = new Set(allowedQuestionIds);
      allowedQuestionIds = source.answers
        .map((answer) => answer.questionId)
        .filter((questionId) => approvedQuestionIds.has(questionId));
      if (allowedQuestionIds.length === 0) {
        throw badRequestException(
          scope === QuizAttemptScopeDto.INCORRECT
            ? "QUIZ_NO_INCORRECT_QUESTIONS"
            : "QUIZ_SOURCE_ATTEMPT_EMPTY",
          scope === QuizAttemptScopeDto.INCORRECT
            ? "Lượt Quiz này không có câu sai để làm lại"
            : "Lượt Quiz nguồn không còn câu hỏi hợp lệ để làm lại",
        );
      }
    }

    if (allowedQuestionIds.length === 0) {
      throw badRequestException("QUIZ_SET_EMPTY", "Bộ Quiz chưa có câu hỏi được duyệt");
    }

    const attempt = await this.prisma.$transaction(async (transaction) => {
      await transaction.quizAttempt.updateMany({
        where: sourceAttemptId
          ? {
              studentUserId,
              quizSetId: quizSet.id,
              status: AttemptStatus.IN_PROGRESS,
            }
          : {
              studentUserId,
              lessonId: quizSet.lessonId,
              sourceAttemptId: null,
              status: AttemptStatus.IN_PROGRESS,
            },
        data: {
          status: AttemptStatus.CANCELLED,
        },
      });

      return transaction.quizAttempt.create({
        data: {
          studentUserId,
          lessonId: quizSet.lessonId,
          quizSetId: quizSet.id,
          sourceAttemptId,
          totalCount: allowedQuestionIds.length,
          answers: {
            create: allowedQuestionIds.map((questionId) => ({
              questionId,
              answerJson: createPendingAnswerJson(),
              isCorrect: false,
            })),
          },
        },
        select: {
          id: true,
          startedAt: true,
          status: true,
          totalCount: true,
          currentQuestionIndex: true,
        },
      });
    });
    const allowedQuestionIdSet = new Set(allowedQuestionIds);
    const questionNumberById = createQuestionNumberById(quizSet.questions);

    return {
      ...attempt,
      quizSet: {
        id: quizSet.id,
        title: quizSet.title,
      },
      scope,
      sourceAttemptId,
      originalTotalCount,
      questions: quizSet.questions
        .filter((question) => allowedQuestionIdSet.has(question.id))
        .map((question) =>
          serializeRunnerQuestion(question, questionNumberById.get(question.id)),
        ),
    };
  }

  async saveProgress(
    attemptId: string,
    studentUserId: string,
    input: SaveStudentQuizProgressDto,
  ) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        studentUserId,
      },
      select: {
        id: true,
        lessonId: true,
        status: true,
        totalCount: true,
        answers: {
          select: {
            id: true,
            questionId: true,
            isAnswered: true,
            isChecked: true,
            question: {
              select: {
                questionType: true,
                optionsJson: true,
                correctAnswerJson: true,
                gradingConfigJson: true,
              },
            },
          },
        },
      },
    });
    if (!attempt) {
      throw notFoundException("QUIZ_ATTEMPT_NOT_FOUND", "Không tìm thấy lượt Quiz");
    }
    await this.studentLessonAccessService.assertCanRead(attempt.lessonId, studentUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw conflictException(
        "QUIZ_ATTEMPT_NOT_IN_PROGRESS",
        "Lượt Quiz này đã kết thúc",
      );
    }
    if (
      input.currentQuestionIndex < 0 ||
      input.currentQuestionIndex >= attempt.totalCount
    ) {
      throw badRequestException(
        "QUIZ_CURRENT_QUESTION_INVALID",
        "Vị trí câu Quiz chưa hợp lệ",
      );
    }

    const draftAnswer = input.answer
      ? attempt.answers.find((answer) => answer.questionId === input.answer?.questionId)
      : undefined;
    if (input.answer && !draftAnswer) {
      throw badRequestException(
        "QUIZ_QUESTION_NOT_IN_ATTEMPT",
        "Câu hỏi không thuộc lượt Quiz này",
      );
    }

    const normalizedAnswerJson =
      input.answer && draftAnswer ? toJsonValue(input.answer.answerJson) : null;
    const draftState =
      normalizedAnswerJson !== null && draftAnswer
        ? validateStudentAnswerDraft({
            answerJson: normalizedAnswerJson,
            optionsJson: draftAnswer.question.optionsJson,
            questionType: draftAnswer.question.questionType,
          })
        : null;
    const checkedGrade =
      input.answer?.isChecked && normalizedAnswerJson !== null && draftAnswer
        ? gradeQuestionAnswer({
            answerJson: normalizedAnswerJson,
            correctAnswerJson: draftAnswer.question.correctAnswerJson,
            gradingConfigJson: draftAnswer.question.gradingConfigJson,
            optionsJson: draftAnswer.question.optionsJson,
            questionType: draftAnswer.question.questionType,
          })
        : null;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          currentQuestionIndex: input.currentQuestionIndex,
        },
      });

      if (
        draftAnswer &&
        normalizedAnswerJson !== null &&
        draftState &&
        !draftAnswer.isChecked
      ) {
        await transaction.quizAttemptAnswer.updateMany({
          where: {
            id: draftAnswer.id,
            isChecked: false,
          },
          data: {
            answerJson: toInputJson(normalizedAnswerJson),
            isAnswered: checkedGrade ? true : draftState.isAnswered,
            isChecked: Boolean(checkedGrade),
            isCorrect: checkedGrade?.isCorrect ?? false,
          },
        });
      }
    });

    const answeredCount = attempt.answers.filter((answer) =>
      answer.id === draftAnswer?.id && !answer.isChecked && draftState
        ? checkedGrade
          ? true
          : draftState.isAnswered
        : answer.isAnswered,
    ).length;
    const checkedCount = attempt.answers.filter((answer) =>
      answer.id === draftAnswer?.id && !answer.isChecked && checkedGrade
        ? true
        : answer.isChecked,
    ).length;

    return {
      attemptId: attempt.id,
      currentQuestionIndex: input.currentQuestionIndex,
      answeredCount,
      checkedCount,
    };
  }

  async checkAnswer(
    attemptId: string,
    questionId: string,
    studentUserId: string,
    rawAnswerJson: unknown,
  ) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        studentUserId,
      },
      select: {
        id: true,
        lessonId: true,
        status: true,
        answers: {
          where: { questionId },
          select: {
            id: true,
            answerJson: true,
            isChecked: true,
            question: {
              select: studentQuizQuestionSelect,
            },
          },
        },
      },
    });
    if (!attempt) {
      throw notFoundException("QUIZ_ATTEMPT_NOT_FOUND", "Không tìm thấy lượt Quiz");
    }
    await this.studentLessonAccessService.assertCanRead(attempt.lessonId, studentUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw conflictException(
        "QUIZ_ATTEMPT_NOT_IN_PROGRESS",
        "Lượt Quiz này đã kết thúc",
      );
    }

    const answer = attempt.answers[0];
    if (!answer) {
      throw badRequestException(
        "QUIZ_QUESTION_NOT_IN_ATTEMPT",
        "Câu hỏi không thuộc lượt Quiz này",
      );
    }
    const answerJson = toJsonValue(rawAnswerJson);
    assertCompleteStudentAnswer({
      answerJson,
      optionsJson: answer.question.optionsJson,
      questionType: answer.question.questionType,
    });

    if (answer.isChecked) {
      if (!jsonValuesEqual(answer.answerJson, answerJson)) {
        throw conflictException(
          "QUIZ_ANSWER_ALREADY_CHECKED",
          "Câu trả lời này đã được kiểm tra",
        );
      }
      return serializeCheckedAnswer(answer.question, answer.answerJson);
    }

    const grade = gradeQuestionAnswer({
      answerJson,
      correctAnswerJson: answer.question.correctAnswerJson,
      gradingConfigJson: answer.question.gradingConfigJson,
      optionsJson: answer.question.optionsJson,
      questionType: answer.question.questionType,
    });
    await this.prisma.quizAttemptAnswer.update({
      where: { id: answer.id },
      data: {
        answerJson: toInputJson(answerJson),
        isAnswered: true,
        isChecked: true,
        isCorrect: grade.isCorrect,
      },
    });

    return serializeCheckedAnswer(answer.question, answerJson);
  }

  async submitAttempt(
    attemptId: string,
    studentUserId: string,
    submittedAnswers: StudentQuizAnswerDto[],
  ) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, studentUserId },
      select: {
        id: true,
        lessonId: true,
        quizSetId: true,
        sourceAttemptId: true,
        status: true,
        totalCount: true,
        answers: {
          select: {
            id: true,
            questionId: true,
            question: {
              select: studentQuizQuestionSelect,
            },
          },
        },
      },
    });
    if (!attempt) {
      throw notFoundException("QUIZ_ATTEMPT_NOT_FOUND", "Không tìm thấy lượt Quiz");
    }
    await this.studentLessonAccessService.assertCanRead(attempt.lessonId, studentUserId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw conflictException(
        "QUIZ_ATTEMPT_NOT_IN_PROGRESS",
        "Lượt Quiz này đã được nộp",
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
        "QUIZ_ATTEMPT_INCOMPLETE",
        "Bạn cần trả lời đầy đủ các câu thuộc bài Quiz",
      );
    }

    const gradedAnswers = attempt.answers.map((answer) => {
      const answerJson = toJsonValue(submittedByQuestionId.get(answer.questionId));
      assertCompleteStudentAnswer({
        answerJson,
        optionsJson: answer.question.optionsJson,
        questionType: answer.question.questionType,
      });
      return {
        ...answer,
        answerJson,
        grade: gradeQuestionAnswer({
          answerJson,
          correctAnswerJson: answer.question.correctAnswerJson,
          gradingConfigJson: answer.question.gradingConfigJson,
          optionsJson: answer.question.optionsJson,
          questionType: answer.question.questionType,
        }),
      };
    });
    const correctCount = gradedAnswers.filter((answer) => answer.grade.isCorrect).length;
    const rootAttempt = attempt.sourceAttemptId
      ? await this.resolveRootAttempt(
          attempt.sourceAttemptId,
          studentUserId,
          attempt.quizSetId,
        )
      : null;
    const { aggregateResult, submittedResult } = await this.prisma.$transaction(
      async (transaction) => {
        for (const answer of gradedAnswers) {
          await transaction.quizAttemptAnswer.update({
            where: { id: answer.id },
            data: {
              answerJson: toInputJson(answer.answerJson),
              isAnswered: true,
              isChecked: true,
              isCorrect: answer.grade.isCorrect,
            },
          });
        }

        await transaction.quizAttempt.updateMany({
          where: {
            id: { not: attempt.id },
            quizSetId: attempt.quizSetId,
            studentUserId,
            status: AttemptStatus.IN_PROGRESS,
          },
          data: {
            status: AttemptStatus.CANCELLED,
          },
        });

        const submittedRetry = await transaction.quizAttempt.update({
          where: { id: attempt.id },
          data: {
            status: AttemptStatus.SUBMITTED,
            submittedAt: new Date(),
            correctCount,
            wrongCount: attempt.totalCount - correctCount,
          },
          select: {
            id: true,
            sourceAttemptId: true,
            status: true,
            submittedAt: true,
            correctCount: true,
            wrongCount: true,
            totalCount: true,
          },
        });

        if (!rootAttempt) {
          return {
            aggregateResult: submittedRetry,
            submittedResult: submittedRetry,
          };
        }

        for (const answer of gradedAnswers) {
          await transaction.quizAttemptAnswer.updateMany({
            where: {
              attemptId: rootAttempt.id,
              questionId: answer.questionId,
              isCorrect: false,
            },
            data: {
              answerJson: toInputJson(answer.answerJson),
              isAnswered: true,
              isChecked: true,
              isCorrect: answer.grade.isCorrect,
            },
          });
        }

        const sourceAnswers = await transaction.quizAttemptAnswer.findMany({
          where: {
            attemptId: rootAttempt.id,
          },
          select: {
            isCorrect: true,
          },
        });
        const cumulativeCorrectCount = sourceAnswers.filter(
          (answer) => answer.isCorrect,
        ).length;

        const updatedAggregate = await transaction.quizAttempt.update({
          where: {
            id: rootAttempt.id,
          },
          data: {
            submittedAt: new Date(),
            correctCount: cumulativeCorrectCount,
            wrongCount: sourceAnswers.length - cumulativeCorrectCount,
          },
          select: {
            id: true,
            sourceAttemptId: true,
            status: true,
            submittedAt: true,
            correctCount: true,
            wrongCount: true,
            totalCount: true,
          },
        });
        return {
          aggregateResult: updatedAggregate,
          submittedResult: submittedRetry,
        };
      },
    );

    return {
      ...submittedResult,
      accuracyPercent:
        submittedResult.totalCount === 0
          ? 0
          : Math.round((submittedResult.correctCount / submittedResult.totalCount) * 100),
      aggregateResult: {
        ...aggregateResult,
        accuracyPercent:
          aggregateResult.totalCount === 0
            ? 0
            : Math.round(
                (aggregateResult.correctCount / aggregateResult.totalCount) * 100,
              ),
      },
    };
  }

  async reviewAttempt(
    attemptId: string,
    studentUserId: string,
    scope: QuizAttemptScopeDto,
  ) {
    if (!Object.values(QuizAttemptScopeDto).includes(scope)) {
      throw badRequestException(
        "QUIZ_REVIEW_SCOPE_INVALID",
        "Phạm vi xem lại không hợp lệ",
      );
    }
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: {
        id: attemptId,
        studentUserId,
        status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
      },
      select: {
        id: true,
        lessonId: true,
        quizSetId: true,
        sourceAttemptId: true,
        correctCount: true,
        wrongCount: true,
        totalCount: true,
        quizSet: {
          select: {
            questions: {
              where: {
                deletedAt: null,
                reviewStatus: ReviewStatus.APPROVED,
              },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              select: {
                id: true,
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
            question: {
              select: studentQuizQuestionSelect,
            },
          },
        },
      },
    });
    if (!attempt) {
      throw notFoundException(
        "QUIZ_ATTEMPT_REVIEW_NOT_FOUND",
        "Chưa thể xem lại lượt Quiz này",
      );
    }
    await this.studentLessonAccessService.assertCanRead(attempt.lessonId, studentUserId);
    const questionNumberById = createQuestionNumberById(attempt.quizSet.questions);
    const rootAttempt = attempt.sourceAttemptId
      ? await this.resolveRootAttempt(
          attempt.sourceAttemptId,
          studentUserId,
          attempt.quizSetId,
        )
      : null;

    return {
      id: attempt.id,
      sourceAttemptId: attempt.sourceAttemptId,
      quizSetId: attempt.quizSetId,
      scope,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      totalCount: attempt.totalCount,
      originalTotalCount: rootAttempt?.totalCount ?? attempt.totalCount,
      questions: attempt.answers.map((answer) => ({
        ...serializeRunnerQuestion(
          answer.question,
          questionNumberById.get(answer.question.id),
        ),
        answerJson: answer.answerJson,
        ...serializeCheckedAnswer(answer.question, answer.answerJson),
      })),
    };
  }

  private async resolveRootAttempt(
    attemptId: string,
    studentUserId: string,
    quizSetId: string,
  ) {
    const visitedAttemptIds = new Set<string>();
    let currentAttemptId = attemptId;

    while (!visitedAttemptIds.has(currentAttemptId)) {
      visitedAttemptIds.add(currentAttemptId);
      const currentAttempt = await this.prisma.quizAttempt.findFirst({
        where: {
          id: currentAttemptId,
          studentUserId,
          quizSetId,
          status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
        },
        select: {
          id: true,
          sourceAttemptId: true,
          totalCount: true,
        },
      });
      if (!currentAttempt) {
        throw notFoundException(
          "QUIZ_SOURCE_ATTEMPT_NOT_FOUND",
          "Không tìm thấy lượt Quiz nguồn",
        );
      }
      if (!currentAttempt.sourceAttemptId) {
        return currentAttempt;
      }
      currentAttemptId = currentAttempt.sourceAttemptId;
    }

    throw conflictException(
      "QUIZ_ATTEMPT_SOURCE_CYCLE",
      "Chuỗi lượt làm lại Quiz không hợp lệ",
    );
  }
}

function serializeRunnerQuestion(
  question: Prisma.QuizQuestionGetPayload<{
    select: typeof studentQuizQuestionSelect;
  }>,
  questionNumber = question.sortOrder + 1,
) {
  return {
    id: question.id,
    questionType: question.questionType,
    questionJson: question.questionJson,
    optionsJson: question.optionsJson,
    hintJson: question.hintJson,
    correctAnswerJson: question.correctAnswerJson,
    gradingConfigJson: question.gradingConfigJson,
    explanationJson:
      question.explanation?.reviewStatus === ReviewStatus.APPROVED &&
      question.explanation.staleAt === null
        ? question.explanation.contentJson
        : null,
    difficulty: question.difficulty,
    sortOrder: question.sortOrder,
    questionNumber,
    hasExplanation:
      question.explanation?.reviewStatus === ReviewStatus.APPROVED &&
      question.explanation.staleAt === null,
  };
}

function createQuestionNumberById(questions: ReadonlyArray<{ id: string }>) {
  return new Map(questions.map((question, index) => [question.id, index + 1]));
}

function serializeCheckedAnswer(
  question: Prisma.QuizQuestionGetPayload<{
    select: typeof studentQuizQuestionSelect;
  }>,
  answerJson: Prisma.JsonValue,
) {
  const grade = gradeQuestionAnswer({
    answerJson,
    correctAnswerJson: question.correctAnswerJson,
    gradingConfigJson: question.gradingConfigJson,
    optionsJson: question.optionsJson,
    questionType: question.questionType,
  });
  return {
    isCorrect: grade.isCorrect,
    correctAnswerJson: question.correctAnswerJson,
    statementResults: grade.statementResults,
    explanationJson:
      question.explanation?.reviewStatus === ReviewStatus.APPROVED &&
      question.explanation.staleAt === null
        ? question.explanation.contentJson
        : null,
  };
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

function jsonValuesEqual(left: Prisma.JsonValue, right: Prisma.JsonValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}
