import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/common/prisma/prisma.service";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { QuizService } from "../src/modules/quiz/services/quiz.service";
import { QuestionType, Difficulty, UserRole, Subject } from "@prisma/client";
import { RequestContext } from "../src/common/api/request-context";
import { randomUUID } from "crypto";

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

    const lp = await prisma.learningPath.create({
      data: {
        title: "Test Path",
        subject: Subject.MATH,
        grade: 10,
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

  it("should list quiz sets and questions", async () => {
    const sets = await quizService.listQuizSetsByLesson(testLessonId);
    expect(sets.length).toBe(1);
    expect(sets[0].id).toBe(testQuizSetId);
    expect(sets[0]._count.questions).toBe(2);

    const questions = await quizService.listQuestionsBySet(testQuizSetId);
    expect(questions.length).toBe(2);
    expect(questions[0]?.explanation?.contentJson).toBeDefined();
  });
});
