import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Difficulty, UserRole } from "@prisma/client";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "#api/common/auth/authenticated-request";
import { getRequestContext } from "#api/common/api/request-context";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { QuizService, CreateQuizSetDto, UpdateQuizSetDto } from "../services/quiz.service";
import { QuizQuestionContentDto } from "../dto/quiz-question-content.dto";
import { IsString, IsOptional, IsEnum } from "class-validator";

// We create wrapper DTOs for the sets for ClassValidator
export class CreateQuizSetBodyDto implements CreateQuizSetDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}

export class UpdateQuizSetBodyDto implements UpdateQuizSetDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
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
  ) {}

  @Get("lessons/:lessonId/quiz-sets")
  @ApiOperation({ summary: "List quiz sets in a lesson" })
  listSets(@Param("lessonId") lessonId: string) {
    return this.quizService.listQuizSetsByLesson(lessonId);
  }

  @Post("lessons/:lessonId/quiz-sets")
  @ApiOperation({ summary: "Create a quiz set for a lesson" })
  createSet(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateQuizSetBodyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.createQuizSet(lessonId, user.id, dto, getRequestContext(request));
  }

  @Patch("quiz-sets/:setId")
  @ApiOperation({ summary: "Update a quiz set" })
  updateSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateQuizSetBodyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.updateQuizSet(setId, user.id, dto, getRequestContext(request));
  }

  @Delete("quiz-sets/:setId")
  @ApiOperation({ summary: "Delete a quiz set" })
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
    return this.quizService.createQuestion(setId, user.id, dto, getRequestContext(request));
  }

  @Patch("quiz-questions/:questionId")
  @ApiOperation({ summary: "Update a question" })
  updateQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<QuizQuestionContentDto>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.updateQuestion(questionId, user.id, dto, getRequestContext(request));
  }

  @Delete("quiz-questions/:questionId")
  @ApiOperation({ summary: "Delete a question" })
  deleteQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.quizService.deleteQuestion(questionId, user.id, getRequestContext(request));
  }
}
