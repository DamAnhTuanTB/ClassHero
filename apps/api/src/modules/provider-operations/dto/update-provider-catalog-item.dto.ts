import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import {
  AI_REASONING_EFFORT_LEVELS,
  type AiReasoningEffort,
} from "@learning-path/shared";
import { ProviderCatalogStatus } from "@prisma/client";
import { AiConfigurationFeature } from "#api/modules/provider-operations/dto/create-provider-catalog-item.dto";

export class UpdateProviderCatalogItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  externalKey?: string;

  @IsOptional()
  @IsEnum(AiConfigurationFeature)
  aiConfiguration?: AiConfigurationFeature | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AI_REASONING_EFFORT_LEVELS, { each: true })
  reasoningEffortLevels?: AiReasoningEffort[] | null;

  @IsOptional()
  @IsEnum(ProviderCatalogStatus)
  status?: ProviderCatalogStatus;

  @IsOptional()
  @IsString()
  createdAt?: string;
}
