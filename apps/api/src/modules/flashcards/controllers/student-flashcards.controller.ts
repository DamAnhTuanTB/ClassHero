import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import {
  ToggleStudentFavoriteDto,
  UpdateStudentFlashcardProgressDto,
} from "#api/modules/flashcards/dto/student-flashcard-progress.dto";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";

@ApiTags("student-flashcards")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student")
export class StudentFlashcardsController {
  constructor(private readonly flashcardsService: FlashcardsService) {}

  @Get("lessons/:lessonId/flashcard-sets")
  @ApiOperation({ summary: "Read approved flashcard content for a lesson" })
  listSets(@Param("lessonId") lessonId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.flashcardsService.listStudentSetsByLesson(lessonId, user.id);
  }

  @Patch("flashcards/:flashcardId/progress")
  @ApiOperation({ summary: "Mark a flashcard as known or not known" })
  updateProgress(
    @Param("flashcardId") flashcardId: string,
    @Body() body: UpdateStudentFlashcardProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flashcardsService.updateStudentProgress(
      flashcardId,
      user.id,
      body.isKnown,
    );
  }

  @Post("favorites/toggle")
  @ApiOperation({ summary: "Toggle a student quiz-question or flashcard favorite" })
  toggleFavorite(
    @Body() body: ToggleStudentFavoriteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flashcardsService.toggleStudentFavorite(user.id, body);
  }
}
