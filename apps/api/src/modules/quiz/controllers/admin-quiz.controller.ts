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
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "#api/common/auth/authenticated-request";
import { getRequestContext } from "#api/common/api/request-context";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { ReviewContentSetDto } from "#api/modules/ai/types/review-content-set.dto";
import { ReviewQuizSetDto } from "#api/modules/quiz/dto/review-quiz-set.dto";
import { GenerateQuizDto } from "#api/modules/quiz/dto/generate-quiz.dto";
import {
  QuizQuestionContentDto,
  UpdateQuizGenerationQuestionJsonDto,
  UpdateQuizQuestionContentDto,
} from "#api/modules/quiz/dto/quiz-question-content.dto";
import {
  QuizService,
  type CreateQuizSetDto,
  type UpdateQuizSetDto,
} from "#api/modules/quiz/services/quiz.service";
import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";
import {
  PreviewQuizSolutionRefinementDto,
  QueueQuizSolutionRefinementDto,
} from "#api/modules/quiz/dto/refine-quiz-solution.dto";
import { QuizSolutionRefinementService } from "#api/modules/quiz/services/quiz-solution-refinement.service";
import { IsString, IsOptional } from "class-validator";

// We create wrapper DTOs for the sets for ClassValidator
export class CreateQuizSetBodyDto implements CreateQuizSetDto {
  @IsString()
  title!: string;
}

export class UpdateQuizSetBodyDto implements UpdateQuizSetDto {
  @IsOptional()
  @IsString()
  title?: string;
}

@ApiTags("admin-quiz")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminQuizController {
  constructor(
    @Inject(QuizService)
    private readonly quizService: QuizService,
    @Inject(QuizGenerationJobService)
    private readonly generationJobs: QuizGenerationJobService,
    @Inject(QuizSolutionRefinementService)
    private readonly solutionRefinement: QuizSolutionRefinementService,
  ) {}

  @Get("lessons/:lessonId/quiz-sets")
  @ApiOperation({ summary: "List quiz sets in a lesson" })
  listSets(@Param("lessonId") lessonId: string) {
    return this.quizService.listQuizSetsByLesson(lessonId);
  }

  @Post("lessons/:lessonId/quiz-sets/generate-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue AI generation for a quiz set" })
  generate(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateQuizDto,
  ) {
    return this.generationJobs.queueQuiz(lessonId, user.id, dto);
  }

  @Post("lessons/:lessonId/quiz-sets/prompt-preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Preview Quiz prompts, lesson source and estimated cost without calling AI",
  })
  previewPrompt(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateQuizDto,
  ) {
    return this.generationJobs.previewQuiz(lessonId, user.id, dto);
  }

  @Post("lessons/:lessonId/quiz-sets")
  @ApiOperation({ summary: "Create a quiz set for a lesson" })
  createSet(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizSetBodyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.createQuizSet(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("quiz-sets/:setId")
  @ApiOperation({ summary: "Update a quiz set" })
  updateSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizSetBodyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.updateQuizSet(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("quiz-sets/:setId/review")
  @ApiOperation({ summary: "Review a quiz set and its generated content" })
  reviewSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewQuizSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.reviewQuizSet(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("quiz-sets/:setId/questions/review-all-ai")
  @ApiOperation({ summary: "Review all pending AI questions in a quiz set" })
  reviewAllPendingAiQuestions(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.reviewAllPendingAiQuestions(
      setId,
      user.id,
      getRequestContext(request),
    );
  }

  @Delete("quiz-sets/:setId")
  @ApiOperation({ summary: "Permanently delete a quiz set and dependent data" })
  deleteSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.deleteQuizSet(setId, user.id, getRequestContext(request));
  }

  @Get("quiz-sets/:setId/questions")
  @ApiOperation({ summary: "List questions in a quiz set" })
  listQuestions(@Param("setId") setId: string) {
    return this.quizService.listQuestionsBySet(setId);
  }

  @Post("quiz-sets/:setId/questions")
  @ApiOperation({ summary: "Create a question in a quiz set" })
  createQuestion(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QuizQuestionContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.createQuestion(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("quiz-questions/:questionId")
  @ApiOperation({ summary: "Update a question" })
  updateQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizQuestionContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.updateQuestion(
      questionId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("quiz-questions/:questionId/generation-json")
  @ApiOperation({ summary: "Update the mutable AI JSON for one Quiz question" })
  updateGenerationQuestionJson(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizGenerationQuestionJsonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.updateGenerationQuestionJson(
      questionId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("quiz-questions/:questionId/solution-refinement/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Preview Quiz solution refinement request without calling AI",
  })
  previewSolutionRefinement(
    @Param("questionId") questionId: string,
    @Body() dto: PreviewQuizSolutionRefinementDto,
  ) {
    return this.solutionRefinement.preview(questionId, dto);
  }

  @Post("quiz-questions/:questionId/solution-refinement")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue AI refinement for the current Quiz solution" })
  refineSolution(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QueueQuizSolutionRefinementDto,
  ) {
    return this.solutionRefinement.queue(questionId, user.id, dto);
  }

  @Post("quiz-questions/:questionId/review")
  @ApiOperation({ summary: "Review one generated quiz question" })
  reviewQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewContentSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.reviewQuestion(
      questionId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Delete("quiz-questions/:questionId")
  @ApiOperation({ summary: "Delete a question" })
  deleteQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.deleteQuestion(
      questionId,
      user.id,
      getRequestContext(request),
    );
  }
}
