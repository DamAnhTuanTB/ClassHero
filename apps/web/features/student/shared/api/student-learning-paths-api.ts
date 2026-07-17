import { apiRequest, apiRequestEnvelope } from "@/lib/api-client";
import {
  mapLearningPathToCourseDetail,
  mapLearningPathsToCoursesList,
} from "@/features/student/shared/mappers/student-course-api-mappers";
import type {
  MockPurchaseResult,
  PublicLearningPathApi,
  StudentCoursesListMeta,
} from "@/features/student/shared/types/student-course-api-types";

export async function listStudentLearningPaths(token?: string) {
  const response = await apiRequestEnvelope<
    PublicLearningPathApi[],
    StudentCoursesListMeta
  >("/learning-paths?pageSize=100", { token });

  return mapLearningPathsToCoursesList(response.data, response.meta);
}

export async function getStudentLearningPathDetail(slug: string, token?: string) {
  const learningPath = await apiRequest<PublicLearningPathApi>(
    `/learning-paths/${encodeURIComponent(slug)}`,
    { token },
  );

  return mapLearningPathToCourseDetail(learningPath);
}

export function mockPurchaseLearningPath(learningPathId: string, token?: string) {
  return apiRequest<MockPurchaseResult>("/student/payments/mock-success", {
    method: "POST",
    body: { learningPathId },
    token,
  });
}
