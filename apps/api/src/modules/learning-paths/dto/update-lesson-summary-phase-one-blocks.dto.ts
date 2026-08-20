import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ContentSource, ReviewStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";

export class LessonSummaryPhaseOneLayoutOperationDto {
  @ApiProperty({ enum: ["MERGE_SECTION", "DELETE_SECTION", "DELETE_BLOCK"] })
  @IsIn(["MERGE_SECTION", "DELETE_SECTION", "DELETE_BLOCK"])
  type!: "MERGE_SECTION" | "DELETE_SECTION" | "DELETE_BLOCK";

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  sectionIndex!: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  blockIndex?: number;
}

export class UpdateLessonSummaryPhaseOneBlocksDto {
  @ApiProperty({
    example: {
      "sections.0.blocks.0": {
        type: "knowledge",
        title: "Vectơ chỉ phương",
        content: "Nội dung đã chỉnh sửa",
        figures: [],
      },
    },
  })
  @IsObject()
  phaseOneBlockJsonByPath!: Record<string, unknown>;

  @ApiProperty({
    required: false,
    type: [LessonSummaryPhaseOneLayoutOperationDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => LessonSummaryPhaseOneLayoutOperationDto)
  phaseOneLayoutOperations?: LessonSummaryPhaseOneLayoutOperationDto[];

  @ApiProperty({ enum: ContentSource, example: ContentSource.AI })
  @IsEnum(ContentSource)
  source!: ContentSource;

  @ApiProperty({ enum: ReviewStatus, example: ReviewStatus.NEEDS_REVIEW })
  @IsEnum(ReviewStatus)
  reviewStatus!: ReviewStatus;
}
