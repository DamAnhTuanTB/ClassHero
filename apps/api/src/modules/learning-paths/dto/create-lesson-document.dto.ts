import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { LessonDocumentKind } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const lessonDocumentProcessingModes = ["PROCESSING", "STORAGE_ONLY"] as const;

export type LessonDocumentProcessingMode = (typeof lessonDocumentProcessingModes)[number];

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

  @ApiPropertyOptional({
    enum: lessonDocumentProcessingModes,
    example: "STORAGE_ONLY",
  })
  @IsOptional()
  @IsIn(lessonDocumentProcessingModes)
  processingMode?: LessonDocumentProcessingMode;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
