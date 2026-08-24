import type {
  QuizSubjectKey,
  QuizSubjectSnapshot,
} from "#api/modules/quiz/types/quiz-generation.types";

const SUBJECT_KEYS_BY_ALIAS: Record<string, QuizSubjectKey> = {
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

export function resolveQuizSubject(input: {
  domainName: string;
  domainSlug: string;
}): QuizSubjectSnapshot {
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

export function buildQuizSubjectProfile(subject: QuizSubjectSnapshot) {
  const heading = [
    "### HỒ SƠ MÔN HỌC BẮT BUỘC CỦA QUIZ",
    `- Môn học cố định của Quiz: ${subject.name}.`,
    "- Chỉ dùng kiến thức, thuật ngữ và quy ước thuộc môn này; không đưa nội dung của môn khác vào câu hỏi nếu PDF nguồn có dữ liệu lạc môn.",
  ];
  switch (subject.key) {
    case "MATH":
      return [
        ...heading,
        "- Kiểm tra giả thiết, phép biến đổi, điều kiện xác định, kí hiệu và kết luận toán học.",
        "- Trong mỗi `explanation`, tự xác định `isGeometry`: đặt `true` cho câu Hình học và `false` cho câu không phải Hình học. Quiz không trả bảng giả thiết–kết luận; hãy dùng trực tiếp các dữ kiện đề bài trong mạch lời giải.",
        "- `isGeometry` không tự động đồng nghĩa với có hình, nhưng phải được dùng làm tín hiệu khi quyết định hình. Nếu `isGeometry=true` và câu có cấu hình cụ thể gồm các đối tượng hoặc quan hệ vị trí tham gia mạch giải, mặc định phải tạo `questionFigure`; chỉ bỏ hình cho câu định nghĩa, công thức hoặc tính chất tổng quát không phụ thuộc cấu hình.",
        "- Câu Đại số vẫn phải tạo `questionFigure` khi đồ thị hàm số, hệ trục tọa độ, đường số, miền nghiệm, bảng biến thiên, bảng xét dấu, bảng dữ liệu, biểu đồ hoặc sơ đồ là đối tượng học sinh phải đọc, dựng, so sánh hay dùng để suy luận; các câu này giữ `isGeometry=false` nếu không thuộc Hình học.",
        "- Ký hiệu góc theo cách viết SGK phải dùng dấu mũ trên ba chữ cái và chữ chỉ đỉnh bắt buộc đứng ở vị trí thứ hai. Ví dụ, góc có đỉnh B với hai cạnh BA và BC phải viết là $\\widehat{ABC}$ hoặc $\\widehat{CBA}$; không dùng ký hiệu ∠ABC và không viết $\\widehat{BAC}$ vì biểu thức sau có đỉnh A.",
        "- Bài Số học hoặc Đại số phải trình bày trực tiếp phép tính và chuỗi biến đổi. Bài chứng minh hoặc dựng hình phải có mạch suy luận liên kết, nêu rõ căn cứ và kết luận; không biến toàn bộ lời giải thành danh sách bước rời rạc.",
        "- Nếu có hình, mọi điểm, đường và quan hệ trên hình phải được nêu trong `problem` hoặc `solution` tương ứng; hình không được bổ sung dữ kiện toán học mới.",
      ].join("\n");
    case "PHYSICS":
      return [
        ...heading,
        "- Kiểm tra đại lượng, đơn vị SI, chiều vector, dấu, mốc quy chiếu và quy ước vật lý.",
        "- Với bài tính, `solution` phải ghi rõ công thức, bước đổi đơn vị nếu cần, bước thế số, phép tính và kết luận; kết quả phải kèm đơn vị khi đại lượng có đơn vị.",
        "- Hình mạch điện, cơ học hoặc quang học chỉ minh họa dữ kiện đã mô tả bằng chữ; phải thể hiện đúng nút nối, cực, chiều vector và tia.",
      ].join("\n");
    case "CHEMISTRY":
      return [
        ...heading,
        "- Kiểm tra công thức chất, hóa trị, hệ số, điện tích, trạng thái, điều kiện phản ứng và bảo toàn nguyên tố.",
        "- `solution` phải trình bày đầy đủ các bước chuyên môn thực sự được dùng, chẳng hạn phương trình phản ứng đã cân bằng, phép tính số mol hoặc lập luận bảo toàn; không để một bước hóa học cần thiết chỉ xuất hiện trên hình.",
        "- Hình thí nghiệm hoặc công thức cấu tạo chỉ minh họa đối tượng và quan hệ đã được mô tả bằng chữ.",
      ].join("\n");
    case "GENERAL":
      return [
        ...heading,
        "- Môn này chưa có bộ quy tắc chuyên biệt; không tự suy diễn thuật ngữ hoặc quy ước ngoài PDF nguồn.",
      ].join("\n");
  }
}

/**
 * Figure Phase 2 only needs the subject rules that can change the drawing.
 * Keeping this separate prevents the much larger question/explanation profile
 * (solution formatting, unit-conversion steps, etc.) from being sent
 * again to the image-code call.
 */
export function buildQuizFigureSubjectProfile(subject: QuizSubjectSnapshot) {
  const heading = [
    "### HỒ SƠ MÔN HỌC CỦA HÌNH QUIZ",
    `- Môn học cố định: ${subject.name}.`,
    "- Chỉ dùng ký hiệu và quy ước trực quan của môn này; không đưa nội dung lạc môn vào hình.",
  ];

  switch (subject.key) {
    case "MATH":
      return [
        ...heading,
        "- Ký hiệu hình học phải gắn đúng đối tượng và đúng quan hệ; chữ giữa của ký hiệu góc ba chữ là đỉnh góc.",
        "- Hình chỉ dùng dữ kiện trong problem; caption chỉ định hướng trình bày, không bổ sung/ghi đè dữ kiện. Mở rộng lời giải chỉ thêm đối tượng/quan hệ trong solution.",
      ].join("\n");
    case "PHYSICS":
      return [
        ...heading,
        "- Giữ đúng đại lượng, đơn vị, chiều vector, điểm đặt, mốc quy chiếu, nút nối và cực tính được mô tả.",
      ].join("\n");
    case "CHEMISTRY":
      return [
        ...heading,
        "- Giữ đúng công thức, liên kết, hóa trị, điện tích, dụng cụ, chất, chiều truyền và điểm nối được mô tả.",
      ].join("\n");
    case "GENERAL":
      return [
        ...heading,
        "- Không tự suy diễn thuật ngữ, ký hiệu hoặc quy ước chuyên môn ngoài nội dung đã cung cấp.",
      ].join("\n");
  }
}

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
