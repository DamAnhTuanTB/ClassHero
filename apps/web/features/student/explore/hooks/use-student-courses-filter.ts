"use client";

import { useMemo } from "react";
import { useStudentCoursesQuery } from "@/features/student/shared/hooks/use-student-courses-query";
import type { StudentCoursesListResult } from "@/features/student/shared/types/student-course-api-results";
import { filterStudentCourses } from "@/features/student/shared/utils/student-courses-utils";
import { useFilterSearchParams } from "@/lib/use-filter-search-params";

export type StudentCourseCatalogFilter = string | "ALL";

export function useStudentCoursesFilter(
  initialData?: StudentCoursesListResult | null,
) {
  const { isAuthHydrated, query: coursesQuery } =
    useStudentCoursesQuery(initialData);
  const { replaceFilterSearchParams, searchParams } = useFilterSearchParams();
  const courses = coursesQuery.data?.courses ?? [];
  const catalog = coursesQuery.data?.catalog ?? {
    domains: [],
    targetAudiences: [],
  };
  const studentGrade = coursesQuery.data?.meta.priorityGrade ?? null;
  const targetAudienceId = parseCatalogFilter(
    searchParams.get("targetAudience"),
    catalog.targetAudiences.map((option) => option.id),
  );
  const domainId = parseCatalogFilter(
    searchParams.get("domain"),
    catalog.domains.map((option) => option.id),
  );
  const query = searchParams.get("q") ?? "";

  const filteredCourses = useMemo(
    () =>
      filterStudentCourses({
        courses,
        domainId: domainId === "ALL" ? null : domainId,
        query,
        targetAudienceId:
          targetAudienceId === "ALL" ? null : targetAudienceId,
      }),
    [courses, domainId, query, targetAudienceId],
  );

  function handleTargetAudienceChange(nextTargetAudienceId: string) {
    replaceFilterSearchParams({
      targetAudience:
        nextTargetAudienceId === "ALL" ? null : nextTargetAudienceId,
    });
  }

  return {
    coursesQuery,
    catalog,
    domainId,
    filteredCourses,
    isError: coursesQuery.isError,
    isLoading:
      coursesQuery.data === undefined &&
      (!isAuthHydrated || coursesQuery.isLoading),
    query,
    refetch: coursesQuery.refetch,
    setDomainId: (nextDomainId: string) => {
      replaceFilterSearchParams({
        domain: nextDomainId === "ALL" ? null : nextDomainId,
      });
    },
    setQuery: (nextQuery: string) => {
      replaceFilterSearchParams({ q: nextQuery });
    },
    setTargetAudienceId: handleTargetAudienceChange,
    studentGrade,
    targetAudienceId,
  };
}

function parseCatalogFilter(
  value: string | null,
  validIds: string[],
): StudentCourseCatalogFilter {
  if (!value || value.toLowerCase() === "all") {
    return "ALL";
  }

  return validIds.includes(value) ? value : "ALL";
}
