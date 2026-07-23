import { ApiPropertyOptional } from "@nestjs/swagger";
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
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  LessonSourceDocumentExtractionDto,
  LessonSourceDocumentPageRangeDto,
} from "#api/modules/learning-paths/dto/create-lesson.dto";

export class UpdateLessonDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  orderIndex?: number;

  @ApiPropertyOptional({
    example: "Buổi 1: Số hữu tỉ",
    minLength: 2,
    maxLength: 180,
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({
    example: "Ôn tập số hữu tỉ và phép tính cơ bản",
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @ApiPropertyOptional({ enum: LessonType, example: LessonType.LIVE })
  @ValidateIf((_, value: unknown) => value !== undefined)
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

  @ApiPropertyOptional({
    example: "2026-08-01T12:00:00.000Z",
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;

  @ApiPropertyOptional({
    example: "2026-08-01T13:00:00.000Z",
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  examOpenAt?: string | null;

  @ApiPropertyOptional({
    example: "https://youtube.com/watch?v=demo",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string | null;

  @ApiPropertyOptional({ example: 7, minimum: 0, maximum: 10 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  completionMinScore?: number;

  @ApiPropertyOptional({ example: false })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  trialEnabled?: boolean;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({ type: LessonSourceDocumentPageRangeDto, nullable: true })
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @ValidateNested()
  @Type(() => LessonSourceDocumentPageRangeDto)
  sourceDocumentPageRange?: LessonSourceDocumentPageRangeDto | null;

  @ApiPropertyOptional({
    type: [LessonSourceDocumentExtractionDto],
    description:
      "Complete ordered extraction collection. An empty array removes all extractions.",
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => LessonSourceDocumentExtractionDto)
  sourceDocumentExtractions?: LessonSourceDocumentExtractionDto[];
}
