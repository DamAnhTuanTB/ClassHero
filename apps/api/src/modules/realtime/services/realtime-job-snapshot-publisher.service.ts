import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { RealtimeEventPublisherService } from "#api/modules/realtime/services/realtime-event-publisher.service";

const realtimeJobSelect = {
  id: true,
  lessonId: true,
  ownerUserId: true,
  queue: true,
  status: true,
  attempts: true,
  resourceType: true,
  resourceId: true,
  updatedAt: true,
} satisfies Prisma.BackgroundJobSelect;

@Injectable()
export class RealtimeJobSnapshotPublisherService {
  private readonly logger = new Logger(RealtimeJobSnapshotPublisherService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeEventPublisherService)
    private readonly realtimePublisher: RealtimeEventPublisherService,
  ) {}

  async publishById(backgroundJobId: string): Promise<void> {
    try {
      const job = await this.prisma.backgroundJob.findUnique({
        where: { id: backgroundJobId },
        select: realtimeJobSelect,
      });
      if (job) await this.realtimePublisher.publishBackgroundJobStatus(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(
        `Could not publish realtime snapshot for job ${backgroundJobId}: ${message}`,
      );
    }
  }
}
