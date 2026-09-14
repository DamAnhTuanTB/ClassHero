import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AdminDomainsController } from "#api/modules/domains/controllers/admin-domains.controller";
import { PublicDomainsController } from "#api/modules/domains/controllers/public-domains.controller";
import { DomainsService } from "#api/modules/domains/services/domains.service";

@Module({
  imports: [AuthModule, PrismaModule, JwtModule.register({})],
  controllers: [AdminDomainsController, PublicDomainsController],
  providers: [DomainsService, JwtAuthGuard, RolesGuard],
  exports: [DomainsService],
})
export class DomainsModule {}
