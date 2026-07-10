import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createDtoValidationPipe } from "../../common/validation/validation-error";
import { PublicLearningPathQueryDto } from "./dto/public-learning-path-query.dto";
import { LearningPathsService } from "./learning-paths.service";

@ApiTags("learning-paths")
@Controller("learning-paths")
export class PublicLearningPathsController {
  constructor(
    @Inject(LearningPathsService)
    private readonly learningPathsService: LearningPathsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List published learning paths" })
  list(
    @Query(createDtoValidationPipe(PublicLearningPathQueryDto))
    query: PublicLearningPathQueryDto,
  ) {
    return this.learningPathsService.listPublished(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one published learning path" })
  getById(@Param("id") id: string) {
    return this.learningPathsService.getPublished(id);
  }
}
