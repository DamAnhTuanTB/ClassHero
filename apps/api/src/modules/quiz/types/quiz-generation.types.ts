import { AI_REASONING_EFFORT_LEVELS } from "@learning-path/shared";
import { Difficulty, QuestionType } from "@prisma/client";
import { z } from "zod";

export const QUIZ_PROMPT_VERSION =
  "quiz-pdf-figure-prompt-v33-source-archetype-coverage";
export const QUIZ_SCHEMA_VERSION =
  "quiz-pdf-figure-schema-v21-grade-bounded-solutions";
export const QUIZ_MAX_OUTPUT_TOKENS = 12_000;
export const QUIZ_MIN_OUTPUT_TOKENS = 1_000;
export const QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS = 32_000;
export const QUIZ_SUBQUESTION_IDS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const QUIZ_OUTPUT_TOKEN_OVERHEAD = 2_000;
const QUIZ_OUTPUT_TOKENS_BY_TYPE: Record<QuestionType, number> = {
  [QuestionType.MULTIPLE_CHOICE]: 500,
  [QuestionType.TRUE_FALSE]: 400,
  [QuestionType.MULTI_STATEMENT_TRUE_FALSE]: 900,
  [QuestionType.TEXT_INPUT]: 650,
};

export function resolveQuizOutputTokenFloor(input: {
  questionCount: number;
  questionTypes?: readonly QuestionType[];
}) {
  const types =
    input.questionTypes && input.questionTypes.length > 0
      ? input.questionTypes
      : Object.values(QuestionType);
  const longestSelectedQuestion = Math.max(
    ...types.map((type) => QUIZ_OUTPUT_TOKENS_BY_TYPE[type]),
  );
  return Math.min(
    QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS,
    Math.max(
      QUIZ_MAX_OUTPUT_TOKENS,
      QUIZ_OUTPUT_TOKEN_OVERHEAD + input.questionCount * longestSelectedQuestion,
    ),
  );
}

export const QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY = [
  "QUY TẮC CỨNG VỀ CHUỖI DẤU BẰNG: trước khi trả kết quả JSON, phải rà soát mọi trường hiển thị có nội dung toán học, đặc biệt là `problem`, `solution`, `statementSolutions[].solution`, `answer`, `hint`, `options[].text` và `statements[].text`.",
  "Bất kỳ chuỗi tính hoặc biến đổi duy nhất nào có từ hai dấu `=` cấp ngoài cùng trở lên đều bắt buộc được xuất thành một khối display `$$...$$` dùng `aligned`/`split`, bất kể chuỗi ngắn, vừa một dòng, không tràn ngang hoặc ban đầu có thể viết inline. Tuyệt đối không đặt chuỗi đó trong `$...$` và không giữ toàn bộ chuỗi trên một dòng.",
  "Trong `aligned`/`split`, mỗi dòng chỉ chứa một dấu `=` cấp ngoài cùng và một bước biến đổi tương ứng. Dòng đầu có dạng `A &= B`, các dòng sau có dạng `&= C`.",
  "Ví dụ tổng quát SAI: `$A=B=C$`. Ví dụ tổng quát SAI: `$$A=B=C.$$` Ví dụ tổng quát ĐÚNG: `$$\\begin{aligned}A&=B\\\\&=C.\\end{aligned}$$`.",
  "Không áp dụng quy tắc tách chuỗi cho các phương trình độc lập, hệ phương trình, phép gán nhiều đại lượng hoặc dấu `=` nằm trong cấu trúc lồng nhau.",
  "Nếu phát hiện chuỗi vi phạm khi tự kiểm tra, phải chuyển chuỗi inline hoặc display một dòng đó thành display nhiều dòng trước khi trả kết quả.",
].join(" ");

export const QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY = [
  "QUY TẮC CỨNG VỀ MÔI TRƯỜNG LATEX: trong mọi khối công thức display `$$...$$`, mỗi lệnh `\\begin{X}` bắt buộc có đúng lệnh `\\end{X}` tương ứng, đóng theo thứ tự lồng ngược và nằm trước dấu `$$` kết thúc khối.",
  "Tuyệt đối không kết thúc khối ngay sau nội dung của `aligned`, `split`, `cases`, `array`, `matrix` hoặc môi trường khác khi chưa viết lệnh `\\end{...}` tương ứng. Ví dụ SAI: `$$\\begin{aligned}A&=B\\\\&=C.$$`; ví dụ ĐÚNG: `$$\\begin{aligned}A&=B\\\\&=C.\\end{aligned}$$`.",
  "Trước khi trả JSON, phải tự quét từng field có LaTeX và sửa mọi cặp `\\begin{...}`/`\\end{...}` bị thiếu, thừa hoặc sai thứ tự; đồng thời bảo đảm mỗi dấu mở `$$` có đúng một dấu đóng `$$`.",
  "Với công thức inline, bắt buộc mở và đóng bằng cùng dấu `$`; không dùng backtick thay cho dấu `$` đóng. Ví dụ SAI: `$E``, ví dụ ĐÚNG: `$E$`.",
].join(" ");

const QUIZ_EQUALITY_CHAIN_FIELD_POLICY =
  "Nếu trường này chứa một chuỗi tính hoặc biến đổi duy nhất có từ hai dấu `=` cấp ngoài cùng trở lên, bất kể chuỗi đang được dự định viết inline hay display, bắt buộc xuất thành `$$\\begin{aligned}...\\end{aligned}$$` hoặc `split` với đúng một dấu `=` cấp ngoài cùng trên mỗi dòng; tuyệt đối không đặt chuỗi đó trong `$...$`.";

export const QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY = [
  "Bảo toàn dấu câu và ký hiệu có chức năng của nguồn; tự bổ sung dấu câu còn thiếu khi ngữ pháp và quan hệ trình bày xác định rõ. Câu dẫn mở danh sách, hệ, bảng hoặc công thức display ở dòng sau phải kết thúc bằng dấu `:`; dùng dấu `,`, `;` và `.` đúng quan hệ câu, không để chuỗi `..` mà phải chọn `.` hoặc `...` theo nghĩa.",
  "Các cụm `Ta có`, `Do đó`, `Suy ra`, `Vì vậy` khi làm câu dẫn trực tiếp cho công thức display hoặc danh sách ở dòng sau phải có dấu `:`; khi nội dung tiếp tục cùng dòng thì dùng dấu câu theo đúng ngữ pháp, không máy móc thêm dấu hai chấm.",
  "Trong `aligned`/`split`, đặt dấu `&` tại quan hệ chính cần căn như `=`. Không đặt `&` ngay trước toán tử suy luận hoặc tương đương đứng đầu dòng như `\\Rightarrow`, `\\Leftrightarrow`, `\\Longrightarrow`, `\\Longleftrightarrow`, `\\implies`, `\\impliedby`, `\\iff` và các biến thể chiều ngược, vì toán tử sẽ bị đẩy vào cột dấu bằng. Khi dòng suy ra còn có dấu bằng, viết toán tử và vế trái trước dấu căn, ví dụ `\\Rightarrow\\quad a &= 2x`.",
].join(" ");

export const QUIZ_TRUE_FALSE_PROBLEM_POLICY =
  "`explanation.problem` phải bắt đầu trực tiếp bằng đúng một mệnh đề cần xét. Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đúng/sai, như `Mệnh đề:`, `Mệnh đề sau đúng hay sai?`, `Đánh giá mệnh đề sau` hoặc cách diễn đạt tương đương. Ví dụ SAI: `Mệnh đề: P`; ví dụ ĐÚNG: `P`.";

export const QUIZ_TRUE_FALSE_SOLUTION_POLICY =
  "Với TRUE_FALSE, `explanation.solution` phải giải thích vì sao mệnh đề đúng hoặc sai rồi kết thúc bằng một câu liên kết tự nhiên với lập luận, như `Vì vậy, mệnh đề đã cho là đúng.` hoặc `Do đó, mệnh đề đã cho là sai.`. Không dùng câu cụt, tách rời ngữ cảnh như `Mệnh đề đúng.` hoặc `Mệnh đề sai.`.";

export const QUIZ_SUBPART_LINEBREAK_POLICY =
  "Trong một câu Quiz có nhiều ý, mỗi ý mang nhãn a), b), c), ... phải bắt đầu ở dòng riêng trong `problem`, `solution` và `answer`; không đặt hai ý trên cùng một dòng. Riêng MULTI_STATEMENT_TRUE_FALSE, mỗi lời giải nằm trong một phần tử `statementSolutions` riêng, còn mapper dựng mỗi đáp án a), b), c), ... thành một dòng độc lập.";

export const QUIZ_CONCLUSION_PARAGRAPH_POLICY =
  "Câu kết luận cuối bắt đầu bằng `Vậy` phải nằm trong một đoạn riêng: chèn đúng một dòng trống trước câu kết luận, không nối câu này vào cùng đoạn văn hoặc cùng dòng với phép tính, công thức hay lập luận ngay trước đó.";

export const QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY =
  "Với MULTIPLE_CHOICE, câu kết luận cuối phải trả lời trực tiếp đúng đại lượng, đối tượng hoặc yêu cầu mà `problem` hỏi, chẳng hạn `Vậy thể tích cần tìm là $V$.`; không được kết luận bằng thao tác làm bài hoặc ID phương án như `Vậy chọn phương án C.`, `Vậy đáp án là C.` hay cách diễn đạt tương đương. ID phương án chỉ thuộc dữ liệu chấm điểm và field `answer` theo contract riêng.";

export const QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY =
  "Trong `problem`, `hint`, `answer`, `solution` và `statementSolutions`, chỉ được sử dụng khái niệm, định lý, công thức, ký hiệu và phương pháp được trình bày trong PDF nguồn hoặc kiến thức tiên quyết cần thiết không vượt quá khối lớp mục tiêu. Không được sử dụng kiến thức, thuật ngữ, định lý hoặc phương pháp thuộc khối lớp cao hơn để rút gọn lời giải, kể cả khi cách giải đó đúng về mặt chuyên môn. Khi PDF nguồn đã trình bày một phương pháp phù hợp, phải ưu tiên phương pháp đó; chỉ dùng cách khác khi cách đó vẫn nằm trong phạm vi kiến thức của nguồn và khối lớp mục tiêu. Khi chưa xác định khối lớp, không dùng phương pháp nâng cao không xuất hiện trong PDF nguồn.";

export const QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY = [
  "Lời giải Quiz bắt đầu trực tiếp và thực hiện đủ các bước cần cho chính câu đang giải: nêu công thức hoặc căn cứ, thay dữ kiện, viết phép biến đổi hay suy luận trung gian, rồi kết luận. Không viết kiểu gợi ý `thay vào công thức`, `làm tương tự`, `suy ra ngay` mà bỏ qua thao tác.",
  "Nếu PDF nguồn có phương pháp hoặc cách ký hiệu phù hợp với dạng bài mới, dùng đó làm chuẩn về thứ tự lập luận, cấu trúc công thức và mức xuống dòng; không chép lại bài/lời giải nguồn, không đổi sang phương pháp xa lạ và không chuyển biểu thức thành đoạn văn dài.",
  "Với câu cần tính toán hoặc biến đổi, công thức, chuỗi biến đổi và ký hiệu toán học phải là phần trình bày chính; văn xuôi chỉ nêu căn cứ hoặc nối các bước. Với câu nhận định lý thuyết không cần phép tính, dùng lập luận ngắn, trực tiếp theo đúng khái niệm hoặc quy tắc liên quan.",
  "Trong `solution` hoặc `statementSolutions[].solution` có tính toán, phải tách theo đơn vị lập luận: câu nêu căn cứ/công thức; khối display chứa phép tính hoặc biến đổi; rồi câu kết luận khi cần. Nếu câu dẫn đứng ngay trước khối display thì kết thúc bằng dấu `:`. Không nhét toàn bộ phép tính nhiều bước vào giữa một đoạn văn; yêu cầu gọn chỉ cho phép bỏ diễn giải lặp lại, không cho phép gộp hoặc văn xuôi hóa các bước toán học.",
  QUIZ_CONCLUSION_PARAGRAPH_POLICY,
  QUIZ_SUBPART_LINEBREAK_POLICY,
].join(" ");

export const QUIZ_MULTI_STATEMENT_PROBLEM_POLICY =
  "`explanation.problem` chỉ chứa bối cảnh hoặc dữ kiện dùng chung thực sự cần cho các phần tử trong `statements`; phải dừng ngay sau bối cảnh đó. Không thêm câu dẫn chỉ nhắc lại thao tác đúng/sai, như `Hãy đánh giá độc lập các mệnh đề sau`, `Đánh giá các mệnh đề sau` hoặc cách diễn đạt tương đương. Ví dụ SAI: `Cho dữ kiện X. Hãy đánh giá các mệnh đề sau`; ví dụ ĐÚNG: `Cho dữ kiện X`.";

export const QUIZ_MULTI_STATEMENT_SOLUTION_POLICY =
  "Với MULTI_STATEMENT_TRUE_FALSE, `statements[].id` và `explanation.statementSolutions[].statementId` bắt buộc dùng lần lượt đúng các chữ thường `a`, `b`, `c`, `d`, ... theo thứ tự mảng và luôn bắt đầu từ `a`; tuyệt đối không dùng `S1`, `S2`, số thứ tự, chữ hoa hoặc ID tùy ý. `explanation.statementSolutions` phải có đúng một phần tử cho mỗi câu con, cùng `statementId`, cùng thứ tự và không thêm ID khác. Mỗi `solution` phải giải riêng câu tương ứng bằng dữ kiện, phép tính hoặc lập luận đầy đủ theo phong cách SGK; không viết một lời giải chung, không văn xuôi hóa biểu thức rồi chỉ liệt kê kết quả. Không lặp nhãn `a)`, `b)` ở đầu `solution` vì lớp trình bày tự thêm nhãn. Mỗi phần kết thúc tự nhiên theo dạng `Vậy câu a) đúng.` hoặc `Vậy câu b) sai.`; câu kết luận này bắt buộc là một đoạn riêng có đúng một dòng trống phía trước, không nằm cùng dòng với câu giải thích hoặc công thức trước đó. Trong nội dung hiển thị không gọi là `mệnh đề 1`, `mệnh đề 2`, `S1` hoặc `S2`. Đáp án cuối được dựng từ `statements[].value`, mỗi câu một dòng theo dạng `a) Đúng.`; provider không trả `explanation.answer` cho loại câu này.";

export const QUIZ_TEXT_INPUT_ANSWER_POLICY =
  "Dùng TEXT_INPUT cho bài tính có đúng một yêu cầu trực tiếp và một kết quả số. `correctAnswer` phải là đúng một chuỗi đáp án chuẩn, không liệt kê nhiều cách viết tương đương, không có xuống dòng, đơn vị, câu văn hoặc LaTeX. Nếu kết quả chính xác là số hữu tỉ: trả số nguyên khi kết quả là số nguyên; nếu không, trả phân số tối giản `p/q` với mẫu dương. Nếu kết quả chính xác là số vô tỉ: `explanation.problem` bắt buộc kết thúc bằng đúng câu `Làm tròn kết quả đến 1 chữ số thập phân.`; `solution` nêu kết quả chính xác rồi thực hiện làm tròn; `correctAnswer` là số thập phân đã làm tròn, dùng dấu `.` và đúng một chữ số sau dấu thập phân; `explanation.answer` phải kết luận cùng giá trị đã làm tròn. Không trả ký hiệu vô tỉ như `π`, `\\sqrt{...}` trong `correctAnswer`. Không thêm yêu cầu làm tròn khi kết quả chính xác là số hữu tỉ. Ví dụ hữu tỉ: kết quả bằng một nửa thì SAI là `1/2; 0.5`, ĐÚNG là `1/2`. Ví dụ vô tỉ: kết quả chính xác là `\\sqrt{2}` thì SAI là `correctAnswer=\\sqrt{2}`, ĐÚNG là problem có câu làm tròn nêu trên và `correctAnswer=1.4`.";

export const QUIZ_SUBJECT_KEYS = ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const;

export const quizSubjectKeySchema = z.enum(QUIZ_SUBJECT_KEYS);
export type QuizSubjectKey = z.infer<typeof quizSubjectKeySchema>;

export interface QuizSubjectSnapshot {
  key: QuizSubjectKey;
  name: string;
  slug: string;
}

const text = (max: number) => z.string().trim().min(1).max(max);
const learnerFacingText = (max: number, description: string) =>
  text(max).describe(description);
const difficultySchema = z
  .enum([Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD])
  .describe("Mức độ của câu hỏi: EASY, MEDIUM hoặc HARD.");

export const quizGeometryStatementSchema = z
  .object({
    hypotheses: z
      .array(text(1_000))
      .min(1)
      .max(20)
      .describe(
        "Các giả thiết được nêu trực tiếp trong đề bài; không thêm điều phải suy ra.",
      ),
    conclusions: z
      .array(text(1_000))
      .min(1)
      .max(20)
      .describe("Đúng các yêu cầu cần tìm hoặc chứng minh trong đề bài."),
  })
  .strict();

const quizExplanationProblemField = learnerFacingText(
  4_000,
  "Phần nội dung chính của câu hỏi phải nêu đủ đối tượng, ký hiệu, dữ kiện và yêu cầu chuyên môn nếu dạng câu cần, để học sinh trả lời được mà không cần xem hình minh họa. Không thêm nhãn hoặc câu dẫn chỉ nhắc lại thao tác đã được `questionType` thể hiện.",
);
const quizExplanationAnswerField = learnerFacingText(
  2_000,
  "Kết luận ngắn gọn, nhất quán với lời giải và không chứa tiền tố `Đáp án:`.",
);
const quizExplanationBaseShape = {
  problem: quizExplanationProblemField,
  answer: quizExplanationAnswerField,
};

const QUIZ_STANDARD_SOLUTION_DESCRIPTION = `Thân lời giải phải đầy đủ và mạch lạc theo phong cách sách giáo khoa: chỉ bỏ diễn giải lặp lại, không gộp phép tính nhiều bước vào câu văn; sau khi thực hiện đủ các bước cần thiết thì kết luận rồi dừng, không viết thêm nhận xét hoặc tính chất tổng quát sau kết luận. Lời giải phải hiểu được mà không cần xem hình minh họa. ${QUIZ_SCHOOLBOOK_SOLUTION_STYLE_POLICY} ${QUIZ_GRADE_APPROPRIATE_KNOWLEDGE_POLICY}`;

const quizSolutionFieldSchema = text(10_000).describe(
  [
    QUIZ_STANDARD_SOLUTION_DESCRIPTION,
    QUIZ_EQUALITY_CHAIN_FIELD_POLICY,
    QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
    QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY,
  ].join(" "),
);

const QUIZ_STATEMENT_SOLUTION_ITEM_POLICY =
  "Lời giải độc lập cho đúng một câu con: nêu đủ dữ kiện, công thức, phép tính, phép biến đổi hoặc lập luận cần thiết; không gộp câu khác và không lặp nhãn ở đầu field. Kết thúc bằng một đoạn riêng như `Vậy câu a) đúng.` hoặc `Vậy câu b) sai.`, có đúng một dòng trống phía trước; không viết `mệnh đề 1`/`mệnh đề 2` hay S1/S2.";

const standardQuizExplanationContentShape = {
  ...quizExplanationBaseShape,
  solution: quizSolutionFieldSchema,
};

const multipleChoiceQuizExplanationContentShape = {
  ...quizExplanationBaseShape,
  solution: quizSolutionFieldSchema,
};

const trueFalseQuizExplanationContentShape = {
  ...quizExplanationBaseShape,
  solution: quizSolutionFieldSchema,
};

const quizStatementSolutionSchema = z
  .object({
    statementId: z
      .enum(QUIZ_SUBQUESTION_IDS)
      .describe(
        "Nhãn chữ thường của đúng câu con được giải; phải khớp `statements[].id`, theo thứ tự liên tiếp a, b, c, d, ... và không dùng S1/S2 hoặc số thứ tự.",
      ),
    solution: quizSolutionFieldSchema,
  })
  .strict()
  .describe(QUIZ_STATEMENT_SOLUTION_ITEM_POLICY);

const multiStatementQuizExplanationContentShape = {
  problem: quizExplanationProblemField,
  statementSolutions: z
    .array(quizStatementSolutionSchema)
    .min(2)
    .max(8)
    .describe(QUIZ_MULTI_STATEMENT_SOLUTION_POLICY),
};

function createMathQuizExplanationSchema<T extends z.ZodRawShape>(
  targetGrade: number | null,
  contentShape: T,
) {
  const supportsGeometryStatement =
    targetGrade !== null && targetGrade >= 7 && targetGrade <= 9;
  if (!supportsGeometryStatement) {
    return z
      .object({
        ...contentShape,
        isGeometry: z
          .boolean()
          .describe("Đặt true nếu đây là câu Hình học; ngược lại đặt false."),
        geometryStatement: z
          .null()
          .describe(
            "Bắt buộc là null khi khối lớp chưa xác định hoặc nằm ngoài lớp 7–9, kể cả khi `isGeometry=true`.",
          ),
      })
      .strict();
  }

  return z.union([
    z
      .object({
        ...contentShape,
        isGeometry: z.literal(true),
        geometryStatement: quizGeometryStatementSchema.describe(
          "Bảng giả thiết–kết luận (GT–KL) dành cho câu Hình học lớp 7–9: `hypotheses` chỉ chứa dữ kiện đề bài cho; `conclusions` chỉ chứa yêu cầu cần tìm hoặc chứng minh.",
        ),
      })
      .strict(),
    z
      .object({
        ...contentShape,
        isGeometry: z.literal(false),
        geometryStatement: z.null(),
      })
      .strict(),
  ]);
}

function createNonMathQuizExplanationSchema<T extends z.ZodRawShape>(contentShape: T) {
  return z.object(contentShape).strict();
}

const nonMathQuizExplanationSchema = createNonMathQuizExplanationSchema(
  multipleChoiceQuizExplanationContentShape,
);

const nonMathTextInputQuizExplanationSchema = createNonMathQuizExplanationSchema(
  standardQuizExplanationContentShape,
);

const nonMathTrueFalseQuizExplanationSchema = createNonMathQuizExplanationSchema(
  trueFalseQuizExplanationContentShape,
);

const nonMathMultiStatementQuizExplanationSchema = createNonMathQuizExplanationSchema(
  multiStatementQuizExplanationContentShape,
);

export const quizExplanationBlockSchema = z
  .object({
    type: z.literal("quizExplanation"),
    problem: text(2_000),
    solution: text(10_000),
    answer: text(2_000),
    isGeometry: z.boolean().optional(),
    geometryStatement: quizGeometryStatementSchema.optional(),
    origin: z.literal("AI_AUTHORED").optional(),
  })
  .strict();

const optionSchema = z
  .object({
    id: text(40).describe("ID duy nhất của phương án trong câu hỏi, ví dụ A, B, C, D."),
    text: learnerFacingText(
      1_000,
      "Nội dung phương án; phải rõ nghĩa và không chỉ dẫn học sinh xem hình minh họa.",
    ),
  })
  .strict();
const generatedCanonicalNumericAnswerPattern = /^-?(?:0|[1-9]\d*)(?:\/[1-9]\d*|\.\d)?$/u;
const numericAnswerSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(generatedCanonicalNumericAnswerPattern)
  .describe(
    "Đúng một đáp án số chuẩn. Chỉ dùng một trong ba dạng: số nguyên; phân số tối giản `p/q` có mẫu dương cho kết quả hữu tỉ không nguyên; hoặc số thập phân dùng dấu `.` và đúng một chữ số sau dấu thập phân cho kết quả vô tỉ đã được yêu cầu làm tròn. Không dùng dấu `,`, ký hiệu khoa học, LaTeX, ký hiệu vô tỉ, đơn vị, câu văn, xuống dòng hoặc nhiều phương án.",
  );

const questionFigurePlanSchema = z
  .object({
    caption: text(500)
      .nullable()
      .describe(
        "Mô tả ngắn, tự đủ nghĩa về cấu hình hoặc quan hệ cần minh họa; không thêm dữ kiện mới và dùng null khi hình không cần chú thích.",
      ),
  })
  .strict();

const solutionFigurePlanSchema = z
  .object({
    addedObjects: z
      .array(text(300))
      .min(1)
      .max(20)
      .describe(
        "Các đối tượng trực quan mới, thiết yếu phải thêm trên đúng hình đề để theo dõi lời giải, ví dụ điểm, đường, vector, tia sáng, bộ phận mạch điện hoặc liên kết hóa học.",
      ),
    clarifiedRelations: z
      .array(text(300))
      .min(1)
      .max(20)
      .describe(
        "Các quan hệ trung gian hoặc kết luận cần làm rõ trên hình lời giải bằng ký hiệu chuyên môn chuẩn; không lặp lại tên đối tượng đã liệt kê trong `addedObjects` nếu không nêu thêm quan hệ.",
      ),
  })
  .strict();

export const quizFigureDecisionSchema = z
  .union([
    z
      .object({
        questionFigure: z
          .null()
          .describe("Không tạo hình cho đề bài vì hình không làm nội dung dễ hiểu hơn."),
        solutionFigureMode: z.literal("NONE").describe("Không tạo hình cho lời giải."),
        solutionFigurePlan: z
          .null()
          .describe("Bắt buộc là null khi `solutionFigureMode=NONE`."),
      })
      .strict(),
    z
      .object({
        questionFigure: questionFigurePlanSchema.describe(
          "Kế hoạch tối thiểu cho hình đề; chỉ dùng khi hình giúp hiểu cấu hình hoặc quan hệ tốt hơn chữ và công thức.",
        ),
        solutionFigureMode: z
          .enum(["NONE", "REUSE_QUESTION"])
          .describe(
            "Chọn NONE nếu lời giải không cần hình; chọn REUSE_QUESTION nếu lời giải dùng nguyên hình đề, không thêm đối tượng hoặc quan hệ.",
          ),
        solutionFigurePlan: z
          .null()
          .describe("Bắt buộc là null khi không mở rộng hình đề."),
      })
      .strict(),
    z
      .object({
        questionFigure: questionFigurePlanSchema.describe(
          "Kế hoạch tối thiểu cho hình đề sẽ được dùng làm nền của hình lời giải.",
        ),
        solutionFigureMode: z
          .literal("EXTEND_QUESTION")
          .describe(
            "Mở rộng đúng hình đề bằng các đối tượng và quan hệ cần cho lời giải.",
          ),
        solutionFigurePlan: solutionFigurePlanSchema.describe(
          "Liệt kê chính xác phần phải bổ sung trên hình đề; không mô tả lại toàn bộ hình.",
        ),
      })
      .strict(),
  ])
  .describe(
    "Quyết định có dùng hình hay không và cách dùng hình đề trong lời giải. Hình chỉ bổ trợ trực quan, không được chứa dữ kiện mà nội dung chữ chưa nêu.",
  );

const ALL_GENERATED_QUESTION_TYPES = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.TRUE_FALSE,
  QuestionType.MULTI_STATEMENT_TRUE_FALSE,
  QuestionType.TEXT_INPUT,
] as const;

function createQuestionSchemas<
  T extends z.ZodRawShape,
  V extends z.ZodType,
  U extends z.ZodType,
  W extends z.ZodType,
>(
  commonFields: T,
  trueFalseExplanationSchema: V,
  multiStatementExplanationSchema: U,
  textInputExplanationSchema: W,
) {
  return {
    [QuestionType.MULTIPLE_CHOICE]: z
      .object({
        questionType: z.literal(QuestionType.MULTIPLE_CHOICE),
        ...commonFields,
        options: z
          .array(optionSchema)
          .min(2)
          .max(6)
          .describe(
            "Từ 2 đến 6 phương án; mỗi phương án có ID riêng, có đúng một đáp án đúng và các phương án nhiễu phải hợp lý, không chồng nghĩa hoặc làm lộ đáp án.",
          ),
        correctOptionId: text(40).describe(
          "ID của đúng một phương án trong `options`; Quiz không có trắc nghiệm nhiều đáp án. `explanation.answer` phải có dạng `<correctOptionId>. <nội dung đầy đủ của phương án đúng>`.",
        ),
      })
      .strict()
      .describe(QUIZ_DIRECT_ANSWER_CONCLUSION_POLICY),
    [QuestionType.TRUE_FALSE]: z
      .object({
        questionType: z.literal(QuestionType.TRUE_FALSE),
        ...commonFields,
        explanation: trueFalseExplanationSchema,
        correctAnswer: z
          .boolean()
          .describe(
            "Giá trị true/false của duy nhất một mệnh đề trong `explanation.problem`.",
          ),
      })
      .strict()
      .describe(
        [QUIZ_TRUE_FALSE_PROBLEM_POLICY, QUIZ_TRUE_FALSE_SOLUTION_POLICY].join(" "),
      ),
    [QuestionType.MULTI_STATEMENT_TRUE_FALSE]: z
      .object({
        questionType: z.literal(QuestionType.MULTI_STATEMENT_TRUE_FALSE),
        ...commonFields,
        explanation: multiStatementExplanationSchema,
        statements: z
          .array(
            z
              .object({
                id: z
                  .enum(QUIZ_SUBQUESTION_IDS)
                  .describe(
                    "Nhãn hiển thị của câu con, bắt buộc theo thứ tự liên tiếp a, b, c, d, ... từ đầu mảng; không dùng S1/S2, số thứ tự, chữ hoa hoặc ID tùy ý.",
                  ),
                text: learnerFacingText(
                  1_000,
                  "Nội dung một câu con đủ rõ để đánh giá đúng/sai độc lập và không chỉ dẫn học sinh xem hình minh họa.",
                ),
                value: z.boolean().describe("Giá trị true/false của câu con này."),
              })
              .strict(),
          )
          .min(2)
          .max(8)
          .describe(
            "Từ 2 đến 8 câu con có thể đánh giá độc lập; ID phải lần lượt là a, b, c, d, ... theo đúng thứ tự mảng.",
          ),
      })
      .strict()
      .describe(QUIZ_MULTI_STATEMENT_PROBLEM_POLICY),
    [QuestionType.TEXT_INPUT]: z
      .object({
        questionType: z.literal(QuestionType.TEXT_INPUT),
        ...commonFields,
        explanation: textInputExplanationSchema,
        correctAnswer: numericAnswerSchema,
      })
      .strict()
      .describe(QUIZ_TEXT_INPUT_ANSWER_POLICY),
  };
}

function buildQuestionSchema<T extends z.ZodRawShape>(
  commonFields: T,
  requestedTypes: readonly QuestionType[],
  trueFalseExplanationSchema: z.ZodType,
  multiStatementExplanationSchema: z.ZodType,
  textInputExplanationSchema: z.ZodType,
) {
  const schemas = createQuestionSchemas(
    commonFields,
    trueFalseExplanationSchema,
    multiStatementExplanationSchema,
    textInputExplanationSchema,
  );
  const selected = requestedTypes.map((type) => schemas[type]);
  const [first, second, ...rest] = selected;
  if (!first) throw new Error("Quiz output schema requires at least one question type.");
  if (!second) return first;
  return z.union([first, second, ...rest]);
}

function createNonMathQuizQuestionFields(difficulty: z.ZodType<Difficulty>) {
  return {
    difficulty,
    hint: learnerFacingText(
      1_000,
      "Gợi ý ngắn định hướng bước đầu nhưng không tiết lộ trực tiếp đáp án.",
    ),
    explanation: nonMathQuizExplanationSchema.describe(
      "Gồm đề bài, lời giải và đáp án theo đúng môn hiện tại; `problem` và `solution` phải hiểu được mà không cần xem hình minh họa.",
    ),
    figure: quizFigureDecisionSchema,
  };
}

const _generatedNonMathQuizQuestionSchema = buildQuestionSchema(
  createNonMathQuizQuestionFields(difficultySchema),
  ALL_GENERATED_QUESTION_TYPES,
  nonMathTrueFalseQuizExplanationSchema,
  nonMathMultiStatementQuizExplanationSchema,
  nonMathTextInputQuizExplanationSchema,
);

const _generatedMathQuizQuestionSchema = buildQuestionSchema(
  {
    difficulty: difficultySchema,
    hint: learnerFacingText(
      1_000,
      "Gợi ý ngắn định hướng bước đầu nhưng không tiết lộ trực tiếp đáp án.",
    ),
    explanation: createMathQuizExplanationSchema(
      9,
      multipleChoiceQuizExplanationContentShape,
    ),
    figure: quizFigureDecisionSchema,
  },
  ALL_GENERATED_QUESTION_TYPES,
  createMathQuizExplanationSchema(9, trueFalseQuizExplanationContentShape),
  createMathQuizExplanationSchema(9, multiStatementQuizExplanationContentShape),
  createMathQuizExplanationSchema(9, standardQuizExplanationContentShape),
);

export interface GeneratedQuizSchemaConfiguration {
  subjectKey: QuizSubjectKey;
  targetGrade?: number | null;
  questionCount?: number;
  questionTypes?: readonly QuestionType[];
  difficulty?: Difficulty;
}

export function getGeneratedQuizOutputSchema(
  configuration: GeneratedQuizSchemaConfiguration,
) {
  const requestedTypes = configuration.questionTypes ?? ALL_GENERATED_QUESTION_TYPES;
  const requestedDifficulty =
    configuration.difficulty && configuration.difficulty !== Difficulty.MIXED
      ? z.literal(configuration.difficulty)
      : difficultySchema;
  const questionSchema =
    configuration.subjectKey === "MATH"
      ? buildQuestionSchema(
          {
            difficulty: requestedDifficulty,
            hint: learnerFacingText(
              1_000,
              "Gợi ý ngắn định hướng bước đầu nhưng không tiết lộ trực tiếp đáp án.",
            ),
            explanation: createMathQuizExplanationSchema(
              configuration.targetGrade ?? null,
              multipleChoiceQuizExplanationContentShape,
            ).describe(
              "Gồm đề bài, lời giải, đáp án, trường phân loại Hình học và bảng GT–KL khi phù hợp; `problem` và `solution` phải hiểu được mà không cần xem hình minh họa.",
            ),
            figure: quizFigureDecisionSchema,
          },
          requestedTypes,
          createMathQuizExplanationSchema(
            configuration.targetGrade ?? null,
            trueFalseQuizExplanationContentShape,
          ).describe(
            "Gồm đúng một mệnh đề, lời giải có kết luận liên kết tự nhiên, đáp án, trường phân loại Hình học và bảng GT–KL khi phù hợp; mọi phần phải hiểu được mà không cần xem hình minh họa.",
          ),
          createMathQuizExplanationSchema(
            configuration.targetGrade ?? null,
            multiStatementQuizExplanationContentShape,
          ).describe(
            "Gồm đề bài, lời giải riêng trong `statementSolutions` cho từng mệnh đề, đáp án, trường phân loại Hình học và bảng GT–KL khi phù hợp; mọi phần phải hiểu được mà không cần xem hình minh họa.",
          ),
          createMathQuizExplanationSchema(
            configuration.targetGrade ?? null,
            standardQuizExplanationContentShape,
          ).describe(
            "Gồm đề bài, lời giải và đáp án số theo đúng môn hiện tại; `problem` và `solution` phải hiểu được mà không cần xem hình minh họa.",
          ),
        )
      : buildQuestionSchema(
          createNonMathQuizQuestionFields(requestedDifficulty),
          requestedTypes,
          nonMathTrueFalseQuizExplanationSchema,
          nonMathMultiStatementQuizExplanationSchema,
          nonMathTextInputQuizExplanationSchema,
        );
  const questions = z.array(questionSchema);

  return z
    .object({
      questions:
        configuration.questionCount === undefined
          ? questions.min(1).max(50)
          : questions.length(configuration.questionCount),
    })
    .strict()
    .describe(
      [
        QUIZ_EQUALITY_CHAIN_LAYOUT_POLICY,
        QUIZ_FUNCTIONAL_PUNCTUATION_AND_INFERENCE_LAYOUT_POLICY,
        QUIZ_LATEX_ENVIRONMENT_BALANCE_POLICY,
        QUIZ_SUBPART_LINEBREAK_POLICY,
      ].join(" "),
    );
}

const sourceSnapshotSchema = z
  .object({
    requestDraftId: z.uuid(),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    documentIds: z.array(z.uuid()).min(1).max(50),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    targetGrade: z.number().int().min(1).max(12).nullable().default(null),
    subjectKey: quizSubjectKeySchema,
    subjectName: z.string().trim().min(1).max(120),
    subjectSlug: z.string().trim().min(1).max(140),
  })
  .strict();

const difficultyCountsSchema = z
  .object({
    easy: z.number().int().min(0).max(50),
    medium: z.number().int().min(0).max(50),
    hard: z.number().int().min(0).max(50),
  })
  .strict();

export const quizGenerationJobInputSchema = sourceSnapshotSchema
  .extend({
    targetQuizSetId: z.uuid().nullable().default(null),
    questionCount: z.number().int().min(1).max(50),
    difficulty: z.nativeEnum(Difficulty),
    difficultyCounts: difficultyCountsSchema.nullable().default(null),
    questionTypes: z
      .array(z.nativeEnum(QuestionType))
      .min(1)
      .max(4)
      .refine((types) => new Set(types).size === types.length, {
        message: "questionTypes must not contain duplicates",
      }),
    style: z
      .enum(["student_friendly", "concise", "academic"])
      .default("student_friendly"),
    styleInstructions: z.string().trim().max(1_000).default(""),
    extraInstructions: z.string().trim().max(2_000).default(""),
    systemInstructions: z.string().trim().max(64_000).default(""),
    userPrompt: z.string().trim().max(16_000).default(""),
    model: z.string().trim().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z.enum(AI_REASONING_EFFORT_LEVELS).optional(),
    schemaReferenceStrategy: z
      .enum(["inline", "ref", "ref_v2", "auto"])
      .default("inline"),
    promptCacheKeyEnabled: z.boolean().default(false),
    promptCacheRetention: z.enum(["in_memory", "24h"]).default("in_memory"),
    maxOutputTokens: z
      .number()
      .int()
      .min(QUIZ_MIN_OUTPUT_TOKENS)
      .max(QUIZ_MAX_CONFIGURED_OUTPUT_TOKENS)
      .optional(),
  })
  .strict();

export type GeneratedQuizQuestion =
  | z.infer<typeof _generatedNonMathQuizQuestionSchema>
  | z.infer<typeof _generatedMathQuizQuestionSchema>;
export type GeneratedQuizStatementSolution = z.infer<typeof quizStatementSolutionSchema>;
export type QuizGenerationJobInput = z.infer<typeof quizGenerationJobInputSchema>;
export type QuizExplanationBlock = z.infer<typeof quizExplanationBlockSchema>;

export function getGeneratedQuizStatementSolutions(
  question: GeneratedQuizQuestion,
): GeneratedQuizStatementSolution[] | null {
  if (!("statementSolutions" in question.explanation)) return null;
  const parsed = z
    .array(quizStatementSolutionSchema)
    .safeParse(question.explanation.statementSolutions);
  return parsed.success ? parsed.data : null;
}
