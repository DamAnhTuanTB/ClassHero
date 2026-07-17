import type {
  StudentCourse,
  StudentCourseDetail,
} from "@/features/student/shared/student-courses-types";

export type StudentCoursesListResult = {
  courses: StudentCourse[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    priorityGrade: number | null;
    gradeGroups: Array<{
      grade: number;
      count: number;
    }>;
  };
};

export type StudentCourseDetailResult = {
  course: StudentCourse;
  detail: StudentCourseDetail;
};
