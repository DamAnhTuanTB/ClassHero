import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ReviewContentSetDto } from "#api/modules/ai/types/review-content-set.dto";

export enum QuizSetReviewActionDto {
  SAVE = "SAVE",
  PUBLISH = "PUBLISH",
  WITHDRAW = "WITHDRAW",
}

export class ReviewQuizSetDto extends ReviewContentSetDto {
  @ApiPropertyOptional({ enum: QuizSetReviewActionDto })
  @IsOptional()
  @IsEnum(QuizSetReviewActionDto)
  action?: QuizSetReviewActionDto;
}
