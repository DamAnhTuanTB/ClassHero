import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { CreateLessonDto } from "#api/modules/learning-paths/dto/create-lesson.dto";

export class CreateLearningPathLessonDto extends CreateLessonDto {
  @ApiPropertyOptional({
    description: "Optional chapter destination. Null creates a top-level lesson.",
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  chapterId?: string | null;
}
