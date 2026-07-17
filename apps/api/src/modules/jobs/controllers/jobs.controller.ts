import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { JobsService } from "#api/modules/jobs/services/jobs.service";

@ApiTags("jobs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("jobs")
export class JobsController {
  constructor(@Inject(JobsService) private readonly jobsService: JobsService) {}

  @Get(":jobId")
  @ApiOperation({ summary: "Get background job status" })
  getById(@Param("jobId") jobId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobsService.getById(jobId, user);
  }
}
