import { ApiProperty } from "@nestjs/swagger";
import { ContentSource, ReviewStatus } from "@prisma/client";
import { IsEnum, IsObject } from "class-validator";
import { IsTiptapJson } from "#api/common/validation/decorators/is-tiptap-json.decorator";

export class UpsertVideoSummaryDto {
  @ApiProperty() @IsObject() @IsTiptapJson() contentJson!: Record<string, unknown>;
  @ApiProperty({ enum: ContentSource }) @IsEnum(ContentSource) source!: ContentSource;
  @ApiProperty({ enum: ReviewStatus }) @IsEnum(ReviewStatus) reviewStatus!: ReviewStatus;
}
