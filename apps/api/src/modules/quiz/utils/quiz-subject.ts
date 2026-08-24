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
        "- Trong mỗi `explanation`, tự xác định `isGeometry`. Với câu Hình học lớp 7–9, đặt `isGeometry=true` và bắt buộc có `geometryStatement`; đây là nơi duy nhất chứa bảng giả thiết–kết luận (GT–KL). `hypotheses` chỉ chứa dữ kiện đề bài cho, còn `conclusions` chỉ chứa yêu cầu cần tìm hoặc chứng minh. Khi khối lớp chưa xác định hoặc nằm ngoài lớp 7–9, câu Hình học vẫn đặt `isGeometry=true` nhưng `geometryStatement=null`. Câu không phải Hình học đặt `isGeometry=false` và `geometryStatement=null`. Không chép lại bảng GT–KL trong `solution`; hãy dùng các giả thiết trực tiếp trong mạch lời giải.",
        "- Quyết định tạo hình độc lập với `isGeometry` và `geometryStatement`; không tạo hình chỉ vì câu hỏi thuộc Hình học hoặc có bảng GT–KL.",
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
