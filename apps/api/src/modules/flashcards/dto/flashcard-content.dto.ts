import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { Difficulty } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { IsTiptapJson } from "#api/common/validation/decorators/is-tiptap-json.decorator";
import type { CreateFlashcardInput } from "#api/modules/flashcards/types/flashcard.types";

export class CreateFlashcardDto implements CreateFlashcardInput {
  @ApiProperty({ description: "Mặt trước dạng Tiptap JSON" })
  @IsTiptapJson()
  frontJson!: Record<string, unknown>;

  @ApiProperty({ description: "Mặt sau dạng Tiptap JSON" })
  @IsTiptapJson()
  backJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Lời giải chi tiết dạng Tiptap JSON",
    nullable: true,
  })
  @IsOptional()
  @IsTiptapJson()
  explanationJson?: Record<string, unknown> | null;

  @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.MEDIUM })
  @IsOptional()
  @IsEnum(Difficulty)
  difficulty?: Difficulty;

  @ApiPropertyOptional({ minimum: 0, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateFlashcardDto extends PartialType(CreateFlashcardDto) {}
