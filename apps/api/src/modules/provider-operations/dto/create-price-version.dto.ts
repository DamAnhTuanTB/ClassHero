import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ProviderBillingMode, ProviderUsageMetric } from "@prisma/client";

export class CreatePriceRateDto {
  @IsEnum(ProviderUsageMetric)
  metric!: ProviderUsageMetric;

  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  unitSize!: number;

  @IsNumber({ maxDecimalPlaces: 10 })
  @Min(0)
  unitPriceUsd!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  tierFrom?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  tierTo?: number;
}

export class CreatePriceVersionDto {
  @IsEnum(ProviderBillingMode)
  billingMode!: ProviderBillingMode;

  @IsUrl({ require_tld: false })
  sourceUrl!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreatePriceRateDto)
  rates!: CreatePriceRateDto[];
}
