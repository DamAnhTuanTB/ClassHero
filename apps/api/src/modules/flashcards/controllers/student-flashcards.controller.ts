import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
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
}
