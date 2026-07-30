import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  ContentSource,
  Difficulty,
  DocumentStatus,
  EnrollmentStatus,
  FileProvider,
  FilePurpose,
  FileVisibility,
  LessonDocumentKind,
  LessonMaterialType,
  LearningPathKind,
  PublishStatus,
  QuestionType,
  ReviewStatus,
  Subject,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";
import { StudentLessonsService } from "#api/modules/student-learning/services/student-lessons.service";

describe("M6.5 student lesson content integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let studentLessonsService: StudentLessonsService;
  let flashcardsService: FlashcardsService;
  let learningPathId = "";
  let chapterId = "";
  let lessonId = "";
  let trialLessonId = "";
  let enrolledStudentId = "";
  let trialStudentId = "";
  let outsiderStudentId = "";
  let fileId = "";
  let deletedFileId = "";
  const suffix = randomUUID().slice(0, 8);
  const futureExamOpenAt = new Date(Date.now() + 60 * 60 * 1000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    studentLessonsService = moduleRef.get(StudentLessonsService);
    flashcardsService = moduleRef.get(FlashcardsService);

    const [admin, enrolledStudent, trialStudent, outsiderStudent] = await Promise.all([
      createUser(prisma, suffix, "admin", UserRole.ADMIN),
      createUser(prisma, suffix, "enrolled", UserRole.STUDENT),
      createUser(prisma, suffix, "trial", UserRole.STUDENT),
      createUser(prisma, suffix, "outsider", UserRole.STUDENT),
    ]);
    enrolledStudentId = enrolledStudent.id;
    trialStudentId = trialStudent.id;
    outsiderStudentId = outsiderStudent.id;

    const learningPath = await prisma.learningPath.create({
      data: {
        title: `M6.5 Path ${suffix}`,
        slug: `m6-5-path-${suffix}`,
        subject: Subject.MATH,
        grade: 7,
        originalPriceVnd: 200_000,
        status: PublishStatus.PUBLISHED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    learningPathId = learningPath.id;

    const chapter = await prisma.learningPathChapter.create({
      data: {
        learningPathId,
        orderIndex: 1,
        title: `M6.5 Chapter ${suffix}`,
        overview: "Chương kiểm thử nội dung học sinh.",
        status: PublishStatus.PUBLISHED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    chapterId = chapter.id;

    const [lesson, trialLesson] = await Promise.all([
      prisma.lesson.create({
        data: {
          learningPathId,
          chapterId,
          orderIndex: 1,
          title: `M6.5 Lesson ${suffix}`,
          shortDescription: "Buổi học dành cho enrollment.",
          prepMaterialJson: documentWithText("Chuẩn bị thước kẻ."),
          examOpenAt: futureExamOpenAt,
          videoUrl: "https://youtu.be/m6-5-demo",
          completionMinScore: 7,
          status: PublishStatus.PUBLISHED,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
      prisma.lesson.create({
        data: {
          learningPathId,
          chapterId,
          orderIndex: 2,
          title: `M6.5 Trial ${suffix}`,
          examOpenAt: new Date(Date.now() - 60 * 1000),
          trialEnabled: true,
          status: PublishStatus.PUBLISHED,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ]);
    lessonId = lesson.id;
    trialLessonId = trialLesson.id;

    await prisma.enrollment.create({
      data: {
        studentUserId: enrolledStudentId,
        learningPathId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: new Date(Date.now() - 60 * 1000),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const file = await prisma.file.create({
      data: {
        provider: FileProvider.MINIO_LOCAL,
        purpose: FilePurpose.LESSON_DOCUMENT,
        bucket: "m6-5-tests",
        objectKey: `m6-5/${suffix}/lesson.pdf`,
        originalName: "lesson.pdf",
        mimeType: "application/pdf",
        sizeBytes: 128n,
        visibility: FileVisibility.PRIVATE,
        uploadedById: admin.id,
        publicUrl: `https://cdn.example.com/m6-5/${suffix}/lesson.pdf`,
      },
    });
    fileId = file.id;
    const deletedFile = await prisma.file.create({
      data: {
        provider: FileProvider.MINIO_LOCAL,
        purpose: FilePurpose.LESSON_DOCUMENT,
        bucket: "m6-5-tests",
        objectKey: `m6-5/${suffix}/deleted.pdf`,
        originalName: "deleted.pdf",
        mimeType: "application/pdf",
        sizeBytes: 64n,
        visibility: FileVisibility.PRIVATE,
        uploadedById: admin.id,
        deletedAt: new Date(),
      },
    });
    deletedFileId = deletedFile.id;

    await Promise.all([
      prisma.lessonMaterial.create({
        data: {
          lessonId,
          type: LessonMaterialType.LINK,
          title: "Tài liệu tham khảo",
          url: "https://example.com/reference",
          sortOrder: 0,
        },
      }),
      prisma.lessonMaterial.create({
        data: {
          lessonId,
          type: LessonMaterialType.PDF,
          fileId: deletedFileId,
          title: "Tài liệu đã xóa",
          sortOrder: 1,
        },
      }),
      prisma.lessonDocument.create({
        data: {
          lessonId,
          fileId,
          kind: LessonDocumentKind.SUPPLEMENT,
          title: "Phiếu bài tập",
          status: DocumentStatus.READY,
          sortOrder: 0,
        },
      }),
      prisma.lessonSummary.create({
        data: {
          lessonId,
          contentJson: documentWithText("Tóm tắt đã duyệt."),
          source: ContentSource.ADMIN,
          reviewStatus: ReviewStatus.APPROVED,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ]);

    const [approvedQuizSet] = await Promise.all([
      prisma.quizSet.create({
        data: {
          lessonId,
          title: "Quiz được phép",
          difficulty: Difficulty.MEDIUM,
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: 0,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
      prisma.quizSet.create({
        data: {
          lessonId,
          title: "Quiz đang ẩn",
          reviewStatus: ReviewStatus.HIDDEN,
          sortOrder: 1,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
      prisma.quizSet.create({
        data: {
          lessonId,
          title: "Quiz dự phòng",
          isReserve: true,
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: 2,
          createdById: admin.id,
          updatedById: admin.id,
        },
      }),
    ]);

    await Promise.all([
      prisma.quizQuestion.create({
        data: {
          quizSetId: approvedQuizSet.id,
          lessonId,
          questionType: QuestionType.MULTIPLE_CHOICE,
          questionJson: documentWithText("2 + 2 bằng bao nhiêu?"),
          optionsJson: [
            { id: "A", richText: documentWithText("3") },
            { id: "B", richText: documentWithText("4") },
          ],
          correctAnswerJson: ["B"],
          hintJson: documentWithText("Cộng hai số."),
          gradingConfigJson: {
            privateMarker: "grading-secret-m6-5",
          },
          difficulty: Difficulty.EASY,
          reviewStatus: ReviewStatus.APPROVED,
          sortOrder: 0,
        },
      }),
      prisma.quizQuestion.create({
        data: {
          quizSetId: approvedQuizSet.id,
          lessonId,
          questionType: QuestionType.TRUE_FALSE,
          questionJson: documentWithText("Câu hỏi đang ẩn."),
          correctAnswerJson: true,
          difficulty: Difficulty.EASY,
          reviewStatus: ReviewStatus.HIDDEN,
          sortOrder: 1,
        },
      }),
    ]);

    const flashcardSet = await prisma.flashcardSet.create({
      data: {
        lessonId,
        title: "Flashcard được phép",
        reviewStatus: ReviewStatus.APPROVED,
        sortOrder: 0,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    await prisma.flashcard.create({
      data: {
        flashcardSetId: flashcardSet.id,
        lessonId,
        frontJson: documentWithText("Mặt trước"),
        backJson: documentWithText("Mặt sau"),
        reviewStatus: ReviewStatus.APPROVED,
        sortOrder: 0,
      },
    });

    const testSet = await prisma.testSet.create({
      data: {
        lessonId,
        title: "Bài kiểm tra được phép",
        durationSeconds: 900,
        difficulty: Difficulty.MIXED,
        reviewStatus: ReviewStatus.APPROVED,
        sortOrder: 0,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    await prisma.testQuestion.create({
      data: {
        testSetId: testSet.id,
        lessonId,
        questionType: QuestionType.TEXT_INPUT,
        questionJson: documentWithText("Đáp án bí mật là gì?"),
        correctAnswerJson: ["test-answer-secret-m6-5"],
        gradingConfigJson: {
          caseSensitive: false,
          exactMatch: true,
        },
        reviewStatus: ReviewStatus.APPROVED,
        sortOrder: 0,
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.testQuestion.deleteMany({ where: { lessonId } });
      await prisma.testSet.deleteMany({ where: { lessonId } });
      await prisma.flashcard.deleteMany({ where: { lessonId } });
      await prisma.flashcardSet.deleteMany({ where: { lessonId } });
      await prisma.quizQuestion.deleteMany({ where: { lessonId } });
      await prisma.quizSet.deleteMany({ where: { lessonId } });
      await prisma.lessonSummary.deleteMany({ where: { lessonId } });
      await prisma.lessonMaterial.deleteMany({ where: { lessonId } });
      await prisma.lessonDocument.deleteMany({ where: { lessonId } });
      await prisma.enrollment.deleteMany({ where: { learningPathId } });
      await prisma.lesson.deleteMany({ where: { chapterId } });
      await prisma.learningPathChapter.deleteMany({ where: { id: chapterId } });
      await prisma.file.deleteMany({ where: { id: { in: [fileId, deletedFileId] } } });
      await prisma.learningPath.deleteMany({ where: { id: learningPathId } });
      await prisma.user.deleteMany({
        where: {
          username: {
            endsWith: `_${suffix}`,
          },
        },
      });
    }
    await moduleRef?.close();
  });

  it("returns approved lesson metadata and omits private storage fields", async () => {
    const content = await studentLessonsService.getLessonContent(
      lessonId,
      enrolledStudentId,
    );

    expect(content.access.mode).toBe("ENROLLMENT");
    expect(content.summary?.contentJson).toEqual(documentWithText("Tóm tắt đã duyệt."));
    expect(content.materials).toHaveLength(1);
    expect(content.documents).toHaveLength(1);
    expect(content.documents[0]?.file.accessUrl).toContain("cdn.example.com/m6-5");
    expect(content.quizSets.map((set) => set.title)).toEqual(["Quiz được phép"]);
    expect(content.quizSets[0]?.questionCount).toBe(1);
    expect(content.flashcardSets[0]?.cardCount).toBe(1);
    expect(content.testSets[0]?.questionCount).toBe(1);
    expect(content.testAvailability.canStartTest).toBe(false);

    const serialized = JSON.stringify(content);
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("grading-secret-m6-5");
    expect(serialized).not.toContain("test-answer-secret-m6-5");
    expect(serialized).not.toContain("Quiz đang ẩn");
    expect(serialized).not.toContain("Quiz dự phòng");
  });

  it("returns quiz content without answer keys or hidden questions", async () => {
    const sets = await studentLessonsService.listQuizSets(lessonId, enrolledStudentId);

    expect(sets).toHaveLength(1);
    expect(sets[0]?.questionCount).toBe(1);
    expect(sets[0]?.questions[0]?.questionJson).toEqual(
      documentWithText("2 + 2 bằng bao nhiêu?"),
    );
    const serialized = JSON.stringify(sets);
    expect(serialized).not.toContain("correctAnswerJson");
    expect(serialized).not.toContain("gradingConfigJson");
    expect(serialized).not.toContain("explanation");
    expect(serialized).not.toContain("Câu hỏi đang ẩn");
  });

  it("keeps tests locked after open time until quiz and flashcard are completed", async () => {
    const blocked = await studentLessonsService.getTestSetsStatus(
      lessonId,
      enrolledStudentId,
    );
    expect(blocked.canStart).toBe(false);
    expect(blocked.bestAttempt).toBeNull();
    expect(blocked.latestSubmittedAttempt).toBeNull();
    expect(blocked.sets).toHaveLength(1);

    await prisma.lesson.update({
      where: { id: lessonId },
      data: {
        examOpenAt: new Date(Date.now() - 60 * 1000),
      },
    });
    const open = await studentLessonsService.getTestSetsStatus(
      lessonId,
      enrolledStudentId,
    );
    expect(open.canStart).toBe(false);
    expect(open.lockReason).toBe("PREREQUISITES_INCOMPLETE");
    expect(open.quiz.isCompleted).toBe(false);
    expect(open.flashcard.isCompleted).toBe(false);
  });

  it("allows trial reads but never opens the test for trial access", async () => {
    const content = await studentLessonsService.getLessonContent(
      trialLessonId,
      trialStudentId,
    );
    const status = await studentLessonsService.getTestSetsStatus(
      trialLessonId,
      trialStudentId,
    );

    expect(content.access.mode).toBe("TRIAL");
    expect(content.testAvailability.canStartTest).toBe(false);
    expect(status.canStart).toBe(false);
  });

  it("rejects reads without enrollment or trial permission", async () => {
    await expect(
      studentLessonsService.getLessonContent(lessonId, outsiderStudentId),
    ).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_REQUIRED",
      },
    });
  });

  it("isolates personalized lesson content to its delivered enrollment", async () => {
    const personalPath = await prisma.learningPath.create({
      data: {
        kind: LearningPathKind.PERSONALIZED,
        sourceLearningPathId: learningPathId,
        title: `M6.5 Personal ${suffix}`,
        slug: `m6-5-personal-${suffix}`,
        subject: Subject.MATH,
        grade: 7,
        originalPriceVnd: 200_000,
        status: PublishStatus.DRAFT,
      },
    });
    const personalChapter = await prisma.learningPathChapter.create({
      data: {
        learningPathId: personalPath.id,
        orderIndex: 1,
        title: "Chương cá nhân",
        status: PublishStatus.DRAFT,
      },
    });
    const personalLesson = await prisma.lesson.create({
      data: {
        learningPathId: personalPath.id,
        chapterId: personalChapter.id,
        orderIndex: 1,
        title: "Buổi học cá nhân",
        status: PublishStatus.PUBLISHED,
        trialEnabled: true,
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        studentUserId: trialStudentId,
        learningPathId,
        deliveryLearningPathId: personalPath.id,
        status: EnrollmentStatus.ACTIVE,
        startsAt: new Date(Date.now() - 60 * 1000),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    try {
      const content = await studentLessonsService.getLessonContent(
        personalLesson.id,
        trialStudentId,
      );
      expect(content.access.mode).toBe("ENROLLMENT");

      await expect(
        studentLessonsService.getLessonContent(personalLesson.id, outsiderStudentId),
      ).rejects.toMatchObject({
        response: {
          code: "PERSONAL_LEARNING_PATH_ACCESS_DENIED",
        },
      });
    } finally {
      await prisma.enrollment.delete({ where: { id: enrollment.id } });
      await prisma.lesson.delete({ where: { id: personalLesson.id } });
      await prisma.learningPathChapter.delete({ where: { id: personalChapter.id } });
      await prisma.learningPath.delete({ where: { id: personalPath.id } });
    }
  });

  it("keeps the existing flashcard route on the shared access policy", async () => {
    const sets = await flashcardsService.listStudentSetsByLesson(
      lessonId,
      enrolledStudentId,
    );
    expect(sets).toHaveLength(1);

    await expect(
      flashcardsService.listStudentSetsByLesson(lessonId, outsiderStudentId),
    ).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_REQUIRED",
      },
    });
  });
});

async function createUser(
  prisma: PrismaService,
  suffix: string,
  label: string,
  role: UserRole,
) {
  return prisma.user.create({
    data: {
      email: `m6.5-${label}-${suffix}@example.com`,
      username: `m6_5_${label}_${suffix}`,
      passwordHash: "hash",
      role,
    },
  });
}

function documentWithText(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}
