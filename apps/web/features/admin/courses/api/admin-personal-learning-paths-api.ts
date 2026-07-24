import { apiRequest, apiRequestEnvelope } from "@/lib/api-client";
import type {
  PersonalLearningPathDetailApi,
  PersonalLearningPathEnrollmentApi,
  PersonalLearningPathEnrollmentsListApi,
} from "@/features/admin/courses/types/admin-course-api-types";

export type PersonalLearningPathEnrollmentsQuery = {
  search?: string;
  personalizationStatus?: string;
  page?: number;
  pageSize?: number;
};

export async function listCourseEnrollments(
  learningPathId: string,
  query: PersonalLearningPathEnrollmentsQuery,
  token: string,
): Promise<PersonalLearningPathEnrollmentsListApi> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.personalizationStatus && query.personalizationStatus !== "ALL") {
    params.set("personalizationStatus", query.personalizationStatus);
  }
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  const qs = params.toString();
  const response = await apiRequestEnvelope<
    PersonalLearningPathEnrollmentApi[],
    { total: number; page: number; pageSize: number }
  >(
    `/admin/learning-paths/${learningPathId}/enrollments${qs ? `?${qs}` : ""}`,
    { token },
  );
  
  return {
    items: response.data,
    total: response.meta?.total ?? 0,
    page: response.meta?.page ?? query.page ?? 1,
    pageSize: response.meta?.pageSize ?? query.pageSize ?? 20,
  };
}

export async function createPersonalLearningPath(
  enrollmentId: string,
  idempotencyKey: string,
  token: string,
): Promise<PersonalLearningPathEnrollmentApi> {
  return apiRequest<PersonalLearningPathEnrollmentApi>(
    `/admin/enrollments/${enrollmentId}/personal-learning-path`,
    {
      method: "POST",
      body: { idempotencyKey },
      token,
    },
  );
}

export async function getPersonalLearningPath(
  enrollmentId: string,
  token: string,
): Promise<PersonalLearningPathDetailApi> {
  return apiRequest<PersonalLearningPathDetailApi>(
    `/admin/enrollments/${enrollmentId}/personal-learning-path`,
    { token },
  );
}
