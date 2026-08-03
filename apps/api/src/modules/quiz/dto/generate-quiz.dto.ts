import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Difficulty, QuestionType } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";

export class GenerateQuizDto {
  @ApiProperty({ minimum: 1, maximum: 50, example: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  questionCount!: number;

  @ApiProperty({ enum: Difficulty, example: Difficulty.MEDIUM })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @ApiPropertyOptional({ enum: QuestionType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsEnum(QuestionType, { each: true })
  questionTypes?: QuestionType[];
}
