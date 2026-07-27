import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Difficulty } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { QuizQuestionContentDto } from "#api/modules/quiz/dto/quiz-question-content.dto";

export class CreateTestSetDto {
  @ApiProperty({ example: "Bộ đề 1" })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @ApiProperty({ description: "Thời gian làm bài tính bằng giây", example: 900 })
  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(14_400)
  durationSeconds!: number;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.MIXED })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({
    description: "Tỷ lệ độ khó tùy chọn phục vụ nội dung sinh tự động sau này",
    example: { easy: 0.4, medium: 0.4, hard: 0.2 },
  })
  @IsOptional()
  @IsObject()
  difficultyRatioJson?: Record<string, number> | null;
}

export class UpdateTestSetDto extends PartialType(CreateTestSetDto) {}

export class TestQuestionContentDto extends QuizQuestionContentDto {
  @ApiPropertyOptional({
    description: "Điểm riêng của câu; để trống thì hệ thống chia đều tổng 10 điểm",
    example: 2.5,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(10)
  points?: number | null;
}

export class UpdateTestQuestionContentDto extends PartialType(TestQuestionContentDto) {}
