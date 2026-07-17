import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateSourceDocumentDto {
  @ApiProperty({ example: "00000000-0000-0000-0000-000000000000" })
  @IsUUID()
  fileId!: string;

  @ApiPropertyOptional({ example: "Toán 7 Tập 1", minLength: 2, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;
}
