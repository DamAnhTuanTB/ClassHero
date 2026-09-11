import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  AiExplanationTargetType,
  Difficulty,
  QuestionType,
  ReviewStatus,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import type { RequestContext } from "#api/common/api/request-context";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { AssessmentAdminService } from "#api/modules/assessments/services/assessment-admin.service";
import { QuizSetReviewActionDto } from "#api/modules/quiz/dto/review-quiz-set.dto";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

describe("M6.4 test CRUD integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: AssessmentAdminService;
  let actorUserId = "";
  let learningPathId = "";
  let chapterId = "";
  let lessonId = "";
  let primarySetId = "";
  let secondarySetId = "";
  let firstQuestionId = "";
  const suffix = randomUUID().slice(0, 8);
  const context: RequestContext = {
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(AssessmentAdminService);

    const actor = await prisma.user.create({
      data: {
        email: `m6.4-${suffix}@example.com`,
        username: `m6_4_${suffix}`,
        passwordHash: "hash",
        role: UserRole.ADMIN,
      },
    });
    actorUserId = actor.id;
    const courseCatalog = await createTestCourseCatalogRelation(prisma, 8);
    const learningPath = await prisma.learningPath.create({
      data: {
        title: `M6.4 Path ${suffix}`,
        slug: `m6-4-path-${suffix}`,
        ...courseCatalog,
        originalPriceVnd: 100_000,
      },
    });
    learningPathId = learningPath.id;
    const chapter = await prisma.learningPathChapter.create({
      data: {
        learningPathId,
        title: `M6.4 Chapter ${suffix}`,
        orderIndex: 1,
      },
    });
    chapterId = chapter.id;
    const lesson = await prisma.lesson.create({
      data: {
        learningPathId,
        chapterId,
        title: `M6.4 Lesson ${suffix}`,
        orderIndex: 1,
      },
    });
    lessonId = lesson.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.aiExplanation.deleteMany({
        where: {
          lessonId,
          targetType: AiExplanationTargetType.TEST_QUESTION,
        },
      });
      await prisma.testQuestion.deleteMany({ where: { lessonId } });
      await prisma.testSet.deleteMany({ where: { lessonId } });
      await prisma.lesson.deleteMany({ where: { id: lessonId } });
      await prisma.learningPathChapter.deleteMany({ where: { id: chapterId } });
      await prisma.learningPath.deleteMany({ where: { id: learningPathId } });
      await prisma.user.deleteMany({ where: { id: actorUserId } });
    }
    await moduleRef?.close();
  });

  it("creates multiple test sets with a duration", async () => {
    const primary = await service.createSet({
      kind: "TEST",
      lessonId,
      userId: actorUserId,
      dto: {
        title: "Bộ đề 1",
        durationSeconds: 900,
      },
      context,
    });
    const secondary = await service.createSet({
      kind: "TEST",
      lessonId,
      userId: actorUserId,
      dto: {
        title: "Bộ đề 2",
        durationSeconds: 1_800,
      },
      context,
    });
    primarySetId = primary.id;
    secondarySetId = secondary.id;

    expect(primary.durationSeconds).toBe(900);
    expect(primary.totalScore.toNumber()).toBe(10);
    expect(primary.reviewStatus).toBe(ReviewStatus.DRAFT);
    expect(secondary.reviewStatus).toBe(ReviewStatus.DRAFT);
    const sets = await service.listSetsByLesson("TEST", lessonId);
    expect(sets.map((set) => set.id)).toEqual([primary.id, secondary.id]);
    expect(sets.map((set) => set.sortOrder)).toEqual([0, 1]);

    const updated = await service.updateSet({
      kind: "TEST",
      setId: primarySetId,
      userId: actorUserId,
      dto: { title: "Bộ đề 15 phút", durationSeconds: 1_200 },
      context,
    });
    expect(updated.title).toBe("Bộ đề 15 phút");
    expect(updated.durationSeconds).toBe(1_200);
  });

  it("rejects a duration outside the Test contract even when the service is called directly", async () => {
    await expect(
      service.createSet({
        kind: "TEST",
        lessonId,
        userId: actorUserId,
        dto: { title: "Bộ đề không hợp lệ", durationSeconds: 59 },
        context,
      }),
    ).rejects.toMatchObject({ response: { code: "TEST_SET_INVALID_DURATION" } });
  });

  it("creates questions with correct answers, grading config and explanations", async () => {
    const multipleChoice = await service.createQuestion({
      kind: "TEST",
      setId: primarySetId,
      userId: actorUserId,
      dto: {
        questionType: QuestionType.MULTIPLE_CHOICE,
        difficulty: Difficulty.MEDIUM,
        questionJson: documentWithText("2 + 2 bằng bao nhiêu?"),
        optionsJson: [
          { id: "A", richText: documentWithText("3") },
          { id: "B", richText: documentWithText("4") },
          { id: "C", richText: documentWithText("5") },
          { id: "D", richText: documentWithText("6") },
        ],
        correctAnswerJson: ["B"],
        hintJson: documentWithText("Cộng hai số hạng."),
        explanationJson: documentWithText("2 + 2 = 4."),
      },
      context,
    });
    firstQuestionId = multipleChoice.id;

    const textInput = await service.createQuestion({
      kind: "TEST",
      setId: primarySetId,
      userId: actorUserId,
      dto: {
        questionType: QuestionType.TEXT_INPUT,
        difficulty: Difficulty.EASY,
        questionJson: documentWithText("Viết kết quả của 3 × 3."),
        correctAnswerJson: ["9"],
      },
      context,
    });

    expect(multipleChoice.testSetId).toBe(primarySetId);
    expect(multipleChoice.reviewStatus).toBe(ReviewStatus.NEEDS_REVIEW);
    expect(multipleChoice.explanation?.reviewStatus).toBe(ReviewStatus.NEEDS_REVIEW);
    expect(textInput.reviewStatus).toBe(ReviewStatus.NEEDS_REVIEW);
    expect(multipleChoice.explanation?.contentJson).toEqual(
      documentWithText("2 + 2 = 4."),
    );
    expect(textInput.gradingConfigJson).toBeNull();

    const set = await prisma.testSet.findUnique({ where: { id: primarySetId } });
    expect(set?.questionCount).toBe(2);
  });

  it("splits the total score equally when points are omitted", async () => {
    const questions = await service.listQuestionsBySet("TEST", primarySetId);
    expect(questions).toHaveLength(2);
    expect(questions.map((question) => question.points)).toEqual([null, null]);
    expect(questions.map((question) => question.effectivePoints)).toEqual([5, 5]);
    expect(
      questions.reduce((total, question) => total + question.effectivePoints, 0),
    ).toBe(10);
  });

  it("uses the Quiz publication staging lifecycle for Test questions", async () => {
    await service.reviewSet({
      kind: "TEST",
      setId: primarySetId,
      userId: actorUserId,
      dto: {
        reviewStatus: ReviewStatus.HIDDEN,
        action: QuizSetReviewActionDto.WITHDRAW,
      },
      context,
    });
    await service.reviewQuestion({
      kind: "TEST",
      questionId: firstQuestionId,
      userId: actorUserId,
      dto: { reviewStatus: ReviewStatus.APPROVED },
      context,
    });
    await expect(
      prisma.testSet.findUniqueOrThrow({ where: { id: primarySetId } }),
    ).resolves.toMatchObject({ reviewStatus: ReviewStatus.HIDDEN });
    await expect(
      prisma.testQuestion.findUniqueOrThrow({ where: { id: firstQuestionId } }),
    ).resolves.toMatchObject({ publishedAt: null });

    await service.reviewSet({
      kind: "TEST",
      setId: primarySetId,
      userId: actorUserId,
      dto: {
        reviewStatus: ReviewStatus.APPROVED,
        action: QuizSetReviewActionDto.PUBLISH,
      },
      context,
    });
    const published = await prisma.testQuestion.findUniqueOrThrow({
      where: { id: firstQuestionId },
    });
    expect(published.publishedAt).toBeInstanceOf(Date);

    await service.reviewQuestion({
      kind: "TEST",
      questionId: firstQuestionId,
      userId: actorUserId,
      dto: { reviewStatus: ReviewStatus.NEEDS_REVIEW },
      context,
    });
    await expect(
      prisma.testQuestion.findUniqueOrThrow({ where: { id: firstQuestionId } }),
    ).resolves.toMatchObject({
      publishedAt: null,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
    });
    await expect(
      prisma.testSet.findUniqueOrThrow({ where: { id: primarySetId } }),
    ).resolves.toMatchObject({ reviewStatus: ReviewStatus.APPROVED });
    await service.reviewQuestion({
      kind: "TEST",
      questionId: firstQuestionId,
      userId: actorUserId,
      dto: { reviewStatus: ReviewStatus.APPROVED },
      context,
    });
    await service.reviewSet({
      kind: "TEST",
      setId: primarySetId,
      userId: actorUserId,
      dto: {
        reviewStatus: ReviewStatus.APPROVED,
        action: QuizSetReviewActionDto.SAVE,
      },
      context,
    });

    await service.updateQuestion({
      kind: "TEST",
      questionId: firstQuestionId,
      userId: actorUserId,
      dto: { difficulty: Difficulty.HARD },
      context,
    });
    await expect(
      prisma.testQuestion.findUniqueOrThrow({ where: { id: firstQuestionId } }),
    ).resolves.toMatchObject({ publishedAt: null });
  });

  it("keeps legacy true/false and creates a distinct multi-statement type", async () => {
    const legacyQuestion = await service.createQuestion({
      kind: "TEST",
      setId: secondarySetId,
      userId: actorUserId,
      dto: {
        questionType: QuestionType.TRUE_FALSE,
        difficulty: Difficulty.EASY,
        questionJson: documentWithText("Số 2 là số chẵn."),
        correctAnswerJson: true,
      },
      context,
    });
    const multiStatementQuestion = await service.createQuestion({
      kind: "TEST",
      setId: secondarySetId,
      userId: actorUserId,
      dto: {
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        difficulty: Difficulty.MEDIUM,
        questionJson: documentWithText("Xác định tính đúng sai."),
        optionsJson: [
          { id: "statement-a", richText: documentWithText("Số 2 là số chẵn.") },
          { id: "statement-b", richText: documentWithText("Số 3 là số chẵn.") },
        ],
        correctAnswerJson: [
          { statementId: "statement-a", value: true },
          { statementId: "statement-b", value: false },
        ],
      },
      context,
    });

    expect(legacyQuestion.questionType).toBe(QuestionType.TRUE_FALSE);
    expect(legacyQuestion.correctAnswerJson).toBe(true);
    expect(multiStatementQuestion.questionType).toBe(
      QuestionType.MULTI_STATEMENT_TRUE_FALSE,
    );
    expect(multiStatementQuestion.optionsJson).toHaveLength(2);
    expect(multiStatementQuestion.correctAnswerJson).toEqual([
      { statementId: "statement-a", value: true },
      { statementId: "statement-b", value: false },
    ]);

    await service.deleteQuestion("TEST", legacyQuestion.id, actorUserId, context);
    await service.deleteQuestion("TEST", multiStatementQuestion.id, actorUserId, context);
    expect(await service.listQuestionsBySet("TEST", secondarySetId)).toHaveLength(0);
  });

  it("updates and soft-deletes questions and sets", async () => {
    const updated = await service.updateQuestion({
      kind: "TEST",
      questionId: firstQuestionId,
      userId: actorUserId,
      dto: {
        difficulty: Difficulty.HARD,
        correctAnswerJson: ["B"],
      },
      context,
    });
    expect(updated.difficulty).toBe(Difficulty.HARD);

    await service.deleteQuestion("TEST", firstQuestionId, actorUserId, context);
    const remainingQuestions = await service.listQuestionsBySet("TEST", primarySetId);
    expect(remainingQuestions).toHaveLength(1);
    expect(remainingQuestions[0]?.effectivePoints).toBe(10);

    await service.deleteSet("TEST", secondarySetId, actorUserId, context);
    const sets = await service.listSetsByLesson("TEST", lessonId);
    expect(sets.map((set) => set.id)).toEqual([primarySetId]);
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
