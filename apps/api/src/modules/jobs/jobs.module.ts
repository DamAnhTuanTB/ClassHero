import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { JobsController } from "#api/modules/jobs/controllers/jobs.controller";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import { JobsService } from "#api/modules/jobs/services/jobs.service";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [JobsController],
  providers: [BackgroundJobQueueService, JobsService, JwtAuthGuard],
  exports: [BackgroundJobQueueService, JobsService],
})
export class JobsModule {}
