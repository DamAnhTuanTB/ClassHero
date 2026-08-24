import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AttachQuizFigureUploadDto } from "#api/modules/quiz-figures/dto/attach-quiz-figure-upload.dto";
import { QuizFiguresService } from "#api/modules/quiz-figures/services/quiz-figures.service";

@ApiTags("admin-quiz-figures")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/quiz-questions")
export class AdminQuizFiguresController {
  constructor(
    @Inject(QuizFiguresService)
    private readonly figures: QuizFiguresService,
  ) {}

  @Post(":questionId/figures/admin-upload")
  @ApiOperation({ summary: "Attach an admin-uploaded illustration to a Quiz" })
  attachUpload(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachQuizFigureUploadDto,
  ) {
    return this.figures.attachAdminUpload({
      questionId,
      role: dto.role,
      fileId: dto.fileId,
      altText: dto.altText,
      caption: dto.caption,
      actorUserId: user.id,
    });
  }
}
