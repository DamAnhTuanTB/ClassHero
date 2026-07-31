import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export enum QuizAttemptScopeDto {
  ALL = "ALL",
  INCORRECT = "INCORRECT",
}

export class StartStudentQuizAttemptDto {
  @ApiPropertyOptional({
    enum: QuizAttemptScopeDto,
    default: QuizAttemptScopeDto.ALL,
  })
  @IsOptional()
  @IsEnum(QuizAttemptScopeDto)
  scope?: QuizAttemptScopeDto;

  @ApiPropertyOptional({
    description: "Attempt cha khi làm lại câu sai hoặc làm lại toàn bộ một bộ câu con",
  })
  @IsOptional()
  @IsUUID()
  sourceAttemptId?: string;

  @ApiPropertyOptional({
    description: "ID lượt làm bài cũ muốn làm lại trực tiếp",
  })
  @IsOptional()
  @IsUUID()
  restartAttemptId?: string;
}

export class CheckStudentQuizAnswerDto {
  @ApiProperty()
  @IsDefined()
  answerJson!: unknown;
}

export class SaveStudentQuizProgressAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty()
  @IsDefined()
  answerJson!: unknown;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;
}

export class SaveStudentQuizProgressDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  currentQuestionIndex!: number;

  @ApiPropertyOptional({ type: SaveStudentQuizProgressAnswerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SaveStudentQuizProgressAnswerDto)
  answer?: SaveStudentQuizProgressAnswerDto;
}

export class StudentQuizAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty()
  @IsDefined()
  answerJson!: unknown;
}

export class SubmitStudentQuizAttemptDto {
  @ApiProperty({ type: [StudentQuizAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StudentQuizAnswerDto)
  answers!: StudentQuizAnswerDto[];
}
