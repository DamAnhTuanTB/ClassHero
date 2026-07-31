import {
  apiRequest,
  apiRequestEnvelope,
  type ApiRequestOptions,
} from "@/lib/api-client";
import {
  mapLearningPathToCourseDetail,
  mapLearningPathsToCoursesList,
} from "@/features/student/shared/mappers/student-course-api-mappers";
import type {
  MockPurchaseResult,
  PublicLearningPathApi,
  StudentCoursesListMeta,
} from "@/features/student/shared/types/student-course-api-types";

type StudentLearningPathReadOptions = Pick<ApiRequestOptions, "cache">;

export async function listStudentLearningPaths(
  token?: string,
  options: StudentLearningPathReadOptions = {},
) {
  const response = await apiRequestEnvelope<
    PublicLearningPathApi[],
    StudentCoursesListMeta
  >("/learning-paths?pageSize=100", { cache: options.cache, token });

  return mapLearningPathsToCoursesList(response.data, response.meta);
}

export async function getStudentLearningPathDetail(
  slug: string,
  token?: string,
  options: StudentLearningPathReadOptions = {},
) {
  const learningPath = await apiRequest<PublicLearningPathApi>(
    `/learning-paths/${encodeURIComponent(slug)}`,
    { cache: options.cache, token },
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
