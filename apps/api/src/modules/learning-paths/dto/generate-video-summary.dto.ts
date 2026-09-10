import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  AI_REASONING_EFFORT_LEVELS,
  type AiReasoningEffort,
} from "@learning-path/shared";
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class GenerateVideoSummaryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestDraftId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  requestHash?: string;
  @ApiPropertyOptional({ enum: ["student_friendly", "concise", "academic"] })
  @IsOptional()
  @IsIn(["student_friendly", "concise", "academic"])
  style?: "student_friendly" | "concise" | "academic";
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  styleInstructions?: string;
  @ApiPropertyOptional({ enum: ["short", "standard", "detailed"] })
  @IsOptional()
  @IsIn(["short", "standard", "detailed"])
  length?: "short" | "standard" | "detailed";
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(80)
  @Max(2000)
  targetWordCount?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  extraInstructions?: string;
  @ApiPropertyOptional({ maxLength: 40_000 })
  @IsOptional()
  @IsString()
  @MaxLength(40_000)
  systemInstructions?: string;
  @ApiPropertyOptional({ maxLength: 16_000 })
  @IsOptional()
  @IsString()
  @MaxLength(16_000)
  userPrompt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) model?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional({ enum: AI_REASONING_EFFORT_LEVELS })
  @IsOptional()
  @IsIn(AI_REASONING_EFFORT_LEVELS)
  reasoningEffort?: AiReasoningEffort;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(32_000)
  maxOutputTokens?: number;
}
