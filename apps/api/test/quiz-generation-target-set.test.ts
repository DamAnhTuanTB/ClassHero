import { describe, expect, it, vi } from "vitest";

import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";

type TargetSetResolver = {
  resolveQuizTargetSet(
    lessonId: string,
    targetQuizSetId?: string,
  ): Promise<{ id: string; title: string } | null>;
  resolveAssessmentTargetSet(
    lessonId: string,
    targetSetId: string | undefined,
    isTest: boolean,
  ): Promise<{ id: string; title: string; durationSeconds?: number } | null>;
  ensureAssessmentTargetSet(
    lessonId: string,
    actorUserId: string,
    targetSetId: string | null,
    isTest: boolean,
  ): Promise<string>;
};

function createService(findFirst: ReturnType<typeof vi.fn>) {
  const prisma = { quizSet: { findFirst } };
  return new QuizGenerationJobService(
    {} as never,
    {} as never,
    {} as never,
    prisma as never,
    {} as never,
  ) as unknown as TargetSetResolver;
}

function createAssessmentService(prisma: Record<string, unknown>) {
  return new QuizGenerationJobService(
    {} as never,
    {} as never,
    {} as never,
    prisma as never,
    {} as never,
  ) as unknown as TargetSetResolver;
}

describe("QuizGenerationJobService target set", () => {
  it("rejects a missing target when the lesson already has a Quiz set", async () => {
    const service = createService(
      vi.fn().mockResolvedValue({ id: "quiz-set-1", title: "Bộ câu hỏi 1" }),
    );

    await expect(service.resolveQuizTargetSet("lesson-1")).rejects.toMatchObject({
      response: {
        code: "QUIZ_TARGET_SET_REQUIRED",
      },
    });
  });

  it("allows an omitted target only when the lesson has no Quiz set", async () => {
    const service = createService(vi.fn().mockResolvedValue(null));

    await expect(service.resolveQuizTargetSet("lesson-1")).resolves.toBeNull();
  });

  it("keeps an explicitly selected set as the generation target", async () => {
    const selected = { id: "quiz-set-1", title: "Bộ câu hỏi 1" };
    const findFirst = vi.fn().mockResolvedValue(selected);
    const service = createService(findFirst);

    await expect(service.resolveQuizTargetSet("lesson-1", selected.id)).resolves.toEqual(
      selected,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: selected.id, lessonId: "lesson-1", deletedAt: null },
      select: { id: true, title: true },
    });
  });

  it("allows an omitted Test target only when the lesson has no Test set", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = createAssessmentService({ testSet: { findFirst } });

    await expect(
      service.resolveAssessmentTargetSet("lesson-1", undefined, true),
    ).resolves.toBeNull();
  });

  it("rejects an omitted Test target if a Test set appeared after preview", async () => {
    const service = createAssessmentService({
      testSet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "test-set-1",
          title: "Bộ đề 1",
          durationSeconds: 900,
        }),
      },
    });

    await expect(
      service.resolveAssessmentTargetSet("lesson-1", undefined, true),
    ).rejects.toMatchObject({ response: { code: "TEST_TARGET_SET_REQUIRED" } });
  });

  it("creates Bộ đề 1 with the shared 15-minute default for an empty lesson", async () => {
    const create = vi.fn().mockResolvedValue({ id: "test-set-1" });
    const service = createAssessmentService({
      testSet: { findFirst: vi.fn().mockResolvedValue(null), create },
    });

    await expect(
      service.ensureAssessmentTargetSet("lesson-1", "admin-1", null, true),
    ).resolves.toBe("test-set-1");
    expect(create).toHaveBeenCalledWith({
      data: {
        lessonId: "lesson-1",
        title: "Bộ đề 1",
        durationSeconds: 900,
        source: "ADMIN",
        reviewStatus: "DRAFT",
        sortOrder: 0,
        createdById: "admin-1",
        updatedById: "admin-1",
      },
      select: { id: true },
    });
  });
});
