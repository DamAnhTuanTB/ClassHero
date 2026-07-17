import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { PublishStatus } from "@prisma/client";
import {
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
} from "class-validator";

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
}
