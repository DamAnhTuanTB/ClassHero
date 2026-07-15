"use client";

import { useMemo, useState } from "react";
import { studentCourses, studentProfile } from "@/features/student-courses/data";
import type { StudentCourseSubjectFilter } from "@/features/student-courses/types";
import { filterStudentCourses } from "@/features/student-courses/utils";

export function useStudentCoursesFilter() {
  const [grade, setGrade] = useState(studentProfile.grade);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<StudentCourseSubjectFilter>("ALL");
  const filteredCourses = useMemo(
    () =>
      filterStudentCourses({
        courses: studentCourses,
        grade,
        query,
        subject,
      }),
    [grade, query, subject],
  );

  return {
    filteredCourses,
    grade,
    query,
    setGrade,
    setQuery,
    setSubject,
    subject,
    total: filteredCourses.length,
  };
}
