import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  MinLength,
} from "class-validator";

export const QUIZ_FIGURE_AI_MODES = ["REGENERATE", "EDIT_CURRENT"] as const;
export type QuizFigureAiMode = (typeof QUIZ_FIGURE_AI_MODES)[number];

export class QuizFigureRevisionGuardDto {
  @ApiPropertyOptional({ format: "uuid", nullable: true })
  @IsOptional()
  @IsUUID("4")
  baseRevisionId?: string | null;
}

export class CompileQuizFigureDraftDto extends QuizFigureRevisionGuardDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersion!: number;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(60_000)
  latexSource!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1_000)
  altText!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;
}

export class ApplyQuizFigureDraftDto extends QuizFigureRevisionGuardDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  revisionId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sourceVersion!: number;
}

export class CreateQuizFigureAiDto extends QuizFigureRevisionGuardDto {
  @ApiProperty({ enum: QUIZ_FIGURE_AI_MODES })
  @IsIn(QUIZ_FIGURE_AI_MODES)
  mode!: QuizFigureAiMode;

  @ApiPropertyOptional({ maxLength: 2_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminInstructions?: string | null;

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

  @ApiPropertyOptional({ enum: ["none", "low", "medium", "high", "xhigh"] })
  @IsOptional()
  @IsIn(["none", "low", "medium", "high", "xhigh"])
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";

  @ApiPropertyOptional({ maxLength: 30_000 })
  @IsOptional()
  @IsString()
  @MaxLength(30_000)
  systemPrompt?: string;

  @ApiPropertyOptional({ maxLength: 30_000 })
  @IsOptional()
  @IsString()
  @MaxLength(30_000)
  userPrompt?: string;
}

export class UpdateQuizFigureCaptionDto extends QuizFigureRevisionGuardDto {
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string | null;
}
