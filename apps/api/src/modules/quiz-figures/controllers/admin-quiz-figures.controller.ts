import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AttachQuizFigureUploadDto } from "#api/modules/quiz-figures/dto/attach-quiz-figure-upload.dto";
import {
  ApplyQuizFigureDraftDto,
  CompileQuizFigureDraftDto,
  CreateQuizFigureAiDto,
  QuizFigureRevisionGuardDto,
  UpdateQuizFigureCaptionDto,
} from "#api/modules/quiz-figures/dto/quiz-figure-revision.dto";
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

  @Post(":questionId/figures/:figureId/drafts/compile")
  @ApiOperation({ summary: "Compile one Quiz figure TeX draft without an AI call" })
  compileDraft(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileQuizFigureDraftDto,
  ) {
    return this.figures.compileDraft(questionId, figureId, user.id, dto);
  }

  @Post(":questionId/figures/:figureId/drafts/apply")
  @ApiOperation({ summary: "Apply one validated Quiz figure TeX draft" })
  applyDraft(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyQuizFigureDraftDto,
  ) {
    return this.figures.applyDraft(questionId, figureId, user.id, dto);
  }

  @Post(":questionId/figures/:figureId/create-new-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Create a new AI revision for one Quiz figure" })
  createNewAi(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizFigureAiDto,
  ) {
    return this.figures.createNewAi(questionId, figureId, user.id, dto);
  }

  @Post(":questionId/figures/:figureId/create-new-ai/preview")
  @ApiOperation({ summary: "Preview the exact AI request for one Quiz figure" })
  previewCreateNewAi(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @Body() dto: CreateQuizFigureAiDto,
  ) {
    return this.figures.previewNewAi(questionId, figureId, dto);
  }

  @Patch(":questionId/figures/:figureId/caption")
  @ApiOperation({ summary: "Update the caption of one Quiz figure" })
  updateCaption(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizFigureCaptionDto,
  ) {
    return this.figures.updateCaption(questionId, figureId, user.id, dto);
  }

  @Delete(":questionId/figures/:figureId")
  @ApiOperation({ summary: "Soft-delete one Quiz figure" })
  deleteFigure(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @Body() dto: QuizFigureRevisionGuardDto,
  ) {
    return this.figures.deleteFigure(questionId, figureId, dto);
  }
}
