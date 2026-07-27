import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { StudentLessonsService } from "#api/modules/student-learning/services/student-lessons.service";

@ApiTags("student-learning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student/lessons")
export class StudentLessonsController {
  constructor(
    @Inject(StudentLessonsService)
    private readonly studentLessonsService: StudentLessonsService,
  ) {}

  @Get(":lessonId")
  @ApiOperation({ summary: "Read one accessible lesson and its content metadata" })
  getLesson(@Param("lessonId") lessonId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentLessonsService.getLessonContent(lessonId, user.id);
  }

  @Get(":lessonId/summary")
  @ApiOperation({ summary: "Read an approved lesson summary" })
  getSummary(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLessonsService.getLessonSummary(lessonId, user.id);
  }

  @Get(":lessonId/quiz-sets")
  @ApiOperation({ summary: "Read approved quiz sets without answer keys" })
  listQuizSets(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLessonsService.listQuizSets(lessonId, user.id);
  }

  @Get(":lessonId/test-sets/status")
  @ApiOperation({ summary: "Read test metadata and server-side availability" })
  getTestSetsStatus(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentLessonsService.getTestSetsStatus(lessonId, user.id);
  }
}
