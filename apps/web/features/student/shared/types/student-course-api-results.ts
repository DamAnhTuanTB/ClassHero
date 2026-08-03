import type {
  StudentCourse,
  StudentCourseDetail,
} from "@/features/student/shared/student-courses-types";
import type { StudentCourseCatalogOptionsApi } from "@/features/student/shared/types/student-course-api-types";

export type StudentCoursesListResult = {
  catalog: StudentCourseCatalogOptionsApi;
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
