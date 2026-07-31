"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, type FormEvent } from "react";
import { useForm, type Resolver } from "react-hook-form";
import {
  createLessonSchema,
  emptyLessonValues,
  type LessonFormValues,
} from "@/features/admin/courses/admin-courses-schemas";
import {
  getLessonSourceExtractionFormValues,
  getSourceDocumentRangeReadiness,
  readRecord,
} from "@/features/admin/courses/admin-course-documents-utils";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { toLessonFormValues } from "@/features/admin/courses/admin-courses-utils";
import { useAdminCourseDetailManager } from "@/features/admin/courses/hooks/use-admin-course-detail-manager";
import { useAdminCourseDocumentsManager } from "@/features/admin/courses/hooks/use-admin-course-documents-manager";
import { LessonDocumentsFields } from "@/features/admin/courses/screens/admin-course-detail-manager/components/lesson-documents-fields";
import { prepareLessonFormValuesForSubmit } from "@/features/admin/courses/utils/prepare-lesson-form-values";

export function LessonDocumentsTab({
  learningPathId,
  lessonId,
  onSaved,
}: {
  learningPathId: string;
  lessonId: string;
  onSaved: () => void | Promise<void>;
}) {
  const { actions, isSavingLesson, path, viewState } =
    useAdminCourseDetailManager(learningPathId);
  const lessonMatch = useMemo(
    () =>
      path?.chapters
        .flatMap((chapter) => chapter.lessons.map((lesson) => ({ chapter, lesson })))
        .find((item) => item.lesson.id === lessonId) ?? null,
    [lessonId, path],
  );
  const lesson = lessonMatch?.lesson ?? null;
  const documentsManager = useAdminCourseDocumentsManager(path, {
    loadAllSourcePages: viewState === "ready",
  });
  const isInitialPending = viewState === "loading" || documentsManager.isLoading;
  const selectableSourceDocuments = useMemo(
    () =>
      documentsManager.sourceDocuments.filter((sourceDocument) => {
        if (sourceDocument.readiness?.isEligibleForExtraction === false) {
          return false;
        }

        return getSourceDocumentRangeReadiness(
          sourceDocument,
          documentsManager.sourcePagesByDocumentId[sourceDocument.id] ?? [],
        ).isReady;
      }),
    [documentsManager.sourceDocuments, documentsManager.sourcePagesByDocumentId],
  );
  const formSchema = useMemo(
    () =>
      createLessonSchema(
        documentsManager.sourceDocuments,
        documentsManager.sourcePagesByDocumentId,
      ),
    [documentsManager.sourceDocuments, documentsManager.sourcePagesByDocumentId],
  );
  const form = useForm<LessonFormValues>({
    resolver: zodResolver(formSchema) as Resolver<LessonFormValues>,
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      ...emptyLessonValues,
      sourceDocumentExtractions: [],
      foundationDocumentOrder: [],
    },
  });
  const resetKeyRef = useRef<string | null>(null);

  const formValues = useMemo(() => {
    if (!lesson) {
      return null;
    }

    const selectableSourceDocumentIds = new Set(
      selectableSourceDocuments.map((document) => document.id),
    );
    const sourceDocumentExtractions = getLessonSourceExtractionFormValues(
      lesson.id,
      documentsManager.documentsByLessonId,
      selectableSourceDocuments[0]?.id,
      documentsManager.sourcePagesByDocumentId,
    ).map((extraction) =>
      selectableSourceDocumentIds.has(extraction.sourceDocumentId)
        ? extraction
        : { ...extraction, sourceDocumentId: "" },
    );
    const lessonDocuments = documentsManager.documentsByLessonId[lesson.id] ?? [];
    const existingDocuments = lessonDocuments.filter((document) => {
      const isRangeDocument =
        document.kind === "PRIMARY_FROM_SOURCE" &&
        (Boolean(document.pageRangeId) ||
          readRecord(document.metadataJson)?.source === "source_document_page_range");
      return !isRangeDocument;
    });
    const foundationDocuments = lessonDocuments
      .filter((document) => document.kind === "PRIMARY_FROM_SOURCE")
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
    const foundationDocumentOrder = foundationDocuments.map((document) =>
      document.pageRangeId
        ? `EXTRACTION:${document.pageRangeId}`
        : `UPLOAD:${document.id}`,
    );

    return {
      ...toLessonFormValues(lesson, existingDocuments),
      sourceDocumentExtractions,
      foundationDocumentOrder,
    };
  }, [
    documentsManager.documentsByLessonId,
    documentsManager.sourcePagesByDocumentId,
    lesson,
    selectableSourceDocuments,
  ]);

  const resetKey = useMemo(() => {
    if (!formValues || !lesson) {
      return null;
    }

    const documents = documentsManager.documentsByLessonId[lesson.id] ?? [];
    return [
      lesson.id,
      lesson.title,
      ...documents.flatMap((document) => [
        document.id,
        document.status,
        document.processingJob?.progress ?? "",
        document.extractError ?? "",
      ]),
      ...formValues.sourceDocumentExtractions.flatMap((extraction) => [
        extraction.clientKey,
        extraction.sourceDocumentId,
        extraction.pageStart,
        extraction.pageEnd,
      ]),
    ].join(":");
  }, [documentsManager.documentsByLessonId, formValues, lesson]);

  useEffect(() => {
    if (!formValues || !resetKey || resetKeyRef.current === resetKey) {
      return;
    }

    if (resetKeyRef.current && form.formState.isDirty) {
      return;
    }

    form.reset(formValues);
    resetKeyRef.current = resetKey;
  }, [form, form.formState.isDirty, formValues, resetKey]);

  async function submit(values: LessonFormValues) {
    if (!lessonMatch) {
      return;
    }

    const preparedValues = prepareLessonFormValuesForSubmit(
      form,
      values,
      documentsManager.sourcePagesByDocumentId,
    );
    if (!preparedValues) {
      return;
    }

    const didSave = await actions.saveLesson(preparedValues, documentsManager, {
      chapterId: lessonMatch.chapter.id,
      closeEditor: false,
      lessonId,
    });
    if (!didSave) {
      return;
    }

    form.reset(values);
    documentsManager.actions.reloadDocuments();
    await onSaved();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    form.getValues("sourceDocumentExtractions").forEach((_, index) => {
      form.setValue(`sourceDocumentExtractions.${index}.hasInteracted`, true, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    });
    void form.handleSubmit(submit)(event);
  }

  if (isInitialPending) {
    return <LessonDocumentsSkeleton />;
  }

  if (viewState === "error" || !path || !lessonMatch) {
    return (
      <div className="flex min-h-72 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-bold text-[var(--theme-text-strong)]">
            Chưa tải được tài liệu buổi học
          </p>
          <p className="mt-1 text-sm leading-6 text-[var(--theme-text-muted)]">
            Thử tải lại dữ liệu khóa học trước khi quản lý tài liệu.
          </p>
          <button
            type="button"
            onClick={actions.retryLoad}
            className="theme-button-primary-subtle mt-4 inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="flex min-w-0 flex-col" onSubmit={handleSubmit} noValidate>
      <div className="space-y-3 sm:p-5">
        <LessonDocumentsFields
          disabled={false}
          form={form}
          isSaving={isSavingLesson}
          sourceDocuments={selectableSourceDocuments}
          sourcePagesByDocumentId={documentsManager.sourcePagesByDocumentId}
        />
      </div>

      <div className="theme-dialog-footer sticky bottom-0 z-10 flex shrink-0 justify-end border-t border-[var(--theme-border)] p-3 sm:p-4">
        <button
          type="submit"
          disabled={isSavingLesson}
          className="theme-button-primary inline-flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSavingLesson ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isSavingLesson ? "Đang lưu" : "Lưu tài liệu"}
        </button>
      </div>
    </form>
  );
}

function LessonDocumentsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Đang tải tài liệu buổi học"
      className="min-h-72 animate-pulse space-y-5 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-32 rounded-full" />
          <SkeletonBlock className="h-11 rounded-lg" />
        </div>
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-24 rounded-full" />
          <SkeletonBlock className="h-11 rounded-lg" />
        </div>
      </div>
      <div className="rounded-xl border border-[var(--theme-border)] p-4">
        <SkeletonBlock className="h-5 w-44 rounded-full" />
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="mt-4 grid gap-3 rounded-lg border border-[var(--theme-border)] p-4 sm:grid-cols-[minmax(0,1fr)_7rem]"
          >
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-3/5 rounded-full" />
              <SkeletonBlock className="h-3.5 w-2/5 rounded-full opacity-70" />
            </div>
            <SkeletonBlock className="h-9 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <SkeletonBlock className="h-11 w-36 rounded-lg" />
      </div>
    </div>
  );
}
