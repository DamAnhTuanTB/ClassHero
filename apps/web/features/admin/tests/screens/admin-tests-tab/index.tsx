"use client";

import { AdminAssessmentTab } from "@/features/admin/assessments/components/admin-assessment-tab";

interface AdminTestsTabProps {
  lessonId: string;
  preferredSetId?: string;
}

export function AdminTestsTab({ lessonId, preferredSetId }: AdminTestsTabProps) {
  return (
    <AdminAssessmentTab
      assessmentKind="test"
      lessonId={lessonId}
      preferredSetId={preferredSetId}
    />
  );
}
