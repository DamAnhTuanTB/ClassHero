import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import {
  AiExplanationTargetType,
  EnrollmentStatus,
  LearningPathKind,
  LessonProgressStatus,
  PrismaClient,
  PublishStatus,
  QuestionType,
  Subject,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { PublicLearningPathsService } from "#api/modules/learning-paths/services/public-learning-paths.service";
import { MockPaymentsService } from "#api/modules/payments/services/mock-payments.service";
import { PersonalLearningPathClonerService } from "#api/workers/services/personal-learning-path-cloner.service";

const testRunId = randomUUID();
const ids = {
  admin: randomUUID(),
  student: randomUUID(),
  basePath: randomUUID(),
  chapter: randomUUID(),
  lesson: randomUUID(),
  enrollment: randomUUID(),
  quizSet: randomUUID(),
  quizQuestion: randomUUID(),
  explanation: randomUUID(),
};

describe("M3.6 personal learning-path clone integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await createFixture(prisma);
  });

  afterAll(async () => {
    await cleanupFixture(prisma);
    await moduleRef.close();
  });

  it("deep-clones active content, migrates progress, and atomically activates delivery", async () => {
    const cloner = new PersonalLearningPathClonerService(prisma);
    const result = await cloner.cloneForEnrollment({
      enrollmentId: ids.enrollment,
      actorUserId: ids.admin,
      backgroundJobId: randomUUID(),
    });

    expect(result).toMatchObject({
      enrollmentId: ids.enrollment,
      sourceLearningPathId: ids.basePath,
      alreadyActivated: false,
      counts: {
        chapters: 1,
        lessons: 1,
        quizQuestions: 1,
        aiExplanations: 1,
        lessonProgress: 1,
      },
    });

    const activatedEnrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: ids.enrollment },
      include: {
        deliveryLearningPath: {
          include: {
            chapters: {
              include: {
                lessons: {
                  include: {
                    quizSets: {
                      include: {
                        questions: {
                          include: {
                            explanation: true,
                          },
                        },
                      },
                    },
                    progressEntries: {
                      where: { studentUserId: ids.student },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const personalPath = activatedEnrollment.deliveryLearningPath;
    const personalLesson = personalPath?.chapters[0]?.lessons[0];

    expect(personalPath).toMatchObject({
      kind: LearningPathKind.PERSONALIZED,
      sourceLearningPathId: ids.basePath,
      slug: `personal-${ids.enrollment}`,
    });
    expect(personalLesson).toMatchObject({
      sourceLessonId: ids.lesson,
      title: "Bài học gốc",
    });
    expect(personalLesson?.progressEntries[0]).toMatchObject({
      status: LessonProgressStatus.COMPLETED,
      xpAwarded: true,
    });
    const personalQuestion = personalLesson?.quizSets[0]?.questions[0];
    expect(personalQuestion?.explanation).toMatchObject({
      targetId: personalQuestion?.id,
      lessonId: personalLesson?.id,
    });
    expect(personalQuestion?.explanationId).not.toBe(ids.explanation);

    await prisma.lesson.update({
      where: { id: personalLesson!.id },
      data: { title: "Bài học cá nhân đã chỉnh sửa" },
    });
    const baseLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: ids.lesson },
      select: { title: true },
    });

    expect(baseLesson.title).toBe("Bài học gốc");

    const publicLearningPaths = moduleRef.get(PublicLearningPathsService);
    const catalog = await publicLearningPaths.listPublished({
      page: 1,
      pageSize: 100,
    });
    expect(catalog.data.some((item) => item.id === personalPath?.id)).toBe(false);

    const payments = moduleRef.get(MockPaymentsService);
    await expect(
      payments.purchaseForStudent(ids.student, {
        learningPathId: personalPath!.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const secondRun = await cloner.cloneForEnrollment({
      enrollmentId: ids.enrollment,
      actorUserId: ids.admin,
      backgroundJobId: randomUUID(),
    });
    expect(secondRun).toMatchObject({
      personalLearningPathId: personalPath?.id,
      alreadyActivated: true,
    });
  });
});

async function createFixture(prisma: PrismaClient) {
  await prisma.user.createMany({
    data: [
      {
        id: ids.admin,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        email: `m3-6-admin-${testRunId}@example.com`,
        username: `m3_6_admin_${testRunId.slice(0, 8)}`,
        passwordHash: "test-only",
      },
      {
        id: ids.student,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        email: `m3-6-student-${testRunId}@example.com`,
        username: `m3_6_student_${testRunId.slice(0, 8)}`,
        passwordHash: "test-only",
      },
    ],
  });
  await prisma.learningPath.create({
    data: {
      id: ids.basePath,
      kind: LearningPathKind.CATALOG,
      subject: Subject.MATH,
      grade: 7,
      title: "Khóa học gốc",
      slug: `m3-6-base-${testRunId}`,
      originalPriceVnd: 1_000_000,
      status: PublishStatus.PUBLISHED,
      createdById: ids.admin,
      updatedById: ids.admin,
      totalChapterCount: 1,
      totalLessonCount: 1,
    },
  });
  await prisma.learningPathChapter.create({
    data: {
      id: ids.chapter,
      learningPathId: ids.basePath,
      orderIndex: 1,
      title: "Chương gốc",
      status: PublishStatus.PUBLISHED,
      createdById: ids.admin,
      updatedById: ids.admin,
    },
  });
  await prisma.lesson.create({
    data: {
      id: ids.lesson,
      learningPathId: ids.basePath,
      chapterId: ids.chapter,
      orderIndex: 1,
      title: "Bài học gốc",
      status: PublishStatus.PUBLISHED,
      createdById: ids.admin,
      updatedById: ids.admin,
    },
  });
  await prisma.lessonProgress.create({
    data: {
      studentUserId: ids.student,
      lessonId: ids.lesson,
      status: LessonProgressStatus.COMPLETED,
      bestScore: 9,
      completedAt: new Date(),
      xpAwarded: true,
    },
  });
  await prisma.quizSet.create({
    data: {
      id: ids.quizSet,
      lessonId: ids.lesson,
      title: "Quiz gốc",
      questionCount: 1,
      createdById: ids.admin,
      updatedById: ids.admin,
    },
  });
  await prisma.quizQuestion.create({
    data: {
      id: ids.quizQuestion,
      quizSetId: ids.quizSet,
      lessonId: ids.lesson,
      questionType: QuestionType.MULTIPLE_CHOICE,
      questionJson: { text: "1 + 1 bằng mấy?" },
      optionsJson: [1, 2, 3, 4],
      correctAnswerJson: { value: 2 },
    },
  });
  await prisma.aiExplanation.create({
    data: {
      id: ids.explanation,
      targetType: AiExplanationTargetType.QUIZ_QUESTION,
      targetId: ids.quizQuestion,
      lessonId: ids.lesson,
      contentJson: { text: "Một cộng một bằng hai." },
    },
  });
  await prisma.quizQuestion.update({
    where: { id: ids.quizQuestion },
    data: { explanationId: ids.explanation },
  });
  await prisma.enrollment.create({
    data: {
      id: ids.enrollment,
      studentUserId: ids.student,
      learningPathId: ids.basePath,
      status: EnrollmentStatus.ACTIVE,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
}

async function cleanupFixture(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany({
    where: {
      entityType: "Enrollment",
      entityId: ids.enrollment,
    },
  });
  await prisma.enrollment.deleteMany({ where: { id: ids.enrollment } });
  await prisma.learningPath.deleteMany({
    where: { sourceLearningPathId: ids.basePath },
  });
  await prisma.learningPath.deleteMany({ where: { id: ids.basePath } });
  await prisma.user.deleteMany({
    where: {
      id: { in: [ids.admin, ids.student] },
    },
  });
}
