import {
  Body,
  Controller,
  Delete,
  Get,
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

@ApiTags("admin-flashcards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminFlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get("lessons/:lessonId/flashcard-sets")
  @ApiOperation({ summary: "List flashcard sets in a lesson" })
  listSets(@Param("lessonId") lessonId: string) {
    return this.flashcardsService.listAdminSetsByLesson(lessonId);
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
