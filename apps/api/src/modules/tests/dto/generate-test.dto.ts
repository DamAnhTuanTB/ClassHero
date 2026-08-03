import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuestionType } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class TestDifficultyRatioDto {
  @IsNumber() @Min(0) @Max(1) easy!: number;
  @IsNumber() @Min(0) @Max(1) medium!: number;
  @IsNumber() @Min(0) @Max(1) hard!: number;
}

export class GenerateTestDto {
  @ApiProperty({ minimum: 1, maximum: 50, example: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  questionCount!: number;

  @ApiProperty({ minimum: 60, maximum: 14_400, example: 900 })
  @IsInt()
  @Min(60)
  @Max(14_400)
  durationSeconds!: number;

  @ApiProperty({ type: TestDifficultyRatioDto })
  @ValidateNested()
  @Type(() => TestDifficultyRatioDto)
  difficultyRatio!: TestDifficultyRatioDto;

  @ApiPropertyOptional({ enum: QuestionType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(QuestionType, { each: true })
  questionTypes?: QuestionType[];
}
