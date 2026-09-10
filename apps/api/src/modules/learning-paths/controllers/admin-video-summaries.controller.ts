import {
  Body,
  Controller,
  Delete,
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
import { GenerateVideoSummaryDto } from "#api/modules/learning-paths/dto/generate-video-summary.dto";
import { UpsertVideoSummaryDto } from "#api/modules/learning-paths/dto/upsert-video-summary.dto";
import { VideoSummariesService } from "#api/modules/learning-paths/services/video-summaries.service";

@ApiTags("admin-video-summaries")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/lessons/:lessonId/video-summary")
export class AdminVideoSummariesController {
  constructor(
    @Inject(VideoSummariesService) private readonly summaries: VideoSummariesService,
  ) {}
  @Get() @ApiOperation({ summary: "Get one video summary for admin review" }) get(
    @Param("lessonId") lessonId: string,
  ) {
    return this.summaries.getForAdmin(lessonId);
  }
  @Post("prompt-preview") @HttpCode(HttpStatus.OK) preview(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateVideoSummaryDto,
  ) {
    return this.summaries.previewPrompt(lessonId, user.id, dto);
  }
  @Post("generate-ai") @HttpCode(HttpStatus.ACCEPTED) generate(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateVideoSummaryDto,
  ) {
    return this.summaries.generate(lessonId, user.id, dto);
  }
  @Put() upsert(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertVideoSummaryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.summaries.upsertForAdmin(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }
  @Delete() remove(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.summaries.deleteForAdmin(lessonId, user.id, getRequestContext(request));
  }
}
