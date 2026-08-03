import { IsInt, IsNumber, Max, Min } from "class-validator";

export class UpdateOcrSettingsDto {
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(1)
  @Max(1_000_000)
  fxRateVndPerUsd!: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  priceFreshnessDays!: number;

  @IsInt()
  @Min(0)
  expectedVersion!: number;
}
