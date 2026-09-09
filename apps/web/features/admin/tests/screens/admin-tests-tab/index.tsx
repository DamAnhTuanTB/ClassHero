"use client";

import { AdminAssessmentTab } from "@/features/admin/assessments/components/admin-assessment-tab";

interface AdminTestsTabProps {
  lessonId: string;
  onSelectedSetIdChange?: (setId: string | undefined) => void;
  preferredSetId?: string;
}

export function AdminTestsTab({
  lessonId,
  onSelectedSetIdChange,
  preferredSetId,
}: AdminTestsTabProps) {
  return (
    <AdminAssessmentTab
      assessmentKind="test"
      lessonId={lessonId}
      onSelectedSetIdChange={onSelectedSetIdChange}
      preferredSetId={preferredSetId}
    />
  );
}
