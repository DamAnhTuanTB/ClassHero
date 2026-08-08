import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
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
  @IsString({ each: true })
  reasoningEffortLevels?: string[] | null;

  @IsOptional()
  @IsEnum(ProviderCatalogStatus)
  status?: ProviderCatalogStatus;

  @IsOptional()
  @IsString()
  createdAt?: string;
}
