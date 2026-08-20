import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class PromoteSearchablePdfDto {
  @IsUUID()
  validationId!: string;

  @IsOptional()
  @IsBoolean()
  acceptWarnings?: boolean;
}
