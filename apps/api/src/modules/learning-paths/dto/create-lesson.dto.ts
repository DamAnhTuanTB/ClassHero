import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { LessonType, PublishStatus } from "@prisma/client";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class LessonSourceDocumentExtractionDto {
  @ApiPropertyOptional({
    description: "Existing extraction id, used when updating a lesson",
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: "00000000-0000-0000-0000-000000000000" })
  @IsUUID()
  sourceDocumentId!: string;

  @ApiProperty({ example: 20, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageStart!: number;

  @ApiProperty({ example: 22, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageEnd!: number;
}

/** @deprecated Use LessonSourceDocumentExtractionDto. */
export class LessonSourceDocumentPageRangeDto extends LessonSourceDocumentExtractionDto {}

export class CreateLessonDto {
  @ApiProperty({ example: "Buổi 1: Số hữu tỉ", minLength: 2, maxLength: 180 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    example: "Ôn tập số hữu tỉ và phép tính cơ bản",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({
    description: "Nội dung Tiptap của Tổng quan buổi học",
    example: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Nội dung" }] }],
    },
  })
  @IsOptional()
  @IsObject()
  overviewContentJson?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: LessonType, example: LessonType.BASIC })
  @IsOptional()
  @IsEnum(LessonType)
  lessonType?: LessonType;

  @ApiPropertyOptional({
    example: "https://meet.google.com/abc-defg-hij",
    maxLength: 2048,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  liveUrl?: string | null;

  @ApiPropertyOptional({ example: "2026-08-01T12:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: "2026-08-01T13:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  examOpenAt?: string;

  @ApiPropertyOptional({ example: "https://youtube.com/watch?v=demo" })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @ApiPropertyOptional({ example: 7, minimum: 0, maximum: 10, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  completionMinScore?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  trialEnabled?: boolean;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({
    type: [LessonSourceDocumentExtractionDto],
    description:
      "Ordered source-document extractions. Ranges using the same source must not overlap.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LessonSourceDocumentExtractionDto)
  sourceDocumentExtractions?: LessonSourceDocumentExtractionDto[];

  @ApiPropertyOptional({
    type: LessonSourceDocumentPageRangeDto,
    deprecated: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LessonSourceDocumentPageRangeDto)
  sourceDocumentPageRange?: LessonSourceDocumentPageRangeDto;
}
