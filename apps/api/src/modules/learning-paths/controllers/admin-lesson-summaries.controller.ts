import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

import { getRequestContext } from "#api/common/api/request-context";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { GenerateLessonSummaryDto } from "#api/modules/learning-paths/dto/generate-lesson-summary.dto";
import { UpsertLessonSummaryDto } from "#api/modules/learning-paths/dto/upsert-lesson-summary.dto";
import { LessonSummariesService } from "#api/modules/learning-paths/services/lesson-summaries.service";

@ApiTags("admin-lesson-summaries")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/lessons/:lessonId/summary")
export class AdminLessonSummariesController {
  constructor(
    @Inject(LessonSummariesService)
    private readonly lessonSummariesService: LessonSummariesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get one lesson summary for admin review" })
  get(@Param("lessonId") lessonId: string) {
    return this.lessonSummariesService.getForAdmin(lessonId);
  }

  @Put()
  @ApiOperation({ summary: "Create or update one lesson summary" })
  upsert(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertLessonSummaryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonSummariesService.upsertForAdmin(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("generate-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue AI generation for one lesson summary" })
  generate(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateLessonSummaryDto,
  ) {
    return this.lessonSummariesService.generate(lessonId, user.id, dto);
  }

  @Post("prompt-preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Preview the exact summary prompts and estimated cost without calling AI",
  })
  previewPrompt(
    @Param("lessonId") lessonId: string,
    @Body() dto: GenerateLessonSummaryDto,
  ) {
    return this.lessonSummariesService.previewPrompt(lessonId, dto);
  }
}
