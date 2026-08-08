import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
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
  @IsString({ each: true })
  reasoningEffortLevels?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePriceVersionDto)
  initialPrice?: CreatePriceVersionDto;
}
