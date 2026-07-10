import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { PublishStatus } from "@prisma/client";
import {
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
} from "class-validator";

export class CreateLessonDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  orderIndex!: number;

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

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
