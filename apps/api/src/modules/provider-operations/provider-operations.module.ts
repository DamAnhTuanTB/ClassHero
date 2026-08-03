import { Global, Module } from "@nestjs/common";

import { AdminProviderOperationsController } from "#api/modules/provider-operations/controllers/admin-provider-operations.controller";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ProviderOperationsAdminService } from "#api/modules/provider-operations/services/provider-operations-admin.service";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AdminProviderOperationsController],
  providers: [
    AiModelRoutingService,
    ProviderUsageService,
    ProviderOperationsAdminService,
  ],
  exports: [AiModelRoutingService, ProviderUsageService],
})
export class ProviderOperationsModule {}
