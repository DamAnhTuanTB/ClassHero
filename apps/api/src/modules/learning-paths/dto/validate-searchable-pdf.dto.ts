import { IsUUID } from "class-validator";

export class ValidateSearchablePdfDto {
  @IsUUID()
  candidateFileId!: string;
}
