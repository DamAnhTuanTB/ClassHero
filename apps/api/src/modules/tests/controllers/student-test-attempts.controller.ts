import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { QuizAttemptScopeDto } from "#api/modules/quiz/dto/student-quiz-attempt.dto";
import { SubmitStudentTestAttemptDto } from "#api/modules/tests/dto/student-test-attempt.dto";
import { StudentTestAttemptsService } from "#api/modules/tests/services/student-test-attempts.service";

@ApiTags("student-test-attempts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student")
export class StudentTestAttemptsController {
  constructor(
    @Inject(StudentTestAttemptsService)
    private readonly studentTestAttemptsService: StudentTestAttemptsService,
  ) {}

  @Post("lessons/:lessonId/test-attempts/start")
  @ApiOperation({ summary: "Start a test after time and learning prerequisites" })
  start(@Param("lessonId") lessonId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentTestAttemptsService.startAttempt(lessonId, user.id);
  }

  @Post("test-attempts/:attemptId/submit")
  @ApiOperation({ summary: "Grade and persist one test attempt" })
  submit(
    @Param("attemptId") attemptId: string,
    @Body() body: SubmitStudentTestAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentTestAttemptsService.submitAttempt(
      attemptId,
      user.id,
      body.answers,
    );
  }

  @Get("test-attempts/:attemptId/review")
  @ApiOperation({ summary: "Review all or only incorrect test answers" })
  review(
    @Param("attemptId") attemptId: string,
    @Query("scope") scope: QuizAttemptScopeDto | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentTestAttemptsService.reviewAttempt(
      attemptId,
      user.id,
      scope ?? QuizAttemptScopeDto.ALL,
    );
  }

  @Post("test-attempts/:attemptId/use-result")
  @ApiOperation({ summary: "Use a passing result for best score and completion" })
  useResult(
    @Param("attemptId") attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentTestAttemptsService.useResult(attemptId, user.id);
  }

  @Get("lessons/:lessonId/leaderboard/top-tests")
  @ApiOperation({ summary: "Read the top five selected lesson test results" })
  leaderboard(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentTestAttemptsService.getLeaderboard(lessonId, user.id);
  }
}
