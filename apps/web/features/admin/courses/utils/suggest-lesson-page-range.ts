import { getPrintedPageView } from "@/features/admin/courses/admin-course-documents-utils";
import type { AdminSourceDocumentPageApi } from "@/features/admin/courses/types/admin-course-document-types";

export type SuggestedLessonPageRange = {
  start: string;
  end: string;
  label: string;
};

export function suggestLessonPageRange(
  lessonTitle: string,
  pages: AdminSourceDocumentPageApi[],
): SuggestedLessonPageRange | null {
  if (!lessonTitle.trim() || pages.length === 0) {
    return null;
  }

  const normalizedTitle = lessonTitle.trim().toLowerCase();
  let searchText = normalizedTitle
    .replace(/^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+\d+[:.-]?\s*/, "")
    .trim();

  if (searchText.length < 3) {
    searchText = normalizedTitle.replace(/[:.-]\s*$/, "");
  }

  const normalizedSearchText = normalizeSearchText(searchText);
  if (!normalizedSearchText) {
    return null;
  }

  const orderedPages = [...pages].sort(
    (left, right) => left.pageNumber - right.pageNumber,
  );
  const matchedPages: Array<{
    index: number;
    page: AdminSourceDocumentPageApi;
  }> = [];

  for (const [index, page] of orderedPages.entries()) {
    const content = getSearchablePageText(page);
    if (isTableOfContentsPage(content)) {
      continue;
    }

    if (normalizeSearchText(content).includes(normalizedSearchText)) {
      matchedPages.push({ index, page });
    }
  }

  if (matchedPages.length === 0) {
    return null;
  }

  const prefixMatch = normalizedTitle.match(
    /^(bài|chủ đề|tiết|phần|unit|lesson|chuyên đề|buổi)\s+(\d+)[:.-]?\s*/,
  );
  const nextLessonText =
    prefixMatch?.[1] && prefixMatch[2]
      ? normalizeSearchText(
          `${prefixMatch[1]} ${Number.parseInt(prefixMatch[2], 10) + 1}`,
        )
      : "";
  const strictStopTexts = [
    nextLessonText,
    "luyen tap chung",
    "bai tap cuoi chuong",
    "on tap chuong",
  ].filter(Boolean);

  const firstRange = [matchedPages[0]!];
  for (let index = 1; index < matchedPages.length; index += 1) {
    const previous = firstRange[firstRange.length - 1]!;
    const current = matchedPages[index]!;
    if (current.index !== previous.index + 1) {
      break;
    }
    firstRange.push(current);
  }

  const firstMatch = firstRange[0]!;
  let lastMatch = firstRange[firstRange.length - 1]!;

  if (nextLessonText) {
    const scanLimit = Math.min(lastMatch.index + 15, orderedPages.length);
    for (let pageIndex = lastMatch.index + 1; pageIndex < scanLimit; pageIndex += 1) {
      const page = orderedPages[pageIndex];
      if (!page) {
        continue;
      }

      const content = normalizeSearchText(getSearchablePageText(page));
      const hasStrictStop = strictStopTexts.some((text) => content.includes(text));
      const hasStandalonePracticeHeading = /luyen tap(?!\s*\d)/.test(
        content.slice(0, 40),
      );

      if (hasStrictStop || hasStandalonePracticeHeading) {
        const previousPage = orderedPages[pageIndex - 1];
        if (previousPage && pageIndex - 1 > lastMatch.index) {
          lastMatch = { index: pageIndex - 1, page: previousPage };
        }
        break;
      }
    }
  }

  const start = getPageDisplayValue(firstMatch.page);
  const end = getPageDisplayValue(lastMatch.page);

  return {
    start,
    end,
    label: start === end ? `Trang ${start}` : `Trang ${start} - ${end}`,
  };
}

function getSearchablePageText(page: AdminSourceDocumentPageApi) {
  const content = page.fullText ?? page.textPreview ?? page.mathpixMarkdown ?? "";
  return content.replace(/\\[a-zA-Z]+\*?/g, " ").toLowerCase();
}

function isTableOfContentsPage(content: string) {
  return (
    /m[uụú]c\s*l[uụú][cg]/i.test(content) ||
    (content.match(/\.{4,}/g) ?? []).length > 4 ||
    (content.match(/(bài|chương|chủ đề|phần)\s+\d+/gi) ?? []).length > 6
  );
}

function getPageDisplayValue(page: AdminSourceDocumentPageApi) {
  const printedPage = getPrintedPageView(page);
  return (
    printedPage.printedPageLabel ??
    printedPage.printedPageNumber?.toString() ??
    page.pageNumber.toString()
  );
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
