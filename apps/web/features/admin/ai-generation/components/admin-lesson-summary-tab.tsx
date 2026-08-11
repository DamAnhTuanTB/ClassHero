"use client";

import {
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Send,
  LayoutTemplate,
  Code2,
  Columns,
} from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { AdminDataErrorState } from "@/components/admin/admin-data-error-state";
import { DeleteConfirmDialog } from "@/components/admin/courses/delete-confirm-dialog";
import {
  describeLessonSummaryDiagramTarget,
  type LessonSummaryDiagramEditableTarget,
  type LessonSummaryDiagramTextTarget,
} from "@/components/common/content/lesson-summary-diagram-editing";
import dynamic from "next/dynamic";
import {
  useAdminAiGenerationPanel,
  useAdminLessonSummary,
  useUpsertAdminLessonSummary,
} from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type {
  AdminLessonSummaryContent,
  AdminLessonSummaryReviewStatus,
  AdminAiPanelJob,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { QuizRichContentEditor } from "@/features/admin/quiz/components/quiz-rich-content-editor";
import { SummaryBlockRenderer } from "@/features/student/lessons/screens/student-lesson-screen/components/summary-block-renderer";
import {
  createEmptyTiptapDocument,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import { MathToolbar } from "@/features/student/lessons/screens/student-lesson-screen/components/math-toolbar";
import { AiJobMetadata } from "@/features/admin/ai-generation/components/ai-job-metadata";
import {
  addEqualLengthMarkerToLessonSummaryDiagram,
  deleteLessonSummaryDiagramTarget,
  editLessonSummaryDiagramTargetText,
} from "@/features/admin/ai-generation/utils/lesson-summary-diagram-edit";
import {
  getUserFacingErrorMessage,
  sanitizeUserFacingMessage,
} from "@/lib/user-facing-error";

const ReactJson = dynamic(() => import("@microlink/react-json-view"), { ssr: false });

type ViewMode = "UI_ONLY" | "JSON_ONLY" | "SPLIT";
type SummaryRendererData = ComponentProps<typeof SummaryBlockRenderer>["data"];
type DiagramDeleteRequest = {
  blockIndex: number;
  sectionIndex: number;
  target: LessonSummaryDiagramEditableTarget;
};
type DiagramTextEditRequest = {
  blockIndex: number;
  sectionIndex: number;
  target: LessonSummaryDiagramTextTarget;
};
type DiagramEqualLengthRequest = {
  blockIndex: number;
  sectionIndex: number;
  segmentIds: string[];
};
type DiagramResetRequest = {
  blockIndex: number;
  sectionIndex: number;
};

export function AdminLessonSummaryTab({
  lessonId,
  lessonTitle,
  onRegenerate,
}: {
  lessonId: string;
  lessonTitle?: string;
  onRegenerate: () => void;
}) {
  const summaryQuery = useAdminLessonSummary(lessonId);
  const panelQuery = useAdminAiGenerationPanel(lessonId);
  const summaryJob = panelQuery.data?.jobs?.SUMMARY;
  const upsertMutation = useUpsertAdminLessonSummary(lessonId);
  const [content, setContent] = useState<AdminLessonSummaryContent>(
    createEmptyTiptapDocument(),
  );
  const [contentError, setContentError] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>("UI_ONLY");
  const [jsonCollapsed, setJsonCollapsed] = useState<boolean | number>(2);
  const [pendingDiagramReset, setPendingDiagramReset] =
    useState<DiagramResetRequest | null>(null);
  const unresolvedReviewIssueCount = countUnresolvedReviewIssues(content);

  useEffect(() => {
    const savedMode = localStorage.getItem("admin-lesson-summary-view-mode");
    if (savedMode === "UI_ONLY" || savedMode === "JSON_ONLY" || savedMode === "SPLIT") {
      setViewMode(savedMode);
    }
  }, []);

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("admin-lesson-summary-view-mode", mode);
  };

  useEffect(() => {
    if (summaryQuery.data?.contentJson) {
      setContent(summaryQuery.data.contentJson);
      setContentError(undefined);
    }
  }, [summaryQuery.data]);

  if (summaryQuery.isPending) {
    return <SummarySkeleton />;
  }
  if (summaryQuery.isError) {
    return (
      <AdminDataErrorState
        description="Vui lòng thử lại để tiếp tục xem và biên tập tóm tắt."
        headingLevel={3}
        isRetrying={summaryQuery.isFetching}
        onRetry={() => summaryQuery.refetch()}
        title="Không tải được tóm tắt buổi học"
        variant="section"
      />
    );
  }

  const summary = summaryQuery.data;
  const deleteDiagramTarget = (request: DiagramDeleteRequest) => {
    if (content.type !== "lesson_summary_blocks") return;
    const data = content.data as SummaryRendererData;
    const section = data.sections[request.sectionIndex];
    const block = section?.blocks[request.blockIndex];
    if (!section || block?.visual?.kind !== "DIAGRAM_SPEC") {
      toast.error("Không tìm thấy hình cần chỉnh. Hãy chọn lại phần tử.");
      return;
    }

    const result = deleteLessonSummaryDiagramTarget(block.visual.spec, request.target);
    if (!result.success) {
      toast.error(
        sanitizeUserFacingMessage(
          result.reason,
          "Chưa thể xóa phần tử này. Vui lòng kiểm tra lại hình.",
        ),
      );
      return;
    }

    const nextSections = data.sections.map((candidateSection, sectionIndex) =>
      sectionIndex === request.sectionIndex
        ? {
            ...candidateSection,
            blocks: candidateSection.blocks.map((candidateBlock, blockIndex) =>
              blockIndex === request.blockIndex
                ? {
                    ...candidateBlock,
                    visual: { ...candidateBlock.visual, spec: result.spec },
                  }
                : candidateBlock,
            ),
          }
        : candidateSection,
    );
    preserveViewportAfterDiagramMutation();
    setContent({
      ...content,
      data: { ...data, sections: nextSections },
    });
    toast.success("Đã xóa khỏi bản nháp. Bấm Lưu nội dung để ghi lại.");
  };

  const editDiagramText = (request: DiagramTextEditRequest, nextText: string) => {
    if (content.type !== "lesson_summary_blocks") return false;
    const data = content.data as SummaryRendererData;
    const section = data.sections[request.sectionIndex];
    const block = section?.blocks[request.blockIndex];
    if (!section || block?.visual?.kind !== "DIAGRAM_SPEC") {
      toast.error("Không tìm thấy hình cần chỉnh. Hãy chọn lại phần tử.");
      return false;
    }
    const result = editLessonSummaryDiagramTargetText(
      block.visual.spec,
      request.target,
      nextText,
    );
    if (!result.success) {
      toast.error(
        sanitizeUserFacingMessage(
          result.reason,
          "Chưa thể sửa phần tử này. Vui lòng kiểm tra lại hình.",
        ),
      );
      return false;
    }

    const mayHaveExternalReference =
      request.target.kind === "POINT_LABEL" ||
      hasTextOutsideSelectedDiagram(
        data,
        request.sectionIndex,
        request.blockIndex,
        request.target.displayText,
      );
    const nextSections = data.sections.map((candidateSection, sectionIndex) =>
      sectionIndex === request.sectionIndex
        ? {
            ...candidateSection,
            blocks: candidateSection.blocks.map((candidateBlock, blockIndex) =>
              blockIndex === request.blockIndex
                ? {
                    ...candidateBlock,
                    visual: { ...candidateBlock.visual, spec: result.spec },
                  }
                : candidateBlock,
            ),
          }
        : candidateSection,
    );
    preserveViewportAfterDiagramMutation();
    setContent({ ...content, data: { ...data, sections: nextSections } });
    if (mayHaveExternalReference) {
      toast.warning(
        `Đã sửa ${describeLessonSummaryDiagramTarget(request.target)} trong bản nháp. Hãy rà soát đề bài, GT–KL và lời giải còn dùng nội dung cũ.`,
      );
    } else {
      toast.success("Đã sửa trong bản nháp. Bấm Lưu nội dung để ghi lại.");
    }
    return true;
  };

  const addEqualLengthMarker = (request: DiagramEqualLengthRequest) => {
    if (content.type !== "lesson_summary_blocks") return false;
    const data = content.data as SummaryRendererData;
    const section = data.sections[request.sectionIndex];
    const block = section?.blocks[request.blockIndex];
    if (!section || block?.visual?.kind !== "DIAGRAM_SPEC") {
      toast.error("Không tìm thấy hình cần chỉnh. Hãy chọn lại các đoạn.");
      return false;
    }
    const result = addEqualLengthMarkerToLessonSummaryDiagram(
      block.visual.spec,
      request.segmentIds,
    );
    if (!result.success) {
      toast.error(
        sanitizeUserFacingMessage(
          result.reason,
          "Chưa thể đánh dấu các đoạn bằng nhau. Vui lòng kiểm tra lại hình.",
        ),
      );
      return false;
    }
    const nextSections = data.sections.map((candidateSection, sectionIndex) =>
      sectionIndex === request.sectionIndex
        ? {
            ...candidateSection,
            blocks: candidateSection.blocks.map((candidateBlock, blockIndex) =>
              blockIndex === request.blockIndex
                ? {
                    ...candidateBlock,
                    visual: { ...candidateBlock.visual, spec: result.spec },
                  }
                : candidateBlock,
            ),
          }
        : candidateSection,
    );
    preserveViewportAfterDiagramMutation();
    setContent({ ...content, data: { ...data, sections: nextSections } });
    toast.success(
      `Đã đánh dấu ${request.segmentIds.length} đoạn bằng nhau trong bản nháp. Bấm Lưu nội dung để ghi lại.`,
    );
    return true;
  };

  const confirmDiagramReset = () => {
    if (
      !pendingDiagramReset ||
      content.type !== "lesson_summary_blocks" ||
      summary?.contentJson.type !== "lesson_summary_blocks"
    ) {
      setPendingDiagramReset(null);
      return;
    }
    const data = content.data as SummaryRendererData;
    const savedData = summary.contentJson.data as SummaryRendererData;
    const currentBlock =
      data.sections[pendingDiagramReset.sectionIndex]?.blocks[
        pendingDiagramReset.blockIndex
      ];
    const savedBlock = findSavedDiagramBlock(
      savedData,
      pendingDiagramReset,
      currentBlock,
    );
    if (
      currentBlock?.visual?.kind !== "DIAGRAM_SPEC" ||
      savedBlock?.visual?.kind !== "DIAGRAM_SPEC"
    ) {
      setPendingDiagramReset(null);
      toast.error("Không tìm thấy bản hình đầu phiên để khôi phục.");
      return;
    }
    const nextSections = data.sections.map((section, sectionIndex) =>
      sectionIndex === pendingDiagramReset.sectionIndex
        ? {
            ...section,
            blocks: section.blocks.map((block, blockIndex) =>
              blockIndex === pendingDiagramReset.blockIndex
                ? {
                    ...block,
                    visual: { ...block.visual, spec: savedBlock.visual.spec },
                  }
                : block,
            ),
          }
        : section,
    );
    preserveViewportAfterDiagramMutation();
    setContent({ ...content, data: { ...data, sections: nextSections } });
    setPendingDiagramReset(null);
    toast.success("Đã khôi phục mọi chỉnh sửa của hình trong phiên bản nháp này.");
  };

  const save = async (action: "SAVE" | "PUBLISH" | "WITHDRAW") => {
    const isBlocks = content?.type === "lesson_summary_blocks";
    if (!isBlocks && !hasTiptapDocumentContent(content)) {
      setContentError("Nhập nội dung Kiến thức trước khi lưu");
      return;
    }
    setContentError(undefined);
    const reviewStatus: AdminLessonSummaryReviewStatus =
      action === "WITHDRAW"
        ? "HIDDEN"
        : action === "PUBLISH"
          ? "APPROVED"
          : summary?.reviewStatus || "DRAFT";
    try {
      await upsertMutation.mutateAsync({
        contentJson: content,
        source: summary?.source ?? "ADMIN",
        reviewStatus,
      });
      toast.success(
        action === "WITHDRAW"
          ? "Đã thu hồi phát hành tóm tắt"
          : action === "PUBLISH"
            ? "Đã phát hành tóm tắt"
            : "Đã lưu nội dung chỉnh sửa",
      );
    } catch (error) {
      toast.error(
        getUserFacingErrorMessage(error, "Chưa lưu được nội dung. Vui lòng thử lại."),
      );
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6" data-testid="admin-lesson-summary-tab">
      <MathToolbar />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
              Kiến thức buổi học
            </h3>
            {summary ? (
              <SummaryStatusBadge
                status={summary.reviewStatus}
                job={summaryJob ?? null}
              />
            ) : null}
            {unresolvedReviewIssueCount > 0 ? (
              <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-2.5 text-xs font-extrabold text-[var(--theme-warning-text)]">
                {unresolvedReviewIssueCount} mục cần kiểm tra
              </span>
            ) : null}
          </div>
          <AiJobMetadata job={summaryJob ?? null} onEdit={onRegenerate} />
        </div>

        {content?.type === "lesson_summary_blocks" && (
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            <button
              type="button"
              onClick={() => handleSetViewMode("UI_ONLY")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === "UI_ONLY"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Chỉ xem UI"
            >
              <LayoutTemplate className="h-4 w-4" />
              <span className="hidden lg:inline">Chỉ xem UI</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("JSON_ONLY")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === "JSON_ONLY"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Chỉ xem JSON"
            >
              <Code2 className="h-4 w-4" />
              <span className="hidden lg:inline">Chỉ xem JSON</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("SPLIT")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === "SPLIT"
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              title="Xem song song"
            >
              <Columns className="h-4 w-4" />
              <span className="hidden lg:inline">Song song</span>
            </button>
          </div>
        )}
      </div>

      {content?.type === "lesson_summary_blocks" ? (
        <div className="-mx-3 sm:mx-0 py-6 px-3 sm:p-8 bg-white dark:bg-slate-950 rounded-none sm:rounded-2xl shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-800/50">
          {summary?.reviewStatus === "APPROVED" ? (
            <div
              className="mb-4 rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-sm font-semibold text-[var(--theme-warning-text)]"
              data-testid="diagram-edit-withdraw-required"
            >
              Thu hồi phát hành trước khi xóa nhãn hoặc ký hiệu trực tiếp trên hình.
            </div>
          ) : null}
          {viewMode === "JSON_ONLY" ? (
            <div className="flex flex-col space-y-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setJsonCollapsed(false)}
                  className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Xổ toàn bộ
                </button>
                <button
                  onClick={() => setJsonCollapsed(2)}
                  className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 transition-colors"
                >
                  Thu lại toàn bộ
                </button>
              </div>
              <div className="w-full overflow-auto max-h-[800px] border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-950 shadow-sm">
                <ReactJson
                  src={content}
                  onEdit={(event) =>
                    setContent(event.updated_src as AdminLessonSummaryContent)
                  }
                  onAdd={(event) =>
                    setContent(event.updated_src as AdminLessonSummaryContent)
                  }
                  onDelete={(event) =>
                    setContent(event.updated_src as AdminLessonSummaryContent)
                  }
                  theme="rjv-default"
                  style={{ backgroundColor: "transparent" }}
                  collapsed={jsonCollapsed}
                  displayDataTypes={false}
                  name={false}
                  enableClipboard={false}
                  keyModifier={(event) =>
                    event instanceof MouseEvent &&
                    (event.detail >= 2 || event.metaKey || event.ctrlKey)
                  }
                />
              </div>
            </div>
          ) : (
            <SummaryBlockRenderer
              data={content.data as ComponentProps<typeof SummaryBlockRenderer>["data"]}
              displayTitle={lessonTitle}
              diagramEditingDisabled={upsertMutation.isPending}
              viewMode={viewMode === "UI_ONLY" ? "UI_ONLY" : "SPLIT"}
              showEditorialMetadata
              onChange={(newData) => setContent({ ...content, data: newData })}
              onRequestDiagramDelete={
                summary?.reviewStatus === "APPROVED" ? undefined : deleteDiagramTarget
              }
              onRequestDiagramAddEqualLength={
                summary?.reviewStatus === "APPROVED" ? undefined : addEqualLengthMarker
              }
              onRequestDiagramReset={
                summary?.reviewStatus === "APPROVED" ? undefined : setPendingDiagramReset
              }
              onRequestDiagramTextEdit={
                summary?.reviewStatus === "APPROVED" ? undefined : editDiagramText
              }
            />
          )}
        </div>
      ) : (
        <QuizRichContentEditor
          ariaLabel="Nội dung Kiến thức buổi học"
          disabled={upsertMutation.isPending}
          error={contentError}
          placeholder="Nhập các ý chính, công thức, ví dụ và câu hỏi ôn tập..."
          value={content}
          onBlur={() => {
            if (!hasTiptapDocumentContent(content)) {
              setContentError("Nhập nội dung Kiến thức trước khi lưu");
            }
          }}
          onChange={(value) => {
            setContent(value);
            if (hasTiptapDocumentContent(value)) {
              setContentError(undefined);
            }
          }}
        />
      )}

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--theme-border)] pt-4 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={upsertMutation.isPending}
          onClick={onRegenerate}
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {summary ? "Sinh lại" : "Sinh Kiến thức"}
        </button>
        <button
          type="button"
          disabled={upsertMutation.isPending}
          onClick={() => save("SAVE")}
          className="theme-button-primary-subtle inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
        >
          {upsertMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          Lưu nội dung
        </button>
        {summary?.reviewStatus !== "APPROVED" ? (
          <button
            type="button"
            disabled={upsertMutation.isPending || unresolvedReviewIssueCount > 0}
            onClick={() => save("PUBLISH")}
            title={
              unresolvedReviewIssueCount > 0
                ? "Sửa hoặc chấp nhận các vấn đề trước khi phát hành"
                : "Phát hành tóm tắt"
            }
            className="theme-button-primary inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-5 text-sm font-extrabold disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Phát hành
          </button>
        ) : null}
        {summary?.reviewStatus === "APPROVED" ? (
          <button
            type="button"
            disabled={upsertMutation.isPending}
            onClick={() => save("WITHDRAW")}
            className="theme-button-neutral inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold disabled:opacity-60"
          >
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Thu hồi phát hành
          </button>
        ) : null}
      </div>

      <DeleteConfirmDialog
        confirmLabel="Khôi phục hình"
        description="Mọi chỉnh sửa của hình này trong bản nháp ở phiên hiện tại sẽ bị khôi phục. Các nội dung khác không bị thay đổi."
        intent="RESET"
        isConfirming={upsertMutation.isPending}
        isOpen={Boolean(pendingDiagramReset)}
        itemName="hình vẽ này"
        title="Khôi phục hình"
        onCancel={() => setPendingDiagramReset(null)}
        onConfirm={confirmDiagramReset}
      />
    </div>
  );
}

function hasTextOutsideSelectedDiagram(
  data: SummaryRendererData,
  selectedSectionIndex: number,
  selectedBlockIndex: number,
  text: string,
) {
  const searchValue = text.trim();
  if (!searchValue) return false;
  const contentWithoutSelectedDiagram = data.sections.map((section, sectionIndex) => ({
    ...section,
    blocks: section.blocks.map((block, blockIndex) =>
      sectionIndex === selectedSectionIndex && blockIndex === selectedBlockIndex
        ? { ...block, visual: undefined }
        : block,
    ),
  }));
  return JSON.stringify(contentWithoutSelectedDiagram).includes(searchValue);
}

function findSavedDiagramBlock(
  savedData: SummaryRendererData,
  request: DiagramResetRequest,
  currentBlock: SummaryRendererData["sections"][number]["blocks"][number] | undefined,
) {
  const direct = savedData.sections[request.sectionIndex]?.blocks[request.blockIndex];
  if (
    direct?.visual?.kind === "DIAGRAM_SPEC" &&
    diagramBlockResetSignature(direct) === diagramBlockResetSignature(currentBlock)
  ) {
    return direct;
  }
  if (!currentBlock) return undefined;
  const signature = diagramBlockResetSignature(currentBlock);
  const candidates = savedData.sections.flatMap((section) =>
    section.blocks.filter(
      (block) =>
        block.visual?.kind === "DIAGRAM_SPEC" &&
        diagramBlockResetSignature(block) === signature,
    ),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

function diagramBlockResetSignature(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const { visual: _visual, ...contentFields } = value as Record<string, unknown>;
  return JSON.stringify(contentFields);
}

function preserveViewportAfterDiagramMutation() {
  const left = window.scrollX;
  const top = window.scrollY;
  if (
    document.activeElement instanceof HTMLElement &&
    !document.activeElement.closest("figure[data-diagram-editable='true']")
  ) {
    document.activeElement.blur();
  }
  requestAnimationFrame(() => {
    window.scrollTo({ behavior: "auto", left, top });
    requestAnimationFrame(() => window.scrollTo({ behavior: "auto", left, top }));
  });
}

type ReviewIssueLike = {
  accepted?: boolean;
  code?: string;
  resolution?: "ACCEPT_OR_FIX" | "FIX_ONLY";
};
type ReviewBlockLike = { reviewIssues?: ReviewIssueLike[] };
type ReviewSectionLike = { blocks?: ReviewBlockLike[] };
type ReviewContentLike = {
  type?: string;
  data?: { reviewIssues?: ReviewIssueLike[]; sections?: ReviewSectionLike[] };
};
const FIX_ONLY_REVIEW_CODES = new Set([
  "BLOCK_CANNOT_PROCESS",
  "BLOCK_SCHEMA_INVALID",
  "DIAGRAM_CANNOT_RENDER",
  "MISSING_REQUIRED_FIELD",
  "MISSING_SUMMARY_TITLE",
  "MISSING_THEORY_SECTION",
  "MISSING_THEORY_UNIT",
]);

function countUnresolvedReviewIssues(content: unknown) {
  const candidate = content as ReviewContentLike;
  if (candidate?.type !== "lesson_summary_blocks" || !candidate.data) return 0;
  const count = (issues: ReviewIssueLike[] | undefined) =>
    Array.isArray(issues)
      ? issues.filter(
          (issue) =>
            issue &&
            (issue.resolution === "FIX_ONLY" ||
              (issue.code !== undefined && FIX_ONLY_REVIEW_CODES.has(issue.code)) ||
              issue.code?.endsWith("_CANNOT_RENDER") ||
              issue.code?.endsWith("_CANNOT_PROCESS") ||
              issue.accepted !== true),
        ).length
      : 0;
  return (
    count(candidate.data.reviewIssues) +
    (Array.isArray(candidate.data.sections)
      ? candidate.data.sections.reduce(
          (sectionTotal: number, section) =>
            sectionTotal +
            (Array.isArray(section?.blocks)
              ? section.blocks.reduce(
                  (blockTotal: number, block) => blockTotal + count(block?.reviewIssues),
                  0,
                )
              : 0),
          0,
        )
      : 0)
  );
}

function SummaryStatusBadge({
  status,
  job,
}: {
  status: AdminLessonSummaryReviewStatus;
  job?: AdminAiPanelJob | null;
}) {
  if (job?.status === "QUEUED" || job?.status === "RUNNING") {
    return (
      <span className="inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold border-[var(--theme-info-border)] bg-[var(--theme-info-bg)] text-[var(--theme-info-text)]">
        {job.status === "QUEUED" ? "Đang chờ" : "Đang tạo"}
      </span>
    );
  }

  const copy = {
    DRAFT: "Bản nháp",
    NEEDS_REVIEW: "Bản nháp",
    APPROVED: "Đã phát hành",
    HIDDEN: "Đã thu hồi",
  }[status];
  const className =
    status === "APPROVED"
      ? "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]"
      : status === "DRAFT" || status === "NEEDS_REVIEW"
        ? "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]"
        : "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text-muted)]";
  return (
    <span
      className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-extrabold ${className}`}
    >
      {copy}
    </span>
  );
}

function SummarySkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-5 p-5 sm:p-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-6 w-48 rounded-full" />
        <SkeletonBlock className="h-4 w-96 max-w-full rounded-full opacity-70" />
      </div>
      <SkeletonBlock className="h-80 rounded-xl" />
      <div className="flex justify-end gap-2">
        <SkeletonBlock className="h-11 w-32 rounded-lg" />
        <SkeletonBlock className="h-11 w-36 rounded-lg" />
      </div>
    </div>
  );
}
