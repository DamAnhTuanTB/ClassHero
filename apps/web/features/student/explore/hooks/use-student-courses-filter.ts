"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudentCoursesQuery } from "@/features/student/shared/hooks/use-student-courses-query";
import type { StudentCourseSubjectFilter } from "@/features/student/shared/student-courses-types";
import { filterStudentCourses } from "@/features/student/shared/utils/student-courses-utils";

export type StudentCourseGradeFilter = number | "ALL" | null;

export function useStudentCoursesFilter() {
  const { isAuthHydrated, query: coursesQuery } = useStudentCoursesQuery();
  const courses = coursesQuery.data?.courses ?? [];
  const priorityGrade =
    coursesQuery.data?.meta.priorityGrade ??
    coursesQuery.data?.meta.gradeGroups[0]?.grade ??
    courses[0]?.grade ??
    null;
  const [grade, setGrade] = useState<StudentCourseGradeFilter>(null);
  const activeGrade = grade === "ALL" ? null : grade ?? priorityGrade;
  const [hasTouchedGrade, setHasTouchedGrade] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<StudentCourseSubjectFilter>("ALL");

  useEffect(() => {
    if (!hasTouchedGrade && priorityGrade !== null) {
      setGrade(priorityGrade);
    }
  }, [hasTouchedGrade, priorityGrade]);

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
    setHasTouchedGrade(true);
    setGrade(nextGrade);
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
    setQuery,
    setSubject,
    subject,
    total: filteredCourses.length,
  };
}
