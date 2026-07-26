import { IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuestionType, Difficulty } from "@prisma/client";
import { IsTiptapJson } from "#api/common/validation/decorators/is-tiptap-json.decorator";
import type {
  QuizCorrectAnswer,
  QuizOption,
  TextInputGradingConfig,
} from "#api/modules/quiz/types/quiz.types";

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

  @ApiPropertyOptional({ description: "Danh sách đáp án cho câu hỏi trắc nghiệm" })
  @IsOptional()
  optionsJson?: QuizOption[];

  @ApiProperty({ description: "Đáp án đúng" })
  correctAnswerJson!: QuizCorrectAnswer;

  @ApiPropertyOptional({ description: "Gợi ý dạng Tiptap JSON" })
  @IsOptional()
  @IsTiptapJson()
  hintJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Cấu hình chấm điểm cho câu hỏi tự luận" })
  @IsOptional()
  gradingConfigJson?: TextInputGradingConfig;
}
