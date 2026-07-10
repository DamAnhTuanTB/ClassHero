import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { PublishStatus, Subject } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class LearningPathQueryDto {
  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.PUBLISHED })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;

  @ApiPropertyOptional({ enum: Subject, example: Subject.MATH })
  @IsOptional()
  @IsEnum(Subject)
  subject?: Subject;

  @ApiPropertyOptional({ example: 7, minimum: 3, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(12)
  grade?: number;

  @ApiPropertyOptional({ example: "Toán", minLength: 2, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
