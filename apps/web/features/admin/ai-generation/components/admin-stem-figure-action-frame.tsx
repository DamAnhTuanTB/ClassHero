"use client";

import { BookOpen, Bot, ImageUp, Trash2, WandSparkles } from "lucide-react";
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
const StemFigureRasterEditorDialog = dynamic(
  () =>
    import("@/features/admin/ai-generation/components/admin-stem-figure-raster-editor-dialog").then(
      (module) => module.AdminStemFigureRasterEditorDialog,
    ),
  { ssr: false },
);

export function AdminStemFigureActionFrame({
  children,
  contextActions,
  figure,
  isSourceCropOpen,
  lessonId,
  modelConfiguration,
  onSourceCropOpenChange,
  sourceCropContainerClassName,
}: {
  children: ReactNode;
  contextActions?: ReactNode;
  figure: AdminStemFigure;
  isSourceCropOpen?: boolean;
  lessonId: string;
  modelConfiguration?: AdminAiModelConfiguration;
  onSourceCropOpenChange?: (isOpen: boolean) => void;
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
  const [internalSourceCropOpen, setInternalSourceCropOpen] = useState(false);
  const [showRasterEditor, setShowRasterEditor] = useState(false);
  const hasTextbookImage = figure.sourceReferenceImages.length > 0;
  const isNotebookOrigin = figure.currentAssetKind === "TEXTBOOK_SOURCE";
  const isUploadOrigin = figure.currentAssetKind === "ADMIN_UPLOAD";
  const originLabel = isNotebookOrigin ? "Notebook" : isUploadOrigin ? "Upload" : "AI";
  const OriginIcon = isNotebookOrigin ? BookOpen : isUploadOrigin ? ImageUp : Bot;
  const canEditRaster =
    figure.status === "SUCCEEDED" &&
    figure.currentAssetKind === "TEXTBOOK_SOURCE" &&
    figure.hasCurrentAsset &&
    figure.pendingRevisionId === null &&
    Boolean(figure.assetUrl);
  const showSourceCrop = isSourceCropOpen ?? internalSourceCropOpen;

  function setShowSourceCrop(isOpen: boolean) {
    setInternalSourceCropOpen(isOpen);
    onSourceCropOpenChange?.(isOpen);
  }

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
            onUse={async (sourceObjectKey, enhance) => {
              try {
                await useSourceCropMutation.mutateAsync({
                  figure,
                  sourceObjectKey,
                  enhance,
                });
                toast.success(
                  enhance
                    ? "Đã làm nét và dùng crop sách giáo khoa làm hình chính thức."
                    : "Đã dùng crop sách giáo khoa làm hình chính thức.",
                );
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

      <div className="relative isolate flex-1 [&>:first-child]:pt-16">
        {children}
        {figure.hasCurrentAsset ? (
          <span
            aria-label={`Nguồn gốc ảnh: ${originLabel}`}
            className={`absolute left-3 top-3 z-30 inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs shadow-sm sm:left-4 sm:top-4 ${
              isNotebookOrigin
                ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200"
                : isUploadOrigin
                  ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/70 dark:text-sky-200"
                  : "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-200"
            }`}
            title={
              isNotebookOrigin
                ? "Ảnh có nguồn gốc từ sách giáo khoa"
                : isUploadOrigin
                  ? "Ảnh do admin tải lên"
                  : "Ảnh được tạo bằng AI"
            }
          >
            <OriginIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-extrabold">{originLabel}</span>
          </span>
        ) : null}
        <div className="absolute right-14 top-3 z-30 flex items-center gap-2 sm:right-16 sm:top-4">
          {contextActions}
          {canEditRaster ? (
            <span className="group relative">
              <button
                aria-label="Chỉnh sửa ảnh"
                className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
                onClick={() => setShowRasterEditor(true)}
                type="button"
              >
                <WandSparkles className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="pointer-events-none absolute right-0 top-11 z-40 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                Chỉnh sửa ảnh
              </span>
            </span>
          ) : null}
          {hasTextbookImage ? (
            <button
              aria-label="Xem ảnh sách giáo khoa"
              aria-pressed={showSourceCrop}
              className="theme-button-primary-subtle grid h-9 w-9 place-items-center rounded-lg shadow-sm"
              onClick={() => setShowSourceCrop(!showSourceCrop)}
              title="Xem ảnh sách giáo khoa"
              type="button"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <button
            aria-label="Xóa hình"
            className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950"
            disabled={deleteMutation.isPending}
            onClick={() => setIsDeleting(true)}
            title="Xóa hình"
            type="button"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
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
      {showRasterEditor ? (
        <StemFigureRasterEditorDialog
          figure={figure}
          isOpen
          lessonId={lessonId}
          onClose={() => setShowRasterEditor(false)}
        />
      ) : null}
      <DeleteConfirmDialog
        description="Bạn muốn xóa hình."
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
