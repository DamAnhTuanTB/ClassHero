import { ApiPropertyOptional } from "@nestjs/swagger";
import { LessonDocumentKind } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateLessonDocumentDto {
  @ApiPropertyOptional({ example: "Phiếu bài tập thêm", maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({
    enum: LessonDocumentKind,
    example: LessonDocumentKind.SUPPLEMENT,
  })
  @IsOptional()
  @IsEnum(LessonDocumentKind)
  kind?: LessonDocumentKind;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
