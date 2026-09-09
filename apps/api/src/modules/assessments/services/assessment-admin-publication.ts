import { ContentSource, ReviewStatus } from "@prisma/client";

import type { getRequestContext } from "#api/common/api/request-context";
import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { toInputJson } from "#api/modules/assessments/utils/assessment-question-content";
import { resolveAssessmentReviewAction } from "#api/modules/assessments/services/assessment-admin-policy";
import {
  QuizSetReviewActionDto,
  type ReviewQuizSetDto,
} from "#api/modules/quiz/dto/review-quiz-set.dto";
import { readQuizGenerationQuestionReference } from "#api/modules/quiz/utils/quiz-generation-output";

type AssessmentKind = "QUIZ" | "TEST";
type RequestContext = ReturnType<typeof getRequestContext>;

/** Shared SAVE/PUBLISH/WITHDRAW state machine for Quiz and timed Quiz (Test). */
export async function reviewAssessmentSet(
  prisma: PrismaService,
  kind: AssessmentKind,
  setId: string,
  userId: string,
  input: ReviewQuizSetDto,
  context: RequestContext,
) {
  const current =
    kind === "QUIZ"
      ? await prisma.quizSet.findUnique({
          where: { id: setId, deletedAt: null },
          select: { id: true, reviewStatus: true },
        })
      : await prisma.testSet.findUnique({
          where: { id: setId, deletedAt: null },
          select: { id: true, reviewStatus: true },
        });
  if (!current) {
    throw notFoundException(
      "NOT_FOUND",
      kind === "QUIZ" ? "Không tìm thấy bộ câu hỏi" : "Không tìm thấy bộ đề",
    );
  }
  const action = resolveAssessmentReviewAction(input);
  return prisma.$transaction(async (transaction) => {
    if (action === QuizSetReviewActionDto.PUBLISH) {
      const approvedQuestionCount =
        kind === "QUIZ"
          ? await transaction.quizQuestion.count({
              where: {
                quizSetId: setId,
                deletedAt: null,
                reviewStatus: ReviewStatus.APPROVED,
              },
            })
          : await transaction.testQuestion.count({
              where: {
                testSetId: setId,
                deletedAt: null,
                reviewStatus: ReviewStatus.APPROVED,
              },
            });
      if (approvedQuestionCount < 1) {
        throw badRequestException(
          `${kind}_SET_HAS_NO_APPROVED_QUESTIONS`,
          `Cần có ít nhất 1 câu ${kind === "QUIZ" ? "Quiz" : "Test"} được duyệt để phát hành`,
          { approvedQuestionCount },
        );
      }
    }
    const latestPublication =
      action !== QuizSetReviewActionDto.SAVE
        ? null
        : kind === "QUIZ"
          ? await transaction.quizQuestion.findFirst({
              where: {
                quizSetId: setId,
                deletedAt: null,
                publishedAt: { not: null },
              },
              orderBy: { publishedAt: "desc" },
              select: { publishedAt: true },
            })
          : await transaction.testQuestion.findFirst({
              where: {
                testSetId: setId,
                deletedAt: null,
                publishedAt: { not: null },
              },
              orderBy: { publishedAt: "desc" },
              select: { publishedAt: true },
            });
    const publishedAt = latestPublication?.publishedAt ?? new Date();
    if (
      action === QuizSetReviewActionDto.SAVE ||
      action === QuizSetReviewActionDto.PUBLISH
    ) {
      if (kind === "QUIZ") {
        await transaction.quizQuestion.updateMany({
          where: {
            quizSetId: setId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          data: { publishedAt },
        });
      } else {
        await transaction.testQuestion.updateMany({
          where: {
            testSetId: setId,
            deletedAt: null,
            reviewStatus: ReviewStatus.APPROVED,
          },
          data: { publishedAt },
        });
      }
    }
    const nextReviewStatus =
      action === QuizSetReviewActionDto.PUBLISH
        ? ReviewStatus.APPROVED
        : action === QuizSetReviewActionDto.WITHDRAW
          ? ReviewStatus.HIDDEN
          : current.reviewStatus;
    const updated =
      kind === "QUIZ"
        ? await transaction.quizSet.update({
            where: { id: setId },
            data: { reviewStatus: nextReviewStatus, updatedById: userId },
          })
        : await transaction.testSet.update({
            where: { id: setId },
            data: { reviewStatus: nextReviewStatus, updatedById: userId },
          });
    await transaction.auditLog.create({
      data: {
        actorUserId: userId,
        action: `${kind}_SET_REVIEWED`,
        entityType: kind === "QUIZ" ? "QuizSet" : "TestSet",
        entityId: setId,
        before: toInputJson(current),
        after: toInputJson({
          id: updated.id,
          action,
          reviewStatus: updated.reviewStatus,
        }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return updated;
  });
}

/** Shared single-question review transition; review never publishes a set. */
export async function reviewAssessmentQuestion(
  prisma: PrismaService,
  kind: AssessmentKind,
  questionId: string,
  userId: string,
  input: { reviewStatus: ReviewStatus },
  context: RequestContext,
) {
  const current =
    kind === "QUIZ"
      ? await prisma.quizQuestion.findUnique({
          where: { id: questionId, deletedAt: null },
          select: {
            id: true,
            quizSetId: true,
            explanationId: true,
            reviewStatus: true,
          },
        })
      : await prisma.testQuestion.findUnique({
          where: { id: questionId, deletedAt: null },
          select: {
            id: true,
            testSetId: true,
            explanationId: true,
            reviewStatus: true,
          },
        });
  if (!current) throw notFoundException("NOT_FOUND", "Không tìm thấy câu hỏi");
  const setId = "quizSetId" in current ? current.quizSetId : current.testSetId;

  return prisma.$transaction(async (transaction) => {
    if (current.explanationId) {
      await transaction.aiExplanation.update({
        where: { id: current.explanationId },
        data: { reviewStatus: input.reviewStatus },
      });
    }
    const updated =
      kind === "QUIZ"
        ? await transaction.quizQuestion.update({
            where: { id: questionId },
            data: { reviewStatus: input.reviewStatus, publishedAt: null },
            include: { explanation: { select: explanationSelect } },
          })
        : await transaction.testQuestion.update({
            where: { id: questionId },
            data: { reviewStatus: input.reviewStatus, publishedAt: null },
            include: { explanation: { select: explanationSelect } },
          });
    const pendingReviewQuestionCount =
      kind === "QUIZ"
        ? await transaction.quizQuestion.count({
            where: {
              quizSetId: setId,
              deletedAt: null,
              reviewStatus: ReviewStatus.NEEDS_REVIEW,
            },
          })
        : await transaction.testQuestion.count({
            where: {
              testSetId: setId,
              deletedAt: null,
              reviewStatus: ReviewStatus.NEEDS_REVIEW,
            },
          });
    await transaction.auditLog.create({
      data: {
        actorUserId: userId,
        action: `${kind}_QUESTION_REVIEWED`,
        entityType: kind === "QUIZ" ? "QuizQuestion" : "TestQuestion",
        entityId: questionId,
        before: toInputJson({ reviewStatus: current.reviewStatus }),
        after: toInputJson({
          reviewStatus: updated.reviewStatus,
          pendingReviewQuestionCount,
        }),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      },
    });
    return updated;
  });
}

/** Shared bulk approval for AI questions. Approved questions remain unpublished. */
export async function reviewAllPendingAssessmentAiQuestions(
  prisma: PrismaService,
  kind: AssessmentKind,
  setId: string,
  userId: string,
  context: RequestContext,
) {
  return prisma.$transaction(async (transaction) => {
    const set =
      kind === "QUIZ"
        ? await transaction.quizSet.findUnique({
            where: { id: setId, deletedAt: null },
            select: { id: true, source: true },
          })
        : await transaction.testSet.findUnique({
            where: { id: setId, deletedAt: null },
            select: { id: true, source: true },
          });
    if (!set) {
      throw notFoundException(
        "NOT_FOUND",
        kind === "QUIZ" ? "Không tìm thấy bộ Quiz" : "Không tìm thấy bộ đề",
      );
    }
    const pendingQuestions =
      kind === "QUIZ"
        ? await transaction.quizQuestion.findMany({
            where: {
              quizSetId: setId,
              deletedAt: null,
              reviewStatus: ReviewStatus.NEEDS_REVIEW,
            },
            select: pendingQuestionSelect,
          })
        : await transaction.testQuestion.findMany({
            where: {
              testSetId: setId,
              deletedAt: null,
              reviewStatus: ReviewStatus.NEEDS_REVIEW,
            },
            select: pendingQuestionSelect,
          });
    const aiQuestions = pendingQuestions.filter(
      (question) =>
        set.source === ContentSource.AI ||
        readQuizGenerationQuestionReference(question.sourceMetadataJson) !== null,
    );
    const questionIds = aiQuestions.map((question) => question.id);
    const explanationIds = aiQuestions.flatMap((question) =>
      question.explanationId ? [question.explanationId] : [],
    );
    if (explanationIds.length > 0) {
      await transaction.aiExplanation.updateMany({
        where: { id: { in: explanationIds } },
        data: { reviewStatus: ReviewStatus.APPROVED },
      });
    }
    const approved =
      questionIds.length === 0
        ? { count: 0 }
        : kind === "QUIZ"
          ? await transaction.quizQuestion.updateMany({
              where: {
                id: { in: questionIds },
                deletedAt: null,
                reviewStatus: ReviewStatus.NEEDS_REVIEW,
              },
              data: { reviewStatus: ReviewStatus.APPROVED, publishedAt: null },
            })
          : await transaction.testQuestion.updateMany({
              where: {
                id: { in: questionIds },
                deletedAt: null,
                reviewStatus: ReviewStatus.NEEDS_REVIEW,
              },
              data: { reviewStatus: ReviewStatus.APPROVED, publishedAt: null },
            });
    const pendingReviewQuestionCount =
      kind === "QUIZ"
        ? await transaction.quizQuestion.count({
            where: {
              quizSetId: setId,
              deletedAt: null,
              reviewStatus: ReviewStatus.NEEDS_REVIEW,
            },
          })
        : await transaction.testQuestion.count({
            where: {
              testSetId: setId,
              deletedAt: null,
              reviewStatus: ReviewStatus.NEEDS_REVIEW,
            },
          });
    if (approved.count > 0) {
      await transaction.auditLog.create({
        data: {
          actorUserId: userId,
          action: `${kind}_AI_QUESTIONS_BULK_REVIEWED`,
          entityType: kind === "QUIZ" ? "QuizSet" : "TestSet",
          entityId: setId,
          before: toInputJson({ pendingAiQuestionCount: aiQuestions.length }),
          after: toInputJson({
            approvedQuestionCount: approved.count,
            pendingReviewQuestionCount,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    }
    return { approvedQuestionCount: approved.count, pendingReviewQuestionCount };
  });
}

const explanationSelect = {
  id: true,
  contentJson: true,
  reviewStatus: true,
  staleAt: true,
} as const;

const pendingQuestionSelect = {
  id: true,
  explanationId: true,
  sourceMetadataJson: true,
} as const;
