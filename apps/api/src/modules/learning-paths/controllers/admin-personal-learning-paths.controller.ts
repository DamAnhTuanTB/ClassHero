import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
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
import { CreatePersonalLearningPathDto } from "#api/modules/learning-paths/dto/create-personal-learning-path.dto";
import { PersonalLearningPathEnrollmentsQueryDto } from "#api/modules/learning-paths/dto/personal-learning-path-enrollments-query.dto";
import { PersonalLearningPathsService } from "#api/modules/learning-paths/services/personal-learning-paths.service";

@ApiTags("admin-personal-learning-paths")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminPersonalLearningPathsController {
  constructor(
    @Inject(PersonalLearningPathsService)
    private readonly personalLearningPathsService: PersonalLearningPathsService,
  ) {}

  @Get("learning-paths/:learningPathId/enrollments")
  @ApiOperation({ summary: "List enrolled students and personalization state" })
  listEnrollments(
    @Param("learningPathId") learningPathId: string,
    @Query() query: PersonalLearningPathEnrollmentsQueryDto,
  ) {
    return this.personalLearningPathsService.listEnrollments(learningPathId, query);
  }

  @Post("enrollments/:enrollmentId/personal-learning-path")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Queue a permanent personal learning-path clone" })
  create(
    @Param("enrollmentId") enrollmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePersonalLearningPathDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.personalLearningPathsService.createCloneJob(
      enrollmentId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Get("enrollments/:enrollmentId/personal-learning-path")
  @ApiOperation({ summary: "Get personal learning-path and clone-job state" })
  getByEnrollment(@Param("enrollmentId") enrollmentId: string) {
    return this.personalLearningPathsService.getByEnrollment(enrollmentId);
  }
}
