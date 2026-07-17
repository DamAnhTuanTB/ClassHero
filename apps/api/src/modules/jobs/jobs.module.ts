import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { JobsController } from "#api/modules/jobs/controllers/jobs.controller";
import { JobsService } from "#api/modules/jobs/services/jobs.service";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [JobsController],
  providers: [JobsService, JwtAuthGuard],
})
export class JobsModule {}
