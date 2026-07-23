import { Prisma } from "@prisma/client";
import {
  personalLearningPathEnrollmentSelect,
  personalLearningPathJobSelect,
} from "#api/modules/learning-paths/selectors/personal-learning-path.selects";

export type PersonalLearningPathEnrollmentRecord = Prisma.EnrollmentGetPayload<{
  select: typeof personalLearningPathEnrollmentSelect;
}>;

export type PersonalLearningPathJobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof personalLearningPathJobSelect;
}>;
