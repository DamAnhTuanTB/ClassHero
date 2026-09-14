import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  backgroundJobStatusChangedEventSchema,
  type BackgroundJobStatusChangedEvent,
} from "@learning-path/shared";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";

import type { EnvConfig } from "#api/config/env.validation";
import { REALTIME_JOB_EVENT_REDIS_CHANNEL } from "#api/modules/realtime/realtime.constants";
import type { RealtimeJobRecord } from "#api/modules/realtime/types/realtime-job.types";

@Injectable()
export class RealtimeEventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeEventPublisherService.name);
  private readonly enabled: boolean;
  private readonly redis: Redis | null;

  constructor(@Inject(ConfigService) configService: ConfigService<EnvConfig, true>) {
    this.enabled = configService.get("REALTIME_JOB_EVENTS_ENABLED", {
      infer: true,
    });
    this.redis = this.enabled
      ? new Redis(configService.get("REDIS_URL", { infer: true }), {
          enableOfflineQueue: false,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
        })
      : null;
    this.redis?.on("error", (error) => {
      this.logger.warn(`Realtime Redis publisher error: ${error.message}`);
    });
  }

  onModuleInit() {
    if (!this.redis) return;
    void this.redis.connect().catch((error: unknown) => {
      this.logger.warn(
        `Realtime publisher started without Redis readiness: ${toErrorMessage(error)}`,
      );
    });
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }

  async publishBackgroundJobStatus(record: RealtimeJobRecord): Promise<boolean> {
    if (!this.redis || this.redis.status !== "ready") return false;

    try {
      const occurredAt = new Date().toISOString();
      const event: BackgroundJobStatusChangedEvent =
        backgroundJobStatusChangedEventSchema.parse({
          schemaVersion: 1,
          eventId: randomUUID(),
          eventType: "background_job.status_changed",
          occurredAt,
          jobId: record.id,
          lessonId: record.lessonId,
          ownerUserId: record.ownerUserId,
          queue: record.queue,
          status: record.status,
          attempts: record.attempts,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          updatedAt: record.updatedAt.toISOString(),
        });
      await this.redis.publish(REALTIME_JOB_EVENT_REDIS_CHANNEL, JSON.stringify(event));
      return true;
    } catch (error) {
      this.logger.warn(
        `Could not build or publish realtime job event ${record.id}: ${toErrorMessage(error)}`,
      );
      return false;
    }
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}
