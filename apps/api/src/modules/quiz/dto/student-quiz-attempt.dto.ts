import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsEnum,
  IsOptional,
  IsUUID,
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
}

export class CheckStudentQuizAnswerDto {
  @ApiProperty()
  @IsDefined()
  answerJson!: unknown;
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
