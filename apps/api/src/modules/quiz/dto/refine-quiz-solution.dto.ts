import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";

import {
  QUIZ_SOLUTION_REFINEMENT_MODES,
  type QuizSolutionRefinementMode,
} from "#api/modules/quiz/types/quiz-solution-refinement.types";

export class PreviewQuizSolutionRefinementDto {
  @ApiProperty({ enum: QUIZ_SOLUTION_REFINEMENT_MODES })
  @IsIn(QUIZ_SOLUTION_REFINEMENT_MODES)
  mode!: QuizSolutionRefinementMode;

  @ApiPropertyOptional({
    default: false,
    description:
      "Chỉ với REGENERATE: gửi lời giải hiện tại như candidate sai cần tránh",
  })
  @IsOptional()
  @IsBoolean()
  includeCurrentSolutionAsRejected?: boolean;

  @ApiPropertyOptional({
    maxLength: 2_000,
    description: "Yêu cầu bổ sung của admin cho lượt tinh chỉnh lời giải",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminInstructions?: string;
}

export class QueueQuizSolutionRefinementDto extends PreviewQuizSolutionRefinementDto {
  @ApiProperty({
    description: "SHA-256 của request tinh chỉnh đã preview",
    pattern: "^[a-f0-9]{64}$",
  })
  @IsString()
  @Matches(/^[a-f0-9]{64}$/u)
  requestHash!: string;
}
