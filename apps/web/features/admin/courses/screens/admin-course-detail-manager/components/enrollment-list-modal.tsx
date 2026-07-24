import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { EnrollmentListPanel } from "@/features/admin/courses/screens/admin-course-detail-manager/components/enrollment-list-panel";

export function EnrollmentListModal({
  isOpen,
  onClose,
  learningPathId,
}: {
  isOpen: boolean;
  onClose: () => void;
  learningPathId: string;
}) {
  return (
    <EditorDialogShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Danh sách học sinh"
      panelClassName="w-full max-w-5xl !rounded-xl min-h-[500px]"
    >
      <div className="bg-[var(--theme-surface)]">
        <EnrollmentListPanel learningPathId={learningPathId} />
      </div>
    </EditorDialogShell>
  );
}
