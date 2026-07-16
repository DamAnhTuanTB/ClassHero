"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import { PathEditor } from "@/features/admin/courses/screens/admin-courses-manager/components/path-editor";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import {
  emptyPathValues,
  learningPathSchema,
  type LearningPathFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import type { EditorMode } from "@/features/admin/courses/admin-courses-types";
import { toPathFormValues } from "@/features/admin/courses/admin-courses-utils";

export function PathEditorDialog({
  isOpen,
  isSaving,
  mode,
  selectedPath,
  onClose,
  onSubmit,
  onUploadCover,
}: {
  isOpen: boolean;
  isSaving: boolean;
  mode: EditorMode;
  selectedPath: AdminLearningPath | null;
  onClose: () => void;
  onSubmit: (values: LearningPathFormValues) => void | Promise<void>;
  onUploadCover: (file: File) => Promise<{
    fileId: string;
    fileName: string;
    imageUrl: string;
  }>;
}) {
  const form = useForm<LearningPathFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(learningPathSchema) as Resolver<LearningPathFormValues>,
    defaultValues: emptyPathValues,
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.reset(
      mode === "edit" && selectedPath ? toPathFormValues(selectedPath) : emptyPathValues,
    );
  }, [form, isOpen, mode, selectedPath]);

  return (
    <EditorDialogShell
      ariaLabel={mode === "create" ? "Tạo lộ trình" : "Sửa lộ trình"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <PathEditor
        mode={mode}
        form={form}
        isSaving={isSaving}
        onClose={onClose}
        onSubmit={onSubmit}
        onUploadCover={onUploadCover}
      />
    </EditorDialogShell>
  );
}
