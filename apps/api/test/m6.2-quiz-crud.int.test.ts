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
        originalPriceVnd: 100000 
      },
    });
    const chapter = await prisma.learningPathChapter.create({
      data: { learningPathId: lp.id, title: "Test Chapter", orderIndex: 1 },
    });
    const lesson = await prisma.lesson.create({
      data: { learningPathId: lp.id, chapterId: chapter.id, title: "Test Lesson", orderIndex: 1 },
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
        questionJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "1 + 1 = ?" }] }] },
        optionsJson: [
          { id: "A", richText: { type: "doc", content: [{ type: "text", text: "1" }] } },
          { id: "B", richText: { type: "doc", content: [{ type: "text", text: "2" }] } },
        ],
        correctAnswerJson: ["B"],
      },
      mockContext,
    );

    expect(question.id).toBeDefined();
    expect(question.quizSetId).toBe(testQuizSetId);
    
    // Check count incremented
    const set = await prisma.quizSet.findUnique({ where: { id: testQuizSetId } });
    expect(set?.questionCount).toBe(1);
  });

  it("should list quiz sets and questions", async () => {
    const sets = await quizService.listQuizSetsByLesson(testLessonId);
    expect(sets.length).toBe(1);
    expect(sets[0].id).toBe(testQuizSetId);
    expect(sets[0]._count.questions).toBe(1);

    const questions = await quizService.listQuestionsBySet(testQuizSetId);
    expect(questions.length).toBe(1);
  });
});
