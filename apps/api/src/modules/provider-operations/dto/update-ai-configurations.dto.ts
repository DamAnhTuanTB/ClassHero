import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { AiGenerationType } from "@prisma/client";

export class UpdateAiFeatureConfigurationItemDto {
  @IsEnum(AiGenerationType)
  feature!: AiGenerationType;

  @IsUUID()
  primaryCatalogItemId!: string;

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
  @Max(100_000)
  maxOutputTokens?: number | null;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class UpdateAiConfigurationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => UpdateAiFeatureConfigurationItemDto)
  configurations!: UpdateAiFeatureConfigurationItemDto[];
}
