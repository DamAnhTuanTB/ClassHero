import { Prisma } from "@prisma/client";
import {
  studentLessonContentSelect,
  studentLessonSummarySelect,
  studentQuizSetSelect,
  studentTestSetSelect,
} from "#api/modules/student-learning/selectors/student-lesson.selects";

export type StudentLessonContentRecord = Prisma.LessonGetPayload<{
  select: typeof studentLessonContentSelect;
}>;

export type StudentLessonSummaryRecord = Prisma.LessonSummaryGetPayload<{
  select: typeof studentLessonSummarySelect;
}>;

export type StudentQuizSetRecord = Prisma.QuizSetGetPayload<{
  select: typeof studentQuizSetSelect;
}>;

export type StudentTestSetRecord = Prisma.TestSetGetPayload<{
  select: typeof studentTestSetSelect;
}>;

export type StudentFileAccessUrls = ReadonlyMap<string, string | null>;
