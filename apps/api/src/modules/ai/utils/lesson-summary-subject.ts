import type {
  LessonSummarySubjectKey,
  LessonSummarySubjectSnapshot,
} from "#api/modules/ai/types/lesson-summary-subject.types";

const SUBJECT_KEYS_BY_ALIAS: Record<string, LessonSummarySubjectKey> = {
  toan: "MATH",
  "toan-hoc": "MATH",
  math: "MATH",
  mathematics: "MATH",
  ly: "PHYSICS",
  li: "PHYSICS",
  "vat-ly": "PHYSICS",
  "vat-li": "PHYSICS",
  physics: "PHYSICS",
  hoa: "CHEMISTRY",
  "hoa-hoc": "CHEMISTRY",
  chemistry: "CHEMISTRY",
};

export function resolveCourseSubject(input: {
  domainName: string;
  domainSlug: string;
}): LessonSummarySubjectSnapshot {
  const slug = input.domainSlug.trim().toLowerCase();
  const slugAlias = normalizeSubjectAlias(slug);
  const nameAlias = normalizeSubjectAlias(input.domainName);
  return {
    key:
      SUBJECT_KEYS_BY_ALIAS[slugAlias] ?? SUBJECT_KEYS_BY_ALIAS[nameAlias] ?? "GENERAL",
    name: input.domainName.trim(),
    slug,
  };
}

export const resolveLessonSummarySubject = resolveCourseSubject;

function normalizeSubjectAlias(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "");
}
export function buildLessonContentSubjectProfile(subject: LessonSummarySubjectSnapshot) {
  const heading = [
    "### HỒ SƠ MÔN HỌC BẮT BUỘC",
    `- Môn học cố định của khóa: ${subject.name}.`,
    "- Chỉ dùng kiến thức, thuật ngữ, quy ước và cách trình bày thuộc môn học này; bỏ qua dữ liệu lạc môn nếu có trong tài liệu nguồn.",
    "- Không pha thêm hướng dẫn chuyên môn của bất kỳ môn nào khác.",
  ];

  switch (subject.key) {
    case "MATH":
      return [
        ...heading,
        "- Kiểm tra chặt chẽ giả thiết, phép biến đổi, điều kiện xác định, kí hiệu và kết luận toán học.",
        "- Ưu tiên ký hiệu đúng nguồn rồi đến ký hiệu chuẩn của công thức Toán; ký hiệu phụ mới phải được gọi tên theo đại lượng/đối tượng trước khi dùng và không đổi nghĩa giữa chừng.",
        "- Khi tạo bài toán về hình chữ nhật có hai số đo cạnh khác nhau, dùng `chiều dài` cho số đo lớn hơn và `chiều rộng` cho số đo nhỏ hơn; không gọi một cạnh là `chiều cao`. Counterexample hợp lệ: vẫn dùng `chiều cao` cho đường cao, khoảng cách vuông góc, độ cao theo trục trong một mô hình hoặc kích thước của hình khối; nếu hai cạnh bằng nhau thì gọi là hình vuông thay vì cố gán một cạnh dài hơn.",
        "- Với chứng minh hình học lớp 7–9, example.geometryStatement phải có GT và KL; trường hợp khác để null.",
        "- Góc ba điểm phải viết theo quy ước SGK `$\\widehat{ABC}$` với B là đỉnh; không viết `$m\\angle ABC$`, `$\\angle ABC$` hoặc đổi ký hiệu cung thành góc.",
      ].join("\n");
    case "PHYSICS":
      return [
        ...heading,
        "- Kiểm tra chặt chẽ đại lượng, đơn vị SI, chiều vector, dấu, mốc quy chiếu và quy ước của hiện tượng trong bài.",
        "- Ưu tiên ký hiệu đúng công thức Vật lý; khi tạo ký hiệu mới phải nêu đại lượng, vật/hệ hoặc mốc/chiều liên quan và đơn vị khi cần trước lần dùng đầu tiên.",
      ].join("\n");
    case "CHEMISTRY":
      return [
        ...heading,
        "- Kiểm tra chặt chẽ công thức chất, hóa trị, hệ số, điện tích, trạng thái, điều kiện phản ứng và bảo toàn nguyên tố theo dữ liệu nguồn.",
        "- Ưu tiên ký hiệu chuẩn của công thức Hóa học; đại lượng mới phải nêu rõ chất/đối tượng, chỉ số phân biệt và đơn vị khi cần trước lần dùng đầu tiên.",
      ].join("\n");
    case "GENERAL":
      return [
        ...heading,
        "- Chưa có profile chuyên môn riêng cho domain này; không tự suy diễn quy ước chuyên môn ngoài nguồn.",
        "- Ưu tiên ký hiệu của nguồn rồi đến quy ước thông dụng của domain; mọi ký hiệu phụ mới phải được định nghĩa rõ trước khi dùng và giữ nguyên ý nghĩa.",
      ].join("\n");
  }
}
