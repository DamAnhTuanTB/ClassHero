import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsUUID,
  ValidateNested,
} from "class-validator";

export class StudentTestAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty()
  @IsDefined()
  answerJson!: unknown;
}

export class SubmitStudentTestAttemptDto {
  @ApiProperty({ type: [StudentTestAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StudentTestAnswerDto)
  answers!: StudentTestAnswerDto[];
}
