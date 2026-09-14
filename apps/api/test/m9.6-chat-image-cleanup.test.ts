import { FilePurpose, FileStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AiChatImageCleanupService } from "#api/workers/services/ai-chat-image-cleanup.service";

describe("M9.6 orphan chat image cleanup", () => {
  it("stages only unattached expired images and retries prior tombstones", async () => {
    const findMany = vi.fn(async () => [{ id: "expired" }, { id: "retry" }]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const deleteStagedFiles = vi.fn(async () => ({
      deletedFileCount: 2,
      pendingFileCleanupCount: 0,
    }));
    const configValues = {
      AI_CHAT_ORPHAN_IMAGE_TTL_HOURS: 24,
      AI_CHAT_ORPHAN_IMAGE_CLEANUP_BATCH_SIZE: 100,
      AI_CHAT_ORPHAN_IMAGE_CLEANUP_INTERVAL_MINUTES: 60,
    } as const;
    const service = new AiChatImageCleanupService(
      { file: { findMany, updateMany } } as never,
      { deleteStagedFiles } as never,
      { get: (key: keyof typeof configValues) => configValues[key] } as never,
    );
    const now = new Date("2026-09-13T12:00:00.000Z");

    await expect(service.cleanupExpiredOrphans(now)).resolves.toEqual({
      candidateFileCount: 2,
      deletedFileCount: 2,
      pendingFileCleanupCount: 0,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        purpose: FilePurpose.CHAT_IMAGE,
        aiChatMessageAttachments: { none: {} },
        OR: [
          {
            status: { in: [FileStatus.UPLOADED, FileStatus.READY] },
            deletedAt: null,
            createdAt: { lt: new Date("2026-09-12T12:00:00.000Z") },
          },
          { status: FileStatus.DELETED, deletedAt: { not: null } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["expired", "retry"] },
          aiChatMessageAttachments: { none: {} },
          createdAt: { lt: new Date("2026-09-12T12:00:00.000Z") },
        }),
        data: { status: FileStatus.DELETED, deletedAt: now },
      }),
    );
    expect(deleteStagedFiles).toHaveBeenCalledWith(["expired", "retry"]);
  });

  it("does no storage work when the batch is empty", async () => {
    const deleteStagedFiles = vi.fn();
    const service = new AiChatImageCleanupService(
      {
        file: {
          findMany: vi.fn(async () => []),
          updateMany: vi.fn(),
        },
      } as never,
      { deleteStagedFiles } as never,
      {
        get: (key: string) =>
          key === "AI_CHAT_ORPHAN_IMAGE_TTL_HOURS" ? 24 : 100,
      } as never,
    );

    await expect(service.cleanupExpiredOrphans()).resolves.toEqual({
      candidateFileCount: 0,
      deletedFileCount: 0,
      pendingFileCleanupCount: 0,
    });
    expect(deleteStagedFiles).not.toHaveBeenCalled();
  });
});
