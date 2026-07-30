import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
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
import {
  CheckStudentQuizAnswerDto,
  QuizAttemptScopeDto,
  SaveStudentQuizProgressDto,
  StartStudentQuizAttemptDto,
  SubmitStudentQuizAttemptDto,
} from "#api/modules/quiz/dto/student-quiz-attempt.dto";
import { StudentQuizAttemptsService } from "#api/modules/quiz/services/student-quiz-attempts.service";

@ApiTags("student-quiz-attempts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller("student")
export class StudentQuizAttemptsController {
  constructor(
    @Inject(StudentQuizAttemptsService)
    private readonly studentQuizAttemptsService: StudentQuizAttemptsService,
  ) {}

  @Get("lessons/:lessonId/quiz-history")
  @ApiOperation({ summary: "List Quiz attempts shown in the student's lesson history" })
  history(@Param("lessonId") lessonId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentQuizAttemptsService.getLessonHistory(lessonId, user.id);
  }

  @Get("quiz-sets/:quizSetId/attempts/status")
  @ApiOperation({ summary: "Get the quiz entry state for the current student" })
  status(@Param("quizSetId") quizSetId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentQuizAttemptsService.getAttemptStatus(quizSetId, user.id);
  }

  @Get("quiz-sets/:quizSetId/attempts/current")
  @ApiOperation({ summary: "Resume the current in-progress quiz attempt" })
  current(@Param("quizSetId") quizSetId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentQuizAttemptsService.getCurrentAttempt(quizSetId, user.id);
  }

  @Post("quiz-sets/:quizSetId/attempts")
  @ApiOperation({
    summary: "Start a full quiz or retry all/incorrect questions from an attempt",
  })
  start(
    @Param("quizSetId") quizSetId: string,
    @Body() body: StartStudentQuizAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentQuizAttemptsService.startAttempt(quizSetId, user.id, body);
  }

  @Patch("quiz-attempts/:attemptId/progress")
  @ApiOperation({ summary: "Autosave Quiz answers and the current question" })
  saveProgress(
    @Param("attemptId") attemptId: string,
    @Body() body: SaveStudentQuizProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentQuizAttemptsService.saveProgress(attemptId, user.id, body);
  }

  @Post("quiz-attempts/:attemptId/questions/:questionId/check")
  @ApiOperation({ summary: "Check and persist one completed quiz answer" })
  check(
    @Param("attemptId") attemptId: string,
    @Param("questionId") questionId: string,
    @Body() body: CheckStudentQuizAnswerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentQuizAttemptsService.checkAnswer(
      attemptId,
      questionId,
      user.id,
      body.answerJson,
    );
  }

  @Post("quiz-attempts/:attemptId/submit")
  @ApiOperation({ summary: "Submit and grade all answers for a quiz attempt" })
  submit(
    @Param("attemptId") attemptId: string,
    @Body() body: SubmitStudentQuizAttemptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentQuizAttemptsService.submitAttempt(
      attemptId,
      user.id,
      body.answers,
    );
  }

  @Get("quiz-attempts/:attemptId/review")
  @ApiOperation({ summary: "Review all or only incorrect quiz answers" })
  review(
    @Param("attemptId") attemptId: string,
    @Query("scope") scope: QuizAttemptScopeDto | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentQuizAttemptsService.reviewAttempt(
      attemptId,
      user.id,
      scope ?? QuizAttemptScopeDto.ALL,
    );
  }
}
