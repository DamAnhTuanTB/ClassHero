import { z } from "zod";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizSubjectProfile } from "#api/modules/quiz/utils/quiz-subject";

export const QUIZ_FIGURE_PROMPT_VERSION = "quiz-figure-prompt-v13";
export const QUIZ_FIGURE_SCHEMA_VERSION = "quiz-figure-schema-v4";
export const QUIZ_FIGURE_EXTENSION_MARKER = "% QUIZ_SOLUTION_EXTENSION";

export const quizFigureLatexSourceSchema = z
  .string()
  .trim()
  .min(20)
  .max(50_000)
  .refine(
    (source) => /\\begin\s*\{\s*(?:tikzpicture|circuitikz)\s*\}/u.test(source),
    "latexSource phải chứa một root tikzpicture hoặc circuitikz.",
  );

export const quizFigureSemanticCheckSchema = z
  .object({
    fact: z.string().trim().min(1).max(500),
    latexEvidence: z.string().trim().min(1).max(500),
  })
  .strict();

export const quizFigureSemanticChecksSchema = z
  .array(quizFigureSemanticCheckSchema)
  .min(1)
  .max(40);

export const quizFigureReadabilityCheckSchema = z
  .object({
    element: z.string().trim().min(1).max(300),
    placement: z.string().trim().min(1).max(300),
    clearance: z.string().trim().min(1).max(300),
  })
  .strict();

export const quizFigureReadabilityChecksSchema = z
  .array(quizFigureReadabilityCheckSchema)
  .min(1)
  .max(60);

export const generatedQuizQuestionFigureSchema = z
  .object({
    semanticChecks: quizFigureSemanticChecksSchema,
    readabilityChecks: quizFigureReadabilityChecksSchema,
    latexSource: quizFigureLatexSourceSchema,
  })
  .strict();

export const generatedQuizSolutionExtensionSchema = z
  .object({
    extensionPlan: z
      .object({
        addedObjects: quizFigureSemanticChecksSchema,
        clarifiedRelations: quizFigureSemanticChecksSchema,
      })
      .strict(),
    readabilityChecks: quizFigureReadabilityChecksSchema,
    extensionLatex: z.string().trim().min(1).max(20_000),
  })
  .strict();

export type QuizFigurePlan = {
  version: 1;
  role: "QUESTION" | "SOLUTION";
  problem: string;
  solution?: string;
  mode?: "EXTEND_QUESTION";
  addedObjects?: string[];
  clarifiedRelations?: string[];
  caption: string | null;
};

export function buildQuestionFigureInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizFigurePlan;
}): AiStructuredInput {
  return {
    systemPrompt: [
      "Bạn tạo mã TeX/TikZ cho hình minh họa đề Quiz tiếng Việt.",
      buildQuizSubjectProfile(input.subject),
      buildQuizFigureVisualGrammar(input.subject),
      "Chỉ trả structured output chứa semanticChecks, readabilityChecks và latexSource.",
      "semanticChecks phải liệt kê từng đối tượng, quan hệ hoặc chú thích mang nghĩa mà problem/caption đòi hỏi; mỗi phần tử gồm fact và latexEvidence trỏ ngắn gọn tới tọa độ hoặc lệnh thực sự biểu diễn fact đó trong latexSource. Hoàn thiện source trước khi khai báo evidence; không ghi một fact nếu source chưa thực sự biểu diễn.",
      "readabilityChecks phải kiểm kê từng nhãn, số đo và ký hiệu nhìn thấy; mỗi phần tử nêu element, placement và clearance với nhãn/nét/ký hiệu gần nhất. Điều chỉnh tọa độ hoặc anchor trước khi khai báo clearance; không tuyên bố rõ nếu hai phần tử còn chồng, chạm hoặc khó phân biệt.",
      "latexSource là figure snippet, không có documentclass, usepackage hay document wrapper.",
      "Chỉ dùng TikZ/circuitikz và các lệnh TeX an toàn; không dùng ảnh, file, URL, raw SVG, shell escape, input/include hoặc directlua.",
      "Hình đề chỉ được thể hiện dữ kiện đã có trong problem và caption; tuyệt đối không chứa đáp án, lời giải, gợi ý, phương án đúng, điểm phụ hay đường dựng chỉ xuất hiện trong lời giải.",
      "Hình phải đúng chuyên môn bằng chính phép dựng: mọi đối tượng, quan hệ, ký hiệu và chú thích mang nghĩa phải nhất quán với problem/caption, gắn đúng đối tượng và không tạo ra cách hiểu sai hoặc mơ hồ.",
      "Chọn tập đối tượng và quan hệ tối thiểu nhưng đủ cho một thông điệp thị giác chính; không tự phát minh dữ kiện và không thêm chi tiết không giúp hiểu câu hỏi.",
      "Trước khi trả kết quả, đối chiếu lại từng nét mang nghĩa với problem/caption: không thiếu hoặc thừa nét, nối sai, gắn sai nhãn hay biểu diễn làm đổi quan hệ. Dùng bố cục sách giáo khoa thoáng, ít màu, nét rõ; chọn cấu hình không suy biến để các điểm đặc biệt và ký hiệu quan hệ độc lập không chồng, chạm hoặc tụ sát gây nhập nhằng; không để nhãn bị cắt.",
      `Đặt nguyên dòng ${QUIZ_FIGURE_EXTENSION_MARKER} ngay trước \\end{tikzpicture} hoặc \\end{circuitikz}; đây là điểm chèn phần mở rộng lời giải.`,
      "Hình phải dễ đọc trên nền trắng và không được là bản sao ảnh sách giáo khoa.",
    ].join("\n"),
    userPrompt: JSON.stringify({
      role: "QUESTION",
      problem: input.plan.problem,
      caption: input.plan.caption,
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "quiz_question_figure",
    promptVersion: QUIZ_FIGURE_PROMPT_VERSION,
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
  };
}

export function buildSolutionFigureExtensionInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizFigurePlan;
  exactQuestionLatexSource: string;
}): AiStructuredInput {
  return {
    systemPrompt: [
      "Bạn bổ sung nét dựng cho hình lời giải Quiz trên đúng hình đề hiện có.",
      buildQuizSubjectProfile(input.subject),
      buildQuizFigureVisualGrammar(input.subject),
      "Chỉ trả structured output chứa extensionPlan, readabilityChecks và extensionLatex; extensionLatex là các lệnh TikZ cần chèn tại marker, không trả lại toàn bộ hình.",
      "extensionPlan.addedObjects liệt kê các đối tượng phụ thiết yếu được solution dùng nhưng chưa có trong hình đề; extensionPlan.clarifiedRelations liệt kê các quan hệ trung gian hoặc kết luận mà hình lời giải làm rõ. Cả hai mảng bắt buộc có ít nhất một phần tử và mỗi phần tử phải có fact cùng latexEvidence trỏ tới lệnh thực sự trong extensionLatex.",
      "extensionPlan phải bao phủ từng mục trong requiredAddedObjects và requiredClarifiedRelations của user input; không được đổi, bỏ hoặc dùng một nhóm để thay cho nhóm còn lại.",
      "readabilityChecks phải kiểm kê từng nhãn, số đo và ký hiệu của toàn bộ hình sau khi chèn, kể cả phần nền; mỗi phần tử nêu element, placement và clearance với phần tử gần nhất. Điều chỉnh phần chèn để không che hoặc tụ sát nội dung nền trước khi khai báo clearance.",
      "Chỉ thêm nội dung trực quan thực sự được mô tả trong solution và cần thiết để làm rõ mạch giải.",
      "Không xóa, đổi tên, dịch chuyển hoặc vẽ lại bất kỳ phần nào của hình đề. Không tạo root environment mới.",
      "Toàn bộ hình sau khi bổ sung phải đúng chuyên môn bằng chính phép dựng; mọi quan hệ, ký hiệu và chú thích phải nhất quán, gắn đúng đối tượng và không tạo ra cách hiểu sai hoặc mơ hồ.",
      "Trước khi trả kết quả, đối chiếu toàn bộ hình sau chèn với problem/solution: dùng ít nét nhất nhưng không thiếu hoặc thừa nét, nối sai, gắn sai nhãn hay biểu diễn làm đổi quan hệ; giữ bố cục thoáng, thứ bậc hình đề và khả năng đọc của mọi nhãn.",
      "Không dùng ảnh, file, URL, raw SVG, shell escape, input/include hoặc directlua.",
    ].join("\n"),
    userPrompt: JSON.stringify({
      role: "SOLUTION",
      mode: "EXTEND_QUESTION",
      problem: input.plan.problem,
      solution: input.plan.solution,
      requiredAddedObjects: input.plan.addedObjects,
      requiredClarifiedRelations: input.plan.clarifiedRelations,
      exactQuestionLatexSource: input.exactQuestionLatexSource,
      insertionMarker: QUIZ_FIGURE_EXTENSION_MARKER,
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 8_000,
    outputName: "quiz_solution_figure_extension",
    promptVersion: QUIZ_FIGURE_PROMPT_VERSION,
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
  };
}

function buildQuizFigureVisualGrammar(subject: QuizSubjectSnapshot) {
  switch (subject.key.trim().toUpperCase()) {
    case "MATH":
      return [
        "Ngữ pháp hình Toán: quan hệ đã nêu và cần đọc trên hình phải được dựng đúng đồng thời có ký hiệu chuẩn, nhưng không ký hiệu kết luận học sinh cần tìm.",
        "Vuông góc dùng dấu góc vuông; trung điểm dùng cùng kiểu vạch trên hai nửa; đường trung trực phải có cả hai dấu hiệu; các đoạn bằng nhau dùng cùng kiểu vạch; các đường song song dùng cùng kiểu mũi tên; phân giác dùng hai cung góc tương ứng bằng nhau. Không dùng một ký hiệu để ám chỉ quan hệ khác.",
        "Ưu tiên ký hiệu tối giản: không lặp marker cho quan hệ đã rõ bằng phép dựng chuẩn nếu việc lặp làm rối, và phải chọn các họ ký hiệu phân biệt nhưng dễ đọc khi hình có nhiều nhóm quan hệ.",
      ].join("\n");
    case "PHYSICS":
      return "Ngữ pháp hình Lý: vector phải có đúng gốc, hướng và nhãn; lực gắn đúng vật/điểm đặt; đồ thị phải có trục, chiều, đại lượng và đơn vị cần thiết; sơ đồ mạch phải dùng ký hiệu chuẩn, đúng nút nối và cực tính. Không thêm chiều, số đo hoặc quan hệ chưa được cho.";
    case "CHEMISTRY":
      return "Ngữ pháp hình Hóa: công thức cấu tạo phải đúng liên kết, hóa trị và điện tích; sơ đồ thí nghiệm phải đúng dụng cụ, chất, chiều truyền và điểm nối; đồ thị phải có trục, đại lượng và đơn vị cần thiết. Không dùng trang trí để thay cho ký hiệu chuyên môn hoặc thêm trạng thái/điều kiện chưa được cho.";
    default:
      return "Mọi ký hiệu chuyên môn phải theo quy ước chuẩn của môn học và biểu diễn đúng quan hệ đã nêu, không được dùng nét trang trí thay cho dữ kiện.";
  }
}
