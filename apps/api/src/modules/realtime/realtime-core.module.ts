import { Global, Module } from "@nestjs/common";

import { RealtimeEventPublisherService } from "#api/modules/realtime/services/realtime-event-publisher.service";
import { RealtimeJobSnapshotPublisherService } from "#api/modules/realtime/services/realtime-job-snapshot-publisher.service";

@Global()
@Module({
  providers: [RealtimeEventPublisherService, RealtimeJobSnapshotPublisherService],
  exports: [RealtimeEventPublisherService, RealtimeJobSnapshotPublisherService],
})
export class RealtimeCoreModule {}
