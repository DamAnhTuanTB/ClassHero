import { ApiProperty } from "@nestjs/swagger";
import { ContentSource, ReviewStatus } from "@prisma/client";
import { IsEnum, IsObject } from "class-validator";

import { IsTiptapJson } from "#api/common/validation/decorators/is-tiptap-json.decorator";

export class UpsertLessonSummaryDto {
  @ApiProperty({ example: { type: "doc", content: [] } })
  @IsObject()
  @IsTiptapJson()
  contentJson!: Record<string, unknown>;

  @ApiProperty({ enum: ContentSource, example: ContentSource.ADMIN })
  @IsEnum(ContentSource)
  source!: ContentSource;

  @ApiProperty({ enum: ReviewStatus, example: ReviewStatus.APPROVED })
  @IsEnum(ReviewStatus)
  reviewStatus!: ReviewStatus;
}
