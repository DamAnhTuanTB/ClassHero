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
  CreateTestSetDto,
  TestQuestionContentDto,
  UpdateTestQuestionContentDto,
  UpdateTestSetDto,
} from "#api/modules/tests/dto/test-content.dto";
import { TestsService } from "#api/modules/tests/services/tests.service";

@ApiTags("admin-tests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminTestsController {
  constructor(
    @Inject(TestsService)
    private readonly testsService: TestsService,
  ) {}

  @Get("lessons/:lessonId/test-sets")
  @ApiOperation({ summary: "List test sets in a lesson" })
  listSets(@Param("lessonId") lessonId: string) {
    return this.testsService.listSetsByLesson(lessonId);
  }

  @Post("lessons/:lessonId/test-sets")
  @ApiOperation({ summary: "Create a test set for a lesson" })
  createSet(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.createSet(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("test-sets/:setId")
  @ApiOperation({ summary: "Update a test set" })
  updateSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestSetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.updateSet(setId, user.id, dto, getRequestContext(request));
  }

  @Delete("test-sets/:setId")
  @ApiOperation({ summary: "Soft-delete a test set" })
  deleteSet(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.deleteSet(setId, user.id, getRequestContext(request));
  }

  @Get("test-sets/:setId/questions")
  @ApiOperation({ summary: "List questions in a test set" })
  listQuestions(@Param("setId") setId: string) {
    return this.testsService.listQuestionsBySet(setId);
  }

  @Post("test-sets/:setId/questions")
  @ApiOperation({ summary: "Create a question in a test set" })
  createQuestion(
    @Param("setId") setId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TestQuestionContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.createQuestion(
      setId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Patch("test-questions/:questionId")
  @ApiOperation({ summary: "Update a test question" })
  updateQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestQuestionContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.updateQuestion(
      questionId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Delete("test-questions/:questionId")
  @ApiOperation({ summary: "Soft-delete a test question" })
  deleteQuestion(
    @Param("questionId") questionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.testsService.deleteQuestion(
      questionId,
      user.id,
      getRequestContext(request),
    );
  }
}
