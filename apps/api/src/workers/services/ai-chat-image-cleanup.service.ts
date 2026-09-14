import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FilePurpose, FileStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { StoredFileCleanupService } from "#api/modules/files/services/stored-file-cleanup.service";

@Injectable()
export class AiChatImageCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiChatImageCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StoredFileCleanupService)
    private readonly fileCleanup: StoredFileCleanupService,
    @Inject(ConfigService)
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  onModuleInit() {
    const intervalMinutes = this.config.get(
      "AI_CHAT_ORPHAN_IMAGE_CLEANUP_INTERVAL_MINUTES",
      { infer: true },
    );
    this.timer = setInterval(() => {
      void this.runScheduledCleanup();
    }, intervalMinutes * 60_000);
    this.timer.unref?.();
    void this.runScheduledCleanup();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async cleanupExpiredOrphans(now = new Date()) {
    const ttlHours = this.config.get("AI_CHAT_ORPHAN_IMAGE_TTL_HOURS", {
      infer: true,
    });
    const batchSize = this.config.get("AI_CHAT_ORPHAN_IMAGE_CLEANUP_BATCH_SIZE", {
      infer: true,
    });
    const expiresBefore = new Date(now.getTime() - ttlHours * 60 * 60 * 1_000);
    const candidates = await this.prisma.file.findMany({
      where: {
        purpose: FilePurpose.CHAT_IMAGE,
        aiChatMessageAttachments: { none: {} },
        OR: [
          {
            status: { in: [FileStatus.UPLOADED, FileStatus.READY] },
            deletedAt: null,
            createdAt: { lt: expiresBefore },
          },
          {
            status: FileStatus.DELETED,
            deletedAt: { not: null },
          },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true },
    });
    const candidateIds = candidates.map((file) => file.id);
    if (candidateIds.length === 0) {
      return {
        candidateFileCount: 0,
        deletedFileCount: 0,
        pendingFileCleanupCount: 0,
      };
    }

    await this.prisma.file.updateMany({
      where: {
        id: { in: candidateIds },
        purpose: FilePurpose.CHAT_IMAGE,
        status: { in: [FileStatus.UPLOADED, FileStatus.READY] },
        deletedAt: null,
        createdAt: { lt: expiresBefore },
        aiChatMessageAttachments: { none: {} },
      },
      data: { status: FileStatus.DELETED, deletedAt: now },
    });
    const result = await this.fileCleanup.deleteStagedFiles(candidateIds);
    return { candidateFileCount: candidateIds.length, ...result };
  }

  private async runScheduledCleanup() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.cleanupExpiredOrphans();
      if (result.candidateFileCount > 0) {
        this.logger.log(
          `Chat image cleanup checked ${result.candidateFileCount} file(s): deleted=${result.deletedFileCount}, pending=${result.pendingFileCleanupCount}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Chat image cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
