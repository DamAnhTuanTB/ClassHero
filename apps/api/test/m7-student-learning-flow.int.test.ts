import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  AttemptStatus,
  EnrollmentStatus,
  PublishStatus,
  QuestionType,
  ReviewStatus,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";
import { PublicLearningPathsService } from "#api/modules/learning-paths/services/public-learning-paths.service";
import { QuizAttemptScopeDto } from "#api/modules/quiz/dto/student-quiz-attempt.dto";
import { StudentQuizAttemptsService } from "#api/modules/quiz/services/student-quiz-attempts.service";
import { StudentLessonsService } from "#api/modules/student-learning/services/student-lessons.service";
import { StudentTestAttemptsService } from "#api/modules/tests/services/student-test-attempts.service";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

describe("M7 student learning flow integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let flashcardsService: FlashcardsService;
  let publicLearningPathsService: PublicLearningPathsService;
  let quizAttemptsService: StudentQuizAttemptsService;
  let lessonsService: StudentLessonsService;
  let testAttemptsService: StudentTestAttemptsService;
  let studentUserId = "";
  let adminUserId = "";
  let learningPathId = "";
  let chapterId = "";
  let lessonId = "";
  let quizSetId = "";
  let flashcardSetId = "";
  let flashcardId = "";
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    flashcardsService = moduleRef.get(FlashcardsService);
    publicLearningPathsService = moduleRef.get(PublicLearningPathsService);
    quizAttemptsService = moduleRef.get(StudentQuizAttemptsService);
    lessonsService = moduleRef.get(StudentLessonsService);
    testAttemptsService = moduleRef.get(StudentTestAttemptsService);

    const [admin, student] = await Promise.all([
      prisma.user.create({
        data: {
          role: UserRole.ADMIN,
          username: `m7-admin-${suffix}`,
          passwordHash: "not-used",
        },
      }),
      prisma.user.create({
        data: {
          role: UserRole.STUDENT,
          username: `m7-student-${suffix}`,
          fullName: "Học sinh M7",
          passwordHash: "not-used",
        },
      }),
    ]);
    adminUserId = admin.id;
    studentUserId = student.id;

    const courseCatalog = await createTestCourseCatalogRelation(prisma, 7);
    const path = await prisma.learningPath.create({
      data: {
        title: `M7 Path ${suffix}`,
        slug: `m7-path-${suffix}`,
        ...courseCatalog,
        originalPriceVnd: 100_000,
        status: PublishStatus.PUBLISHED,
        createdBy: { connect: { id: admin.id } },
        updatedBy: { connect: { id: admin.id } },
      },
    });
    learningPathId = path.id;
    const chapter = await prisma.learningPathChapter.create({
      data: {
        learningPathId,
        orderIndex: 1,
        title: "Chương M7",
        status: PublishStatus.PUBLISHED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    chapterId = chapter.id;
    const lesson = await prisma.lesson.create({
      data: {
        learningPathId,
        chapterId: chapter.id,
        orderIndex: 1,
        title: "Buổi học M7",
        examOpenAt: new Date(Date.now() - 60_000),
        completionMinScore: 7,
        status: PublishStatus.PUBLISHED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    lessonId = lesson.id;
    await prisma.enrollment.create({
      data: {
        studentUserId,
        learningPathId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const quizSet = await prisma.quizSet.create({
      data: {
        lessonId,
        title: "Quiz M7",
        reviewStatus: ReviewStatus.APPROVED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    quizSetId = quizSet.id;
    await prisma.quizQuestion.create({
      data: {
        quizSetId,
        lessonId,
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionJson: documentWithText("2 + 2 bằng bao nhiêu?"),
        optionsJson: [
          { id: "A", richText: documentWithText("3") },
          { id: "B", richText: documentWithText("4") },
        ],
        correctAnswerJson: ["B"],
        hintJson: documentWithText("Hãy cộng hai số."),
        reviewStatus: ReviewStatus.APPROVED,
      },
    });

    const flashcardSet = await prisma.flashcardSet.create({
      data: {
        lessonId,
        title: "Flashcard M7",
        reviewStatus: ReviewStatus.APPROVED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    flashcardSetId = flashcardSet.id;
    const flashcard = await prisma.flashcard.create({
      data: {
        flashcardSetId: flashcardSet.id,
        lessonId,
        frontJson: documentWithText("2 + 2"),
        backJson: documentWithText("4"),
        reviewStatus: ReviewStatus.APPROVED,
      },
    });
    flashcardId = flashcard.id;

    const testSet = await prisma.testSet.create({
      data: {
        lessonId,
        title: "Test M7",
        durationSeconds: 600,
        reviewStatus: ReviewStatus.APPROVED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    await prisma.testQuestion.create({
      data: {
        testSetId: testSet.id,
        lessonId,
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionJson: documentWithText("3 + 3 bằng bao nhiêu?"),
        optionsJson: [
          { id: "A", richText: documentWithText("5") },
          { id: "B", richText: documentWithText("6") },
        ],
        correctAnswerJson: ["B"],
        reviewStatus: ReviewStatus.APPROVED,
      },
    });
    const alternateTestSet = await prisma.testSet.create({
      data: {
        lessonId,
        title: "Test M7 alternate",
        durationSeconds: 600,
        reviewStatus: ReviewStatus.APPROVED,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    await prisma.testQuestion.create({
      data: {
        testSetId: alternateTestSet.id,
        lessonId,
        questionType: QuestionType.MULTIPLE_CHOICE,
        questionJson: documentWithText("4 + 4 bằng bao nhiêu?"),
        optionsJson: [
          { id: "A", richText: documentWithText("7") },
          { id: "B", richText: documentWithText("8") },
        ],
        correctAnswerJson: ["B"],
        reviewStatus: ReviewStatus.APPROVED,
      },
    });
  });

  it("keeps the test locked when Quiz or Flashcard content is unavailable", async () => {
    const lessonWithoutPrerequisiteContent = await prisma.lesson.create({
      data: {
        learningPathId,
        chapterId,
        orderIndex: 2,
        title: "Bài 2 chưa có nội dung luyện tập",
        examOpenAt: new Date(Date.now() - 60_000),
        completionMinScore: 7,
        status: PublishStatus.PUBLISHED,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    });
    await prisma.quizSet.create({
      data: {
        lessonId: lessonWithoutPrerequisiteContent.id,
        title: "Quiz chưa có câu hỏi",
        reviewStatus: ReviewStatus.APPROVED,
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    });

    const status = await lessonsService.getTestSetsStatus(
      lessonWithoutPrerequisiteContent.id,
      studentUserId,
    );

    expect(status).toMatchObject({
      canStart: false,
      lockReason: "PREREQUISITES_INCOMPLETE",
      quiz: { isRequired: true, isCompleted: false },
      flashcard: { isRequired: true, isCompleted: false },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.enrollment.deleteMany({ where: { learningPathId } });
      await prisma.quizAttempt.deleteMany({ where: { lessonId } });
      await prisma.testAttempt.deleteMany({ where: { lessonId } });
      await prisma.flashcardProgress.deleteMany({ where: { lessonId } });
      await prisma.flashcardStudySession.deleteMany({ where: { lessonId } });
      await prisma.lessonProgress.deleteMany({ where: { lessonId } });
      await prisma.learningPath.deleteMany({ where: { id: learningPathId } });
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, studentUserId] } },
      });
      await moduleRef.close();
    }
  });

  it("requires quiz and flashcard, grades attempts, and promotes only a passing result", async () => {
    const initiallyLocked = await lessonsService.getTestSetsStatus(
      lessonId,
      studentUserId,
    );
    expect(initiallyLocked.canStart).toBe(false);
    expect(initiallyLocked.lockReason).toBe("PREREQUISITES_INCOMPLETE");
    await expect(
      quizAttemptsService.getAttemptStatus(quizSetId, studentUserId),
    ).resolves.toMatchObject({
      state: "NOT_STARTED",
      answeredCount: 0,
      checkedCount: 0,
      currentAttemptId: null,
      latestSubmittedAttempt: null,
    });

    const staleQuizAttempt = await quizAttemptsService.startAttempt(
      quizSetId,
      studentUserId,
      {
        scope: QuizAttemptScopeDto.ALL,
      },
    );
    const quizAttempt = await quizAttemptsService.startAttempt(quizSetId, studentUserId, {
      scope: QuizAttemptScopeDto.ALL,
    });
    await expect(
      prisma.quizAttempt.findUniqueOrThrow({
        where: { id: staleQuizAttempt.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: AttemptStatus.CANCELLED });
    expect(quizAttempt.questions[0]?.correctAnswerJson).toEqual(["B"]);
    expect(quizAttempt.questions[0]?.gradingConfigJson).toBeNull();
    expect(quizAttempt.questions[0]?.hintJson).toEqual(
      documentWithText("Hãy cộng hai số."),
    );
    const pendingQuizAttempt = await quizAttemptsService.getCurrentAttempt(
      quizSetId,
      studentUserId,
    );
    expect(pendingQuizAttempt?.id).toBe(quizAttempt.id);
    expect(pendingQuizAttempt?.savedAnswers).toHaveLength(0);
    expect(pendingQuizAttempt?.checkedAnswers).toHaveLength(0);
    const savedQuizProgress = await quizAttemptsService.saveProgress(
      quizAttempt.id,
      studentUserId,
      {
        currentQuestionIndex: 0,
        answer: {
          questionId: quizAttempt.questions[0]!.id,
          answerJson: ["A"],
        },
      },
    );
    expect(savedQuizProgress).toMatchObject({
      attemptId: quizAttempt.id,
      currentQuestionIndex: 0,
      answeredCount: 1,
      checkedCount: 0,
    });
    const draftQuizAttempt = await quizAttemptsService.getCurrentAttempt(
      quizSetId,
      studentUserId,
    );
    expect(draftQuizAttempt?.savedAnswers).toEqual([
      {
        questionId: quizAttempt.questions[0]!.id,
        answerJson: ["A"],
      },
    ]);
    expect(draftQuizAttempt?.checkedAnswers).toHaveLength(0);
    const activeQuizHistory = await quizAttemptsService.getLessonHistory(
      lessonId,
      studentUserId,
    );
    expect(activeQuizHistory.items[0]).toMatchObject({
      id: quizAttempt.id,
      state: "IN_PROGRESS",
      answeredCount: 1,
      totalCount: 1,
    });
    await expect(
      quizAttemptsService.getAttemptStatus(quizSetId, studentUserId),
    ).resolves.toMatchObject({
      state: "IN_PROGRESS",
      answeredCount: 1,
      checkedCount: 0,
      currentAttemptId: quizAttempt.id,
    });
    const quizFeedback = await quizAttemptsService.checkAnswer(
      quizAttempt.id,
      quizAttempt.questions[0]!.id,
      studentUserId,
      ["B"],
    );
    expect(quizFeedback.isCorrect).toBe(true);
    const resumedQuizAttempt = await quizAttemptsService.getCurrentAttempt(
      quizSetId,
      studentUserId,
    );
    expect(resumedQuizAttempt?.checkedAnswers[0]?.answerJson).toEqual(["B"]);
    expect(resumedQuizAttempt?.checkedAnswers[0]?.feedback.isCorrect).toBe(true);
    await expect(
      quizAttemptsService.getAttemptStatus(quizSetId, studentUserId),
    ).resolves.toMatchObject({
      state: "IN_PROGRESS",
      answeredCount: 1,
      checkedCount: 1,
      currentAttemptId: quizAttempt.id,
    });
    const quizResult = await quizAttemptsService.submitAttempt(
      quizAttempt.id,
      studentUserId,
      [{ questionId: quizAttempt.questions[0]!.id, answerJson: ["B"] }],
    );
    expect(quizResult.correctCount).toBe(1);
    await prisma.quizAttempt.update({
      where: { id: staleQuizAttempt.id },
      data: {
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(quizAttempt.startedAt.getTime() - 60_000),
      },
    });
    await expect(
      quizAttemptsService.getCurrentAttempt(quizSetId, studentUserId),
    ).resolves.toBeNull();
    await expect(
      quizAttemptsService.getAttemptStatus(quizSetId, studentUserId),
    ).resolves.toMatchObject({
      state: "COMPLETED",
      answeredCount: 1,
      checkedCount: 1,
      currentAttemptId: null,
      latestSubmittedAttempt: {
        id: quizAttempt.id,
        correctCount: 1,
        wrongCount: 0,
        totalCount: 1,
        accuracyPercent: 100,
      },
    });

    await Promise.all(
      [2, 3, 4].map((questionNumber) =>
        prisma.quizQuestion.create({
          data: {
            quizSetId,
            lessonId,
            questionType: QuestionType.MULTIPLE_CHOICE,
            questionJson: documentWithText(`Câu ${questionNumber}: chọn đáp án đúng`),
            optionsJson: [
              { id: "A", richText: documentWithText("Sai") },
              { id: "B", richText: documentWithText("Đúng") },
            ],
            correctAnswerJson: ["B"],
            reviewStatus: ReviewStatus.APPROVED,
            sortOrder: questionNumber - 1,
          },
        }),
      ),
    );

    const cumulativeSource = await quizAttemptsService.startAttempt(
      quizSetId,
      studentUserId,
      { scope: QuizAttemptScopeDto.ALL },
    );
    expect(cumulativeSource.questions.map((question) => question.questionNumber)).toEqual(
      [1, 2, 3, 4],
    );
    const cumulativeSourceResult = await quizAttemptsService.submitAttempt(
      cumulativeSource.id,
      studentUserId,
      cumulativeSource.questions.map((question) => ({
        questionId: question.id,
        answerJson:
          question.questionNumber === 1 || question.questionNumber === 3 ? ["B"] : ["A"],
      })),
    );
    expect(cumulativeSourceResult).toMatchObject({
      id: cumulativeSource.id,
      correctCount: 2,
      wrongCount: 2,
      totalCount: 4,
    });

    const firstIncorrectRetry = await quizAttemptsService.startAttempt(
      quizSetId,
      studentUserId,
      {
        scope: QuizAttemptScopeDto.INCORRECT,
        sourceAttemptId: cumulativeSource.id,
      },
    );
    expect(firstIncorrectRetry).toMatchObject({
      scope: QuizAttemptScopeDto.INCORRECT,
      sourceAttemptId: cumulativeSource.id,
      originalTotalCount: 4,
      totalCount: 2,
    });
    expect(
      firstIncorrectRetry.questions.map((question) => question.questionNumber),
    ).toEqual([2, 4]);
    const firstChildResult = await quizAttemptsService.submitAttempt(
      firstIncorrectRetry.id,
      studentUserId,
      firstIncorrectRetry.questions.map((question) => ({
        questionId: question.id,
        answerJson: question.questionNumber === 2 ? ["B"] : ["A"],
      })),
    );
    expect(firstChildResult).toMatchObject({
      id: firstIncorrectRetry.id,
      sourceAttemptId: cumulativeSource.id,
      correctCount: 1,
      wrongCount: 1,
      totalCount: 2,
      aggregateResult: {
        id: cumulativeSource.id,
        correctCount: 3,
        wrongCount: 1,
        totalCount: 4,
      },
    });
    const firstChildReview = await quizAttemptsService.reviewAttempt(
      firstChildResult.id,
      studentUserId,
      QuizAttemptScopeDto.ALL,
    );
    expect(firstChildReview).toMatchObject({
      id: firstChildResult.id,
      sourceAttemptId: cumulativeSource.id,
      totalCount: 2,
      originalTotalCount: 4,
    });
    expect(firstChildReview.questions.map((question) => question.questionNumber)).toEqual(
      [2, 4],
    );

    const firstChildAllRetry = await quizAttemptsService.startAttempt(
      quizSetId,
      studentUserId,
      {
        scope: QuizAttemptScopeDto.ALL,
        sourceAttemptId: firstChildResult.id,
      },
    );
    expect(firstChildAllRetry).toMatchObject({
      sourceAttemptId: firstChildResult.id,
      originalTotalCount: 4,
      totalCount: 2,
    });
    expect(
      firstChildAllRetry.questions.map((question) => question.questionNumber),
    ).toEqual([2, 4]);

    const secondIncorrectRetry = await quizAttemptsService.startAttempt(
      quizSetId,
      studentUserId,
      {
        scope: QuizAttemptScopeDto.INCORRECT,
        sourceAttemptId: firstChildResult.id,
      },
    );
    expect(secondIncorrectRetry).toMatchObject({
      sourceAttemptId: firstChildResult.id,
      originalTotalCount: 4,
      totalCount: 1,
    });
    expect(
      secondIncorrectRetry.questions.map((question) => question.questionNumber),
    ).toEqual([4]);
    const completedSecondChildResult = await quizAttemptsService.submitAttempt(
      secondIncorrectRetry.id,
      studentUserId,
      [{ questionId: secondIncorrectRetry.questions[0]!.id, answerJson: ["B"] }],
    );
    expect(completedSecondChildResult).toMatchObject({
      id: secondIncorrectRetry.id,
      sourceAttemptId: firstChildResult.id,
      correctCount: 1,
      wrongCount: 0,
      totalCount: 1,
      aggregateResult: {
        id: cumulativeSource.id,
        correctCount: 4,
        wrongCount: 0,
        totalCount: 4,
      },
    });
    const cumulativeReview = await quizAttemptsService.reviewAttempt(
      cumulativeSource.id,
      studentUserId,
      QuizAttemptScopeDto.ALL,
    );
    expect(cumulativeReview.questions).toHaveLength(4);
    expect(cumulativeReview.questions.every((question) => question.isCorrect)).toBe(true);
    await expect(
      quizAttemptsService.getAttemptStatus(quizSetId, studentUserId),
    ).resolves.toMatchObject({
      state: "COMPLETED",
      latestSubmittedAttempt: {
        id: cumulativeSource.id,
        correctCount: 4,
        wrongCount: 0,
        totalCount: 4,
      },
    });

    const fullResetAttempt = await quizAttemptsService.startAttempt(
      quizSetId,
      studentUserId,
      { scope: QuizAttemptScopeDto.ALL },
    );
    const fullResetResult = await quizAttemptsService.submitAttempt(
      fullResetAttempt.id,
      studentUserId,
      fullResetAttempt.questions.map((question) => ({
        questionId: question.id,
        answerJson: ["A"],
      })),
    );
    expect(fullResetResult).toMatchObject({
      id: fullResetAttempt.id,
      correctCount: 0,
      wrongCount: 4,
      totalCount: 4,
    });
    await expect(
      quizAttemptsService.getAttemptStatus(quizSetId, studentUserId),
    ).resolves.toMatchObject({
      state: "COMPLETED",
      latestSubmittedAttempt: {
        id: fullResetAttempt.id,
        correctCount: 0,
        wrongCount: 4,
        totalCount: 4,
      },
    });
    const quizHistory = await quizAttemptsService.getLessonHistory(
      lessonId,
      studentUserId,
    );
    expect(quizHistory.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: quizAttempt.id,
          setId: quizSetId,
          state: "COMPLETED",
        }),
        expect.objectContaining({
          id: cumulativeSource.id,
          setId: quizSetId,
          state: "COMPLETED",
        }),
        expect.objectContaining({
          id: fullResetAttempt.id,
          setId: quizSetId,
          state: "COMPLETED",
        }),
      ]),
    );
    expect(quizHistory.items.map((item) => item.displayName)).toEqual([
      "Bộ 3",
      "Bộ 2",
      "Bộ 1",
    ]);

    const firstFlashcardSession = await flashcardsService.startStudentStudySession(
      flashcardSetId,
      studentUserId,
    );
    await flashcardsService.updateStudentProgress(
      flashcardId,
      studentUserId,
      false,
      firstFlashcardSession.id,
    );
    const secondFlashcardSession = await flashcardsService.startStudentStudySession(
      flashcardSetId,
      studentUserId,
    );
    await flashcardsService.updateStudentProgress(
      flashcardId,
      studentUserId,
      true,
      secondFlashcardSession.id,
    );
    const flashcardHistory = await flashcardsService.getStudentStudyHistory(
      lessonId,
      studentUserId,
    );
    expect(flashcardHistory.items).toMatchObject([
      {
        id: secondFlashcardSession.id,
        setId: flashcardSetId,
        displayName: "Bộ 2",
        state: "COMPLETED",
        knownCount: 1,
      },
      {
        id: firstFlashcardSession.id,
        setId: flashcardSetId,
        displayName: "Bộ 1",
        state: "COMPLETED",
        unknownCount: 1,
      },
    ]);
    const ready = await lessonsService.getTestSetsStatus(lessonId, studentUserId);
    expect(ready.canStart).toBe(true);
    expect(ready.flashcard.isCompleted).toBe(true);
    const initialTestHistory = await testAttemptsService.getLessonHistory(
      lessonId,
      studentUserId,
    );
    expect(initialTestHistory.currentItemId).toBe(
      `not-started:${initialTestHistory.items[0]?.setId}`,
    );
    expect(initialTestHistory.items[0]).toMatchObject({
      attemptId: null,
      displayName: "Bài thi 1",
      state: "NOT_STARTED",
    });

    const failedAttempt = await testAttemptsService.startAttempt(lessonId, studentUserId);
    expect(JSON.stringify(failedAttempt)).not.toContain("correctAnswerJson");
    const failedResult = await testAttemptsService.submitAttempt(
      failedAttempt.id,
      studentUserId,
      [{ questionId: failedAttempt.questions[0]!.id, answerJson: ["A"] }],
    );
    expect(failedResult.passed).toBe(false);
    const statusAfterFailedAttempt = await lessonsService.getTestSetsStatus(
      lessonId,
      studentUserId,
    );
    expect(statusAfterFailedAttempt.latestSubmittedAttempt).toMatchObject({
      id: failedAttempt.id,
      score: 0,
    });
    const historyAfterFailedAttempt = await testAttemptsService.getLessonHistory(
      lessonId,
      studentUserId,
    );
    expect(historyAfterFailedAttempt.currentItemId).toBe(
      `not-started:${historyAfterFailedAttempt.items[0]?.setId}`,
    );
    expect(historyAfterFailedAttempt.items[0]).toMatchObject({
      attemptId: null,
      displayName: "Bài thi 2",
      state: "NOT_STARTED",
    });
    expect(historyAfterFailedAttempt.items[1]).toMatchObject({
      id: failedAttempt.id,
      attemptId: failedAttempt.id,
      displayName: "Bài thi 1",
      score: 0,
      state: "COMPLETED",
    });
    await expect(
      prisma.lessonProgress.findUnique({
        where: { studentUserId_lessonId: { studentUserId, lessonId } },
      }),
    ).resolves.toBeNull();

    const passingAttempt = await testAttemptsService.startAttempt(
      lessonId,
      studentUserId,
    );
    const passingResult = await testAttemptsService.submitAttempt(
      passingAttempt.id,
      studentUserId,
      [{ questionId: passingAttempt.questions[0]!.id, answerJson: ["B"] }],
    );
    expect(passingResult.score).toBe(10);
    expect(passingResult.passed).toBe(true);
    const statusAfterPassingAttempt = await lessonsService.getTestSetsStatus(
      lessonId,
      studentUserId,
    );
    expect(statusAfterPassingAttempt.latestSubmittedAttempt).toMatchObject({
      id: passingAttempt.id,
      score: 10,
    });
    const historyAfterPassingAttempt = await testAttemptsService.getLessonHistory(
      lessonId,
      studentUserId,
    );
    expect(historyAfterPassingAttempt.currentItemId).toBe(passingAttempt.id);
    expect(historyAfterPassingAttempt.currentItemId).toBe(
      historyAfterPassingAttempt.items[0]?.id,
    );
    expect(historyAfterPassingAttempt.items[0]).toMatchObject({
      id: passingAttempt.id,
      displayName: "Bài thi 2",
      score: 10,
      state: "COMPLETED",
    });
    expect(historyAfterPassingAttempt.items.map((item) => item.displayName)).toEqual([
      "Bài thi 2",
      "Bài thi 1",
    ]);

    const progressAfterPassingAttempt = await prisma.lessonProgress.findUniqueOrThrow({
      where: { studentUserId_lessonId: { studentUserId, lessonId } },
    });
    expect(progressAfterPassingAttempt).toMatchObject({
      status: "COMPLETED",
      bestTestAttemptId: passingAttempt.id,
      bestDurationSeconds: passingResult.durationSeconds,
    });
    expect(Number(progressAfterPassingAttempt.bestScore)).toBe(10);
    await expect(
      publicLearningPathsService.getPublished(learningPathId, {
        id: studentUserId,
        role: UserRole.STUDENT,
      }),
    ).resolves.toMatchObject({
      progress: {
        completedLessonCount: 1,
        progressPercent: 50,
      },
    });
    const leaderboardAfterPassingAttempt = await testAttemptsService.getLeaderboard(
      lessonId,
      studentUserId,
    );
    expect(leaderboardAfterPassingAttempt.entries[0]).toMatchObject({
      rank: 1,
      isCurrentStudent: true,
      score: 10,
    });

    const failedRetake = await testAttemptsService.startAttempt(
      lessonId,
      studentUserId,
    );
    const failedRetakeResult = await testAttemptsService.submitAttempt(
      failedRetake.id,
      studentUserId,
      [{ questionId: failedRetake.questions[0]!.id, answerJson: ["A"] }],
    );
    expect(failedRetakeResult.passed).toBe(false);

    const progressAfterFailedRetake = await prisma.lessonProgress.findUniqueOrThrow({
      where: { studentUserId_lessonId: { studentUserId, lessonId } },
    });
    expect(progressAfterFailedRetake).toMatchObject({
      status: "COMPLETED",
      bestTestAttemptId: passingAttempt.id,
      bestDurationSeconds: passingResult.durationSeconds,
      completedAt: progressAfterPassingAttempt.completedAt,
    });
    expect(Number(progressAfterFailedRetake.bestScore)).toBe(10);
    await expect(
      publicLearningPathsService.getPublished(learningPathId, {
        id: studentUserId,
        role: UserRole.STUDENT,
      }),
    ).resolves.toMatchObject({
      progress: {
        completedLessonCount: 1,
        progressPercent: 50,
      },
    });
  });
});

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
