import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
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
import { CreateLearningPathDto } from "#api/modules/learning-paths/dto/create-learning-path.dto";
import { LearningPathQueryDto } from "#api/modules/learning-paths/dto/learning-path-query.dto";
import { UpdateLearningPathDto } from "#api/modules/learning-paths/dto/update-learning-path.dto";
import { LearningPathsService } from "#api/modules/learning-paths/services/learning-paths.service";

@ApiTags("admin-learning-paths")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/learning-paths")
export class AdminLearningPathsController {
  constructor(
    @Inject(LearningPathsService)
    private readonly learningPathsService: LearningPathsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List learning paths for admin management" })
  list(@Query() query: LearningPathQueryDto) {
    return this.learningPathsService.listForAdmin(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one learning path for admin management" })
  getById(@Param("id") id: string) {
    return this.learningPathsService.getForAdmin(id);
  }

  @Post()
  @ApiOperation({ summary: "Create a learning path" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLearningPathDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.learningPathsService.create(user.id, dto, getRequestContext(request));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a learning path" })
  update(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLearningPathDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.learningPathsService.update(id, user.id, dto, getRequestContext(request));
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete a learning path" })
  remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.learningPathsService.softDelete(id, user.id, getRequestContext(request));
  }

  @Post(":id/publish")
  @ApiOperation({ summary: "Publish a learning path" })
  publish(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.learningPathsService.publish(id, user.id, getRequestContext(request));
  }
}
