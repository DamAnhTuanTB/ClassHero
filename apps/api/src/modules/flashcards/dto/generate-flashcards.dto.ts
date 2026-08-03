import { ApiProperty } from "@nestjs/swagger";
import { Difficulty } from "@prisma/client";
import { IsEnum, IsInt, Max, Min } from "class-validator";

export class GenerateFlashcardsDto {
  @ApiProperty({ minimum: 1, maximum: 60, example: 20 })
  @IsInt()
  @Min(1)
  @Max(60)
  cardCount!: number;

  @ApiProperty({ enum: Difficulty, example: Difficulty.MEDIUM })
  @IsEnum(Difficulty)
  difficulty!: Difficulty;
}
