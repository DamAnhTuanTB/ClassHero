import { FileStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { StoredFileCleanupService } from "#api/modules/files/services/stored-file-cleanup.service";

describe("StoredFileCleanupService", () => {
  it("stages only detached figure files and deduplicates candidate ids", async () => {
    const findMany = vi.fn(async () => [{ id: "file-1" }]);
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const transaction = { file: { findMany, updateMany } };
    const service = new StoredFileCleanupService({} as never, {} as never);

    await expect(
      service.stageDetachedFigureFiles(transaction as never, [
        "file-1",
        "file-1",
        "shared-file",
      ]),
    ).resolves.toEqual(["file-1"]);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["file-1", "shared-file"] },
        stemFigureDeliveries: { none: {} },
        quizFigureDeliveries: { none: {} },
        flashcardFigureDeliveries: { none: {} },
        aiChatMessageAttachments: { none: {} },
      },
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["file-1"] } },
      data: { status: FileStatus.DELETED, deletedAt: expect.any(Date) },
    });
  });

  it("deletes storage objects before hard-deleting their file metadata", async () => {
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      file: {
        findMany: vi.fn(async () => [
          { id: "file-1", objectKey: "quiz/file-1.svg" },
          { id: "file-2", objectKey: "summary/file-2.svg" },
        ]),
        deleteMany,
      },
    };
    const objectStorage = { deleteObject: vi.fn(async () => undefined) };
    const service = new StoredFileCleanupService(prisma as never, objectStorage as never);

    await expect(
      service.deleteStagedFiles(["file-1", "file-2", "file-1"]),
    ).resolves.toEqual({ deletedFileCount: 2, pendingFileCleanupCount: 0 });
    expect(objectStorage.deleteObject).toHaveBeenCalledTimes(2);
    expect(objectStorage.deleteObject).toHaveBeenCalledWith("quiz/file-1.svg");
    expect(objectStorage.deleteObject).toHaveBeenCalledWith("summary/file-2.svg");
    expect(deleteMany).toHaveBeenCalledTimes(2);
  });

  it("keeps a tombstone when object storage deletion fails", async () => {
    const prisma = {
      file: {
        findMany: vi.fn(async () => [{ id: "file-1", objectKey: "summary/file-1.svg" }]),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
    };
    const objectStorage = {
      deleteObject: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    };
    const service = new StoredFileCleanupService(prisma as never, objectStorage as never);

    await expect(service.deleteStagedFiles(["file-1"])).resolves.toEqual({
      deletedFileCount: 0,
      pendingFileCleanupCount: 1,
    });
    expect(prisma.file.deleteMany).not.toHaveBeenCalled();
  });
});
