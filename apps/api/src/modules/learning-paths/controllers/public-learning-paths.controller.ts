import { Controller, Get, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "#api/common/auth/authenticated-request";
import { OptionalJwtAuthGuard } from "#api/common/auth/optional-jwt-auth.guard";
import { PublicLearningPathQueryDto } from "#api/modules/learning-paths/dto/public-learning-path-query.dto";
import { PublicLearningPathsService } from "#api/modules/learning-paths/services/public-learning-paths.service";

@ApiTags("learning-paths")
@ApiBearerAuth()
@UseGuards(OptionalJwtAuthGuard)
@Controller("learning-paths")
export class PublicLearningPathsController {
  constructor(
    @Inject(PublicLearningPathsService)
    private readonly learningPathsService: PublicLearningPathsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List published learning paths" })
  list(@Query() query: PublicLearningPathQueryDto, @Req() request: AuthenticatedRequest) {
    return this.learningPathsService.listPublished(query, request.user);
  }

  @Get(":idOrSlug")
  @ApiOperation({ summary: "Get one published learning path" })
  getByIdOrSlug(
    @Param("idOrSlug") idOrSlug: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.learningPathsService.getPublished(idOrSlug, request.user);
  }
}
