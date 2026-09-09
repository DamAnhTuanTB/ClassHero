"use client";

import { Captions, Trash2, WandSparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import { ImmediateTooltip } from "@/components/common/ui/immediate-tooltip";
import { AdminStemFigureActionsMenu } from "@/features/admin/ai-generation/components/admin-stem-figure-actions-menu";
import type {
  AdminQuizAssessmentKind,
  AdminQuizFigure,
} from "@/features/admin/quiz/api/admin-quiz-api";
import {
  useAdminQuizFigureMutations,
  useAdminQuizFigureUpload,
} from "@/features/admin/quiz/hooks/use-admin-quiz";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const CodeDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-figure-code-dialog").then(
      (module) => module.AdminQuizFigureCodeDialog,
    ),
  { ssr: false },
);
const AiDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-figure-ai-dialog").then(
      (module) => module.AdminQuizFigureAiDialog,
    ),
  { ssr: false },
);
const CaptionDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-figure-caption-dialog").then(
      (module) => module.AdminQuizFigureCaptionDialog,
    ),
  { ssr: false },
);
const RefinementDialog = dynamic(
  () =>
    import("@/features/admin/quiz/components/admin-quiz-figure-refinement-dialog").then(
      (module) => module.AdminQuizFigureRefinementDialog,
    ),
  { ssr: false },
);

export function AdminQuizFigureActionFrame({
  children,
  assessmentKind,
  displayPercent,
  figure,
  questionId,
  setId,
}: {
  assessmentKind: AdminQuizAssessmentKind;
  children: ReactNode;
  displayPercent?: number | null;
  figure: AdminQuizFigure;
  questionId: string;
  setId: string;
}) {
  const mutations = useAdminQuizFigureMutations(setId, assessmentKind);
  const uploadMutation = useAdminQuizFigureUpload(setId, assessmentKind);
  const inputRef = useRef<HTMLInputElement>(null);
  const [codeMode, setCodeMode] = useState<"create" | "edit" | null>(null);
  const [showAi, setShowAi] = useState(false);
  const [showCaption, setShowCaption] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showRefinement, setShowRefinement] = useState(false);
  const revision = figure.currentRevision;
  const canRefine = Boolean(
    figure.status === "SUCCEEDED" &&
    revision?.sourceKind === "AI_TEX" &&
    revision.latexSource?.trim() &&
    revision.deliveryFile?.mimeType === "image/svg+xml",
  );

  async function upload(file: File) {
    try {
      await uploadMutation.mutateAsync({
        questionId,
        role: figure.role,
        file,
        altText: revision?.altText ?? roleLabel(figure.role),
        caption: revision?.caption ?? undefined,
      });
      toast.success("Đã tải ảnh mới lên.");
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa tải được ảnh mới."));
    }
  }

  async function remove() {
    try {
      await mutations.deleteFigure.mutateAsync({ questionId, figure });
      toast.success("Đã xóa hình khỏi câu Quiz.");
      setShowDelete(false);
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa xóa được hình Quiz."));
    }
  }

  return (
    <>
      <div className="mx-auto w-full max-w-2xl">
        <div
          className="relative isolate mx-auto w-full [&>:first-child]:pt-16"
          data-testid="admin-quiz-figure-action-frame"
          style={displayPercent == null ? undefined : { width: `${displayPercent}%` }}
        >
          {children}
          <div className="absolute right-14 top-3 z-30 flex items-center gap-2 sm:right-16 sm:top-4">
            {canRefine ? (
              <ImmediateTooltip content="Tinh chỉnh bằng AI">
                <button
                  aria-label="Tinh chỉnh bằng AI"
                  className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
                  onClick={() => setShowRefinement(true)}
                  type="button"
                >
                  <WandSparkles className="h-4 w-4" aria-hidden="true" />
                </button>
              </ImmediateTooltip>
            ) : null}
            {revision ? (
              <ImmediateTooltip content="Chỉnh sửa caption">
                <button
                  aria-label="Chỉnh sửa caption"
                  className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
                  onClick={() => setShowCaption(true)}
                  type="button"
                >
                  <Captions className="h-4 w-4" aria-hidden="true" />
                </button>
              </ImmediateTooltip>
            ) : null}
            <ImmediateTooltip content="Xóa ảnh">
              <button
                aria-label="Xóa ảnh"
                className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
                disabled={mutations.deleteFigure.isPending}
                onClick={() => setShowDelete(true)}
                type="button"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </ImmediateTooltip>
          </div>
          <AdminStemFigureActionsMenu
            canEditCode={Boolean(
              revision?.sourceKind === "AI_TEX" && revision.latexSource,
            )}
            canRetryInfrastructure={false}
            isCreating={mutations.createWithAi.isPending}
            isReplacing={uploadMutation.isPending}
            isRetrying={false}
            onCreateWithAi={() => setShowAi(true)}
            onCreateWithCode={() => setCodeMode("create")}
            onEditCode={() => setCodeMode("edit")}
            onReplaceImage={() => inputRef.current?.click()}
            onRetryInfrastructure={() => undefined}
          />
        </div>
      </div>

      <input
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) void upload(file);
        }}
      />
      {codeMode ? (
        <CodeDialog
          figure={figure}
          isOpen
          mode={codeMode}
          onClose={() => setCodeMode(null)}
          questionId={questionId}
          setId={setId}
          assessmentKind={assessmentKind}
        />
      ) : null}
      {showAi ? (
        <AiDialog
          figure={figure}
          isOpen
          onClose={() => setShowAi(false)}
          questionId={questionId}
          setId={setId}
          assessmentKind={assessmentKind}
        />
      ) : null}
      {showCaption ? (
        <CaptionDialog
          figure={figure}
          isOpen
          onClose={() => setShowCaption(false)}
          questionId={questionId}
          setId={setId}
          assessmentKind={assessmentKind}
        />
      ) : null}
      {showRefinement ? (
        <RefinementDialog
          figure={figure}
          isOpen
          onClose={() => setShowRefinement(false)}
          questionId={questionId}
          setId={setId}
          assessmentKind={assessmentKind}
        />
      ) : null}
      <DeleteConfirmDialog
        description="Bạn muốn xóa hình này khỏi câu Quiz. Nếu xóa hình đề, hình lời giải phụ thuộc cũng sẽ bị xóa."
        isConfirming={mutations.deleteFigure.isPending}
        isOpen={showDelete}
        itemName={revision?.caption ?? roleLabel(figure.role)}
        title="Xóa hình Quiz"
        onCancel={() => setShowDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}

function roleLabel(role: AdminQuizFigure["role"]) {
  return role === "QUESTION" ? "Hình đề" : "Hình lời giải";
}
