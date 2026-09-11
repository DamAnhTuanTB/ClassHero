import { describe, expect, it, vi } from "vitest";

import { VideoSummariesService } from "#api/modules/learning-paths/services/video-summaries.service";

describe("VideoSummariesService hard delete", () => {
  it("hard-deletes the current video summary and records its audit snapshot", async () => {
    const summary = {
      id: "summary-1",
      lessonId: "lesson-1",
      contentJson: { type: "doc", content: [] },
      deletedAt: null,
    };
    const hardDelete = vi.fn(async () => summary);
    const softDelete = vi.fn(async () => summary);
    const createAuditLog = vi.fn(async () => ({ id: "audit-1" }));
    const prisma = {
      lessonVideoSummary: {
        findFirst: vi.fn(async () => summary),
        delete: hardDelete,
        update: softDelete,
      },
      auditLog: { create: createAuditLog },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const service = new VideoSummariesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.deleteForAdmin("lesson-1", "actor-1", {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      }),
    ).resolves.toBeUndefined();

    expect(prisma.lessonVideoSummary.findFirst).toHaveBeenCalledWith({
      where: { lessonId: "lesson-1", deletedAt: null },
    });
    expect(hardDelete).toHaveBeenCalledWith({ where: { id: "summary-1" } });
    expect(softDelete).not.toHaveBeenCalled();
    expect(createAuditLog).toHaveBeenCalledWith({
      data: {
        actorUserId: "actor-1",
        action: "LESSON_VIDEO_SUMMARY_DELETED",
        entityType: "LessonVideoSummary",
        entityId: "summary-1",
        before: summary,
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    });
  });

  it("does nothing when there is no current video summary", async () => {
    const hardDelete = vi.fn();
    const createAuditLog = vi.fn();
    const prisma = {
      lessonVideoSummary: {
        findFirst: vi.fn(async () => null),
        delete: hardDelete,
      },
      auditLog: { create: createAuditLog },
      $transaction: vi.fn(),
    };
    const service = new VideoSummariesService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.deleteForAdmin("lesson-1", "actor-1")).resolves.toBeUndefined();

    expect(hardDelete).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
