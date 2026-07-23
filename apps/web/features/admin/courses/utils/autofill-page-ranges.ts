/**
 * Autofill page ranges for lessons ("Gợi ý chia trang")
 *
 * This module computes printed-page ranges for each lesson by searching
 * the OCR text of source document pages. It outputs PRINTED page numbers
 * (the numbers printed on the physical textbook), not PDF page numbers.
 *
 * Key differences from the single-lesson suggestion in lesson-source-range-section.tsx:
 * - Operates on ALL lessons at once (bulk autofill)
 * - Uses printed page numbers via getPrintedPageView()
 * - Determines end pages by scanning for next lesson headings + stop keywords
 */

import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";
import { getPrintedPageView } from "@/features/admin/courses/admin-course-documents-utils";

// ─── Helpers (identical to lesson-source-range-section.tsx) ───

/** Remove Vietnamese diacritics + đ, keep only alphanumeric, collapse whitespace */
function normalizeText(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip LaTeX/Mathpix commands so "section", "begin" etc. don't pollute search */
function stripLatex(t: string): string {
  return t.replace(/\\[a-zA-Z]+\*?/g, " ");
}

// ─── Types ───

export interface AutofillLesson {
  lessonId: string;
  title: string;
}

export interface AutofillResult {
  /** Printed page start (string for form compatibility) */
  pageStart: string;
  /** Printed page end (string for form compatibility) */
  pageEnd: string;
}

interface PageInfo {
  page: AdminSourceDocumentPageApi;
  normText: string;
  isTocPage: boolean;
  /** Printed page number (from OCR metadata), fallback to PDF pageNumber */
  printedPage: number;
}

// ─── Core logic ───

/**
 * Auto-detect printed-page ranges for a list of lessons
 * from source document pages.
 *
 * @returns Record<lessonId, { pageStart, pageEnd }> with printed page numbers
 */
export function computeAutofillRanges(
  lessons: AutofillLesson[],
  sourcePages: AdminSourceDocumentPageApi[],
  pageLimit: number,
): Record<string, AutofillResult> | null {
  if (lessons.length === 0 || sourcePages.length === 0 || !pageLimit) {
    return null;
  }

  const sortedPages = [...sourcePages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Pre-compute page info with TOC detection + printed page number
  const pageInfos: PageInfo[] = sortedPages.map((page) => {
    const raw = page.fullText ?? page.textPreview ?? page.mathpixMarkdown ?? "";
    const rawText = stripLatex(raw).toLowerCase();
    const normText = normalizeText(rawText);
    const isTocPage =
      /m[uụú]c\s*l[uụú][cg]/i.test(rawText) ||
      (rawText.match(/\.{4,}/g) ?? []).length > 4 ||
      (rawText.match(/(bài|chương|chủ đề|phần)\s+\d+/gi) ?? []).length > 6;

    // Get printed page number from OCR metadata
    const printed = getPrintedPageView(page);
    const printedPage = printed.printedPageNumber ?? page.pageNumber;

    return { page, normText, isTocPage, printedPage };
  });

  // ─── Step 1: Find start pages (printed) for each lesson ───

  const startPages: (number | null)[] = new Array(lessons.length).fill(null);

  for (let i = 0; i < lessons.length; i++) {
    const rawTitle = lessons[i]!.title.trim().toLowerCase();

    // Strategy 1: Search by lesson identifier (e.g. "bài 20") – most precise
    const prefixMatch = rawTitle.match(
      /^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+(\d+)/,
    );
    if (prefixMatch?.[1] && prefixMatch[2]) {
      const lessonIdStr = normalizeText(`${prefixMatch[1]} ${prefixMatch[2]}`);
      for (const info of pageInfos) {
        if (info.isTocPage) continue;
        if (info.normText.includes(lessonIdStr)) {
          startPages[i] = info.printedPage;
          break;
        }
      }
    }

    // Strategy 2: Fallback to core title search
    if (startPages[i] === null) {
      let coreTitle = rawTitle
        .replace(
          /^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+\d+[:.-]?\s*/,
          "",
        )
        .trim();
      if (!coreTitle || coreTitle.length < 3) {
        coreTitle = rawTitle.replace(/[:.-]\s*$/, "");
      }
      const normCoreTitle = normalizeText(coreTitle);
      if (normCoreTitle) {
        for (const info of pageInfos) {
          if (info.isTocPage) continue;
          if (info.normText.includes(normCoreTitle)) {
            startPages[i] = info.printedPage;
            break;
          }
        }
      }
    }
  }

  const foundAny = startPages.some((p) => p !== null);
  if (!foundAny) {
    return null; // Caller should handle fallback (divide evenly)
  }

  // ─── Step 2: Fill gaps for lessons that couldn't be found ───

  // Use printed pageLimit
  const printedPageLimit =
    getPrintedPageView(sortedPages[sortedPages.length - 1]!).printedPageNumber ??
    pageLimit;

  for (let i = 0; i < lessons.length; i++) {
    if (startPages[i] === null) {
      // Look for next known start
      let nextKnown = printedPageLimit;
      for (let j = i + 1; j < lessons.length; j++) {
        if (startPages[j] !== null) {
          nextKnown = startPages[j]!;
          break;
        }
      }
      const prevKnown = i > 0 ? (startPages[i - 1] ?? 1) : 1;
      startPages[i] = Math.min(nextKnown, prevKnown + 1);
    }
  }

  // ─── Step 3: Compute end pages with smart stop detection ───

  const result: Record<string, AutofillResult> = {};

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i]!;
    const pageStart = startPages[i]!;

    // Build stop keywords for this lesson
    const rawTitle = lesson.title.trim().toLowerCase();
    const pm = rawTitle.match(
      /^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+(\d+)/,
    );
    const stopStrs: string[] = ["on tap chuong"];
    if (pm?.[1] && pm[2]) {
      const nextNum = parseInt(pm[2], 10) + 1;
      stopStrs.unshift(normalizeText(`${pm[1]} ${nextNum}`));
    }

    // Determine scan limit (printed page numbers)
    let hardLimit: number;
    if (i < lessons.length - 1) {
      hardLimit = startPages[i + 1]! - 1;
    } else {
      // Last lesson: estimate max range from average span of earlier lessons
      const avgSpan = i > 0 ? Math.ceil((startPages[i]! - startPages[0]!) / i) : 10;
      hardLimit = Math.min(printedPageLimit, pageStart + Math.max(avgSpan * 2, 10));
    }

    // Scan forward from start to hardLimit
    let pageEnd = pageStart;
    for (const info of pageInfos) {
      if (info.printedPage < pageStart) continue;
      if (info.printedPage > hardLimit) break;
      if (info.isTocPage) continue;

      // Check stop conditions on pages after start
      if (info.printedPage > pageStart) {
        // Strict stop keywords (next lesson number, chapter review)
        if (stopStrs.some((s) => info.normText.includes(s))) break;
        // "Luyện tập" as a standalone heading (NOT followed by a number)
        // "Luyện tập 2" = lesson exercise → don't stop
        // "Luyện tập" alone = separate section → stop
        if (/luyen tap(?!\s*\d)/.test(info.normText.substring(0, 40))) break;
      }
      pageEnd = info.printedPage;
    }

    result[lesson.lessonId] = {
      pageEnd: String(Math.max(pageStart, pageEnd)),
      pageStart: String(pageStart),
    };
  }

  return result;
}
