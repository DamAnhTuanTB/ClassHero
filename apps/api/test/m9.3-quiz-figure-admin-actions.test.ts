import { describe, expect, it, vi } from "vitest";

import { QuizFigureDraftService } from "#api/modules/quiz-figures/services/quiz-figure-draft.service";
import { QuizFiguresService } from "#api/modules/quiz-figures/services/quiz-figures.service";

const questionId = "11111111-1111-4111-8111-111111111111";
const figureId = "22222222-2222-4222-8222-222222222222";
const currentRevisionId = "33333333-3333-4333-8333-333333333333";
const draftRevisionId = "44444444-4444-4444-8444-444444444444";
const actorUserId = "55555555-5555-4555-8555-555555555555";
const latexSource = [
  "\\begin{tikzpicture}",
  "\\draw (0,0) circle (1);",
  "% QUIZ_SOLUTION_EXTENSION",
  "\\end{tikzpicture}",
].join("\n");
const previewSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>';

describe("M9.3 Quiz figure admin actions", () => {
  it("compiles and applies a code draft without calling AI", async () => {
    const prisma = {
      quizFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figureId,
          subjectKey: "MATH",
          currentRevisionId,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRevision: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ sourceVersion: 3 })
          .mockResolvedValueOnce({ previewSvg }),
        create: vi.fn().mockResolvedValue({ id: draftRevisionId }),
      },
    };
    const renderer = {
      render: vi.fn().mockResolvedValue({
        ok: true,
        svg: previewSvg,
        log: "",
        durationMs: 4,
        rendererVersion: "test",
      }),
    };
    const artifacts = { promoteSvg: vi.fn().mockResolvedValue({}) };
    const service = new QuizFigureDraftService(
      prisma as never,
      renderer as never,
      artifacts as never,
    );

    const compiled = await service.compile(questionId, figureId, actorUserId, {
      baseRevisionId: currentRevisionId,
      sourceVersion: 3,
      latexSource,
      altText: "Hình đề",
      caption: "Caption",
    });
    expect(compiled).toMatchObject({
      revisionId: draftRevisionId,
      sourceVersion: 4,
      status: "DRAFT_READY",
    });
    expect(renderer.render).toHaveBeenCalledWith(latexSource, "MATH");

    await service.apply(questionId, figureId, actorUserId, {
      baseRevisionId: currentRevisionId,
      revisionId: draftRevisionId,
      sourceVersion: 4,
    });
    expect(artifacts.promoteSvg).toHaveBeenCalledWith(
      expect.objectContaining({
        figureId,
        revisionId: draftRevisionId,
        svg: previewSvg,
      }),
    );
  });

  it("queues a fresh AI revision and preserves scoped admin instructions", async () => {
    const prisma = {
      quizFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figureId,
          role: "QUESTION",
          planJson: {
            version: 1,
            role: "QUESTION",
            problem: "Cho tam giác ABC.",
            caption: "Tam giác ABC",
          },
          currentRevisionId,
          currentRevision: {
            altText: "Hình đề",
            caption: "Caption",
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRevision: {
        findFirst: vi.fn().mockResolvedValue({ sourceVersion: 2 }),
        create: vi.fn().mockResolvedValue({ id: draftRevisionId }),
      },
    };
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ id: "job-1", status: "QUEUED" }),
    };
    const route = {
      feature: "QUIZ",
      version: 1,
      model: "gpt-test",
      temperature: null,
      reasoningEffort: "medium",
      maxInputTokens: 20_000,
      maxOutputTokens: 12_000,
      candidates: [
        {
          provider: "OPENAI",
          model: "gpt-test",
          available: true,
          capabilitiesJson: { aiConfiguration: "REASONING_EFFORT" },
        },
      ],
      hasConfiguration: true,
    };
    const modelRouting = { resolve: vi.fn().mockResolvedValue(route) };
    const service = new QuizFiguresService(
      prisma as never,
      {} as never,
      {} as never,
      jobs as never,
      {} as never,
      modelRouting as never,
    );
    const result = await service.createNewAi(questionId, figureId, actorUserId, {
      baseRevisionId: currentRevisionId,
      mode: "REGENERATE",
      adminInstructions: "  Đặt nhãn thoáng hơn.  ",
    });
    expect(result).toEqual({ jobId: "job-1", status: "QUEUED" });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      figureId,
      actorUserId,
      expect.objectContaining({ model: "gpt-test", maxOutputTokens: 12_000 }),
      {
        adminInstructions: "Đặt nhãn thoáng hơn.",
        aiMode: "REGENERATE",
        systemPrompt: null,
        userPrompt: null,
      },
    );
  });

  it("preserves the configured output budget for an independent solution figure", async () => {
    const prisma = {
      quizFigure: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: figureId,
            role: "SOLUTION",
            planJson: {
              version: 2,
              role: "SOLUTION",
              problem: "Mảnh đất ABCDEF có các kích thước đã cho.",
              solution: "Kẻ CE vuông góc DE để chia mảnh đất thành hai hình chữ nhật.",
              caption: "Mô hình toán học của mảnh đất",
            },
            currentRevisionId,
            currentRevision: {
              altText: "Mô hình lời giải",
              caption: "Mô hình toán học của mảnh đất",
            },
          })
          .mockResolvedValueOnce({ id: "question-figure-id" }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRevision: {
        findFirst: vi.fn().mockResolvedValue({ sourceVersion: 1 }),
        create: vi.fn().mockResolvedValue({ id: draftRevisionId }),
      },
    };
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ id: "job-redraw", status: "QUEUED" }),
    };
    const route = {
      feature: "QUIZ",
      version: 1,
      model: "gpt-test",
      temperature: null,
      reasoningEffort: "medium",
      maxInputTokens: 20_000,
      maxOutputTokens: 20_000,
      candidates: [
        {
          provider: "OPENAI",
          model: "gpt-test",
          available: true,
          capabilitiesJson: { aiConfiguration: "REASONING_EFFORT" },
        },
      ],
      hasConfiguration: true,
    };
    const modelRouting = { resolve: vi.fn().mockResolvedValue(route) };
    const service = new QuizFiguresService(
      prisma as never,
      {} as never,
      {} as never,
      jobs as never,
      {} as never,
      modelRouting as never,
    );

    await service.createNewAi(questionId, figureId, actorUserId, {
      baseRevisionId: currentRevisionId,
      mode: "REGENERATE",
    });

    expect(jobs.enqueue).toHaveBeenCalledWith(
      figureId,
      actorUserId,
      expect.objectContaining({ maxOutputTokens: 20_000 }),
      expect.objectContaining({ aiMode: "REGENERATE" }),
    );
  });

  it("queues AI refinement only for a successful TikZ revision", async () => {
    const prisma = {
      quizFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figureId,
          role: "QUESTION",
          status: "SUCCEEDED",
          planJson: {
            version: 1,
            role: "QUESTION",
            problem: "Cho tam giác ABC vuông tại A.",
          },
          currentRevisionId,
          currentRevision: {
            status: "SUCCEEDED",
            sourceKind: "AI_TEX",
            latexSource,
            deliveryFileId: "77777777-7777-4777-8777-777777777777",
            deliveryFile: { mimeType: "image/svg+xml" },
            altText: "Hình đề",
            caption: null,
          },
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      quizFigureRevision: {
        findFirst: vi.fn().mockResolvedValue({ sourceVersion: 2 }),
        create: vi.fn().mockResolvedValue({ id: draftRevisionId }),
      },
    };
    const route = {
      feature: "QUIZ",
      purpose: "IMAGE",
      version: 1,
      model: "gpt-test",
      temperature: null,
      reasoningEffort: "medium",
      maxInputTokens: 20_000,
      maxOutputTokens: 12_000,
      candidates: [
        {
          provider: "OPENAI",
          model: "gpt-test",
          available: true,
          capabilitiesJson: { aiConfiguration: "REASONING_EFFORT" },
        },
      ],
      hasConfiguration: true,
    };
    const jobs = {
      enqueue: vi.fn().mockResolvedValue({ id: "job-refine", status: "QUEUED" }),
    };
    const modelRouting = { resolve: vi.fn().mockResolvedValue(route) };
    const service = new QuizFiguresService(
      prisma as never,
      {} as never,
      {} as never,
      jobs as never,
      {} as never,
      modelRouting as never,
    );

    await expect(
      service.refineWithAi(questionId, figureId, actorUserId, {
        baseRevisionId: currentRevisionId,
        adminInstructions: "  Sửa nhãn đang chồng nét.  ",
      }),
    ).resolves.toEqual({ jobId: "job-refine", status: "QUEUED" });

    expect(modelRouting.resolve).toHaveBeenCalledWith("QUIZ", "IMAGE");
    expect(prisma.quizFigureRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        origin: "AI_REFINEMENT",
        sourceKind: "AI_TEX",
        status: "QUEUED",
      }),
      select: { id: true },
    });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      figureId,
      actorUserId,
      expect.objectContaining({ model: "gpt-test" }),
      {
        aiMode: "EDIT_CURRENT",
        operation: "REFINE_CURRENT",
        adminInstructions: "Sửa nhãn đang chồng nét.",
      },
    );
  });

  it("deletes a question figure without touching the independent solution", async () => {
    const tx = {
      quizFigure: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      quizQuestion: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      quizFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figureId,
          role: "QUESTION",
          currentRevisionId,
          currentRevision: null,
        }),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new QuizFiguresService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.deleteFigure(questionId, figureId, { baseRevisionId: currentRevisionId }),
    ).resolves.toEqual({ deleted: true, figureId });
    expect(tx.quizFigure.updateMany).not.toHaveBeenCalled();
    expect(tx.quizQuestion.update).not.toHaveBeenCalled();
  });

  it("deletes only the selected solution figure", async () => {
    const tx = {
      quizFigure: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn(),
      },
      quizQuestion: { update: vi.fn().mockResolvedValue({}) },
    };
    const prisma = {
      quizFigure: {
        findFirst: vi.fn().mockResolvedValue({
          id: figureId,
          role: "SOLUTION",
          currentRevisionId,
          currentRevision: null,
        }),
      },
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new QuizFiguresService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.deleteFigure(questionId, figureId, {
      baseRevisionId: currentRevisionId,
    });

    expect(tx.quizFigure.updateMany).not.toHaveBeenCalled();
    expect(tx.quizQuestion.update).not.toHaveBeenCalled();
  });
});
