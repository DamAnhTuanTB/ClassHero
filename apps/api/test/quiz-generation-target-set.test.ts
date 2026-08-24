import { describe, expect, it, vi } from "vitest";

import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";

type TargetSetResolver = {
  resolveQuizTargetSet(
    lessonId: string,
    targetQuizSetId?: string,
  ): Promise<{ id: string; title: string } | null>;
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

    await expect(
      service.resolveQuizTargetSet("lesson-1", selected.id),
    ).resolves.toEqual(selected);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: selected.id, lessonId: "lesson-1", deletedAt: null },
      select: { id: true, title: true },
    });
  });
});
