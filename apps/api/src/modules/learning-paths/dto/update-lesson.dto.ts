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

export class VideoChapterDto {
  @ApiProperty({ example: 69, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  time!: number;

  @ApiProperty({ example: "1. Đơn thức và đơn thức thu gọn" })
  @IsString()
  @MinLength(1)
  title!: string;
}

export class CustomVideoSettingsDto {
  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  isDisabled?: boolean;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  startTimeInSeconds?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  endTimeCutInSeconds?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  introOverlayDurationInSeconds?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  pauseOverlayDurationInSeconds?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  seekStepInSeconds?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  letterboxTopPercentage?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  letterboxRightPercentage?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  letterboxBottomPercentage?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber()
  letterboxLeftPercentage?: number;

  @ApiPropertyOptional()
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  hasWatermark?: boolean;

  @ApiPropertyOptional({ type: [VideoChapterDto] })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VideoChapterDto)
  chapters?: VideoChapterDto[];
}

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

  @ApiPropertyOptional({ type: CustomVideoSettingsDto, nullable: true })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @ValidateNested()
  @Type(() => CustomVideoSettingsDto)
  customVideoSettings?: CustomVideoSettingsDto | null;

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
