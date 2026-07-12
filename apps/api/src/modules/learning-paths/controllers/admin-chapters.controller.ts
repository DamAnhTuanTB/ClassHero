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
import { CreateChapterDto } from "#api/modules/learning-paths/dto/create-chapter.dto";
import { UpdateChapterDto } from "#api/modules/learning-paths/dto/update-chapter.dto";
import { ChaptersService } from "#api/modules/learning-paths/services/chapters.service";

@ApiTags("admin-chapters")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller()
export class AdminChaptersController {
  constructor(
    @Inject(ChaptersService)
    private readonly chaptersService: ChaptersService,
  ) {}

  @Get("admin/learning-paths/:learningPathId/chapters")
  @ApiOperation({ summary: "List chapters in one learning path for admin" })
  listByLearningPath(@Param("learningPathId") learningPathId: string) {
    return this.chaptersService.listForAdmin(learningPathId);
  }

  @Post("admin/learning-paths/:learningPathId/chapters")
  @ApiOperation({ summary: "Create a chapter in one learning path" })
  create(
    @Param("learningPathId") learningPathId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateChapterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.create(
      learningPathId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Get("admin/chapters/:chapterId")
  @ApiOperation({ summary: "Get one chapter for admin management" })
  getById(@Param("chapterId") chapterId: string) {
    return this.chaptersService.getForAdmin(chapterId);
  }

  @Patch("admin/chapters/:chapterId")
  @ApiOperation({ summary: "Update a chapter" })
  update(
    @Param("chapterId") chapterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateChapterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.update(
      chapterId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Delete("admin/chapters/:chapterId")
  @ApiOperation({ summary: "Soft delete a chapter" })
  remove(
    @Param("chapterId") chapterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.softDelete(
      chapterId,
      user.id,
      getRequestContext(request),
    );
  }

  @Post("admin/chapters/:chapterId/publish")
  @ApiOperation({ summary: "Publish a chapter" })
  publish(
    @Param("chapterId") chapterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.publish(chapterId, user.id, getRequestContext(request));
  }
}
