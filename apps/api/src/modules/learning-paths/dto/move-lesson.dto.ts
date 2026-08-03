import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDefined, IsInt, IsUUID, Max, Min, ValidateIf } from "class-validator";

export class MoveLessonDto {
  @ApiProperty({
    description: "Destination chapter. Null moves the lesson to course top-level.",
    nullable: true,
  })
  @IsDefined()
  @ValidateIf((_, value: unknown) => value !== null)
  @IsUUID()
  chapterId!: string | null;

  @ApiProperty({ example: 1, minimum: 1, maximum: 500 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  targetOrderIndex!: number;
}
