import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { ProviderCatalogCategory, ProviderUsageStatus } from "@prisma/client";

export enum ProviderUsageGranularity {
  DAY = "DAY",
  WEEK = "WEEK",
  MONTH = "MONTH",
}

export class ProviderUsageQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(ProviderUsageGranularity)
  granularity: ProviderUsageGranularity = ProviderUsageGranularity.DAY;

  @IsOptional()
  @IsEnum(ProviderCatalogCategory)
  category?: ProviderCatalogCategory;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  feature?: string;
}

export class ProviderUsageEventsQueryDto extends ProviderUsageQueryDto {
  @IsOptional()
  @IsUUID()
  aiGenerationId?: string;

  @IsOptional()
  @IsEnum(ProviderUsageStatus)
  status?: ProviderUsageStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class ProviderAuditQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
