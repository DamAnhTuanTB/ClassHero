"use client";

import { BookOpen } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import { AdminStemFigureActionsMenu } from "@/features/admin/ai-generation/components/admin-stem-figure-actions-menu";
import {
  useAdminStemFigureSourceCrop,
  useCreateNewAdminStemFigure,
  useDeleteAdminStemFigure,
  useReplaceAdminStemFigure,
  useRetryAdminStemFigure,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminAiModelConfiguration,
  AdminStemFigure,
  AdminStemFigureReferenceImageMode,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { getUserFacingErrorMessage } from "@/lib/user-facing-error";

const StemFigureEditorDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-editor-dialog").then(
      (module) => module.AdminStemFigureEditorDialog,
    ),
  { ssr: false },
);
const StemFigureCreateAiDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-create-ai-dialog").then(
      (module) => module.AdminStemFigureCreateAiDialog,
    ),
  { ssr: false },
);
const StemFigureSourceCropPanel = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-source-crop-panel").then(
      (module) => module.AdminStemFigureSourceCropPanel,
    ),
  { ssr: false },
);

export function AdminStemFigureActionFrame({
  children,
  figure,
  lessonId,
  modelConfiguration,
  sourceCropContainerClassName,
}: {
  children: ReactNode;
  figure: AdminStemFigure;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  sourceCropContainerClassName?: string;
}) {
  const retryMutation = useRetryAdminStemFigure(lessonId);
  const createNewMutation = useCreateNewAdminStemFigure(lessonId);
  const replaceMutation = useReplaceAdminStemFigure(lessonId);
  const deleteMutation = useDeleteAdminStemFigure(lessonId);
  const useSourceCropMutation = useAdminStemFigureSourceCrop(lessonId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingCode, setIsCreatingCode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateAi, setShowCreateAi] = useState(false);
  const [showSourceCrop, setShowSourceCrop] = useState(false);
  const hasTextbookImage = figure.sourceReferenceImages.length > 0;

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Thao tác với hình chưa thành công."));
    }
  }

  async function deleteFigure() {
    try {
      await deleteMutation.mutateAsync(figure);
      toast.success("Đã xóa hình khỏi bản kiến thức.");
      setIsDeleting(false);
    } catch (error) {
      toast.error(getUserFacingErrorMessage(error, "Chưa xóa được hình."));
    }
  }

  return (
    <>
      {showSourceCrop ? (
        <div className={sourceCropContainerClassName}>
          <StemFigureSourceCropPanel
            figure={figure}
            isUsing={useSourceCropMutation.isPending}
            onClose={() => setShowSourceCrop(false)}
            onUse={async (sourceObjectKey) => {
              try {
                await useSourceCropMutation.mutateAsync({ figure, sourceObjectKey });
                toast.success("Đã dùng crop sách giáo khoa làm hình chính thức.");
                setShowSourceCrop(false);
              } catch (error) {
                toast.error(
                  getUserFacingErrorMessage(error, "Chưa dùng được crop sách giáo khoa."),
                );
              }
            }}
          />
        </div>
      ) : null}

      <div className="relative isolate [&>:first-child]:pt-16">
        {children}
        {hasTextbookImage ? (
          <span className="absolute right-14 top-3 z-30 rounded-lg bg-[var(--theme-surface)] sm:right-16 sm:top-4">
            <button
              aria-label="Xem hình trong sách giáo khoa"
              aria-pressed={showSourceCrop}
              className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
              onClick={() => setShowSourceCrop((isVisible) => !isVisible)}
              title="Xem hình trong sách giáo khoa"
              type="button"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ) : null}
        <AdminStemFigureActionsMenu
          canEditCode={figure.sourceKind === "AI_TEX"}
          canRetryInfrastructure={
            (figure.status === "FAILED" || figure.status === "NEEDS_REVIEW") &&
            !figure.retryUsesAi
          }
          isCreating={createNewMutation.isPending}
          isReplacing={replaceMutation.isPending}
          isRetrying={retryMutation.isPending}
          onCreateWithAi={() => setShowCreateAi(true)}
          onCreateWithCode={() => setIsCreatingCode(true)}
          onDelete={() => setIsDeleting(true)}
          onEditCode={() => setIsEditing(true)}
          onReplaceImage={() => inputRef.current?.click()}
          onRetryInfrastructure={() =>
            void run(
              () => retryMutation.mutateAsync(figure),
              "Đã bắt đầu xử lý lại hình.",
            )
          }
        />
      </div>

      <input
        ref={inputRef}
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          void run(
            () => replaceMutation.mutateAsync({ figure, file }),
            "Đã tải ảnh mới lên.",
          );
        }}
        type="file"
      />

      {isEditing ? (
        <StemFigureEditorDialog
          figure={figure}
          isOpen
          lessonId={lessonId}
          onClose={() => setIsEditing(false)}
        />
      ) : null}
      {isCreatingCode ? (
        <StemFigureEditorDialog
          figure={figure}
          isOpen
          lessonId={lessonId}
          mode="create"
          onClose={() => setIsCreatingCode(false)}
        />
      ) : null}
      {showCreateAi ? (
        <StemFigureCreateAiDialog
          figure={figure}
          initialAdminInstructions=""
          initialMode={defaultCreateImageMode(figure)}
          isCreating={createNewMutation.isPending}
          isOpen
          lessonId={lessonId}
          modelConfiguration={modelConfiguration}
          onClose={() => setShowCreateAi(false)}
          onCreate={async (input) => {
            try {
              await createNewMutation.mutateAsync(input);
              toast.success("Đã bắt đầu tạo hình mới bằng AI.");
              setShowCreateAi(false);
            } catch (error) {
              toast.error(
                getUserFacingErrorMessage(error, "Chưa tạo được hình mới bằng AI."),
              );
            }
          }}
        />
      ) : null}
      <DeleteConfirmDialog
        description={`Xóa hình tại ${figure.blockPath}. Phần kiến thức bằng chữ vẫn được giữ lại.`}
        isConfirming={deleteMutation.isPending}
        isOpen={isDeleting}
        itemName={figure.caption ?? figure.blockPath}
        title="Xóa hình STEM"
        onCancel={() => setIsDeleting(false)}
        onConfirm={deleteFigure}
      />
    </>
  );
}

function defaultCreateImageMode(
  figure: AdminStemFigure,
): AdminStemFigureReferenceImageMode {
  if (
    figure.currentAssetKind === "TEXTBOOK_SOURCE" &&
    figure.sourceReferenceImages.length > 0
  ) {
    return "SOURCE_CROP_ONLY";
  }
  if (figure.hasCurrentAsset) return "CURRENT_ONLY";
  if (figure.sourceReferenceImages.length > 0) return "SOURCE_CROP_ONLY";
  return "NONE";
}
