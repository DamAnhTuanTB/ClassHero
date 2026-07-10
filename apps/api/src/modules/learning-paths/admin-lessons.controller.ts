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
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { Roles } from "../../common/auth/roles.decorator";
import { RolesGuard } from "../../common/auth/roles.guard";
import { CreateLessonDto } from "./dto/create-lesson.dto";
import { UpdateLessonDto } from "./dto/update-lesson.dto";
import { LessonsService } from "./lessons.service";

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

  @Get("admin/learning-paths/:learningPathId/lessons")
  @ApiOperation({ summary: "List lessons in one learning path for admin" })
  listByLearningPath(@Param("learningPathId") learningPathId: string) {
    return this.lessonsService.listForAdmin(learningPathId);
  }

  @Post("admin/learning-paths/:learningPathId/lessons")
  @ApiOperation({ summary: "Create a lesson in one learning path" })
  create(
    @Param("learningPathId") learningPathId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonsService.create(
      learningPathId,
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

function getRequestContext(request: AuthenticatedRequest) {
  return {
    ipAddress: request.ip,
    userAgent: request.get?.("user-agent"),
  };
}
