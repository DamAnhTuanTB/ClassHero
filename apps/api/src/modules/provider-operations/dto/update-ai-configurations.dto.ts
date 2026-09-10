import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { AiGenerationType, AiModelPurpose } from "@prisma/client";

export class UpdateAiFeatureConfigurationItemDto {
  @IsEnum(AiGenerationType)
  feature!: AiGenerationType;

  @IsEnum(AiModelPurpose)
  purpose!: AiModelPurpose;

  @IsOptional()
  @IsUUID()
  primaryCatalogItemId?: string | null;

  @IsOptional()
  @IsUUID()
  fallbackCatalogItemId?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(2)
  temperature?: number | null;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(2_000_000)
  maxInputTokens?: number | null;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(100_000)
  maxOutputTokens?: number | null;

  @IsOptional()
  @IsString()
  reasoningEffort?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(2)
  fallbackTemperature?: number | null;

  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(100_000)
  fallbackMaxOutputTokens?: number | null;

  @IsOptional()
  @IsString()
  fallbackReasoningEffort?: string | null;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class UpdateAiConfigurationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @ValidateNested({ each: true })
  @Type(() => UpdateAiFeatureConfigurationItemDto)
  configurations!: UpdateAiFeatureConfigurationItemDto[];
}
