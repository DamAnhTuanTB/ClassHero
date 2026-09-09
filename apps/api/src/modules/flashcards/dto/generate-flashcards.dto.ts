import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AI_REASONING_EFFORT_LEVELS, type AiReasoningEffort } from "@learning-path/shared";
import { Type } from "class-transformer";
import { Difficulty } from "@prisma/client";
import {
  ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsIn, IsInt,
  IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested,
} from "class-validator";
import { FLASHCARD_MIN_OUTPUT_TOKENS } from "#api/modules/flashcards/types/flashcard-generation.types";

export class FlashcardDifficultyCountsDto {
  @IsInt() @Min(0) @Max(60) easy!: number;
  @IsInt() @Min(0) @Max(60) medium!: number;
  @IsInt() @Min(0) @Max(60) hard!: number;
}

export class GenerateFlashcardsDto {
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID("4") requestDraftId?: string;
  @ApiPropertyOptional({ pattern: "^[a-f0-9]{64}$" }) @IsOptional() @IsString() requestHash?: string;
  @ApiPropertyOptional({ format: "uuid" }) @IsOptional() @IsUUID("4") targetFlashcardSetId?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsUUID("4", { each: true }) documentIds?: string[];
  @ApiProperty({ minimum: 1, maximum: 60, example: 10 }) @IsInt() @Min(1) @Max(60) cardCount!: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 60 }) @IsOptional() @IsInt() @Min(0) @Max(60) realWorldCardCount?: number;
  @ApiProperty({ enum: Difficulty, example: Difficulty.MIXED }) @IsEnum(Difficulty) difficulty!: Difficulty;
  @ApiPropertyOptional({ type: FlashcardDifficultyCountsDto }) @IsOptional() @ValidateNested() @Type(() => FlashcardDifficultyCountsDto) difficultyCounts?: FlashcardDifficultyCountsDto;
  @ApiPropertyOptional({ enum: ["student_friendly", "concise", "academic"] }) @IsOptional() @IsIn(["student_friendly", "concise", "academic"]) style?: "student_friendly" | "concise" | "academic";
  @IsOptional() @IsString() @MaxLength(1_000) styleInstructions?: string;
  @IsOptional() @IsString() @MaxLength(2_000) extraInstructions?: string;
  @IsOptional() @IsString() @MaxLength(64_000) systemInstructions?: string;
  @IsOptional() @IsString() @MaxLength(16_000) userPrompt?: string;
  @IsOptional() @IsString() @MaxLength(200) model?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1) temperature?: number;
  @IsOptional() @IsIn(AI_REASONING_EFFORT_LEVELS) reasoningEffort?: AiReasoningEffort;
  @IsOptional() @IsInt() @Min(FLASHCARD_MIN_OUTPUT_TOKENS) @Max(32_000) maxOutputTokens?: number;
  @IsOptional() @IsString() @MaxLength(200) figureModel?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1) figureTemperature?: number;
  @IsOptional() @IsIn(AI_REASONING_EFFORT_LEVELS) figureReasoningEffort?: AiReasoningEffort;
  @IsOptional() @IsInt() @Min(128) @Max(32_000) figureMaxOutputTokens?: number;
}
