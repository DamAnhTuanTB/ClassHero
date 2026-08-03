import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from "class-validator";

export class GenerateLessonSummaryDto {
  @ApiProperty({
    type: [String],
    description: "Danh sách lesson_documents.id thuộc đúng buổi học",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  documentIds!: string[];

  @ApiProperty({ enum: ["student_friendly"], example: "student_friendly" })
  @IsIn(["student_friendly"])
  style!: "student_friendly";
}
