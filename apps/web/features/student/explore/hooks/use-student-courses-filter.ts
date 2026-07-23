"use client";

import { useMemo } from "react";
import { useStudentCoursesQuery } from "@/features/student/shared/hooks/use-student-courses-query";
import type { StudentCourseSubjectFilter } from "@/features/student/shared/student-courses-types";
import { filterStudentCourses } from "@/features/student/shared/utils/student-courses-utils";
import { useFilterSearchParams } from "@/lib/use-filter-search-params";

export type StudentCourseGradeFilter = number | "ALL" | null;

export function useStudentCoursesFilter() {
  const { isAuthHydrated, query: coursesQuery } = useStudentCoursesQuery();
  const { replaceFilterSearchParams, searchParams } = useFilterSearchParams();
  const courses = coursesQuery.data?.courses ?? [];
  const priorityGrade =
    coursesQuery.data?.meta.priorityGrade ??
    coursesQuery.data?.meta.gradeGroups[0]?.grade ??
    courses[0]?.grade ??
    null;
  const grade = parseGradeFilter(searchParams.get("grade")) ?? priorityGrade;
  const activeGrade = grade === "ALL" ? null : (grade ?? priorityGrade);
  const query = searchParams.get("q") ?? "";
  const subject = parseSubjectFilter(searchParams.get("subject"));

  const filteredCourses = useMemo(
    () =>
      grade === null && priorityGrade === null
        ? []
        : filterStudentCourses({
            courses,
            grade: activeGrade,
            query,
            subject,
          }),
    [activeGrade, courses, grade, priorityGrade, query, subject],
  );

  function handleGradeChange(nextGrade: Exclude<StudentCourseGradeFilter, null>) {
    replaceFilterSearchParams({
      grade: nextGrade === "ALL" ? "all" : nextGrade,
    });
  }

  return {
    coursesQuery,
    filteredCourses,
    grade,
    isError: coursesQuery.isError,
    isLoading: !isAuthHydrated || coursesQuery.isLoading,
    query,
    refetch: coursesQuery.refetch,
    setGrade: handleGradeChange,
    setQuery: (nextQuery: string) => {
      replaceFilterSearchParams({ q: nextQuery });
    },
    setSubject: (nextSubject: StudentCourseSubjectFilter) => {
      replaceFilterSearchParams({
        subject: nextSubject === "ALL" ? null : nextSubject.toLowerCase(),
      });
    },
    subject,
    total: filteredCourses.length,
  };
}

function parseGradeFilter(value: string | null): StudentCourseGradeFilter {
  if (value?.toLowerCase() === "all") {
    return "ALL";
  }

  const parsedGrade = Number(value);

  return Number.isInteger(parsedGrade) && parsedGrade >= 3 && parsedGrade <= 12
    ? parsedGrade
    : null;
}

function parseSubjectFilter(value: string | null): StudentCourseSubjectFilter {
  switch (value?.toUpperCase()) {
    case "MATH":
    case "PHYSICS":
    case "CHEMISTRY":
      return value.toUpperCase() as StudentCourseSubjectFilter;
    default:
      return "ALL";
  }
}
