import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
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

export enum PersonalizationStatus {
  BASE = "BASE",
  CLONING = "CLONING",
  PERSONALIZED = "PERSONALIZED",
  FAILED = "FAILED",
}

export class PersonalLearningPathEnrollmentsQueryDto {
  @ApiPropertyOptional({ enum: PersonalizationStatus })
  @IsOptional()
  @IsEnum(PersonalizationStatus)
  personalizationStatus?: PersonalizationStatus;

  @ApiPropertyOptional({ example: "Nguyễn An", minLength: 2, maxLength: 120 })
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
