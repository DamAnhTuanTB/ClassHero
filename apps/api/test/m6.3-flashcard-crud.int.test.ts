import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  Difficulty,
  PublishStatus,
  ReviewStatus,
  UserRole,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";
import type { FlashcardRequestContext } from "#api/modules/flashcards/types/flashcard.types";
import { createTestCourseCatalogRelation } from "./helpers/course-catalog-fixture";

describe("M6.3 flashcard CRUD integration", () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: FlashcardsService;
  let actorUserId = "";
  let studentUserId = "";
  let enrollmentId = "";
  let learningPathId = "";
  let chapterId = "";
  let lessonId = "";
  let primarySetId = "";
  let hiddenSetId = "";
  let cardId = "";

  const context: FlashcardRequestContext = {
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };
  const suffix = randomUUID().slice(0, 8);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(FlashcardsService);

    const actor = await prisma.user.create({
      data: {
        email: `m6.3-${suffix}@example.com`,
        username: `m6_3_${suffix}`,
        passwordHash: "hash",
        role: UserRole.ADMIN,
      },
    });
    actorUserId = actor.id;
    const student = await prisma.user.create({
      data: {
        email: `m6.3-student-${suffix}@example.com`,
        username: `m6_3_student_${suffix}`,
        passwordHash: "hash",
        role: UserRole.STUDENT,
      },
    });
    studentUserId = student.id;
    const courseCatalog = await createTestCourseCatalogRelation(prisma, 8);
    const learningPath = await prisma.learningPath.create({
      data: {
        title: `M6.3 Path ${suffix}`,
        slug: `m6-3-path-${suffix}`,
        ...courseCatalog,
        originalPriceVnd: 100_000,
      },
    });
    learningPathId = learningPath.id;
    const chapter = await prisma.learningPathChapter.create({
      data: {
        learningPathId,
        title: `M6.3 Chapter ${suffix}`,
        orderIndex: 1,
      },
    });
    chapterId = chapter.id;
    const lesson = await prisma.lesson.create({
      data: {
        learningPathId,
        chapterId,
        title: `M6.3 Lesson ${suffix}`,
        orderIndex: 1,
        status: PublishStatus.PUBLISHED,
      },
    });
    lessonId = lesson.id;
    const enrollment = await prisma.enrollment.create({
      data: {
        studentUserId,
        learningPathId,
        startsAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    enrollmentId = enrollment.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.auditLog.deleteMany({ where: { actorUserId } });
      await prisma.flashcard.deleteMany({ where: { lessonId } });
      await prisma.flashcardSet.deleteMany({ where: { lessonId } });
      await prisma.enrollment.deleteMany({ where: { id: enrollmentId } });
      await prisma.lesson.deleteMany({ where: { id: lessonId } });
      await prisma.learningPathChapter.deleteMany({ where: { id: chapterId } });
      await prisma.learningPath.deleteMany({ where: { id: learningPathId } });
      await prisma.user.deleteMany({ where: { id: actorUserId } });
      await prisma.user.deleteMany({ where: { id: studentUserId } });
    }
    await moduleRef?.close();
  });

  it("creates multiple flashcard sets in one lesson", async () => {
    const primary = await service.createSet(
      lessonId,
      actorUserId,
      { title: "Công thức trọng tâm", difficulty: Difficulty.MIXED },
      context,
    );
    const hidden = await service.createSet(
      lessonId,
      actorUserId,
      { title: "Bộ đang biên tập", difficulty: Difficulty.HARD },
      context,
    );
    primarySetId = primary.id;
    hiddenSetId = hidden.id;

    await service.reviewSet(
      hiddenSetId,
      actorUserId,
      { reviewStatus: ReviewStatus.HIDDEN },
      context,
    );

    const sets = await service.listAdminSetsByLesson(lessonId);
    expect(sets).toHaveLength(2);
    expect(sets.map((set) => set.title)).toEqual([
      "Công thức trọng tâm",
      "Bộ đang biên tập",
    ]);
    expect(sets.map((set) => set.sortOrder)).toEqual([0, 1]);
  });

  it("creates, reads and updates a flashcard item", async () => {
    const card = await service.createCard(
      primarySetId,
      actorUserId,
      {
        difficulty: Difficulty.MEDIUM,
        frontJson: documentWithText("Định lý Pythagore"),
        backJson: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "inlineMath", attrs: { latex: "a^2+b^2=c^2" } }],
            },
          ],
        },
        explanationJson: documentWithText(
          "Áp dụng định lý cho ba cạnh của tam giác vuông.",
        ),
      },
      context,
    );
    cardId = card.id;

    expect(card.lessonId).toBe(lessonId);
    expect(card.flashcardSetId).toBe(primarySetId);

    const cards = await service.listCardsBySet(primarySetId);
    expect(cards).toHaveLength(1);
    const updated = await service.updateCard(
      cardId,
      actorUserId,
      {
        difficulty: Difficulty.HARD,
        explanationJson: documentWithText(
          "Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.",
        ),
      },
      context,
    );
    expect(updated.difficulty).toBe(Difficulty.HARD);
    expect(updated.explanation?.contentJson).toEqual(
      documentWithText(
        "Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.",
      ),
    );
    expect(updated.explanationId).toBeTruthy();

    const cleared = await service.updateCard(
      cardId,
      actorUserId,
      { explanationJson: null },
      context,
    );
    expect(cleared.explanation).toBeNull();

    const restored = await service.updateCard(
      cardId,
      actorUserId,
      {
        explanationJson: documentWithText(
          "Dùng quan hệ giữa cạnh huyền và hai cạnh góc vuông.",
        ),
      },
      context,
    );
    expect(restored.explanation?.contentJson).toEqual(
      documentWithText("Dùng quan hệ giữa cạnh huyền và hai cạnh góc vuông."),
    );

    const set = (await service.listAdminSetsByLesson(lessonId)).find(
      (item) => item.id === primarySetId,
    );
    expect(set?.cardCount).toBe(1);
  });

  it("returns approved student content and excludes hidden sets", async () => {
    const sets = await service.listStudentSetsByLesson(lessonId, studentUserId);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.id).toBe(primarySetId);
    expect(sets[0]?.flashcards).toHaveLength(1);
    expect(sets[0]?.flashcards[0]?.backJson).toBeDefined();
    expect(sets[0]?.flashcards[0]?.explanation?.contentJson).toBeDefined();
  });

  it("rejects student reads without an active enrollment", async () => {
    await expect(
      service.listStudentSetsByLesson(lessonId, randomUUID()),
    ).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_REQUIRED",
      },
    });
  });

  it("soft-deletes cards and sets without exposing them again", async () => {
    await service.deleteCard(cardId, actorUserId, context);
    expect(await service.listCardsBySet(primarySetId)).toHaveLength(0);
    const setAfterCardDelete = (await service.listAdminSetsByLesson(lessonId)).find(
      (item) => item.id === primarySetId,
    );
    expect(setAfterCardDelete?.cardCount).toBe(0);

    await service.deleteSet(hiddenSetId, actorUserId, context);
    const sets = await service.listAdminSetsByLesson(lessonId);
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
