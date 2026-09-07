import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import {
  AI_REASONING_EFFORT_LEVELS,
  type AiReasoningEffort,
} from "@learning-path/shared";
import { ProviderCatalogCategory } from "@prisma/client";
import { CreatePriceVersionDto } from "#api/modules/provider-operations/dto/create-price-version.dto";

export enum AiConfigurationFeature {
  TEMPERATURE = "TEMPERATURE",
  REASONING_EFFORT = "REASONING_EFFORT",
}

export class CreateProviderCatalogItemDto {
  @IsEnum(ProviderCatalogCategory)
  category!: ProviderCatalogCategory;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsString()
  @IsNotEmpty()
  externalKey!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsOptional()
  @IsEnum(AiConfigurationFeature)
  aiConfiguration?: AiConfigurationFeature;

  @IsOptional()
  @IsString()
  createdAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AI_REASONING_EFFORT_LEVELS, { each: true })
  reasoningEffortLevels?: AiReasoningEffort[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePriceVersionDto)
  initialPrice?: CreatePriceVersionDto;
}
