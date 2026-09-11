export type LessonSummaryReviewCopy = {
  message: string;
  suggestion: string;
};

const DIFFICULT_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/sourceTopicId/giu, "mã chủ đề nguồn"],
  [/sourceChunkIds/giu, "nguồn tham chiếu"],
  [/displayHeading/giu, "tên đề mục"],
  [/geometryStatement/giu, "bảng giả thiết–kết luận"],
  [/figureId/giu, "mã hình minh họa"],
  [/latexSource/giu, "mã TeX"],
  [/\bbackend\b/giu, "hệ thống"],
  [/\badmin\b/giu, "quản trị viên"],
  [/\boutput\b/giu, "nội dung tạo ra"],
  [/\bsection\b/giu, "đề mục"],
  [/\bheading\b/giu, "tiêu đề"],
  [/\btitle\b/giu, "tiêu đề"],
  [/\bcontent\b/giu, "nội dung"],
  [/\bproblem\b/giu, "đề bài"],
  [/\bsolution\b/giu, "lời giải"],
  [/\banswer\b/giu, "đáp án"],
  [/\bsteps\b/giu, "các bước thực hiện"],
  [/\bobjectives\b/giu, "kiến thức trọng tâm"],
  [/\bvisual\b/giu, "hình minh họa"],
  [/\btype\b/giu, "loại dữ liệu"],
  [/\binvalid\b/giu, "chưa hợp lệ"],
  [/\bnull\b/giu, "để trống"],
  [/\bJSON\b/gu, "dữ liệu"],
  [/\bID\b/gu, "mã"],
  [/\bfield\b/giu, "phần dữ liệu"],
  [/\bcontext\b/giu, "tài liệu nguồn"],
];

export function simplifyLessonSummaryReviewCopy(
  copy: LessonSummaryReviewCopy,
): LessonSummaryReviewCopy {
  return {
    message: simplifyReviewText(copy.message),
    suggestion: simplifyReviewText(copy.suggestion),
  };
}

function simplifyReviewText(value: string) {
  let result = value;
  for (const [pattern, replacement] of DIFFICULT_TERM_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s{2,}/gu, " ").trim();
}
