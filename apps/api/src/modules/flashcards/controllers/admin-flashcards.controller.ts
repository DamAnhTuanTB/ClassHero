import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
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
import { GenerateFlashcardsDto } from "#api/modules/flashcards/dto/generate-flashcards.dto";
import {
  CreateFlashcardFigureAiDto,
  PreviewFlashcardFigureAiDto,
} from "#api/modules/flashcards/dto/flashcard-figure-ai.dto";
import { AttachFlashcardSolutionFigureUploadDto } from "#api/modules/flashcards/dto/attach-flashcard-figure-upload.dto";
import { FlashcardFiguresService } from "#api/modules/flashcards/services/flashcard-figures.service";
import { FlashcardFigureRequestService } from "#api/modules/flashcards/services/flashcard-figure-request.service";
import {
  CreateFlashcardDto,
  UpdateFlashcardDto,
} from "#api/modules/flashcards/dto/flashcard-content.dto";
import {
  CreateFlashcardSetDto,
  ReviewFlashcardSetDto,
  UpdateFlashcardSetDto,
} from "#api/modules/flashcards/dto/flashcard-set.dto";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";
import { FlashcardGenerationJobService } from "#api/modules/flashcards/services/flashcard-generation-job.service";

@ApiTags("admin-flashcards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminFlashcardsController {
  constructor(
    private readonly flashcardsService: FlashcardsService,
    private readonly generationJobs: FlashcardGenerationJobService,
    private readonly figureRequests: FlashcardFigureRequestService,
    private readonly figures: FlashcardFiguresService,
  ) {}

  @Get("lessons/:lessonId/flashcard-sets")
  @ApiOperation({ summary: "List flashcard sets in a lesson" })
  listSets(@Param("lessonId") lessonId: string) {
    return this.flashcardsService.listAdminSetsByLesson(lessonId);
  }

  @Post("flashcards/:flashcardId/figures/admin-upload")
  @ApiOperation({ summary: "Attach an admin-uploaded solution illustration to a Flashcard" })
  attachFigureUpload(
    @Param("flashcardId") flashcardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AttachFlashcardSolutionFigureUploadDto,
  ) {
    return this.figures.attachAdminUpload({
      flashcardId,
      fileId: dto.fileId,
      altText: dto.altText,
      caption: dto.caption,
      actorUserId: user.id,
    });
  }

  @Post("flashcards/:flashcardId/figures/create-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue a Flashcard solution illustration" })
  createFigure(
    @Param("flashcardId") flashcardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlashcardFigureAiDto,
  ) {
    return this.figures.createWithAi(flashcardId, user.id, dto);
  }

  @Post("flashcards/:flashcardId/figures/create-ai/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Preview the exact Flashcard solution illustration request" })
  previewFigureGeneration(
    @Param("flashcardId") flashcardId: string,
    @Body() dto: PreviewFlashcardFigureAiDto,
  ) {
    return this.figureRequests.preview(flashcardId, dto);
  }

  @Delete("flashcards/:flashcardId/figures/:figureId")
  @ApiOperation({ summary: "Remove a Flashcard solution illustration" })
  deleteFigure(
    @Param("flashcardId") flashcardId: string,
    @Param("figureId") figureId: string,
  ) {
    return this.figures.delete(flashcardId, figureId);
  }

  @Post("lessons/:lessonId/flashcard-sets/generate-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue AI generation for a flashcard set" })
  generate(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateFlashcardsDto,
  ) {
    return this.generationJobs.queue(lessonId, user.id, dto);
  }

  @Post("lessons/:lessonId/flashcard-sets/prompt-preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Preview Flashcard generation request without calling AI" })
  previewGeneration(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateFlashcardsDto,
  ) {
    return this.generationJobs.preview(lessonId, user.id, dto);
  }

  @Post("lessons/:lessonId/flashcard-sets")
  @ApiOperation({ summary: "Create a flashcard set" })
  createSet(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlashcardSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.createSet(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("flashcard-sets/:setId")
  @ApiOperation({ summary: "Update a flashcard set" })
  updateSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFlashcardSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.updateSet(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("flashcard-sets/:setId/review")
  @ApiOperation({ summary: "Review a flashcard set" })
  reviewSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewFlashcardSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.reviewSet(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("flashcard-sets/:setId/cards/review-all-ai")
  @ApiOperation({ summary: "Review all pending AI cards in a flashcard set" })
  reviewAllPendingAiCards(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.reviewAllPendingAiCards(
      setId,
      user.id,
      getRequestContext(request),
    );
  }

  @Delete("flashcard-sets/:setId")
  @ApiOperation({ summary: "Soft-delete a flashcard set" })
  deleteSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.deleteSet(setId, user.id, getRequestContext(request));
  }

  @Get("flashcard-sets/:setId/cards")
  @ApiOperation({ summary: "List cards in a flashcard set" })
  listCards(@Param("setId") setId: string) {
    return this.flashcardsService.listCardsBySet(setId);
  }

  @Post("flashcard-sets/:setId/cards")
  @ApiOperation({ summary: "Create a card in a flashcard set" })
  createCard(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFlashcardDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.createCard(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("flashcards/:flashcardId")
  @ApiOperation({ summary: "Update a flashcard" })
  updateCard(
    @Param("flashcardId") flashcardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFlashcardDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.updateCard(
      flashcardId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("flashcards/:flashcardId/review")
  @ApiOperation({ summary: "Review one generated flashcard" })
  reviewCard(
    @Param("flashcardId") flashcardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewFlashcardSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.reviewCard(
      flashcardId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Delete("flashcards/:flashcardId")
  @ApiOperation({ summary: "Soft-delete a flashcard" })
  deleteCard(
    @Param("flashcardId") flashcardId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.flashcardsService.deleteCard(
      flashcardId,
      user.id,
      getRequestContext(request),
    );
  }
}
