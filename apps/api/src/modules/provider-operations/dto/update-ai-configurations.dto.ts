import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsIn,
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
  @Max(2_000_000)
  fallbackMaxInputTokens?: number | null;

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

const chatImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

export class UpdateAiChatRuntimeSettingsDto {
  @IsUUID()
  embeddingCatalogItemId!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  maxImagesPerMessage!: number;

  @IsInt()
  @Min(65_536)
  @Max(20 * 1024 * 1024)
  maxImageBytes!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(chatImageMimeTypes.length)
  @ArrayUnique()
  @IsIn(chatImageMimeTypes, { each: true })
  allowedImageMimeTypes!: string[];

  @IsInt()
  @Min(1)
  @Max(1_000)
  studentDailyMessageLimit!: number;

  @IsInt()
  @Min(0)
  @Max(1_000)
  studentDailyImageLimit!: number;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class UpdateAiConfigurationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => UpdateAiFeatureConfigurationItemDto)
  configurations!: UpdateAiFeatureConfigurationItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateAiChatRuntimeSettingsDto)
  chatSettings?: UpdateAiChatRuntimeSettingsDto;
}
