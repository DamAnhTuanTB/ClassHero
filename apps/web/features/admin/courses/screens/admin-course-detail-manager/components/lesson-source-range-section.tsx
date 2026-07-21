"use client";

import { useState, useMemo } from "react";
import { FileText, Layers3, Maximize2, Minimize2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { FieldLabel } from "@/components/common/forms/field-label";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import type { LessonFormValues } from "@/features/admin/courses/admin-courses-schemas";
import { getPrintedPageView } from "@/features/admin/courses/admin-course-documents-utils";
import {
  AdminSourceDocumentApi,
  AdminSourceDocumentPageApi,
} from "@/features/admin/courses/types/admin-course-document-types";
import { getPdfPageFromPrintedPage } from "@/features/admin/courses/admin-course-documents-utils";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import { PdfPagePreview } from "@/components/shared/pdf-page-preview";

export function LessonSourceRangeSection({
  disabled,
  form,
  isSaving,
  isRangeReady,
  pageLimit,
  pages,
  rangeDisabledReason,
  selectedSourceDocument,
  sourceDocuments,
  onSelectSourceDocument,
}: {
  disabled: boolean;
  form: UseFormReturn<LessonFormValues>;
  isSaving: boolean;
  isRangeReady: boolean;
  pageLimit: number | null;
  pages: AdminSourceDocumentPageApi[];
  rangeDisabledReason: string;
  selectedSourceDocument: AdminSourceDocumentApi | null;
  sourceDocuments: AdminSourceDocumentApi[];
  onSelectSourceDocument: (sourceDocumentId: string | null) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [previewMode, setPreviewMode] = useState<"ocr" | "pdf">("pdf");
  const sourceDocumentId = form.watch("sourceDocumentPageRange.sourceDocumentId") ?? "";
  const pageStart = form.watch("sourceDocumentPageRange.pageStart") ?? "";
  const pageEnd = form.watch("sourceDocumentPageRange.pageEnd") ?? "";
  const pageStartNumber = getPdfPageFromPrintedPage(pageStart, pages);
  const pageEndNumber = getPdfPageFromPrintedPage(pageEnd, pages);
  const previewPage = pageStartNumber !== null
    ? pages.find((page) => page.pageNumber === pageStartNumber)
    : null;
    
  const previewPages =
    pageStartNumber !== null && pageEndNumber !== null && pageStartNumber <= pageEndNumber
      ? pages.filter(
          (page) =>
            page.pageNumber >= pageStartNumber && page.pageNumber <= pageEndNumber,
        )
      : previewPage
        ? [previewPage]
        : [];
  const fullText = previewPages
    .map((page) => page.mathpixMarkdown ?? page.fullText ?? page.textPreview)
    .filter(Boolean)
    .join("\n\n");
  const hasMultiplePages = previewPages.length > 1 || (fullText && fullText.length > 200);
  const printedPage = previewPage ? getPrintedPageView(previewPage) : null;
  const selectedTitle =
    selectedSourceDocument?.title ??
    selectedSourceDocument?.file.originalName ??
    "Tài liệu nguồn";
  const rangeWarning =
    pageLimit && pageEndNumber !== null && pageEndNumber > pageLimit
      ? `Tài liệu chỉ có ${pageLimit} trang.`
      : null;

  const lessonTitle = form.watch("title") ?? "";
  
  const suggestedPages = useMemo(() => {
    if (!lessonTitle.trim() || !pages || pages.length === 0) return [];
    
    const normalizedTitle = lessonTitle.trim().toLowerCase();
    
    // Extract core title (e.g. "Bài 1: Tỉ lệ thức" -> "tỉ lệ thức")
    let searchStr = normalizedTitle.replace(/^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+\d+[:\-\.]?\s*/, "").trim();
    if (!searchStr || searchStr.length < 3) {
      // Fallback if there's no core title or it's too short, strip trailing punctuations
      searchStr = normalizedTitle.replace(/[:\-\.]\s*$/, "");
    }

    const normalizeText = (t: string) => t
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const normSearchStr = normalizeText(searchStr);
    if (!normSearchStr) return [];

    // Strip LaTeX/Mathpix markdown commands so that command names like "section",
    // "begin", "textbf" etc. don't interfere with text search.
    // e.g. \section{Bài}\n\section{37 HÌNH...} → "{Bài}\n{37 HÌNH...}"
    // After normalizeText: "bai 37 hinh..." (contiguous, searchable)
    const stripLatex = (t: string) => t.replace(/\\[a-zA-Z]+\*?/g, " ");

    const getSearchText = (page: NonNullable<typeof pages[0]>) => {
      const raw = page.fullText ?? page.textPreview ?? page.mathpixMarkdown ?? "";
      return stripLatex(raw).toLowerCase();
    };

    const matchedPages: (NonNullable<typeof pages[0]> & { index: number })[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page) continue;
      const text = getSearchText(page);
      
      const isTocPage = 
        /m[uụú]c\s*l[uụú][cg]/i.test(text) || 
        (text.match(/\.{4,}/g) ?? []).length > 4 ||
        (text.match(/(bài|chương|chủ đề|phần)\s+\d+/gi) ?? []).length > 6;
        
      if (isTocPage) continue;

      if (normalizeText(text).includes(normSearchStr)) {
        matchedPages.push({ ...page, index: i });
      }
    }

    if (matchedPages.length === 0) return [];

    let nextLessonStr = "";
    const prefixMatch = normalizedTitle.match(/^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+(\d+)[:\-\.]?\s*/);
    if (prefixMatch && prefixMatch[1] && prefixMatch[2]) {
      nextLessonStr = normalizeText(`${prefixMatch[1]} ${parseInt(prefixMatch[2], 10) + 1}`);
    }
    const stopKeywords = [
      nextLessonStr,
      "luyen tap",
      "luyen tap chung",
      "bai tap cuoi chuong",
      "on tap chuong"
    ].filter(Boolean);

    const validMatchedPages: typeof matchedPages = [];
    for (let i = 0; i < matchedPages.length; i++) {
       const p = matchedPages[i]!;
       if (i > 0) {
          const text = normalizeText(getSearchText(p));
          const isStop = stopKeywords.some(k => text.includes(k));
          if (isStop) {
             break; // Dừng việc gộp trang nếu gặp trang của bài học tiếp theo hoặc phần ôn tập
          }
       }
       validMatchedPages.push(p);
    }

    if (validMatchedPages.length === 0) return [];

    const resolveRange = (range: typeof validMatchedPages) => {
       const firstMatch = range[0]!;
       let lastMatch = range[range.length - 1]!;
       
       // Quét tiến để đoán điểm kết thúc nếu chỉ tìm thấy trang bắt đầu (như khi gõ "Bài 20:")
       if (nextLessonStr) {
          const startIdx = firstMatch.index;
          const endIdx = lastMatch.index;
          const maxScan = Math.min(endIdx + 15, pages.length);
          let foundStop = false;
          let stopIdx = endIdx;
          
          for (let j = endIdx + 1; j < maxScan; j++) {
             const scanPage = pages[j];
             if (!scanPage) continue;
             const t = normalizeText(getSearchText(scanPage));
             if (stopKeywords.some(k => t.includes(k))) {
                foundStop = true;
                stopIdx = j - 1;
                break;
             }
          }
          // Chỉ mở rộng range nếu tìm thấy chính xác điểm dừng
          if (foundStop && stopIdx > endIdx) {
              lastMatch = { ...pages[stopIdx]!, index: stopIdx };
          }
       }
       
       const startPrinted = getPrintedPageView(firstMatch);
       const endPrinted = getPrintedPageView(lastMatch);
       const startStr = startPrinted.printedPageLabel ?? startPrinted.printedPageNumber?.toString() ?? firstMatch.pageNumber.toString();
       const endStr = endPrinted.printedPageLabel ?? endPrinted.printedPageNumber?.toString() ?? lastMatch.pageNumber.toString();
       
       return {
         start: startStr,
         end: endStr,
         label: startStr === endStr ? `Trang ${startStr}` : `Trang ${startStr} - ${endStr}`
       };
    };

    const ranges: { start: string; end: string; label: string }[] = [];
    let currentRange: typeof validMatchedPages = [validMatchedPages[0]!];

    for (let i = 1; i < validMatchedPages.length; i++) {
      const prev = currentRange[currentRange.length - 1]!;
      const curr = validMatchedPages[i]!;
      if (curr.index === prev.index + 1) {
        currentRange.push(curr);
      } else {
        ranges.push(resolveRange(currentRange));
        currentRange = [curr];
      }
    }
    ranges.push(resolveRange(currentRange));

    // Trả về duy nhất 1 gợi ý (khoảng trang đầu tiên khớp và đã được gộp liên tiếp)
    // vì người dùng muốn khi gõ tên bài học chính xác thì chỉ hiện 1 khoảng trang chính xác nhất
    return [ranges[0]!];
  }, [lessonTitle, pages]);

  const isRangeInputDisabled = disabled || isSaving || !isRangeReady;
  const isSourceSelectDisabled = disabled || isSaving;

  return (
    <section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3">
      <div className="flex items-start gap-3">
        <span className="theme-button-primary-subtle mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FieldLabel id="admin-lesson-source-range" label="Khoảng trang" isOptional />
            {suggestedPages.length > 0 ? (
              <span className="flex items-center gap-1 text-xs text-[var(--theme-text-muted)]">
                (Gợi ý: 
                {suggestedPages.map((range, idx) => (
                  <span key={idx}>
                    <button
                      type="button"
                      onClick={() => {
                        form.setValue("sourceDocumentPageRange.pageStart", range.start, {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        if (range.start !== range.end) {
                          form.setValue("sourceDocumentPageRange.pageEnd", range.end, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                        }
                      }}
                      className="font-bold text-[var(--theme-primary)] hover:underline"
                    >
                      {range.label}
                    </button>
                    {idx < suggestedPages.length - 1 ? ", " : ""}
                  </span>
                ))}
                )
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold leading-5 text-[var(--theme-text-muted)]">
            Bỏ trống nếu chỉ tạo thông tin buổi học.
          </p>
        </div>
      </div>

      {sourceDocuments.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-3 py-4 text-sm font-semibold text-[var(--theme-text-muted)]">
          Chưa có tài liệu nguồn.
        </div>
      ) : (
        <div className="mt-3 grid gap-3">
          {!isRangeReady ? (
            <p className="rounded-lg border border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--theme-warning-text)]">
              {rangeDisabledReason}
            </p>
          ) : null}
          <OptionField
            id="admin-lesson-source-document"
            label="Tài liệu nguồn"
            value={sourceDocumentId || selectedSourceDocument?.id || ""}
            disabled={isSourceSelectDisabled}
            icon={<Layers3 className="h-5 w-5" aria-hidden="true" />}
            options={sourceDocuments.map((document) => ({
              value: document.id,
              label: document.title ?? document.file.originalName,
            }))}
            error={form.formState.errors.sourceDocumentPageRange?.sourceDocumentId}
            onChange={(value) => {
              form.setValue("sourceDocumentPageRange.sourceDocumentId", value, {
                shouldDirty: true,
                shouldValidate: true,
              });
              onSelectSourceDocument(value || null);
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id="admin-lesson-page-start"
              label="Từ trang"
              inputMode="text"
              disabled={isRangeInputDisabled}
              icon={null}
              error={form.formState.errors.sourceDocumentPageRange?.pageStart}
              {...form.register("sourceDocumentPageRange.pageStart")}
            />
            <TextField
              id="admin-lesson-page-end"
              label="Đến trang"
              inputMode="text"
              disabled={isRangeInputDisabled}
              icon={null}
              error={form.formState.errors.sourceDocumentPageRange?.pageEnd}
              {...form.register("sourceDocumentPageRange.pageEnd")}
            />
          </div>

          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-3 transition-all">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
                Xem nhanh
              </p>
              {hasMultiplePages && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold text-[var(--theme-primary)] hover:bg-[var(--theme-surface-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]"
                >
                  {isExpanded ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" />
                      Thu gọn
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      Mở rộng
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="mt-1 text-sm font-extrabold text-[var(--theme-primary)]">
                {selectedTitle}
              </p>
              {previewPages.length > 0 && (
                <div className="flex rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)]">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("ocr")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-l-md transition-colors ${
                      previewMode === "ocr"
                        ? "bg-[var(--theme-primary)] text-white"
                        : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
                    }`}
                  >
                    Nội dung OCR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("pdf")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-r-md transition-colors ${
                      previewMode === "pdf"
                        ? "bg-[var(--theme-primary)] text-white"
                        : "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-soft)]"
                    }`}
                  >
                    PDF gốc
                  </button>
                </div>
              )}
            </div>
            <div
              className={`mt-2 w-full max-w-3xl text-sm font-semibold leading-5 text-[var(--theme-text)] transition-all ${
                isExpanded
                  ? "max-h-[500px] overflow-y-auto whitespace-normal rounded-md border border-[var(--theme-border)] bg-white p-3 sm:p-6 lg:p-8 shadow-sm"
                  : "max-h-[60px] overflow-hidden relative"
              }`}
            >
              {previewPages.length > 0 ? (
                isExpanded ? (
                  <div className="flex flex-col gap-4">
                    {previewPages.map((page, index) => {
                      const text = page.mathpixMarkdown ?? page.fullText ?? page.textPreview;
                      const printed = getPrintedPageView(page);
                      return (
                        <div key={page.id} className={index > 0 ? "border-t border-[var(--theme-border-strong)] pt-4" : ""}>
                          <div className="mb-2 text-xs font-bold text-[var(--theme-text-muted)]">
                            Trang PDF {page.pageNumber} {printed.printedPageLabel ? `(Trang in: ${printed.printedPageLabel})` : ""}
                          </div>
                          {previewMode === "ocr" ? (
                            text ? <MathpixMarkdownRenderer content={text} /> : <p className="italic text-[var(--theme-text-muted)]">Không có nội dung OCR</p>
                          ) : (
                            <div className="flex justify-center border border-[var(--theme-border)] rounded-md overflow-hidden bg-[var(--theme-surface-soft)]">
                              {selectedSourceDocument?.file?.publicUrl ? (
                                <PdfPagePreview pdfUrl={selectedSourceDocument.file.publicUrl} pageNumber={page.pageNumber} width={650} />
                              ) : (
                                <p className="p-4 italic text-[var(--theme-text-muted)]">Không tìm thấy file PDF</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  previewMode === "ocr" ? (
                    <MathpixMarkdownRenderer content={fullText} />
                  ) : (
                    <div className="pointer-events-none py-2 opacity-50 flex items-center gap-2 italic text-[var(--theme-text-muted)]">
                      <span>Mở rộng để xem bản PDF chi tiết</span>
                    </div>
                  )
                )
              ) : (
                <p>
                  {printedPage
                    ? `Trang in ${printedPage.printedPageLabel ?? printedPage.printedPageNumber ?? "chưa rõ"}`
                    : "Nhập trang bắt đầu để xem nhanh."}
                </p>
              )}
              {!isExpanded && fullText && previewMode === "ocr" && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[var(--theme-surface)] to-transparent" />
              )}
            </div>
            {rangeWarning ? (
              <p className="mt-2 text-sm font-bold text-[var(--theme-danger)]">
                {rangeWarning}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
