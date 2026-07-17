import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class ReplacePrimaryLessonDocumentDto {
  @ApiPropertyOptional({ example: "00000000-0000-0000-0000-000000000000" })
  @IsOptional()
  @IsUUID()
  sourceDocumentId?: string;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageStart?: number;

  @ApiPropertyOptional({ example: 22, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageEnd?: number;

  @ApiPropertyOptional({ example: "00000000-0000-0000-0000-000000000000" })
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional({ example: "PDF gốc của buổi học", maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;
}
