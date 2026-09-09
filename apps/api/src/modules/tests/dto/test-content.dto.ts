import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
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
}

export class UpdateTestSetDto extends PartialType(CreateTestSetDto) {}

export class TestQuestionContentDto extends QuizQuestionContentDto {}

export class UpdateTestQuestionContentDto extends PartialType(TestQuestionContentDto) {}
