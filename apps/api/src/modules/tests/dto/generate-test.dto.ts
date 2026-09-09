import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { GenerateQuizDto } from "#api/modules/quiz/dto/generate-quiz.dto";

/** Test v2 uses the Quiz generation contract and may create its first Test set. */
export class GenerateTestDto extends OmitType(GenerateQuizDto, [
  "targetQuizSetId",
] as const) {
  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Bộ Test nhận câu AI; bỏ trống khi lesson chưa có bộ nào để tự tạo Bộ đề 1 với thời gian mặc định 15 phút",
  })
  @IsOptional()
  @IsUUID("4")
  targetTestSetId?: string;
}
