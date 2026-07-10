import { PartialType } from "@nestjs/swagger";
import { CreateLearningPathDto } from "#api/modules/learning-paths/dto/create-learning-path.dto";

export class UpdateLearningPathDto extends PartialType(CreateLearningPathDto) {}
