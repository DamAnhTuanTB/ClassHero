import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class PreviewFlashcardFigureAiDto {
  @ApiPropertyOptional({ enum: ["REGENERATE", "EDIT_CURRENT"], default: "REGENERATE" })
  @IsOptional()
  @IsIn(["REGENERATE", "EDIT_CURRENT"])
  mode?: "REGENERATE" | "EDIT_CURRENT";

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

export class CreateFlashcardFigureAiDto extends PreviewFlashcardFigureAiDto {}
