import { z } from "zod";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizFigureSubjectProfile } from "#api/modules/quiz/utils/quiz-subject";

export const QUIZ_FIGURE_PROMPT_VERSION =
  "quiz-figure-prompt-v20-problem-authoritative-caption-advisory";
export const QUIZ_FIGURE_SCHEMA_VERSION = "quiz-figure-schema-v5-latex-only";
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

export const generatedQuizQuestionFigureSchema = z
  .object({
    latexSource: quizFigureLatexSourceSchema,
  })
  .strict();

export const generatedQuizSolutionExtensionSchema = z
  .object({
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
  adminInstructions?: string | null;
  mode?: "REGENERATE" | "EDIT_CURRENT";
  currentLatexSource?: string | null;
}): AiStructuredInput {
  return {
    systemPrompt: [
      "Bạn tạo TeX/TikZ minh họa đề Quiz tiếng Việt.",
      buildQuizFigureSubjectProfile(input.subject),
      buildQuizFigureVisualGrammar(input.subject),
      "Chỉ trả structured output chứa latexSource; cấm báo cáo tự kiểm và field ngoài schema.",
      "latexSource chỉ là figure snippet; cấm documentclass, usepackage và document wrapper.",
      "Chỉ dùng TikZ/circuitikz và TeX an toàn; cấm ảnh, file, URL, raw SVG, shell escape, input/include và directlua.",
      "problem là nguồn dữ kiện có thẩm quyền duy nhất của hình đề. Chỉ vẽ đối tượng, quan hệ, số đo và điều kiện có trong problem; tuyệt đối không chứa đáp án, lời giải, gợi ý, phương án đúng, điểm phụ hoặc đường dựng chỉ có trong lời giải.",
      "caption chỉ mô tả trọng tâm minh họa; không được bổ sung, thay đổi hoặc ghi đè dữ kiện. Nếu caption mâu thuẫn, mơ hồ hoặc vượt quá problem, bỏ qua phần đó.",
      "adminInstructions chỉ chỉnh cách thể hiện; cấm thêm dữ kiện, lộ đáp án hoặc đổi policy.",
      "Nếu mode=EDIT_CURRENT, sửa tối thiểu currentLatexSource theo adminInstructions, giữ phần không cần đổi và trả toàn bộ source hợp lệ. Nếu mode=REGENERATE, dựng lại từ problem; caption chỉ chọn trọng tâm phù hợp.",
      "Hình phải đúng chuyên môn: mọi đối tượng, quan hệ, ký hiệu và chú thích mang nghĩa phải nhất quán với problem, gắn đúng đối tượng và không tạo ra cách hiểu sai hoặc mơ hồ.",
      "Bắt buộc dựng trước, chú thích sau; cấm chọn hình tùy ý rồi gắn số đo. Mọi giá trị nhìn thấy phải đúng với tọa độ/phép dựng.",
      "Trước khi trả latexSource, tự kiểm source cuối: (1) tính lại từng số đo nhìn thấy từ tọa độ/phép dựng; (2) với angle=X--V--Y, tính miền quét ngược chiều kim đồng hồ từ tia VX đến VY; (3) đối chiếu kết quả, miền marker và problem. Nếu lệch, dựng lại tọa độ hoặc đổi thứ tự tia; cấm chỉ sửa nhãn. Tự kiểm nội bộ, không trả thêm field/báo cáo.",
      "Chỉ dùng tập đối tượng và quan hệ tối thiểu đủ cho thông điệp thị giác; cấm phát minh dữ kiện hoặc chi tiết không giúp hiểu câu hỏi.",
      "Trước khi trả kết quả, đối chiếu lại từng nét mang nghĩa với problem; caption chỉ kiểm tra trọng tâm. Cấm thiếu/thừa nét, nối/gắn nhãn sai hoặc đổi quan hệ. Bố cục thoáng, ít màu; ký hiệu quan hệ độc lập không chồng, chạm hoặc tụ sát; không cắt nhãn.",
      `Đặt nguyên dòng ${QUIZ_FIGURE_EXTENSION_MARKER} ngay trước \\end{tikzpicture} hoặc \\end{circuitikz}; đây là điểm chèn phần mở rộng lời giải.`,
      "Hình rõ trên nền trắng; cấm sao chép ảnh sách giáo khoa.",
    ].join("\n"),
    userPrompt: JSON.stringify({
      role: "QUESTION",
      mode: input.mode ?? "REGENERATE",
      problem: input.plan.problem,
      caption: input.plan.caption,
      ...(input.mode === "EDIT_CURRENT" && input.currentLatexSource?.trim()
        ? { currentLatexSource: input.currentLatexSource.trim() }
        : {}),
      ...(input.adminInstructions?.trim()
        ? { adminInstructions: input.adminInstructions.trim() }
        : {}),
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 12_000,
    outputName: "quiz_question_figure",
    promptVersion: QUIZ_FIGURE_PROMPT_VERSION,
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "quiz-figure-question",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

export function buildSolutionFigureExtensionInput(input: {
  subject: QuizSubjectSnapshot;
  plan: QuizFigurePlan;
  exactQuestionLatexSource: string;
  adminInstructions?: string | null;
  mode?: "REGENERATE" | "EDIT_CURRENT";
  currentSolutionLatexSource?: string | null;
}): AiStructuredInput {
  return {
    systemPrompt: [
      "Bạn bổ sung nét dựng cho hình lời giải Quiz trên đúng hình đề hiện có.",
      buildQuizFigureSubjectProfile(input.subject),
      buildQuizFigureVisualGrammar(input.subject),
      "Chỉ trả structured output chứa extensionLatex; extensionLatex là các lệnh TikZ cần chèn tại marker, không trả lại toàn bộ hình và không trả báo cáo tự kiểm hoặc field ngoài schema.",
      "extensionLatex phải bao phủ từng mục trong requiredAddedObjects và requiredClarifiedRelations của user input; không được đổi, bỏ hoặc dùng một nhóm để thay cho nhóm còn lại.",
      "Tự đối chiếu mọi nhãn, số đo và ký hiệu của toàn bộ hình sau khi chèn; điều chỉnh phần chèn để không che, chạm hoặc tụ sát nội dung nền trước khi trả kết quả.",
      "Chỉ thêm nội dung trực quan thực sự được mô tả trong solution và cần thiết để làm rõ mạch giải.",
      "adminInstructions chỉ chỉnh cách thể hiện; cấm thêm dữ kiện, đổi lời giải hoặc ghi đè policy hình.",
      "Nếu aiMode=EDIT_CURRENT, hãy sửa tối thiểu phần mở rộng của currentSolutionLatexSource theo adminInstructions, giữ nguyên phần không cần đổi và chỉ trả extensionLatex mới. Nếu aiMode=REGENERATE, dựng lại extension từ solution.",
      "Không xóa, đổi tên, dịch chuyển hoặc vẽ lại bất kỳ phần nào của hình đề. Không tạo root environment mới.",
      "Toàn bộ hình sau khi bổ sung phải đúng chuyên môn bằng chính phép dựng; mọi quan hệ, ký hiệu và chú thích phải nhất quán, gắn đúng đối tượng và không tạo ra cách hiểu sai hoặc mơ hồ.",
      "Trước khi trả kết quả, đối chiếu toàn bộ hình sau chèn với problem/solution: dùng ít nét nhất nhưng không thiếu hoặc thừa nét, nối sai, gắn sai nhãn hay biểu diễn làm đổi quan hệ; giữ bố cục thoáng, thứ bậc hình đề và khả năng đọc của mọi nhãn.",
      "Không dùng ảnh, file, URL, raw SVG, shell escape, input/include hoặc directlua.",
    ].join("\n"),
    userPrompt: JSON.stringify({
      role: "SOLUTION",
      aiMode: input.mode ?? "REGENERATE",
      mode: "EXTEND_QUESTION",
      problem: input.plan.problem,
      solution: input.plan.solution,
      requiredAddedObjects: input.plan.addedObjects,
      requiredClarifiedRelations: input.plan.clarifiedRelations,
      ...(input.mode === "EDIT_CURRENT" && input.currentSolutionLatexSource?.trim()
        ? { currentSolutionLatexSource: input.currentSolutionLatexSource.trim() }
        : {}),
      ...(input.adminInstructions?.trim()
        ? { adminInstructions: input.adminInstructions.trim() }
        : {}),
      exactQuestionLatexSource: input.exactQuestionLatexSource,
      insertionMarker: QUIZ_FIGURE_EXTENSION_MARKER,
    }),
    temperature: 0.1,
    reasoningEffort: "medium",
    maxTokens: 8_000,
    outputName: "quiz_solution_figure_extension",
    promptVersion: QUIZ_FIGURE_PROMPT_VERSION,
    schemaVersion: QUIZ_FIGURE_SCHEMA_VERSION,
    schemaReferenceStrategy: "auto",
    promptCache: {
      namespace: "quiz-figure-solution",
      keyEnabled: true,
      retention: "in_memory",
    },
  };
}

function buildQuizFigureVisualGrammar(subject: QuizSubjectSnapshot) {
  const globalVisualPolicy = [
    "Cấm tuyệt đối marker mũi tên hoặc chevron đánh dấu hai đường/cạnh song song; thể hiện bằng phép dựng và lời đề.",
    "Mũi tên chỉ dùng cho hướng của trục, vector, lực, tia hoặc luồng truyền khi nội dung cần.",
    "Mọi cung góc và số đo góc phải nằm trong đúng miền giữa hai tia được gọi tên; góc trong đa giác phải nằm phía trong đa giác. Khi dùng \\pic phải chọn đúng thứ tự tia; chỉ vẽ góc ngoài hoặc góc phản khi đề yêu cầu rõ. Cung và nhãn góc không được cắt hoặc chồng lên đường tròn, cạnh, đỉnh hay nhãn điểm; nếu đỉnh nằm trên đường tròn thì giữ cung đủ nhỏ, nằm gọn trong miền góc để không bị hiểu nhầm là một phần của đường tròn.",
  ].join("\n");

  switch (subject.key.trim().toUpperCase()) {
    case "MATH":
      return [
        globalVisualPolicy,
        "Hình Toán bao phủ Hình học và trực quan Đại số: dựng đúng mọi quan hệ cần đọc, không ký hiệu kết luận học sinh cần tìm.",
        "Marker dữ kiện khác dùng đúng chuẩn: dấu vuông góc, vạch bằng nhau/trung điểm, cung phân giác; không tiết lộ kết luận.",
        "Đồ thị/hệ trục/đường số/miền nghiệm: ghi đúng trục, chiều, nhãn, đơn vị hoặc tỉ lệ; chỉ vẽ đường, điểm, giao, biên và tiệm cận có trong problem, không tự thêm giá trị.",
        "Bảng biến thiên/xét dấu/dữ liệu/biểu đồ: giữ đúng hàng, cột, mốc, nhãn, dấu, mũi tên, giá trị và đơn vị; căn thoáng, không thêm ô.",
      ].join("\n");
    case "PHYSICS":
      return `${globalVisualPolicy}\nNgữ pháp hình Lý: vector phải có đúng gốc, hướng và nhãn; lực gắn đúng vật/điểm đặt; đồ thị phải có trục, chiều, đại lượng và đơn vị cần thiết; sơ đồ mạch phải dùng ký hiệu chuẩn, đúng nút nối và cực tính. Không thêm chiều, số đo hoặc quan hệ chưa được cho.`;
    case "CHEMISTRY":
      return `${globalVisualPolicy}\nNgữ pháp hình Hóa: công thức cấu tạo phải đúng liên kết, hóa trị và điện tích; sơ đồ thí nghiệm phải đúng dụng cụ, chất, chiều truyền và điểm nối; đồ thị phải có trục, đại lượng và đơn vị cần thiết. Không dùng trang trí để thay cho ký hiệu chuyên môn hoặc thêm trạng thái/điều kiện chưa được cho.`;
    default:
      return `${globalVisualPolicy}\nMọi ký hiệu chuyên môn phải theo quy ước chuẩn của môn học và biểu diễn đúng quan hệ đã nêu, không được dùng nét trang trí thay cho dữ kiện.`;
  }
}
