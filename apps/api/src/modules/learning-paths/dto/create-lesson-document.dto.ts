import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LessonDocumentKind } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateLessonDocumentDto {
  @ApiProperty({ example: "00000000-0000-0000-0000-000000000000" })
  @IsUUID()
  fileId!: string;

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
}
