import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AI_REASONING_EFFORT_LEVELS,
  type AiReasoningEffort,
} from "@learning-path/shared";
import { Type } from "class-transformer";
import { Difficulty, QuestionType } from "@prisma/client";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { QUIZ_MIN_OUTPUT_TOKENS } from "#api/modules/quiz/types/quiz-generation.types";

export class QuizDifficultyCountsDto {
  @IsInt() @Min(0) @Max(50) easy!: number;
  @IsInt() @Min(0) @Max(50) medium!: number;
  @IsInt() @Min(0) @Max(50) hard!: number;
}

export class GenerateQuizDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4")
  requestDraftId?: string;

  @ApiPropertyOptional({
    description: "SHA-256 của request Quiz đã preview",
    pattern: "^[a-f0-9]{64}$",
  })
  @IsOptional()
  @IsString()
  requestHash?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Bộ Quiz đang mở để nhận các câu AI; bỏ trống thì dùng bộ đầu tiên hoặc tự tạo Bộ câu hỏi 1",
  })
  @IsOptional()
  @IsUUID("4")
  targetQuizSetId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Các lesson_documents READY thuộc đúng bài học; bỏ trống để dùng tất cả",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  documentIds?: string[];

  @ApiProperty({ minimum: 1, maximum: 50, example: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  questionCount!: number;

  @ApiProperty({ enum: Difficulty, example: Difficulty.MEDIUM })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @ApiPropertyOptional({ type: QuizDifficultyCountsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuizDifficultyCountsDto)
  difficultyCounts?: QuizDifficultyCountsDto;

  @ApiPropertyOptional({ enum: QuestionType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsEnum(QuestionType, { each: true })
  questionTypes?: QuestionType[];

  @ApiPropertyOptional({ enum: ["student_friendly", "concise", "academic"] })
  @IsOptional()
  @IsIn(["student_friendly", "concise", "academic"])
  style?: "student_friendly" | "concise" | "academic";

  @ApiPropertyOptional({ maxLength: 1_000 })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  styleInstructions?: string;

  @ApiPropertyOptional({ maxLength: 2_000 })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  extraInstructions?: string;

  @ApiPropertyOptional({ maxLength: 64_000 })
  @IsOptional()
  @IsString()
  @MaxLength(64_000)
  systemInstructions?: string;

  @ApiPropertyOptional({ maxLength: 16_000 })
  @IsOptional()
  @IsString()
  @MaxLength(16_000)
  userPrompt?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({ enum: AI_REASONING_EFFORT_LEVELS })
  @IsOptional()
  @IsIn(AI_REASONING_EFFORT_LEVELS)
  reasoningEffort?: AiReasoningEffort;

  @ApiPropertyOptional({ minimum: QUIZ_MIN_OUTPUT_TOKENS, maximum: 32_000 })
  @IsOptional()
  @IsInt()
  @Min(QUIZ_MIN_OUTPUT_TOKENS)
  @Max(32_000)
  maxOutputTokens?: number;
}
