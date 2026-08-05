import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class GenerateLessonSummaryDto {
  @ApiProperty({
    type: [String],
    description: "Danh sách lesson_documents.id thuộc đúng buổi học",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  documentIds!: string[];

  @ApiProperty({
    enum: ["student_friendly", "concise", "academic"],
    example: "student_friendly",
  })
  @IsIn(["student_friendly", "concise", "academic"])
  style!: "student_friendly" | "concise" | "academic";

  @ApiPropertyOptional({
    maxLength: 1_000,
    description: "Cách trình bày do admin nhập tự do",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  styleInstructions?: string;

  @ApiPropertyOptional({ enum: ["short", "standard", "detailed"], default: "standard" })
  @IsOptional()
  @IsIn(["short", "standard", "detailed"])
  length?: "short" | "standard" | "detailed";

  @ApiPropertyOptional({
    minimum: 50,
    maximum: 5_000,
    description: "Số từ mục tiêu gần đúng của bản tóm tắt",
  })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(5_000)
  targetWordCount?: number;



  @ApiPropertyOptional({ maxLength: 2_000 })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  extraInstructions?: string;

  @ApiPropertyOptional({ maxLength: 12_000 })
  @IsOptional()
  @IsString()
  @MaxLength(12_000)
  systemInstructions?: string;

  @ApiPropertyOptional({ maxLength: 16_000 })
  @IsOptional()
  @IsString()
  @MaxLength(16_000)
  userPrompt?: string;

  @ApiPropertyOptional({ description: "Tên model thuộc cấu hình SUMMARY hiện tại" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  temperature?: number;

  @ApiPropertyOptional({ minimum: 500, maximum: 4_000 })
  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(4_000)
  maxOutputTokens?: number;
}
