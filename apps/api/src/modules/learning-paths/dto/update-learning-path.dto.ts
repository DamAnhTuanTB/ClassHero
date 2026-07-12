import { OmitType, PartialType } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { CreateLearningPathDto } from "#api/modules/learning-paths/dto/create-learning-path.dto";

class UpdateLearningPathBaseDto extends OmitType(CreateLearningPathDto, [
  "thumbnailFileId",
] as const) {}

export class UpdateLearningPathDto extends PartialType(UpdateLearningPathBaseDto) {
  @IsOptional()
  @IsUUID()
  thumbnailFileId?: string | null;
}
