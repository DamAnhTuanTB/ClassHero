import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Difficulty, ReviewStatus } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type {
  CreateFlashcardSetInput,
  ReviewFlashcardSetInput,
} from "#api/modules/flashcards/types/flashcard.types";

export class CreateFlashcardSetDto implements CreateFlashcardSetInput {
  @ApiProperty({ example: "Flashcard công thức", minLength: 1, maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.MIXED })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;
}

export class UpdateFlashcardSetDto extends PartialType(CreateFlashcardSetDto) {}

export enum FlashcardSetReviewActionDto {
  SAVE = "SAVE",
  PUBLISH = "PUBLISH",
  WITHDRAW = "WITHDRAW",
}

export class ReviewFlashcardSetDto implements ReviewFlashcardSetInput {
  @ApiProperty({ enum: ReviewStatus, example: ReviewStatus.APPROVED })
  @IsEnum(ReviewStatus)
  reviewStatus!: ReviewStatus;

  @ApiPropertyOptional({ enum: FlashcardSetReviewActionDto })
  @IsOptional()
  @IsEnum(FlashcardSetReviewActionDto)
  action?: ReviewFlashcardSetInput["action"];
}
