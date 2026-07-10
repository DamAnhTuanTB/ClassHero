import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Subject } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class PublicLearningPathQueryDto {
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
