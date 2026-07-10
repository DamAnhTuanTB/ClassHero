import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PublishStatus, Subject } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
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

  @ApiProperty({ enum: Subject, example: Subject.MATH })
  @IsEnum(Subject)
  subject!: Subject;

  @ApiProperty({ example: 7, minimum: 3, maximum: 12 })
  @IsInt()
  @Min(3)
  @Max(12)
  grade!: number;

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

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  trialEnabled?: boolean;

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
