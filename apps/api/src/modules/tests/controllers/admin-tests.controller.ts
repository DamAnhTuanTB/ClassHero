import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";
import { QuizSolutionRefinementService } from "#api/modules/quiz/services/quiz-solution-refinement.service";
import {
  PreviewQuizSolutionRefinementDto,
  QueueQuizSolutionRefinementDto,
} from "#api/modules/quiz/dto/refine-quiz-solution.dto";
import { ReviewContentSetDto } from "#api/modules/ai/types/review-content-set.dto";
import { ReviewQuizSetDto } from "#api/modules/quiz/dto/review-quiz-set.dto";
import { GenerateTestDto } from "#api/modules/tests/dto/generate-test.dto";
import { UpdateQuizGenerationQuestionJsonDto } from "#api/modules/quiz/dto/quiz-question-content.dto";
import {
  CreateTestSetDto,
  TestQuestionContentDto,
  UpdateTestQuestionContentDto,
  UpdateTestSetDto,
} from "#api/modules/tests/dto/test-content.dto";
import { AssessmentAdminService } from "#api/modules/assessments/services/assessment-admin.service";

@ApiTags("admin-tests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminTestsController {
  constructor(
    @Inject(AssessmentAdminService)
    private readonly testsService: AssessmentAdminService,
    @Inject(QuizGenerationJobService)
    private readonly generationJobs: QuizGenerationJobService,
    @Inject(QuizSolutionRefinementService)
    private readonly solutionRefinement: QuizSolutionRefinementService,
  ) {}

  @Get("lessons/:lessonId/test-sets")
  @ApiOperation({ summary: "List test sets in a lesson" })
  listSets(@Param("lessonId") lessonId: string) {
    return this.testsService.listSetsByLesson("TEST", lessonId);
  }

  @Post("lessons/:lessonId/test-sets/generate-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue AI generation for a test set" })
  generate(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateTestDto,
  ) {
    return this.generationJobs.queueTest(lessonId, user.id, dto);
  }

  @Post("lessons/:lessonId/test-sets/generate-ai/preview")
  @ApiOperation({ summary: "Preview the shared Quiz-generation request for a test set" })
  previewGenerate(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateTestDto,
  ) {
    return this.generationJobs.previewQuiz(lessonId, user.id, {
      ...dto,
      assessmentKind: "TEST",
    });
  }

  @Post("lessons/:lessonId/test-sets/prompt-preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Preview shared Assessment prompts for a Test set" })
  previewPrompt(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateTestDto,
  ) {
    return this.generationJobs.previewQuiz(lessonId, user.id, {
      ...dto,
      assessmentKind: "TEST",
    });
  }

  @Post("test-questions/:questionId/solution-refinement/preview")
  @ApiOperation({ summary: "Preview shared solution refinement for a test question" })
  previewSolutionRefinement(
    @Param("questionId") questionId: string,
    @Body() dto: PreviewQuizSolutionRefinementDto,
  ) {
    return this.solutionRefinement.previewTest(questionId, dto);
  }

  @Post("test-questions/:questionId/solution-refinement")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue shared solution refinement for a test question" })
  queueSolutionRefinement(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueueQuizSolutionRefinementDto,
  ) {
    return this.solutionRefinement.queueTest(questionId, user.id, dto);
  }

  @Post("lessons/:lessonId/test-sets")
  @ApiOperation({ summary: "Create a test set for a lesson" })
  createSet(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.createSet({
      kind: "TEST",
      lessonId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Patch("test-sets/:setId")
  @ApiOperation({ summary: "Update a test set" })
  updateSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.updateSet({
      kind: "TEST",
      setId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Post("test-sets/:setId/review")
  @ApiOperation({ summary: "Review a test set and its generated content" })
  reviewSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewQuizSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.reviewSet({
      kind: "TEST",
      setId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Post("test-sets/:setId/questions/review-all-ai")
  @ApiOperation({ summary: "Review all pending AI questions in a test set" })
  reviewAllPendingAiQuestions(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.reviewAllPendingAiQuestions(
      "TEST",
      setId,
      user.id,
      getRequestContext(request),
    );
  }

  @Delete("test-sets/:setId")
  @ApiOperation({ summary: "Soft-delete a test set" })
  deleteSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.deleteSet(
      "TEST",
      setId,
      user.id,
      getRequestContext(request),
    );
  }

  @Get("test-sets/:setId/questions")
  @ApiOperation({ summary: "List questions in a test set" })
  listQuestions(@Param("setId") setId: string) {
    return this.testsService.listQuestionsBySet("TEST", setId);
  }

  @Post("test-sets/:setId/questions")
  @ApiOperation({ summary: "Create a question in a test set" })
  createQuestion(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TestQuestionContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.createQuestion({
      kind: "TEST",
      setId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Patch("test-questions/:questionId")
  @ApiOperation({ summary: "Update a test question" })
  updateQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestQuestionContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.updateQuestion({
      kind: "TEST",
      questionId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Patch("test-questions/:questionId/generation-json")
  @ApiOperation({ summary: "Update the shared v2 generation JSON for one Test question" })
  updateGenerationQuestionJson(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizGenerationQuestionJsonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.updateGenerationQuestionJson({
      kind: "TEST",
      questionId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Post("test-questions/:questionId/review")
  @ApiOperation({ summary: "Review one generated test question" })
  reviewQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewContentSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.reviewQuestion({
      kind: "TEST",
      questionId,
      userId: user.id,
      dto,
      context: getRequestContext(request),
    });
  }

  @Delete("test-questions/:questionId")
  @ApiOperation({ summary: "Soft-delete a test question" })
  deleteQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.deleteQuestion(
      "TEST",
      questionId,
      user.id,
      getRequestContext(request),
    );
  }
}
