import type { StudentCourseDetailContinueKind } from "@/features/student/shared/student-courses-types";

export type StudentCourseContinueLessonCopy = {
  actionLabel: string;
  prefix: string;
};

const continueLessonCopy: Record<
  StudentCourseDetailContinueKind,
  StudentCourseContinueLessonCopy
> = {
  first: {
    actionLabel: "Vào học",
    prefix: "Buổi học đầu tiên",
  },
  inProgress: {
    actionLabel: "Học tiếp",
    prefix: "Buổi đang học",
  },
  last: {
    actionLabel: "Vào học",
    prefix: "Buổi học cuối cùng",
  },
  next: {
    actionLabel: "Vào học",
    prefix: "Buổi tiếp theo",
  },
};

export function getStudentCourseContinueLessonCopy(
  kind: StudentCourseDetailContinueKind,
) {
  return continueLessonCopy[kind];
}
