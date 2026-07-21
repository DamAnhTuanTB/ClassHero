"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createAdminLessonSupplementDocument,
  createAdminSourceDocument,
  deleteAdminLessonSupplementDocument,
  deleteAdminSourceDocument,
  getAdminFileSignedUrl,
  listAdminLearningPathLessonDocuments,
  listAdminSourceDocumentPages,
  listAdminSourceDocuments,
  replaceAdminLessonPrimaryDocument,
  requestAdminSourceDocumentProcessing,
  saveAdminLessonPageRanges,
  uploadAdminLessonDocumentFile,
} from "@/features/admin/courses/api/admin-course-documents-api";
import type { AdminLearningPath } from "@/features/admin/courses/admin-courses-data";
import {
  buildLocalPageRangeWarnings,
  createInitialRangeDraft,
  getLessonsWithChapter,
  getSourceDocumentRangeReadiness,
  getSourceDocumentPageLimit,
  getSourceDocumentStats,
  groupLessonDocumentsByLessonId,
  validateLessonRangeDraft,
  type LessonRangeDraft,
} from "@/features/admin/courses/admin-course-documents-utils";
import type {
  AdminLessonDocumentKind,
  AdminPageRangeWarningApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { ApiRequestError } from "@/lib/api-client";
import { computeAutofillRanges } from "@/features/admin/courses/utils/autofill-page-ranges";

const EMPTY_ARRAY: any[] = [];

type DialogState =
  | {
      type: "lesson-upload";
      kind: Exclude<AdminLessonDocumentKind, "PRIMARY_FROM_SOURCE">;
      lessonId: string;
      returnTo?: "ranges";
    }
  | { type: "pages"; filter?: "all" | "warnings" }
  | { type: "ranges" }
  | { type: "source-upload" }
  | null;

export const adminCourseDocumentQueryKeys = {
  all: ["admin-course-documents"] as const,
  lessonDocuments: (userId: string | undefined, learningPathId: string) =>
    [
      ...adminCourseDocumentQueryKeys.all,
      "lesson-documents",
      userId ?? "anonymous",
      learningPathId,
    ] as const,
  sourceDocuments: (userId: string | undefined, learningPathId: string) =>
    [
      ...adminCourseDocumentQueryKeys.all,
      "source-documents",
      userId ?? "anonymous",
      learningPathId,
    ] as const,
  sourcePages: (userId: string | undefined, sourceDocumentId: string | null) =>
    [
      ...adminCourseDocumentQueryKeys.all,
      "source-pages",
      userId ?? "anonymous",
      sourceDocumentId ?? "none",
    ] as const,
};

export function useAdminCourseDocumentsManager(path: AdminLearningPath | null) {
  const queryClient = useQueryClient();
  const session = useAuthSessionStore((state) => state.session);
  const token = session?.accessToken ?? "";
  const userId = session?.user.id;
  const pathId = path?.id ?? "none";
  const lessons = useMemo(() => (path ? getLessonsWithChapter(path) : []), [path]);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [selectedSourceDocumentId, setSelectedSourceDocumentId] = useState<string | null>(
    null,
  );
  const [rangeDraft, setRangeDraft] = useState<LessonRangeDraft>({});
  const [rangeSubmitAttempted, setRangeSubmitAttempted] = useState(false);
  const [latestRangeWarnings, setLatestRangeWarnings] = useState<
    AdminPageRangeWarningApi[]
  >([]);

  const sourceDocumentsQuery = useQuery({
    queryKey: adminCourseDocumentQueryKeys.sourceDocuments(userId, pathId),
    queryFn: () => listAdminSourceDocuments(path?.id ?? "", token),
    enabled: Boolean(token && path),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const sourceDocuments = sourceDocumentsQuery.data ?? (EMPTY_ARRAY as typeof sourceDocumentsQuery.data & any[]);
  const selectedSourceDocument =
    sourceDocuments.find((document) => document.id === selectedSourceDocumentId) ??
    sourceDocuments[0] ??
    null;

  const sourcePagesQuery = useQuery({
    queryKey: adminCourseDocumentQueryKeys.sourcePages(
      userId,
      selectedSourceDocument?.id ?? null,
    ),
    queryFn: () => listAdminSourceDocumentPages(selectedSourceDocument?.id ?? "", token),
    enabled: Boolean(token && selectedSourceDocument?.id),
    refetchInterval: selectedSourceDocument?.status === "PROCESSING" ? 5_000 : false,
    refetchIntervalInBackground: false,
  });
  const sourcePages = sourcePagesQuery.data ?? (EMPTY_ARRAY as typeof sourcePagesQuery.data & any[]);

  const lessonDocumentsQuery = useQuery({
    queryKey: adminCourseDocumentQueryKeys.lessonDocuments(userId, pathId),
    queryFn: () => listAdminLearningPathLessonDocuments(path?.id ?? "", token),
    enabled: Boolean(token && path),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const lessonDocuments = lessonDocumentsQuery.data ?? (EMPTY_ARRAY as typeof lessonDocumentsQuery.data & any[]);
  const documentsByLessonId = useMemo(
    () => groupLessonDocumentsByLessonId(lessonDocuments),
    [lessonDocuments],
  );
  const pageLimit = getSourceDocumentPageLimit(selectedSourceDocument, sourcePages);
  const rangeValidation = useMemo(
    () => validateLessonRangeDraft(lessons, rangeDraft, pageLimit, sourcePages),
    [lessons, pageLimit, rangeDraft, sourcePages],
  );
  const localRangeWarnings = useMemo(
    () => buildLocalPageRangeWarnings(rangeValidation.ranges, pageLimit),
    [pageLimit, rangeValidation.ranges],
  );
  const sourceStats = useMemo(() => getSourceDocumentStats(sourcePages), [sourcePages]);
  const rangeReadiness = useMemo(
    () => getSourceDocumentRangeReadiness(selectedSourceDocument, sourcePages),
    [selectedSourceDocument, sourcePages],
  );
  const mappedLessonCount = lessonDocuments.filter((document) =>
    ["PRIMARY_FROM_SOURCE", "PRIMARY_REPLACEMENT"].includes(document.kind),
  ).length;
  const selectedUploadLesson =
    dialogState?.type === "lesson-upload"
      ? (lessons.find((item) => item.lesson.id === dialogState.lessonId) ?? null)
      : null;

  useEffect(() => {
    if (sourceDocuments.length === 0) {
      setSelectedSourceDocumentId(null);
      return;
    }

    if (
      selectedSourceDocumentId &&
      sourceDocuments.some((document) => document.id === selectedSourceDocumentId)
    ) {
      return;
    }

    setSelectedSourceDocumentId(sourceDocuments[0]?.id ?? null);
  }, [selectedSourceDocumentId, sourceDocuments]);

  useEffect(() => {
    setRangeDraft(
      createInitialRangeDraft(
        lessons,
        documentsByLessonId,
        selectedSourceDocument?.id ?? null,
        sourcePages,
      ),
    );
    setRangeSubmitAttempted(false);
  }, [documentsByLessonId, lessons, selectedSourceDocument?.id, sourcePages]);

  useEffect(() => {
    if (selectedSourceDocument?.status === "READY") {
      void queryClient.invalidateQueries({
        queryKey: adminCourseDocumentQueryKeys.sourcePages(
          userId,
          selectedSourceDocument.id,
        ),
      });
    }
  }, [selectedSourceDocument?.status, selectedSourceDocument?.id, userId, queryClient]);

  async function invalidateDocumentQueries() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminCourseDocumentQueryKeys.sourceDocuments(userId, pathId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminCourseDocumentQueryKeys.lessonDocuments(userId, pathId),
      }),
      queryClient.invalidateQueries({
        queryKey: adminCourseDocumentQueryKeys.sourcePages(
          userId,
          selectedSourceDocument?.id ?? null,
        ),
      }),
    ]);
  }

  function closeDialog() {
    setDialogState((current) =>
      current?.type === "lesson-upload" && current.returnTo === "ranges"
        ? { type: "ranges" }
        : null,
    );
  }

  const uploadSourceDocumentMutation = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const uploadedFile = await uploadAdminLessonDocumentFile(file, token);
      if (!path) {
        throw new Error("Learning path is required");
      }

      return createAdminSourceDocument(
        path.id,
        {
          fileId: uploadedFile.id,
          title: title.trim() || uploadedFile.originalName,
        },
        token,
      );
    },
    onSuccess: async (sourceDocument) => {
      setSelectedSourceDocumentId(sourceDocument.id);
      setDialogState(null);
      toast.success("Đã nhận tài liệu nguồn");
      await invalidateDocumentQueries();
    },
    onError: (error) => {
      toast.error("Chưa upload được tài liệu nguồn", {
        description: getErrorMessage(error),
      });
    },
  });

  const retrySourceDocumentMutation = useMutation({
    mutationFn: () =>
      requestAdminSourceDocumentProcessing(selectedSourceDocument?.id ?? "", token),
    onSuccess: async () => {
      await invalidateDocumentQueries();
      toast.success("Đã bắt đầu xử lý lại");
    },
    onError: (error) => {
      toast.error("Chưa xử lý lại được", {
        description: getErrorMessage(error),
      });
    },
  });

  const deleteSourceDocumentMutation = useMutation({
    mutationFn: () => deleteAdminSourceDocument(selectedSourceDocument?.id ?? "", token),
    onSuccess: async () => {
      setSelectedSourceDocumentId(null);
      await invalidateDocumentQueries();
      toast.info("Đã xóa tài liệu nguồn");
    },
    onError: (error) => {
      toast.error("Chưa xóa được tài liệu nguồn", {
        description: getErrorMessage(error),
      });
    },
  });

  const saveRangesMutation = useMutation({
    mutationFn: () =>
      saveAdminLessonPageRanges(
        selectedSourceDocument?.id ?? "",
        rangeValidation.ranges,
        token,
      ),
    onSuccess: async (response) => {
      setLatestRangeWarnings(response.warnings);
      setDialogState(null);
      await invalidateDocumentQueries();
      toast.success("Đã lưu khoảng trang");
    },
    onError: (error) => {
      toast.error("Chưa lưu được khoảng trang", {
        description: getErrorMessage(error),
      });
    },
  });

  const uploadLessonDocumentMutation = useMutation({
    mutationFn: async ({
      file,
      kind,
      lessonId,
      title,
    }: {
      file: File;
      kind: Exclude<AdminLessonDocumentKind, "PRIMARY_FROM_SOURCE">;
      lessonId: string;
      returnTo?: "ranges";
      title: string;
    }) => {
      const uploadedFile = await uploadAdminLessonDocumentFile(file, token);

      if (kind === "PRIMARY_REPLACEMENT") {
        return replaceAdminLessonPrimaryDocument(
          lessonId,
          {
            fileId: uploadedFile.id,
            title: title.trim() || uploadedFile.originalName,
          },
          token,
        );
      }

      return createAdminLessonSupplementDocument(
        lessonId,
        {
          fileId: uploadedFile.id,
          kind: "SUPPLEMENT",
          title: title.trim() || uploadedFile.originalName,
        },
        token,
      );
    },
    onSuccess: async (_document, variables) => {
      setDialogState(variables.returnTo === "ranges" ? { type: "ranges" } : null);
      await invalidateDocumentQueries();
      toast.success(
        variables.kind === "PRIMARY_REPLACEMENT"
          ? "Đã thay tài liệu chính"
          : "Đã thêm tài liệu bổ sung",
      );
    },
    onError: (error) => {
      toast.error("Chưa upload được tài liệu", {
        description: getErrorMessage(error),
      });
    },
  });

  const deleteSupplementMutation = useMutation({
    mutationFn: ({ documentId, lessonId }: { documentId: string; lessonId: string }) =>
      deleteAdminLessonSupplementDocument(lessonId, documentId, token),
    onSuccess: async () => {
      await invalidateDocumentQueries();
      toast.info("Đã xóa tài liệu bổ sung");
    },
    onError: (error) => {
      toast.error("Chưa xóa được tài liệu bổ sung", {
        description: getErrorMessage(error),
      });
    },
  });

  const openFileMutation = useMutation({
    mutationFn: (fileId: string) => getAdminFileSignedUrl(fileId, token),
    onSuccess: () => {
      // Logic is handled in the caller to avoid popup blockers
    },
    onError: (error) => {
      toast.error("Chưa mở được tài liệu", {
        description: getErrorMessage(error),
      });
    },
  });

  function updateRangeDraft(
    lessonId: string,
    field: "pageEnd" | "pageStart",
    value: string,
  ) {
    setRangeDraft((current) => ({
      ...current,
      [lessonId]: {
        pageEnd: current[lessonId]?.pageEnd ?? "",
        pageStart: current[lessonId]?.pageStart ?? "",
        [field]: value,
      },
    }));
  }

  function autofillRanges() {
    if (!pageLimit || lessons.length === 0) {
      return;
    }

    const autofillLessons = lessons.map((item) => ({
      lessonId: item.lesson.id,
      title: item.lesson.title,
    }));

    const result = computeAutofillRanges(autofillLessons, sourcePages, pageLimit);

    if (result) {
      setRangeDraft(result);
    } else {
      // Fallback: divide evenly
      const nextDraft: LessonRangeDraft = {};
      const pageSpan = Math.max(1, Math.ceil(pageLimit / lessons.length));
      let cursor = 1;
      for (const item of lessons) {
        const pageStart = cursor;
        const pageEnd = Math.min(pageLimit, cursor + pageSpan - 1);
        nextDraft[item.lesson.id] = {
          pageEnd: String(pageEnd),
          pageStart: String(pageStart),
        };
        cursor = Math.min(pageLimit + 1, pageEnd + 1);
      }
      setRangeDraft(nextDraft);
    }

    setRangeSubmitAttempted(true);
  }

  async function saveRanges() {
    setRangeSubmitAttempted(true);

    if (!selectedSourceDocument) {
      toast.warning("Hãy upload tài liệu nguồn trước");
      return;
    }

    if (!rangeReadiness.isReady) {
      toast.warning("Chưa thể nhập khoảng trang", {
        description: rangeReadiness.reason,
      });
      return;
    }

    if (rangeValidation.issues.length > 0) {
      toast.warning("Kiểm tra lại khoảng trang");
      return;
    }

    await saveRangesMutation.mutateAsync();
  }

  return {
    dialogState,
    documentsByLessonId,
    isDeletingSourceDocument: deleteSourceDocumentMutation.isPending,
    isDeletingSupplement: deleteSupplementMutation.isPending,
    isLoading:
      sourceDocumentsQuery.isLoading ||
      lessonDocumentsQuery.isLoading ||
      sourcePagesQuery.isLoading,
    isOpeningFile: openFileMutation.isPending,
    isRetryingSourceDocument: retrySourceDocumentMutation.isPending,
    isSavingRanges: saveRangesMutation.isPending,
    isUploadingLessonDocument: uploadLessonDocumentMutation.isPending,
    isUploadingSourceDocument: uploadSourceDocumentMutation.isPending,
    latestRangeWarnings,
    lessons,
    localRangeWarnings,
    mappedLessonCount,
    pageLimit,
    rangeDraft,
    rangeReadiness,
    rangeSubmitAttempted,
    rangeValidation,
    selectedSourceDocument,
    selectedUploadLesson,
    sourceDocuments,
    sourceDocumentsError: sourceDocumentsQuery.error,
    sourcePages,
    sourceStats,
    actions: {
      autofillRanges,
      closeDialog,
      deleteSourceDocument: () => deleteSourceDocumentMutation.mutateAsync(),
      deleteSupplementDocument: (lessonId: string, documentId: string) =>
        deleteSupplementMutation.mutateAsync({ documentId, lessonId }),
      openLessonPrimaryUpload: (lessonId: string, returnTo?: "ranges") =>
        setDialogState({
          kind: "PRIMARY_REPLACEMENT",
          lessonId,
          returnTo,
          type: "lesson-upload",
        }),
      openLessonSupplementUpload: (lessonId: string, returnTo?: "ranges") =>
        setDialogState({
          kind: "SUPPLEMENT",
          lessonId,
          returnTo,
          type: "lesson-upload",
        }),
      openPagesDialog: () => setDialogState({ type: "pages", filter: "all" }),
      openPagesDialogWithWarnings: () => setDialogState({ type: "pages", filter: "warnings" }),
      openRangesDialog: () => setDialogState({ type: "ranges" }),
      openSourceDocumentFile: () => {
        if (selectedSourceDocument) {
          const popup = window.open("", "_blank");
          openFileMutation.mutate(selectedSourceDocument.fileId, {
            onSuccess: (signedUrl) => {
              if (popup) {
                popup.location.href = signedUrl.url;
              } else {
                toast.error("Trình duyệt đã chặn cửa sổ bật lên. Vui lòng cấp quyền cho trang web.");
              }
            },
            onError: () => {
              if (popup) popup.close();
            }
          });
        }
      },
      openSourceUploadDialog: () => setDialogState({ type: "source-upload" }),
      reloadDocuments: () => {
        lessonDocumentsQuery.refetch();
        sourceDocumentsQuery.refetch();
      },
      retrySourceDocument: () => retrySourceDocumentMutation.mutateAsync(),
      saveRanges,
      selectSourceDocument: setSelectedSourceDocumentId,
      updateRangeDraft,
      uploadLessonDocument: (
        lessonId: string,
        kind: Exclude<AdminLessonDocumentKind, "PRIMARY_FROM_SOURCE">,
        file: File,
        title: string,
      ) =>
        uploadLessonDocumentMutation.mutateAsync({
          file,
          kind,
          lessonId,
          returnTo:
            dialogState?.type === "lesson-upload" ? dialogState.returnTo : undefined,
          title,
        }),
      uploadSourceDocument: (file: File, title: string) =>
        uploadSourceDocumentMutation.mutateAsync({ file, title }),
    },
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Vui lòng thử lại sau ít phút.";
}
