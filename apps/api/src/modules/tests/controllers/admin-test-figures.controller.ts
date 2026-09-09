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
  CreateQuestionQuizFigureAiDto,
  CreateQuizFigureAiDto,
  RefineQuizFigureWithAiDto,
  QuizFigureRevisionGuardDto,
  UpdateQuizFigureCaptionDto,
} from "#api/modules/quiz-figures/dto/quiz-figure-revision.dto";
import { QuizFiguresService } from "#api/modules/quiz-figures/services/quiz-figures.service";

@ApiTags("admin-test-figures")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/test-questions")
export class AdminTestFiguresController {
  constructor(@Inject(QuizFiguresService) private readonly figures: QuizFiguresService) {}

  private target(questionId: string) {
    return { kind: "TEST" as const, questionId };
  }

  @Post(":questionId/figures/admin-upload")
  @ApiOperation({ summary: "Attach an admin-uploaded illustration to a Test" })
  attachUpload(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachQuizFigureUploadDto,
  ) {
    return this.figures.attachAdminUpload({
      ...dto,
      questionId,
      actorUserId: user.id,
      target: this.target(questionId),
    });
  }

  @Post(":questionId/figures/create-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  createForQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuestionQuizFigureAiDto,
  ) {
    return this.figures.createForQuestion(
      questionId,
      user.id,
      dto,
      this.target(questionId),
    );
  }

  @Post(":questionId/figures/create-ai/preview")
  previewForQuestion(
    @Param("questionId") questionId: string,
    @Body() dto: CreateQuestionQuizFigureAiDto,
  ) {
    return this.figures.previewForQuestion(questionId, dto, this.target(questionId));
  }

  @Post(":questionId/figures/:figureId/drafts/compile")
  compileDraft(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileQuizFigureDraftDto,
  ) {
    return this.figures.compileDraft(
      questionId,
      figureId,
      user.id,
      dto,
      this.target(questionId),
    );
  }

  @Post(":questionId/figures/:figureId/drafts/apply")
  applyDraft(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyQuizFigureDraftDto,
  ) {
    return this.figures.applyDraft(
      questionId,
      figureId,
      user.id,
      dto,
      this.target(questionId),
    );
  }

  @Post(":questionId/figures/:figureId/create-new-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  createNewAi(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizFigureAiDto,
  ) {
    return this.figures.createNewAi(
      questionId,
      figureId,
      user.id,
      dto,
      this.target(questionId),
    );
  }

  @Post(":questionId/figures/:figureId/create-new-ai/preview")
  previewCreateNewAi(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @Body() dto: CreateQuizFigureAiDto,
  ) {
    return this.figures.previewNewAi(questionId, figureId, dto, this.target(questionId));
  }

  @Post(":questionId/figures/:figureId/refine-ai/preview")
  previewRefinement(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @Body() dto: RefineQuizFigureWithAiDto,
  ) {
    return this.figures.previewRefinement(
      questionId,
      figureId,
      dto,
      this.target(questionId),
    );
  }

  @Post(":questionId/figures/:figureId/refine-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  refineWithAi(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefineQuizFigureWithAiDto,
  ) {
    return this.figures.refineWithAi(
      questionId,
      figureId,
      user.id,
      dto,
      this.target(questionId),
    );
  }

  @Patch(":questionId/figures/:figureId/caption")
  updateCaption(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizFigureCaptionDto,
  ) {
    return this.figures.updateCaption(
      questionId,
      figureId,
      user.id,
      dto,
      this.target(questionId),
    );
  }

  @Delete(":questionId/figures/:figureId")
  deleteFigure(
    @Param("questionId") questionId: string,
    @Param("figureId") figureId: string,
    @Body() dto: QuizFigureRevisionGuardDto,
  ) {
    return this.figures.deleteFigure(questionId, figureId, dto, this.target(questionId));
  }
}
