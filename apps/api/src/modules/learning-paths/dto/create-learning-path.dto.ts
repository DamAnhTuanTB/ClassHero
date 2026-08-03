import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PublishStatus } from "@prisma/client";
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateLearningPathDto {
  @ApiProperty({ example: "Toán 7", minLength: 2, maxLength: 160 })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({
    example: "toan-7",
    description: "Optional custom slug. If omitted, it is generated from title.",
  })
  @IsOptional()
  @IsString()
  @Matches(slugPattern, {
    message: "slug must use lowercase letters, numbers and hyphens",
  })
  @MinLength(2)
  @MaxLength(180)
  slug?: string;

  @ApiProperty({ example: "10000000-0000-4000-8000-000000000001" })
  @IsUUID()
  domainId!: string;

  @ApiProperty({
    example: ["20000000-0000-4000-8000-000000000007"],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  targetAudienceIds!: string[];

  @ApiProperty({ example: 2000000, minimum: 0 })
  @IsInt()
  @Min(0)
  originalPriceVnd!: number;

  @ApiPropertyOptional({ example: 1500000, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salePriceVnd?: number;

  @ApiPropertyOptional({ example: "00000000-0000-0000-0000-000000000000" })
  @IsOptional()
  @IsUUID()
  thumbnailFileId?: string;

  @ApiPropertyOptional({ example: { type: "doc", content: [] } })
  @IsOptional()
  @IsObject()
  descriptionJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: "2026-09-05",
    format: "date",
    description: "Optional calendar date when the main course starts.",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string | null;

  @ApiPropertyOptional({
    example: "2027-05-31",
    format: "date",
    description: "Optional calendar date when the main course ends.",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string | null;

  @ApiPropertyOptional({
    example: 50,
    minimum: 1,
    description: "Optional lower bound for the planned number of lessons.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  lessonCountMin?: number | null;

  @ApiPropertyOptional({
    example: 100,
    minimum: 1,
    description: "Optional upper bound for the planned number of lessons.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  lessonCountMax?: number | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
