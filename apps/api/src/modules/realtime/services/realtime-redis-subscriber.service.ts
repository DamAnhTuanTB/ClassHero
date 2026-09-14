import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { backgroundJobStatusChangedEventSchema } from "@learning-path/shared";
import Redis from "ioredis";

import type { EnvConfig } from "#api/config/env.validation";
import { RealtimeGateway } from "#api/modules/realtime/gateways/realtime.gateway";
import { REALTIME_JOB_EVENT_REDIS_CHANNEL } from "#api/modules/realtime/realtime.constants";

@Injectable()
export class RealtimeRedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeRedisSubscriberService.name);
  private readonly redis: Redis | null;

  constructor(
    @Inject(ConfigService) configService: ConfigService<EnvConfig, true>,
    @Inject(RealtimeGateway) private readonly gateway: RealtimeGateway,
  ) {
    const enabled = configService.get("REALTIME_JOB_EVENTS_ENABLED", {
      infer: true,
    });
    this.redis = enabled
      ? new Redis(configService.get("REDIS_URL", { infer: true }), {
          lazyConnect: true,
          maxRetriesPerRequest: null,
          retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
        })
      : null;
    this.redis?.on("error", (error) => {
      this.logger.warn(`Realtime Redis subscriber error: ${error.message}`);
    });
  }

  onModuleInit() {
    if (!this.redis) return;
    this.redis.on("message", (_channel, rawEvent) => {
      this.handleMessage(rawEvent);
    });
    this.redis.on("ready", () => {
      void this.subscribe();
    });
    void this.redis.connect().catch((error: unknown) => {
      this.logger.warn(
        `Realtime subscriber started without Redis readiness: ${toErrorMessage(error)}`,
      );
    });
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }

  private handleMessage(rawEvent: string) {
    try {
      const parsed = backgroundJobStatusChangedEventSchema.safeParse(
        JSON.parse(rawEvent) as unknown,
      );
      if (!parsed.success) {
        this.logger.warn("Ignored invalid realtime background job event");
        return;
      }
      this.gateway.emitBackgroundJobStatus(parsed.data);
    } catch {
      this.logger.warn("Ignored malformed realtime background job event");
    }
  }

  private async subscribe() {
    if (!this.redis) return;
    try {
      await this.redis.subscribe(REALTIME_JOB_EVENT_REDIS_CHANNEL);
    } catch (error) {
      this.logger.warn(
        `Could not subscribe realtime Redis channel: ${toErrorMessage(error)}`,
      );
    }
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}
