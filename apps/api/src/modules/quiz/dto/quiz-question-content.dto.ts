import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { QuestionType, Difficulty } from "@prisma/client";
import { IsTiptapJson } from "#api/common/validation/decorators/is-tiptap-json.decorator";
import type {
  QuizCorrectAnswer,
  TextInputGradingConfig,
} from "#api/modules/quiz/types/quiz.types";

export class QuizOptionDto {
  @ApiProperty({ example: "option-a" })
  @IsString()
  @MinLength(1)
  id!: string;

  @ApiProperty({ description: "Nội dung phương án dạng Tiptap JSON" })
  @IsTiptapJson()
  richText!: Record<string, unknown>;
}

export class QuizQuestionContentDto {
  @ApiProperty({ enum: QuestionType, example: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  questionType!: QuestionType;

  @ApiProperty({ enum: Difficulty, example: Difficulty.MEDIUM })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;

  @ApiProperty({ description: "Nội dung câu hỏi dạng Tiptap JSON" })
  @IsTiptapJson()
  questionJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      "Danh sách phương án trắc nghiệm hoặc danh sách mệnh đề của câu đúng/sai nhiều mệnh đề",
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  optionsJson?: QuizOptionDto[];

  @ApiProperty({ description: "Đáp án đúng" })
  @IsDefined()
  correctAnswerJson!: QuizCorrectAnswer;

  @ApiPropertyOptional({ description: "Gợi ý dạng Tiptap JSON" })
  @IsOptional()
  @IsTiptapJson()
  hintJson?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: "Cấu hình chấm điểm cho câu hỏi tự luận" })
  @IsOptional()
  gradingConfigJson?: TextInputGradingConfig;

  @ApiPropertyOptional({ description: "Lời giải chi tiết dạng Tiptap JSON" })
  @IsOptional()
  @IsTiptapJson()
  explanationJson?: Record<string, unknown> | null;
}

export class UpdateQuizQuestionContentDto extends PartialType(QuizQuestionContentDto) {
  @ApiPropertyOptional({
    description: "Khối lời giải có cấu trúc thuộc riêng câu Quiz",
  })
  @IsOptional()
  @IsObject()
  quizExplanationBlock?: Record<string, unknown>;
}

export class UpdateQuizGenerationQuestionJsonDto {
  @ApiProperty({
    description:
      "Object câu Quiz theo structured-output contract hiện tại; được lưu vào mutable generation snapshot",
  })
  @IsObject()
  generationQuestionJson!: Record<string, unknown>;
}
