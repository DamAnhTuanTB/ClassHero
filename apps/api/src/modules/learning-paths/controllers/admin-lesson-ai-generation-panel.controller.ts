import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { LessonAiGenerationPanelService } from "#api/modules/learning-paths/services/lesson-ai-generation-panel.service";

@ApiTags("admin-lesson-ai-generation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/lessons/:lessonId/ai-generation-panel")
export class AdminLessonAiGenerationPanelController {
  constructor(
    @Inject(LessonAiGenerationPanelService)
    private readonly panelService: LessonAiGenerationPanelService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Get lesson AI generation readiness and latest jobs",
  })
  get(@Param("lessonId") lessonId: string) {
    return this.panelService.getForAdmin(lessonId);
  }
}
