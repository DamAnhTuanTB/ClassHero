import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { ProviderBudgetScope } from "@prisma/client";

export class UpdateProviderBudgetItemDto {
  @IsEnum(ProviderBudgetScope)
  scope!: ProviderBudgetScope;

  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  monthlyLimitVnd!: number;

  @IsBoolean()
  hardStop!: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  warningThresholds!: number[];

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

export class UpdateProviderBudgetsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => UpdateProviderBudgetItemDto)
  budgets!: UpdateProviderBudgetItemDto[];
}
