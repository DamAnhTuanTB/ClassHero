import { STEM_FIGURE_TOOLBOX_MANIFEST } from "@learning-path/shared";

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

export function buildLessonSummarySubjectProfile(subject: LessonSummarySubjectSnapshot) {
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
        "- Quyết định figure theo quan hệ hình nguồn–block trong quy tắc hệ thống; không ép mọi block có hình chỉ vì bài được gọi là Hình học.",
        "- Với hình học, kiểm tra đầy đủ các đối tượng và quan hệ cần thiết theo đề và hình nguồn; không dùng ngữ nghĩa để tự thêm dấu hiệu trình bày không quan sát được.",
        "- Trong text ngoài hình, ký hiệu góc dùng ba tên điểm với đỉnh ở giữa và số đo độ dùng LaTeX chuẩn.",
        "- Bài Số học/Đại số trình bày trực tiếp phép tính và chuỗi biến đổi. Bài chứng minh/dựng hình phải có mạch suy luận liên kết, nêu rõ căn cứ và kết luận; không biến toàn bộ lời giải thành checklist.",
        "- Mọi bài Hình học lớp 7–9 bắt buộc có `geometryStatement` khác null và đây là nơi duy nhất chứa bảng GT–KL. Hình học lớp 10–12 và mọi bài không phải Hình học bắt buộc trả `geometryStatement=null`; không chép bảng này vào solution.",
      ].join("\n");
    case "PHYSICS":
      return [
        ...heading,
        "- Quyết định figure theo quan hệ hình nguồn–block trong quy tắc hệ thống; không tạo hình trang trí chỉ vì tên chủ đề.",
        "- Kiểm tra chặt chẽ đại lượng, đơn vị SI, chiều vector, dấu, mốc quy chiếu và quy ước của hiện tượng trong bài.",
        "- Sơ đồ mạch phải đúng nút nối, cực, chiều dòng điện và kí hiệu linh kiện; hình cơ học/quang học phải đúng phương, chiều, tia và tỉ lệ mang ý nghĩa vật lý.",
      ].join("\n");
    case "CHEMISTRY":
      return [
        ...heading,
        "- Quyết định figure theo quan hệ hình nguồn–block trong quy tắc hệ thống; không tạo hình trang trí chỉ vì tên chủ đề.",
        "- Kiểm tra chặt chẽ công thức chất, hóa trị, hệ số, điện tích, trạng thái, điều kiện phản ứng và bảo toàn nguyên tố theo dữ liệu nguồn.",
        "- Phương trình, kí hiệu và công thức cấu tạo phải đúng quy ước Hóa học; nếu cần figure sơ đồ thí nghiệm thì phải giữ đúng dụng cụ, chất và chiều diễn biến quan sát được trong nguồn.",
      ].join("\n");
    case "GENERAL":
      return [
        ...heading,
        "- Quyết định figure theo quan hệ hình nguồn–block trong quy tắc hệ thống; không tạo hình trang trí chỉ vì tên chủ đề.",
        "- Chưa có profile chuyên môn riêng cho domain này; không tự suy diễn quy ước ngoài nguồn.",
      ].join("\n");
  }
}

export function buildStemFigureRepairSubjectProfile(
  subject: LessonSummarySubjectSnapshot,
) {
  return [
    buildStemFigureGenerationSubjectProfile(subject),
    "- Khi sửa hình, chỉ sửa lỗi compile/validator được cung cấp và giữ nguyên ý nghĩa chuyên môn của hình.",
  ].join("\n");
}

export function buildStemFigureGenerationSubjectProfile(
  subject: LessonSummarySubjectSnapshot,
) {
  const heading = [
    "### HỒ SƠ MÔN HỌC VÀ TOOLBOX",
    `- Môn học cố định: ${subject.name}.`,
    buildStemFigureSnippetContract(subject.key),
  ];
  switch (subject.key) {
    case "MATH":
      return heading.join("\n");
    case "PHYSICS":
      return [
        ...heading,
        "- Giữ đúng đơn vị, chiều vector, nút nối/cực mạch điện, tia sáng, mốc quy chiếu và quy ước vật lý.",
      ].join("\n");
    case "CHEMISTRY":
      return [
        ...heading,
        "- Giữ đúng công thức, hóa trị, điện tích, hệ số, trạng thái, điều kiện phản ứng và bố trí thí nghiệm.",
      ].join("\n");
    case "GENERAL":
      return [...heading, "- Không tự suy diễn quy ước chuyên môn ngoài brief."].join(
        "\n",
      );
  }
}

function buildStemFigureSnippetContract(subjectKey: LessonSummarySubjectKey) {
  const profile = STEM_FIGURE_TOOLBOX_MANIFEST.subjects[subjectKey];
  return [
    `- Renderer đã cài package: ${profile.packages.map(({ name, options }) => (options ? `${name}[${options}]` : name)).join(", ")}.`,
    `- TikZ library được phép chọn trong local header: ${profile.tikzLibraries.join(", ") || "không có"}.`,
    `- PGFPlots library được phép chọn trong local header: ${profile.pgfplotsLibraries.join(", ") || "không có"}.`,
    `- Local header chỉ được dùng: ${profile.headerCommands.map((command) => `\\${command}`).join(", ")}.`,
    `- Sau local header phải có đúng một root: ${profile.rootEnvironments.join(" hoặc ")}. axis chỉ được nằm bên trong tikzpicture.`,
  ].join("\n");
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
        "- Với chứng minh hình học lớp 7–9, example.geometryStatement phải có GT và KL; trường hợp khác để null.",
        "- Chuẩn hóa kí hiệu góc theo ba điểm với đỉnh ở giữa, ví dụ ∠ABC có đỉnh B.",
      ].join("\n");
    case "PHYSICS":
      return [
        ...heading,
        "- Kiểm tra chặt chẽ đại lượng, đơn vị SI, chiều vector, dấu, mốc quy chiếu và quy ước của hiện tượng trong bài.",
      ].join("\n");
    case "CHEMISTRY":
      return [
        ...heading,
        "- Kiểm tra chặt chẽ công thức chất, hóa trị, hệ số, điện tích, trạng thái, điều kiện phản ứng và bảo toàn nguyên tố theo dữ liệu nguồn.",
      ].join("\n");
    case "GENERAL":
      return [
        ...heading,
        "- Chưa có profile chuyên môn riêng cho domain này; không tự suy diễn quy ước chuyên môn ngoài nguồn.",
      ].join("\n");
  }
}
