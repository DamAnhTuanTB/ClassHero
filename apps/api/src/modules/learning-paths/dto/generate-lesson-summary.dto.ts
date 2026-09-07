import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AI_REASONING_EFFORT_LEVELS,
  LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
  type AiReasoningEffort,
} from "@learning-path/shared";
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
  Matches,
  Min,
} from "class-validator";

import {
  LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT,
  LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT,
  LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT,
  LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT,
  LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
} from "#api/modules/ai/types/lesson-summary.types";

export class GenerateLessonSummaryDto {
  @ApiPropertyOptional({ description: "Immutable request draft returned by preview" })
  @IsOptional()
  @IsUUID()
  requestDraftId?: string;

  @ApiPropertyOptional({ description: "SHA-256 request hash returned by preview" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  requestHash?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      "Sau Phase 1, dùng crop ảnh SGK đã phân giải và không xếp hàng Phase 2 tạo hình",
  })
  @IsOptional()
  @IsBoolean()
  useTextbookSourceImages?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      "Khi dùng crop ảnh SGK, tự động giảm nhiễu và làm nét trước khi lưu delivery",
  })
  @IsOptional()
  @IsBoolean()
  autoEnhanceTextbookSourceImages?: boolean;

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

  @ApiPropertyOptional({ maxLength: 2_000 })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  extraInstructions?: string;

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

  @ApiPropertyOptional({
    default: LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT,
    minimum: LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT,
    maximum: LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT,
    description: "Số bài tập vận dụng không thuộc dạng ứng dụng thực tế",
  })
  @IsOptional()
  @IsInt()
  @Min(LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT)
  @Max(LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT)
  standardExerciseCount?: number;

  @ApiPropertyOptional({
    default: LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT,
    minimum: LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT,
    maximum: LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT,
    description: "Số bài tập vận dụng ứng dụng thực tế",
  })
  @IsOptional()
  @IsInt()
  @Min(LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT)
  @Max(LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT)
  realWorldExerciseCount?: number;

  @ApiPropertyOptional({
    maxLength: LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
  })
  @IsOptional()
  @IsString()
  @MaxLength(LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS)
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

  @ApiPropertyOptional({
    enum: AI_REASONING_EFFORT_LEVELS,
    description: "Mức độ suy luận mà model đã chọn hỗ trợ",
  })
  @IsOptional()
  @IsIn(AI_REASONING_EFFORT_LEVELS)
  reasoningEffort?: AiReasoningEffort;

  @ApiPropertyOptional({
    minimum: LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
    maximum: 32_000,
  })
  @IsOptional()
  @IsInt()
  @Min(LESSON_SUMMARY_MIN_OUTPUT_TOKENS)
  @Max(32_000)
  maxOutputTokens?: number;

  @ApiPropertyOptional({ description: "Tên model dùng riêng cho Phase 2 tạo hình" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  figureModel?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  figureTemperature?: number;

  @ApiPropertyOptional({ enum: AI_REASONING_EFFORT_LEVELS })
  @IsOptional()
  @IsIn(AI_REASONING_EFFORT_LEVELS)
  figureReasoningEffort?: AiReasoningEffort;

  @ApiPropertyOptional({ minimum: 128, maximum: 32_000 })
  @IsOptional()
  @IsInt()
  @Min(128)
  @Max(32_000)
  figureMaxOutputTokens?: number;
}
