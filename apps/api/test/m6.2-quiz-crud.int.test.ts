import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { QuizService } from "../src/modules/quiz/services/quiz.service";
import { QuizSetReviewActionDto } from "../src/modules/quiz/dto/review-quiz-set.dto";
import { QuestionType, Difficulty, ReviewStatus, UserRole } from "@prisma/client";
import { RequestContext } from "../src/common/api/request-context";
import { randomUUID } from "crypto";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

describe("M6.2 Quiz CRUD Integration Test", () => {
  let moduleRef: TestingModule;
  let quizService: QuizService;
  let prisma: PrismaService;

  let testUserId: string;
  let testLessonId: string;
  let testQuizSetId: string;

  const mockContext: RequestContext = {
    ip: "127.0.0.1",
    userAgent: "vitest",
    path: "/test",
    method: "POST",
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    quizService = moduleRef.get(QuizService);
    prisma = moduleRef.get(PrismaService);

    // Setup basic relations
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `test-quiz-${Date.now()}@example.com`,
        username: `test_quiz_${Date.now()}`,
        passwordHash: "hash",
        role: UserRole.ADMIN,
      },
    });
    testUserId = user.id;

    const courseCatalog = await createTestCourseCatalogRelation(prisma, 10);
    const lp = await prisma.learningPath.create({
      data: {
        title: "Test Path",
        ...courseCatalog,
        slug: `test-path-${Date.now()}`,
        originalPriceVnd: 100000,
      },
    });
    const chapter = await prisma.learningPathChapter.create({
      data: { learningPathId: lp.id, title: "Test Chapter", orderIndex: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: {
        learningPathId: lp.id,
        chapterId: chapter.id,
        title: "Test Lesson",
        orderIndex: 1,
      },
    });
    testLessonId = lesson.id;
  });

  afterAll(async () => {
    // Cleanup
    if (prisma) {
      if (testLessonId) {
        await prisma.quizQuestion.deleteMany({ where: { lessonId: testLessonId } });
        await prisma.quizSet.deleteMany({ where: { lessonId: testLessonId } });
        await prisma.lesson.deleteMany({ where: { id: testLessonId } });
      }
      await prisma.learningPathChapter.deleteMany({ where: { title: "Test Chapter" } });
      await prisma.learningPath.deleteMany({ where: { title: "Test Path" } });
      if (testUserId) {
        await prisma.user.deleteMany({ where: { id: testUserId } });
      }
    }
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it("should create a quiz set", async () => {
    const set = await quizService.createQuizSet(
      testLessonId,
      testUserId,
      { title: "Toán Đại Số 10" },
      mockContext,
    );
    expect(set.id).toBeDefined();
    expect(set.title).toBe("Toán Đại Số 10");
    expect(set).not.toHaveProperty("difficulty");
    testQuizSetId = set.id;
  });

  it("should add a question to quiz set", async () => {
    const question = await quizService.createQuestion(
      testQuizSetId,
      testUserId,
      {
        questionType: QuestionType.MULTIPLE_CHOICE,
        difficulty: Difficulty.MEDIUM,
        questionJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              attrs: { textAlign: "center" },
              content: [
                {
                  type: "text",
                  text: "Tính giá trị ",
                  marks: [
                    { type: "bold" },
                    { type: "textStyle", attrs: { color: "#2563eb" } },
                  ],
                },
                {
                  type: "inlineMath",
                  attrs: { latex: "\\frac{2}{2}" },
                },
              ],
            },
            {
              type: "image",
              attrs: {
                fileId: "question-image-id",
                src: "https://cdn.example.com/question.png",
                alt: "Hình minh họa",
              },
            },
          ],
        },
        optionsJson: [
          {
            id: "A",
            richText: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "inlineMath", attrs: { latex: "1" } }],
                },
              ],
            },
          },
          { id: "B", richText: { type: "doc", content: [{ type: "text", text: "2" }] } },
          { id: "C", richText: { type: "doc", content: [{ type: "text", text: "3" }] } },
          { id: "D", richText: { type: "doc", content: [{ type: "text", text: "4" }] } },
          { id: "E", richText: { type: "doc", content: [{ type: "text", text: "5" }] } },
        ],
        correctAnswerJson: ["E"],
        explanationJson: {
          type: "doc",
          content: [
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Rút gọn phân số" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "blockMath",
              attrs: { latex: "\\frac{2}{2}=1" },
            },
          ],
        },
      },
      mockContext,
    );

    expect(question.id).toBeDefined();
    expect(question.quizSetId).toBe(testQuizSetId);
    expect(Array.isArray(question.optionsJson)).toBe(true);
    expect(question.optionsJson).toHaveLength(5);
    expect(question.correctAnswerJson).toEqual(["E"]);
    expect(question.explanation?.contentJson).toBeDefined();

    // Check count incremented
    const set = await prisma.quizSet.findUnique({ where: { id: testQuizSetId } });
    expect(set?.questionCount).toBe(1);
  });

  it("should accept a table as structural question content", async () => {
    const question = await quizService.createQuestion(
      testQuizSetId,
      testUserId,
      {
        questionType: QuestionType.TRUE_FALSE,
        difficulty: Difficulty.EASY,
        questionJson: {
          type: "doc",
          content: [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [
                    {
                      type: "tableCell",
                      content: [{ type: "paragraph" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        optionsJson: null,
        correctAnswerJson: true,
      },
      mockContext,
    );

    expect(question.id).toBeDefined();
    expect(question.questionType).toBe(QuestionType.TRUE_FALSE);

    const set = await prisma.quizSet.findUnique({ where: { id: testQuizSetId } });
    expect(set?.questionCount).toBe(2);
  });

  it("should create and preserve a multi-statement true/false question", async () => {
    const question = await quizService.createQuestion(
      testQuizSetId,
      testUserId,
      {
        questionType: QuestionType.MULTI_STATEMENT_TRUE_FALSE,
        difficulty: Difficulty.MEDIUM,
        questionJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Xác định tính đúng sai." }],
            },
          ],
        },
        optionsJson: [
          {
            id: "statement-a",
            richText: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Số 2 là số nguyên tố." }],
                },
              ],
            },
          },
          {
            id: "statement-b",
            richText: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Số 4 là số nguyên tố." }],
                },
              ],
            },
          },
        ],
        correctAnswerJson: [
          { statementId: "statement-a", value: true },
          { statementId: "statement-b", value: false },
        ],
      },
      mockContext,
    );

    expect(question.questionType).toBe(QuestionType.MULTI_STATEMENT_TRUE_FALSE);
    expect(question.optionsJson).toHaveLength(2);
    expect(question.correctAnswerJson).toEqual([
      { statementId: "statement-a", value: true },
      { statementId: "statement-b", value: false },
    ]);

    await quizService.deleteQuestion(question.id, testUserId, mockContext);
  });

  it("should list quiz sets in creation order and list questions", async () => {
    const secondSet = await quizService.createQuizSet(
      testLessonId,
      testUserId,
      { title: "Bộ câu hỏi 2" },
      mockContext,
    );
    const sets = await quizService.listQuizSetsByLesson(testLessonId);
    expect(sets.map((set) => set.id)).toEqual([testQuizSetId, secondSet.id]);
    expect(sets.map((set) => set.sortOrder)).toEqual([0, 1]);
    expect(sets[0]._count.questions).toBe(2);

    const questions = await quizService.listQuestionsBySet(testQuizSetId);
    expect(questions.length).toBe(2);
    expect(questions[0]?.explanation?.contentJson).toBeDefined();
  });

  it("should bulk review only pending AI questions in the selected quiz set", async () => {
    const createPendingQuestion = (label: string) =>
      quizService.createQuestion(
        testQuizSetId,
        testUserId,
        {
          questionType: QuestionType.TRUE_FALSE,
          difficulty: Difficulty.EASY,
          questionJson: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: label }],
              },
            ],
          },
          optionsJson: null,
          correctAnswerJson: true,
          explanationJson: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: `Lời giải ${label}` }],
              },
            ],
          },
        },
        mockContext,
      );

    const [firstAiQuestion, secondAiQuestion, manualQuestion] = await Promise.all([
      createPendingQuestion("Câu AI 1"),
      createPendingQuestion("Câu AI 2"),
      createPendingQuestion("Câu admin"),
    ]);
    const aiGenerationId = randomUUID();
    await Promise.all([
      prisma.quizQuestion.update({
        where: { id: firstAiQuestion.id },
        data: {
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          sourceMetadataJson: { aiGenerationId, generationQuestionIndex: 0 },
        },
      }),
      prisma.quizQuestion.update({
        where: { id: secondAiQuestion.id },
        data: {
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
          sourceMetadataJson: { aiGenerationId, generationQuestionIndex: 1 },
        },
      }),
      prisma.quizQuestion.update({
        where: { id: manualQuestion.id },
        data: { reviewStatus: ReviewStatus.NEEDS_REVIEW },
      }),
      prisma.aiExplanation.updateMany({
        where: {
          id: {
            in: [firstAiQuestion.explanationId, secondAiQuestion.explanationId].filter(
              (id): id is string => Boolean(id),
            ),
          },
        },
        data: { reviewStatus: ReviewStatus.NEEDS_REVIEW },
      }),
    ]);

    const result = await quizService.reviewAllPendingAiQuestions(
      testQuizSetId,
      testUserId,
      mockContext,
    );
    expect(result).toEqual({
      approvedQuestionCount: 2,
      pendingReviewQuestionCount: 1,
    });

    const reviewedQuestions = await prisma.quizQuestion.findMany({
      where: {
        id: { in: [firstAiQuestion.id, secondAiQuestion.id, manualQuestion.id] },
      },
      select: { id: true, publishedAt: true, reviewStatus: true },
    });
    expect(
      reviewedQuestions
        .filter((question) => question.id !== manualQuestion.id)
        .every(
          (question) =>
            question.reviewStatus === ReviewStatus.APPROVED &&
            question.publishedAt === null,
        ),
    ).toBe(true);
    expect(
      reviewedQuestions.find((question) => question.id === manualQuestion.id)
        ?.reviewStatus,
    ).toBe(ReviewStatus.NEEDS_REVIEW);

    const reviewedExplanations = await prisma.aiExplanation.findMany({
      where: {
        id: {
          in: [firstAiQuestion.explanationId, secondAiQuestion.explanationId].filter(
            (id): id is string => Boolean(id),
          ),
        },
      },
      select: { reviewStatus: true },
    });
    expect(
      reviewedExplanations.every(
        (explanation) => explanation.reviewStatus === ReviewStatus.APPROVED,
      ),
    ).toBe(true);

    await expect(
      quizService.reviewAllPendingAiQuestions(testQuizSetId, testUserId, mockContext),
    ).resolves.toEqual({
      approvedQuestionCount: 0,
      pendingReviewQuestionCount: 1,
    });
  });

  it("publishes with one approved question and saves later approvals into the latest release", async () => {
    const set = await quizService.createQuizSet(
      testLessonId,
      testUserId,
      { title: "Quiz phát hành từng phần" },
      mockContext,
    );
    const [approvedQuestion, pendingQuestion] = await Promise.all([
      prisma.quizQuestion.create({
        data: {
          quizSetId: set.id,
          lessonId: testLessonId,
          questionType: QuestionType.TRUE_FALSE,
          questionJson: {
            type: "doc",
            content: [{ type: "text", text: "Câu đã duyệt" }],
          },
          correctAnswerJson: true,
          reviewStatus: ReviewStatus.APPROVED,
        },
      }),
      prisma.quizQuestion.create({
        data: {
          quizSetId: set.id,
          lessonId: testLessonId,
          questionType: QuestionType.TRUE_FALSE,
          questionJson: {
            type: "doc",
            content: [{ type: "text", text: "Câu chờ duyệt" }],
          },
          correctAnswerJson: false,
          reviewStatus: ReviewStatus.NEEDS_REVIEW,
        },
      }),
    ]);

    await expect(
      quizService.reviewQuizSet(
        set.id,
        testUserId,
        {
          action: QuizSetReviewActionDto.PUBLISH,
          reviewStatus: ReviewStatus.APPROVED,
        },
        mockContext,
      ),
    ).resolves.toMatchObject({ reviewStatus: ReviewStatus.APPROVED });

    const firstRelease = await prisma.quizQuestion.findMany({
      where: { id: { in: [approvedQuestion.id, pendingQuestion.id] } },
      select: { id: true, publishedAt: true },
    });
    const firstPublishedAt = firstRelease.find(
      (question) => question.id === approvedQuestion.id,
    )?.publishedAt;
    expect(firstPublishedAt).toBeInstanceOf(Date);
    expect(
      firstRelease.find((question) => question.id === pendingQuestion.id)?.publishedAt,
    ).toBeNull();

    await quizService.reviewQuestion(
      pendingQuestion.id,
      testUserId,
      { reviewStatus: ReviewStatus.APPROVED },
      mockContext,
    );
    await quizService.reviewQuizSet(
      set.id,
      testUserId,
      {
        action: QuizSetReviewActionDto.SAVE,
        reviewStatus: ReviewStatus.APPROVED,
      },
      mockContext,
    );

    const savedQuestions = await prisma.quizQuestion.findMany({
      where: { id: { in: [approvedQuestion.id, pendingQuestion.id] } },
      select: { publishedAt: true },
    });
    expect(savedQuestions).toHaveLength(2);
    expect(
      savedQuestions.every(
        (question) => question.publishedAt?.getTime() === firstPublishedAt?.getTime(),
      ),
    ).toBe(true);
  });

  it("rejects publishing a Quiz set without an approved question", async () => {
    const set = await quizService.createQuizSet(
      testLessonId,
      testUserId,
      { title: "Quiz chưa có câu duyệt" },
      mockContext,
    );
    await prisma.quizQuestion.create({
      data: {
        quizSetId: set.id,
        lessonId: testLessonId,
        questionType: QuestionType.TRUE_FALSE,
        questionJson: { type: "doc", content: [{ type: "text", text: "Chờ duyệt" }] },
        correctAnswerJson: true,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      },
    });

    await expect(
      quizService.reviewQuizSet(
        set.id,
        testUserId,
        {
          action: QuizSetReviewActionDto.PUBLISH,
          reviewStatus: ReviewStatus.APPROVED,
        },
        mockContext,
      ),
    ).rejects.toMatchObject({
      response: { code: "QUIZ_SET_HAS_NO_APPROVED_QUESTIONS" },
    });
  });
});
