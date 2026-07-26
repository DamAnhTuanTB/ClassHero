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
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "#api/common/auth/authenticated-request";
import { getRequestContext } from "#api/common/api/request-context";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { CreateLessonDto } from "#api/modules/learning-paths/dto/create-lesson.dto";
import { UpdateLessonDto } from "#api/modules/learning-paths/dto/update-lesson.dto";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";

@ApiTags("admin-lessons")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller()
export class AdminLessonsController {
  constructor(
    @Inject(LessonsService)
    private readonly lessonsService: LessonsService,
  ) {}

  @Get("admin/chapters/:chapterId/lessons")
  @ApiOperation({ summary: "List lessons in one chapter for admin" })
  listByChapter(@Param("chapterId") chapterId: string) {
    return this.lessonsService.listForAdmin(chapterId);
  }

  @Post("admin/chapters/:chapterId/lessons")
  @ApiOperation({ summary: "Create a lesson in one chapter" })
  create(
    @Param("chapterId") chapterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonsService.create(
      chapterId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Get("admin/lessons/:lessonId")
  @ApiOperation({ summary: "Get one lesson for admin management" })
  getById(@Param("lessonId") lessonId: string) {
    return this.lessonsService.getForAdmin(lessonId);
  }

  @Patch("admin/lessons/:lessonId")
  @ApiOperation({ summary: "Update a lesson" })
  update(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLessonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonsService.update(lessonId, user.id, dto, getRequestContext(request));
  }

  @Delete("admin/lessons/:lessonId")
  @ApiOperation({ summary: "Soft delete a lesson" })
  remove(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonsService.softDelete(lessonId, user.id, getRequestContext(request));
  }

  @Post("admin/lessons/:lessonId/publish")
  @ApiOperation({ summary: "Publish a lesson" })
  publish(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonsService.publish(lessonId, user.id, getRequestContext(request));
  }
}
