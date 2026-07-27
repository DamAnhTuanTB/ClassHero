"use client";

import { AdminAssessmentTab } from "@/features/admin/assessments/components/admin-assessment-tab";

interface AdminTestsTabProps {
  lessonId: string;
}

export function AdminTestsTab({ lessonId }: AdminTestsTabProps) {
  return <AdminAssessmentTab assessmentKind="test" lessonId={lessonId} />;
}
