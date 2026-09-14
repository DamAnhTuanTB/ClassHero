import { Inject, Injectable, Logger } from "@nestjs/common";
import { FileStatus, Prisma } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";

type FileTransaction = Prisma.TransactionClient;

export type StoredFileCleanupResult = {
  deletedFileCount: number;
  pendingFileCleanupCount: number;
};

@Injectable()
export class StoredFileCleanupService {
  private readonly logger = new Logger(StoredFileCleanupService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService)
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async stageDetachedFigureFiles(
    transaction: FileTransaction,
    candidateFileIds: string[],
  ): Promise<string[]> {
    const uniqueFileIds = [...new Set(candidateFileIds)];
    if (uniqueFileIds.length === 0) return [];

    const detachedFiles = await transaction.file.findMany({
      where: {
        id: { in: uniqueFileIds },
        stemFigureDeliveries: { none: {} },
        quizFigureDeliveries: { none: {} },
        flashcardFigureDeliveries: { none: {} },
        aiChatMessageAttachments: { none: {} },
      },
      select: { id: true },
    });
    const detachedFileIds = detachedFiles.map((file) => file.id);
    if (detachedFileIds.length === 0) return [];

    await transaction.file.updateMany({
      where: { id: { in: detachedFileIds } },
      data: { status: FileStatus.DELETED, deletedAt: new Date() },
    });

    return detachedFileIds;
  }

  async deleteStagedFiles(fileIds: string[]): Promise<StoredFileCleanupResult> {
    const uniqueFileIds = [...new Set(fileIds)];
    if (uniqueFileIds.length === 0) {
      return { deletedFileCount: 0, pendingFileCleanupCount: 0 };
    }

    const stagedFiles = await this.prisma.file.findMany({
      where: {
        id: { in: uniqueFileIds },
        status: FileStatus.DELETED,
        deletedAt: { not: null },
        stemFigureDeliveries: { none: {} },
        quizFigureDeliveries: { none: {} },
        flashcardFigureDeliveries: { none: {} },
        aiChatMessageAttachments: { none: {} },
      },
      select: { id: true, objectKey: true },
    });

    const results = await Promise.all(
      stagedFiles.map(async (file) => {
        try {
          await this.objectStorage.deleteObject(file.objectKey);
          const deleted = await this.prisma.file.deleteMany({
            where: {
              id: file.id,
              status: FileStatus.DELETED,
              stemFigureDeliveries: { none: {} },
              quizFigureDeliveries: { none: {} },
              flashcardFigureDeliveries: { none: {} },
              aiChatMessageAttachments: { none: {} },
            },
          });
          return deleted.count === 1;
        } catch (error) {
          this.logger.warn(
            `Stored file cleanup failed for ${file.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return false;
        }
      }),
    );
    const deletedFileCount = results.filter(Boolean).length;

    return {
      deletedFileCount,
      pendingFileCleanupCount: stagedFiles.length - deletedFileCount,
    };
  }
}
