import { Module } from "@nestjs/common";

import { AuthModule } from "#api/modules/auth/auth.module";
import { RealtimeGateway } from "#api/modules/realtime/gateways/realtime.gateway";
import { RealtimeCoreModule } from "#api/modules/realtime/realtime-core.module";
import { RealtimeRedisSubscriberService } from "#api/modules/realtime/services/realtime-redis-subscriber.service";

@Module({
  imports: [AuthModule, RealtimeCoreModule],
  providers: [RealtimeGateway, RealtimeRedisSubscriberService],
})
export class RealtimeModule {}
