import { Inject, Injectable } from "@nestjs/common";
import { AttemptStatus, ReviewStatus } from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import type { StudentTestPrerequisiteStatus } from "#api/modules/student-learning/types/student-learning-prerequisite.types";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";

@Injectable()
export class StudentLearningPrerequisitesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudentLessonAccessService)
    private readonly studentLessonAccessService: StudentLessonAccessService,
  ) {}

  async getTestPrerequisites(
    lessonId: string,
    studentUserId: string,
  ): Promise<StudentTestPrerequisiteStatus> {
    const access = await this.studentLessonAccessService.assertCanRead(
      lessonId,
      studentUserId,
    );
    const [lesson, quizSets, flashcardSets] = await Promise.all([
      this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { examOpenAt: true },
      }),
      this.prisma.quizSet.findMany({
        where: {
          lessonId,
          deletedAt: null,
          isReserve: false,
          reviewStatus: ReviewStatus.APPROVED,
          questions: {
            some: {
              deletedAt: null,
              reviewStatus: ReviewStatus.APPROVED,
              publishedAt: { not: null },
            },
          },
        },
        select: { id: true },
      }),
      this.prisma.flashcardSet.findMany({
        where: {
          lessonId,
          deletedAt: null,
          isReserve: false,
          reviewStatus: ReviewStatus.APPROVED,
          flashcards: {
            some: {
              deletedAt: null,
              reviewStatus: ReviewStatus.APPROVED,
            },
          },
        },
        select: {
          flashcards: {
            where: {
              deletedAt: null,
              reviewStatus: ReviewStatus.APPROVED,
            },
            select: { id: true },
          },
        },
      }),
    ]);
    if (!lesson) {
      throwLessonNotFound();
    }

    const quizCompleted =
      quizSets.length > 0 &&
      Boolean(
        await this.prisma.quizAttempt.findFirst({
          where: {
            studentUserId,
            lessonId,
            quizSetId: { in: quizSets.map((set) => set.id) },
            status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED] },
          },
          select: { id: true },
        }),
      );
    const flashcardCompleted =
      flashcardSets.length > 0 &&
      (
        await Promise.all(
          flashcardSets.map(async (set) => {
            const reviewedCount = await this.prisma.flashcardProgress.count({
              where: {
                studentUserId,
                flashcardId: { in: set.flashcards.map((card) => card.id) },
              },
            });
            return reviewedCount === set.flashcards.length;
          }),
        )
      ).some(Boolean);
    const timeOpened =
      !lesson.examOpenAt || lesson.examOpenAt.getTime() <= access.evaluatedAt.getTime();
    const prerequisitesCompleted = quizCompleted && flashcardCompleted;
    const canStart = access.mode === "ENROLLMENT" && timeOpened && prerequisitesCompleted;

    return {
      canStart,
      examOpenAt: lesson.examOpenAt,
      evaluatedAt: access.evaluatedAt,
      lockReason:
        access.mode === "TRIAL"
          ? "TRIAL_NOT_ALLOWED"
          : !timeOpened
            ? "BEFORE_OPEN_TIME"
            : !prerequisitesCompleted
              ? "PREREQUISITES_INCOMPLETE"
              : null,
      quiz: {
        isRequired: true,
        isCompleted: quizCompleted,
      },
      flashcard: {
        isRequired: true,
        isCompleted: flashcardCompleted,
      },
    };
  }
}
