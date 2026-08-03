import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class PublicLearningPathQueryDto {
  @ApiPropertyOptional({ example: "10000000-0000-4000-8000-000000000001" })
  @IsOptional()
  @IsString()
  domainId?: string;

  @ApiPropertyOptional({ example: "20000000-0000-4000-8000-000000000007" })
  @IsOptional()
  @IsString()
  targetAudienceId?: string;

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
