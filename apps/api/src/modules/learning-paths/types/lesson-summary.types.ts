import type { Prisma } from "@prisma/client";

import { lessonSummarySelect } from "#api/modules/learning-paths/selectors/lesson-summary.selects";

export type LessonSummaryRecord = Prisma.LessonSummaryGetPayload<{
  select: typeof lessonSummarySelect;
}>;
