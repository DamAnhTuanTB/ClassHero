import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PROVIDER_USAGE_OPERATIONS } from "@learning-path/shared";

import {
  quizFigureTargetCreateData,
  quizFigureTargetFeature,
  quizFigureTargetUsageKind,
  quizFigureTargetWhere,
} from "#api/modules/quiz-figures/types/quiz-figure-target";
import { QuizFiguresService } from "#api/modules/quiz-figures/services/quiz-figures.service";

describe("M6.6 QuizFigure assessment targets", () => {
  it("creates mutually exclusive Quiz and Test foreign-key payloads", () => {
    expect(
      quizFigureTargetCreateData({ kind: "QUIZ", questionId: "quiz-question" }),
    ).toEqual({
      quizQuestionId: "quiz-question",
      testQuestionId: null,
    });
    expect(
      quizFigureTargetCreateData({ kind: "TEST", questionId: "test-question" }),
    ).toEqual({
      quizQuestionId: null,
      testQuestionId: "test-question",
    });
    expect(quizFigureTargetWhere({ kind: "TEST", questionId: "test-question" })).toEqual({
      testQuestionId: "test-question",
    });
  });

  it("routes Test figure usage and provider selection to Test, not Quiz", () => {
    const target = { kind: "TEST" as const, questionId: "test-question" };
    expect(quizFigureTargetFeature(target)).toBe("TEST");
    expect(quizFigureTargetUsageKind(target)).toBe("TEST_QUESTION");
  });

  it("scopes a Test mutation to test_question_id and cannot fall through to Quiz", async () => {
    const findFirst = vi.fn(async () => ({
      id: "figure-id",
      role: "QUESTION",
      status: "SUCCEEDED",
      planJson: null,
      subjectKey: "GENERAL",
      subjectName: "Tổng quát",
      subjectSlug: "general",
      aiGeneration: null,
      currentRevisionId: null,
      currentRevision: null,
    }));
    const update = vi.fn(async () => ({ id: "figure-id" }));
    const prisma = {
      quizFigure: { findFirst, update },
      $transaction: async (callback: (transaction: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    };
    const service = new QuizFiguresService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.deleteFigure(
      "test-question",
      "figure-id",
      {},
      { kind: "TEST", questionId: "test-question" },
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "figure-id",
          testQuestionId: "test-question",
          deletedAt: null,
        }),
      }),
    );
    expect(findFirst.mock.calls[0]?.[0].where).not.toHaveProperty("quizQuestionId");
  });

  it("migration enforces one target and adds the Test FK/index without replacing quiz_figures", async () => {
    const migration = await readFile(
      resolve(
        process.cwd(),
        "prisma/migrations/20260909160000_m6_6_test_quiz_figure_targets/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain('ALTER COLUMN "quiz_question_id" DROP NOT NULL');
    expect(migration).toContain('ADD COLUMN "test_question_id" UUID');
    expect(migration).toContain('REFERENCES "test_questions"("id")');
    expect(migration).toContain("quiz_figures_exactly_one_question_target_check");
    expect(migration).toContain("quiz_figures_test_question_id_role_key");
    expect(migration).not.toContain('DROP TABLE "quiz_figures"');
  });

  it("keeps the database usage-operation allowlist aligned with shared Test operations", async () => {
    const migration = await readFile(
      resolve(
        process.cwd(),
        "prisma/migrations/20260909190000_allow_test_solution_usage_operations/migration.sql",
      ),
      "utf8",
    );
    for (const operation of PROVIDER_USAGE_OPERATIONS.filter((value) =>
      value.startsWith("TEST_"),
    )) {
      expect(migration).toContain(`'${operation}'`);
    }
  });
});
