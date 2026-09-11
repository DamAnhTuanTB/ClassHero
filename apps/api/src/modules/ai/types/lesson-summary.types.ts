import {
  AI_REASONING_EFFORT_LEVELS,
  LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION,
  LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
  lessonSummaryGeometryStatementSchema,
  stemFigureVisualSchema,
} from "@learning-path/shared";
import { z } from "zod";

import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";

export const LESSON_SUMMARY_PROMPT_VERSIONS = {
  MATH: "lesson-summary-math-v45-math-syntax-contract",
  PHYSICS: "lesson-summary-physics-v40-math-syntax-contract",
  CHEMISTRY: "lesson-summary-chemistry-v40-math-syntax-contract",
  GENERAL: "lesson-summary-general-v40-math-syntax-contract",
} as const;
export const LESSON_SUMMARY_SCHEMA_VERSION =
  "lesson-summary-pdf-packet-six-block-schema-v33-math-syntax-warning";
export const LESSON_SUMMARY_MAX_CONTEXT_TOKENS = 12_000;
export const LESSON_SUMMARY_MAX_OUTPUT_TOKENS = 8_000;
export const LESSON_SUMMARY_MIN_OUTPUT_TOKENS = 8_000;
export const LESSON_SUMMARY_MAX_CONFIGURED_OUTPUT_TOKENS = 32_000;
export const LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT = 2;
export const LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT = 2;
export const LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT = 1;
export const LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT = 10;

export type LessonSummaryApplicationExerciseCounts = {
  standardExerciseCount: number;
  realWorldExerciseCount: number;
};

export function resolveLessonSummaryOutputTokenFloor(input: {
  length: z.infer<typeof lessonSummaryLengthSchema>;
  targetWordCount: number | null;
  standardExerciseCount?: number;
  realWorldExerciseCount?: number;
}) {
  const lengthFloor = input.length === "detailed" ? 12_000 : 8_000;
  const requestedContentFloor = input.targetWordCount
    ? Math.ceil(input.targetWordCount * 3) + 4_000
    : 0;
  const requestedExerciseCount =
    (input.standardExerciseCount ?? LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT) +
    (input.realWorldExerciseCount ?? LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT);
  const exerciseFloor =
    LESSON_SUMMARY_MIN_OUTPUT_TOKENS + Math.max(0, requestedExerciseCount - 2) * 1_500;

  return Math.min(
    LESSON_SUMMARY_MAX_CONFIGURED_OUTPUT_TOKENS,
    Math.max(
      LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
      lengthFloor,
      requestedContentFloor,
      exerciseFloor,
    ),
  );
}

export const lessonSummaryStyleSchema = z.enum([
  "student_friendly",
  "concise",
  "academic",
]);
export const lessonSummaryLengthSchema = z.enum(["short", "standard", "detailed"]);
const nonEmptyText = (maxLength: number) => z.string().trim().min(1).max(maxLength);
export const LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION =
  "Không coi ngắt dòng do dàn trang là ranh giới ngữ nghĩa. Bảo toàn câu, đoạn, danh sách, hệ điều kiện, dấu câu dẫn và cấu trúc công thức theo chức năng trong nguồn; chọn inline hay display theo vai trò và độ phức tạp, không theo vị trí xuống dòng trong ảnh PDF.";
export const LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION = [
  "QUY TẮC CỨNG VỀ CHUỖI DẤU BẰNG: trước khi trả structured output, phải quét riêng từng field `content`, `problem`, `solution`, `answer` và từng công thức display trong field đó.",
  "Nếu một công thức display là một chuỗi tính hoặc biến đổi duy nhất có từ hai dấu `=` cấp ngoài cùng trở lên, bắt buộc dùng `aligned`/`split` và đặt đúng một dấu `=` cấp ngoài cùng cùng bước biến đổi tương ứng trên mỗi dòng: dòng đầu có dạng `A &= B`, các dòng sau có dạng `&= C`. Công thức ngắn, vừa một dòng hoặc không tràn chiều ngang vẫn không phải ngoại lệ; tuyệt đối không giữ chuỗi đó trên một dòng.",
  "Ví dụ tổng quát SAI: `$$A=B=C.$$` Ví dụ tổng quát ĐÚNG: `$$\\begin{aligned}A&=B\\\\&=C.\\end{aligned}$$`.",
  "Không áp dụng quy tắc này cho các phương trình độc lập, hệ phương trình, phép gán nhiều đại lượng hoặc dấu `=` nằm trong cấu trúc lồng nhau. Ngoài đúng các trường hợp đó, nếu bước tự kiểm tra còn thấy chuỗi tính/biến đổi vi phạm thì phải viết lại field trước khi trả output.",
  "Bảo toàn dấu câu và ký hiệu có chức năng của nguồn; tự bổ sung dấu câu còn thiếu khi ngữ pháp và quan hệ trình bày xác định rõ. Câu dẫn mở danh sách, hệ, bảng hoặc công thức display ở dòng sau phải kết thúc bằng dấu `:`; dùng dấu `,`, `;` và `.` đúng quan hệ câu, không để chuỗi `..` mà phải chọn `.` hoặc `...` theo nghĩa.",
  "Mọi công thức phải dùng cặp delimiter đầy đủ (`$...$`, `$$...$$`, `\\(...\\)` hoặc `\\[...\\]`), không dùng backtick để đóng công thức; các dấu `{}` và từng cặp `\\begin{...}`/`\\end{...}` phải cân bằng.",
  "Chỉ dùng $\\Leftrightarrow$ cho quan hệ tương đương hai chiều và $\\Rightarrow$ cho suy ra một chiều; không tự thêm hai ký hiệu này khi lập luận không chứng minh quan hệ tương ứng. Khi nhiều công thức display liên tiếp thuộc cùng một hệ, nhóm trường hợp hoặc chuỗi biến đổi, nhóm chúng trong một khối `$$\\begin{aligned}...\\end{aligned}$$` hoặc môi trường `split` phù hợp và ngắt dòng tại toán tử quan hệ/phép biến đổi hợp lý; không để các từ nối như `và`, `nên`, `do đó` thành dòng rời giữa hai công thức. Trong `aligned`/`split`, đặt dấu `&` tại quan hệ chính cần căn như `=`; không đặt `&` ngay trước toán tử suy luận hoặc tương đương đứng đầu dòng như `\\Rightarrow`, `\\Leftrightarrow`, `\\Longrightarrow`, `\\Longleftrightarrow`, `\\implies`, `\\impliedby`, `\\iff` và các biến thể chiều ngược, vì toán tử sẽ bị đẩy vào cột dấu bằng. Khi dòng suy ra còn có dấu bằng, viết toán tử và vế trái trước dấu căn, ví dụ `\\Rightarrow\\quad a &= 2x`. Công thức độc lập ngắn hoặc không cùng một mạch vẫn giữ riêng, không ép gộp.",
].join(" ");
export const LESSON_SUMMARY_LOGICAL_DERIVATION_INSTRUCTION = [
  "QUY TẮC CỨNG VỀ MẠCH BIẾN ĐỔI TRONG EXAMPLE/PHƯƠNG PHÁP: nhận diện chuỗi theo quan hệ logic, không theo cách đã chia delimiter. Từ hai công thức liên tiếp trở lên cùng biến đổi một biểu thức/phương trình, cùng cô lập một đại lượng hoặc cùng duy trì tập nghiệm vẫn là một chuỗi duy nhất, dù mỗi công thức nằm trong display riêng và chỉ có một dấu `=`.",
  "Phải gom chuỗi đó trong một `aligned`/`split`, giữ đại lượng cần tìm ở vế trái sau khi đã cô lập và thể hiện bước chuyển vế, thế, rút gọn, khai căn, chia hoặc biến đổi chính. Được gộp số học hiển nhiên nhưng không được nhảy qua bước chuyên môn quyết định.",
  "Nếu phép biến đổi có thể sinh nhiều nhánh, làm mất nghiệm hoặc đòi hỏi điều kiện, phải nêu điều kiện và chỉ loại nhánh theo ngữ cảnh chuyên môn. Ví dụ tổng quát SAI: ba display rời `u^2=p^2-q^2`, `u^2=r`, `u=\\sqrt{r}` không nêu điều kiện; dạng ĐÚNG gom hai bước tính trong một `aligned`, rồi nêu điều kiện trước kết luận.",
  "Counterexample hợp lệ: các phương trình độc lập của một hệ, các phép gán cho những đại lượng khác nhau hoặc một phép tính một bước vẫn giữ riêng. Với `SOURCE_EXACT`, giữ phương pháp của nguồn nhưng phải bảo toàn liên kết logic và điều kiện; không đổi sang phương pháp khác chỉ để rút gọn.",
].join(" ");
export const LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION =
  "Trong problem, solution và answer của mọi example/bài tập, mỗi ý con mang nhãn a), b), c) hoặc nhãn chữ cái tương đương phải bắt đầu ở dòng riêng; không được đặt hai nhãn ý con trên cùng một dòng.";
export const LESSON_SUMMARY_PROVIDER_ROOT_FORMATTING_DESCRIPTION = `Structured output của bản tóm tắt bài học; mọi field văn bản phải tuân thủ quy tắc nội dung, nguồn, lập luận và định dạng trong system prompt. ${LEARNER_MATH_TEXT_SYNTAX_DESCRIPTION}`;
const LESSON_SUMMARY_THEORY_SECTIONS_DESCRIPTION =
  "Các đề mục kiến thức lớn của bài theo đúng thứ tự nguồn; không chứa đề mục Ví dụ, Luyện tập, Vận dụng hoặc Bài tập.";
const LESSON_SUMMARY_OBJECTIVES_DESCRIPTION =
  "Khối riêng ở đầu bản Sinh kiến thức; đúng một ý ngắn gọn cho mỗi theorySections cùng vị trí, nêu kiến thức hoặc năng lực trọng tâm của section tương ứng. Không tạo objective cho Ví dụ, Luyện tập, Vận dụng, Bài tập, tiểu mục hoặc applicationExercises.";

const baseBlockSchema = z.object({
  figures: z.array(stemFigureVisualSchema).max(3).default([]),
  sourcePageNumbers: z.array(z.number().int().positive()).max(20).optional(),
});

export const lessonSummaryExampleOriginSchema = z.enum([
  "SOURCE_EXACT",
  "SOURCE_ADAPTED",
  "AI_AUTHORED",
]);

export const lessonSummarySourceAssessmentSchema = z
  .object({
    status: z.enum(["CONFIRMED", "CORRECTED", "UNCERTAIN"]),
    reason: nonEmptyText(1_000),
    correctedKindHint: z
      .enum(["ILLUSTRATION", "STANDARD_EXERCISE", "REAL_WORLD_EXERCISE", "UNKNOWN"])
      .nullable(),
    correctedRelatedTopicId: nonEmptyText(300).nullable(),
  })
  .strict();

const knowledgeBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("knowledge"),
    title: nonEmptyText(240),
    content: nonEmptyText(6_000).describe(
      `Chỉ trình bày lý thuyết; không chứa ví dụ/bài tập. Bao gồm định nghĩa, công thức, tiêu chuẩn, quy tắc, phương pháp và trình tự không được nguồn/câu dẫn thông báo rõ là định lí hay tính chất. Bảo toàn ký hiệu tương đương, hệ điều kiện, dấu ngoặc nhóm, bullet và dấu câu dẫn của nguồn; không văn xuôi hóa công thức. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} ${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION}`,
    ),
  })
  .strict();

const propertyBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("property"),
    title: nonEmptyText(240),
    content: nonEmptyText(6_000).describe(
      `Chỉ dùng cho phát biểu được nhãn, câu dẫn hoặc ngữ nghĩa xung quanh thông báo rõ là một tính chất; không chứa ví dụ/bài tập. Một bảng tiêu chuẩn, quy tắc, phương pháp hoặc chuỗi tương đương không tự trở thành property chỉ vì nó gồm nhiều mệnh đề chuyên môn. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} ${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION}`,
    ),
  })
  .strict();

const exampleBlockSchema = z
  .object({
    type: z.literal("example"),
    problem: nonEmptyText(4_000).describe(
      `${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION} ${LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION}`,
    ),
    solution: nonEmptyText(10_000).describe(
      `${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION} ${LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION}`,
    ),
    answer: nonEmptyText(3_000).describe(
      `${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION} ${LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION}`,
    ),
    isGeometry: z.boolean().optional(),
    geometryStatement: lessonSummaryGeometryStatementSchema.optional(),
    figures: z.array(stemFigureVisualSchema).max(3).default([]),
    origin: lessonSummaryExampleOriginSchema.optional(),
    sourcePageNumbers: z.array(z.number().int().positive()).max(20).optional(),
  })
  .strict();

const exerciseBlockSchema = exampleBlockSchema.extend({
  type: z.literal("exercise"),
});

const noteBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("note"),
    content: nonEmptyText(3_000).describe(
      `Chỉ dùng cho ý Chú ý, Lưu ý hoặc Nhận xét có trong nguồn. Không bắt đầu content bằng Chú ý:, Lưu ý: hoặc Nhận xét: vì giao diện đã hiển thị nhãn khối. Ví dụ là tùy chọn; nếu có phải tự đủ dữ kiện và không phụ thuộc hình/ảnh/URL của tài liệu nguồn. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} ${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION}`,
    ),
  })
  .strict();

const theoremBlockSchema = baseBlockSchema
  .extend({
    type: z.literal("theorem"),
    title: nonEmptyText(240),
    content: nonEmptyText(6_000).describe(
      `Chỉ dùng cho phát biểu được nhãn hoặc câu dẫn bên ngoài phát biểu thông báo rõ là một định lí; không chứa ví dụ/bài tập. Điều kiện tương đương, tiêu chuẩn hay công thức quan trọng không tự trở thành theorem chỉ vì nội dung chuyên môn của nó. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} ${LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION}`,
    ),
  })
  .strict();

export const lessonSummaryReviewIssueResolutionSchema = z.enum([
  "ACCEPT_OR_FIX",
  "FIX_ONLY",
]);

export type LessonSummaryReviewIssueResolution = z.infer<
  typeof lessonSummaryReviewIssueResolutionSchema
>;

const FIX_ONLY_LESSON_SUMMARY_ISSUE_CODES = new Set([
  "BLOCK_CANNOT_PROCESS",
  "BLOCK_SCHEMA_INVALID",
  "DIAGRAM_CANNOT_RENDER",
  "MISSING_REQUIRED_FIGURE",
  "MISSING_REQUIRED_FIELD",
  "MISSING_SUMMARY_TITLE",
  "MISSING_THEORY_SECTION",
  "MISSING_THEORY_UNIT",
  "MALFORMED_LATEX",
]);

export function resolveLessonSummaryReviewIssueResolution(
  code: string,
): LessonSummaryReviewIssueResolution {
  if (
    FIX_ONLY_LESSON_SUMMARY_ISSUE_CODES.has(code) ||
    code.endsWith("_CANNOT_RENDER") ||
    code.endsWith("_CANNOT_PROCESS")
  ) {
    return "FIX_ONLY";
  }
  return "ACCEPT_OR_FIX";
}

export const lessonSummaryReviewIssueSchema = z
  .object({
    id: nonEmptyText(100),
    code: nonEmptyText(100),
    path: nonEmptyText(500),
    message: nonEmptyText(1_000),
    suggestion: nonEmptyText(1_000),
    technicalDetails: nonEmptyText(2_000).nullable(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    resolution: lessonSummaryReviewIssueResolutionSchema.optional(),
    accepted: z.boolean(),
  })
  .strict();

const reviewIssuesShape = {
  reviewIssues: z.array(lessonSummaryReviewIssueSchema).max(50).optional(),
};

const reviewedKnowledgeBlockSchema = knowledgeBlockSchema.extend(reviewIssuesShape);
const reviewedPropertyBlockSchema = propertyBlockSchema.extend(reviewIssuesShape);
const reviewedExampleBlockSchema = exampleBlockSchema.extend(reviewIssuesShape);
const reviewedExerciseBlockSchema = exerciseBlockSchema.extend(reviewIssuesShape);
const reviewedNoteBlockSchema = noteBlockSchema.extend(reviewIssuesShape);
const reviewedTheoremBlockSchema = theoremBlockSchema.extend(reviewIssuesShape);

export const lessonSummaryMvpBlockSchema = z.discriminatedUnion("type", [
  reviewedKnowledgeBlockSchema,
  reviewedPropertyBlockSchema,
  reviewedExampleBlockSchema,
  reviewedExerciseBlockSchema,
  reviewedNoteBlockSchema,
  reviewedTheoremBlockSchema,
]);

export type LessonSummaryMvpBlock = z.infer<typeof lessonSummaryMvpBlockSchema>;

const LESSON_SUMMARY_PROVIDER_SOLUTION_OWNERSHIP_DESCRIPTION =
  "Chỉ chứa thân lời giải; không chứa tiêu đề do UI sở hữu, không lặp lại answer hoặc dữ liệu cấu trúc đã được tách sang field riêng.";
export const LESSON_SUMMARY_PROVIDER_SOLUTION_DESCRIPTION = `${LESSON_SUMMARY_PROVIDER_SOLUTION_OWNERSHIP_DESCRIPTION} Lời giải phải đầy đủ theo phong cách sách giáo khoa: không làm tắt, không bỏ bước biến đổi hoặc suy luận cần thiết để người học theo dõi. Tuân theo cách lập luận của hồ sơ môn học trong system prompt, giữ đúng thứ tự suy luận và không biến toàn bộ lời giải thành checklist rời rạc. Bảo toàn ký hiệu tương đương và hệ ngoặc nhóm có ý nghĩa. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION}`;
const LESSON_SUMMARY_PROVIDER_GEOMETRY_STATEMENT_OWNERSHIP_DESCRIPTION =
  "Bắt buộc khác null cho bài Hình học lớp 7–9 và phải chứa bảng Giả thiết–Kết luận; Hình học lớp 10–12 và nội dung không phải Hình học phải trả null. Khi có giá trị, không chép lại bảng này vào solution.";
const LESSON_SUMMARY_PROVIDER_GEOMETRY_STATEMENT_DESCRIPTION = `${LESSON_SUMMARY_PROVIDER_GEOMETRY_STATEMENT_OWNERSHIP_DESCRIPTION} hypotheses chỉ chứa dữ kiện có sẵn trong đề và conclusions ghi đúng điều cần kết luận.`;

const transportText = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const lessonSummaryProviderProblemFieldSchema = transportText(4_000).describe(
  "Đề ví dụ/bài tập đầy đủ dữ kiện, yêu cầu và phạm vi cần kiểm tra. Với ví dụ minh họa theory, phải bao phủ trực tiếp các trường hợp hoặc cách làm độc lập của theory; nếu không thể bao phủ gọn trong một bài nhiều ý thì tách theory thành các UNIT nhỏ hơn.",
);
const lessonSummaryProviderSolutionFieldSchema = transportText(10_000).describe(
  LESSON_SUMMARY_PROVIDER_SOLUTION_DESCRIPTION,
);
const lessonSummaryProviderAnswerFieldSchema = transportText(3_000).describe(
  "Đáp án hoặc kết quả cuối của bài; không lặp lại toàn bộ thân lời giải.",
);
const providerSourcePageNumbersSchema = z.array(z.number().int().positive()).max(20);
const providerTheorySourcePageNumbersSchema = providerSourcePageNumbersSchema
  .min(1)
  .describe("Các trang packet chứa trực tiếp nội dung của block lý thuyết.");
const providerNoteSourcePageNumbersSchema = providerSourcePageNumbersSchema
  .min(1)
  .describe("Các trang packet chứa trực tiếp nội dung của block ghi chú.");
const providerSourcedExamplePageNumbersSchema = providerSourcePageNumbersSchema
  .min(1)
  .describe("SOURCE_EXACT/SOURCE_ADAPTED bắt buộc có ít nhất một trang nguồn.");
const providerAiAuthoredExamplePageNumbersSchema = providerSourcePageNumbersSchema
  .max(0)
  .describe("AI_AUTHORED bắt buộc có sourcePageNumbers là mảng rỗng.");
export const sourceEvidenceSchema = z
  .object({
    kind: z.enum(["HEADING", "CONTENT"]),
    text: z.string().trim().min(1).max(800),
    packetPageNumbers: z.array(z.number().int().positive()).min(1).max(20),
  })
  .strict();
export const stemFigureSourceTargetSchema = z.discriminatedUnion("scope", [
  z
    .object({
      scope: z.literal("WHOLE_FIGURE"),
      locator: z.null(),
    })
    .strict(),
  z
    .object({
      scope: z.literal("SUBFIGURE"),
      locator: z.string().trim().min(1).max(300),
    })
    .strict(),
]);

export type StemFigureSourceTarget = z.infer<typeof stemFigureSourceTargetSchema>;

const stemFigureSourceReferenceSchema = z
  .object({
    packetPageNumber: z.number().int().positive(),
    printedPageLabel: z.string().trim().max(80).nullable(),
    figureLabel: z.string().trim().max(160).nullable(),
    sourceTarget: stemFigureSourceTargetSchema.describe(
      "Phạm vi cần lấy trong hình nguồn. WHOLE_FIGURE dùng toàn bộ hình mang figureLabel; SUBFIGURE dùng đúng hình con được locator định vị. Đây chỉ là locator nguồn, không chứa hướng dẫn vẽ.",
    ),
  })
  .strict();

const stemFigureTextbookProviderPlanSchema = z
  .object({
    figureOrigin: z
      .literal("TEXTBOOK_SOURCE")
      .describe("Hình trực quan có thật trong PDF và bắt buộc có sourceReferences."),
    sourceReferences: z.array(stemFigureSourceReferenceSchema).min(1).max(5),
  })
  .strict();
const stemFigureGeneratedProviderPlanSchema = z
  .object({
    figureOrigin: z
      .literal("GENERATED_FROM_BRIEF")
      .describe(
        "Hình mới do AI đề xuất; đây chỉ là nhãn provenance, không yêu cầu hoặc cho phép thêm field brief.",
      ),
    sourceReferences: z.array(stemFigureSourceReferenceSchema).max(0),
  })
  .strict();
export const stemFigureProviderPlanDraftSchema = z.discriminatedUnion("figureOrigin", [
  stemFigureTextbookProviderPlanSchema,
  stemFigureGeneratedProviderPlanSchema,
]);
const stemFigurePlanIdentityShape = {
  figurePlanContractVersion: z.literal(3),
  localId: z
    .string()
    .trim()
    .regex(/^F\d{3}$/u),
};
export const stemFigurePlanDraftSchema = z.discriminatedUnion("figureOrigin", [
  stemFigureTextbookProviderPlanSchema
    .extend({
      ...stemFigurePlanIdentityShape,
      altText: z.string().trim().min(1).max(500),
    })
    .strict(),
  stemFigureGeneratedProviderPlanSchema
    .extend({
      ...stemFigurePlanIdentityShape,
      altText: z.string().trim().min(1).max(500),
    })
    .strict(),
]);
/**
 * Only the semantic fields required to resolve references and render a figure.
 * Alternative text has its own revision lifecycle and must not make an otherwise
 * valid render plan unreadable after accessibility rules evolve.
 */
const stemFigureRenderDisplayShape = {
  altText: z.string().nullable().optional(),
  // Backward-compatible persisted/admin metadata only. Provider-facing plans
  // intentionally do not expose or request this field.
  caption: z.string().nullable().optional(),
};
export const stemFigureRenderPlanSchema = z.discriminatedUnion("figureOrigin", [
  z
    .object({
      figureOrigin: z.literal("TEXTBOOK_SOURCE"),
      sourceReferences: z.array(stemFigureSourceReferenceSchema).min(1).max(5),
      ...stemFigurePlanIdentityShape,
      ...stemFigureRenderDisplayShape,
    })
    .strict(),
  z
    .object({
      figureOrigin: z.literal("GENERATED_FROM_BRIEF"),
      sourceReferences: z.array(stemFigureSourceReferenceSchema).max(0),
      ...stemFigurePlanIdentityShape,
      ...stemFigureRenderDisplayShape,
    })
    .strict(),
]);
const transportFiguresSchema = z
  .array(stemFigureProviderPlanDraftSchema)
  .max(1)
  .describe(
    "Figure plan của riêng block. Bắt buộc có ít nhất một phần tử nếu bất kỳ hình ở trước hoặc sau trong nguồn trực tiếp minh họa, giải thích hay cung cấp dữ kiện cho block; chỉ để mảng rỗng sau khi đã đối chiếu inventory toàn bộ hình nguồn và xác nhận không có hình liên quan trực tiếp, hoặc hình bổ sung không có giá trị sư phạm.",
  );

export type LessonSummaryFigureRequirement = "CONTEXTUAL" | "ALL_REQUIRED";

function createLessonSummaryTheoryBlockTransportSchema(
  figureSchema: typeof transportFiguresSchema,
) {
  const baseShape = {
    sourcePageNumbers: providerNoteSourcePageNumbersSchema,
    figures: figureSchema,
  };
  return z.discriminatedUnion("type", [
    z
      .object({
        ...baseShape,
        type: z.literal("knowledge"),
        title: transportText(240),
        content: transportText(6_000).describe(
          `Nội dung kiến thức/định nghĩa/tiêu chuẩn/quy tắc/phương pháp đầy đủ theo nguồn khi không có semantic cue rõ cho định lí/tính chất. Bảo toàn ký hiệu tương đương, hệ ngoặc nhóm, bullet, dấu câu dẫn và bố cục công thức có ý nghĩa; không văn xuôi hóa. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} Không hấp thụ đoạn có nhãn rõ Chú ý, Nhận xét, Lưu ý hoặc lời dẫn tương đương; các đoạn đó phải thành NOTE riêng.`,
        ),
      })
      .strict(),
    z
      .object({
        ...baseShape,
        type: z.literal("property"),
        title: transportText(240),
        content: transportText(6_000).describe(
          `Phát biểu được nhãn/câu dẫn/ngữ nghĩa xung quanh thông báo rõ là tính chất, đầy đủ theo nguồn. Không dùng property chỉ vì nội dung là bảng tiêu chuẩn, quy tắc, phương pháp hoặc chuỗi tương đương. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} Không hấp thụ đoạn có nhãn rõ Chú ý, Nhận xét, Lưu ý hoặc lời dẫn tương đương; các đoạn đó phải thành NOTE riêng.`,
        ),
      })
      .strict(),
    z
      .object({
        ...baseShape,
        type: z.literal("theorem"),
        title: transportText(240),
        content: transportText(6_000).describe(
          `Phát biểu được nhãn hoặc câu dẫn bên ngoài phát biểu thông báo rõ là định lí, đầy đủ theo nguồn. Điều kiện tương đương, tiêu chuẩn hay công thức quan trọng không tự trở thành theorem chỉ vì nội dung chuyên môn. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION} Không hấp thụ đoạn có nhãn rõ Chú ý, Nhận xét, Lưu ý hoặc lời dẫn tương đương; các đoạn đó phải thành NOTE riêng.`,
        ),
      })
      .strict(),
  ]);
}

export const lessonSummaryTheoryBlockTransportSchema =
  createLessonSummaryTheoryBlockTransportSchema(transportFiguresSchema);

export const lessonSummaryProviderNoteTransportSchema = z
  .object({
    type: z.literal("note"),
    content: transportText(3_000).describe(
      `Ý Chú ý/Nhận xét/Lưu ý bổ trợ đúng phần kiến thức liên quan; đi thẳng vào nội dung và không lặp nhãn loại block. Khi nguồn có nhãn rõ Chú ý, Nhận xét, Lưu ý hoặc lời dẫn có cùng chức năng thì bắt buộc biểu diễn bằng NOTE này, không gộp vào theory. ${LESSON_SUMMARY_SEMANTIC_LAYOUT_DESCRIPTION}`,
    ),
    sourcePageNumbers: providerTheorySourcePageNumbersSchema,
  })
  .strict();

const providerGeometryStatementSchema = z
  .object({
    hypotheses: z.array(transportText(1_000)).min(1).max(20),
    conclusions: z.array(transportText(1_000)).min(1).max(20),
  })
  .strict()
  .describe(LESSON_SUMMARY_PROVIDER_GEOMETRY_STATEMENT_DESCRIPTION);

const providerSourcedExampleProvenanceShape = {
  origin: z.enum(["SOURCE_EXACT", "SOURCE_ADAPTED"]),
  sourcePageNumbers: providerSourcedExamplePageNumbersSchema,
};
const providerAiAuthoredExampleProvenanceShape = {
  origin: z.literal("AI_AUTHORED"),
  sourcePageNumbers: providerAiAuthoredExamplePageNumbersSchema,
};

function createLessonSummaryProviderExampleTransportSchema<
  TKind extends "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE",
>(
  exampleKind: TKind,
  figureSchema: typeof transportFiguresSchema = transportFiguresSchema,
  targetGrade: number | null = null,
) {
  const blockType = (
    exampleKind === "ILLUSTRATION" ? "example" : "exercise"
  ) as TKind extends "ILLUSTRATION" ? "example" : "exercise";
  const baseShape = {
    type: z.literal(blockType),
    exampleKind: z.literal(exampleKind),
    problem: lessonSummaryProviderProblemFieldSchema,
    solution: lessonSummaryProviderSolutionFieldSchema,
    answer: lessonSummaryProviderAnswerFieldSchema,
    figures: figureSchema,
  };
  if (targetGrade !== null && (targetGrade < 7 || targetGrade > 9)) {
    const geometryShape = {
      isGeometry: z.boolean(),
      geometryStatement: z
        .null()
        .describe("Bắt buộc null với lớp 10–12 và mọi lớp ngoài phạm vi 7–9."),
    };
    return z.union([
      z
        .object({
          ...baseShape,
          ...providerSourcedExampleProvenanceShape,
          ...geometryShape,
        })
        .strict(),
      z
        .object({
          ...baseShape,
          ...providerAiAuthoredExampleProvenanceShape,
          ...geometryShape,
        })
        .strict(),
    ]);
  }
  return z.union([
    z
      .object({
        ...baseShape,
        ...providerSourcedExampleProvenanceShape,
        isGeometry: z.literal(true),
        geometryStatement: providerGeometryStatementSchema,
      })
      .strict(),
    z
      .object({
        ...baseShape,
        ...providerSourcedExampleProvenanceShape,
        isGeometry: z.literal(false),
        geometryStatement: z.null(),
      })
      .strict(),
    z
      .object({
        ...baseShape,
        ...providerAiAuthoredExampleProvenanceShape,
        isGeometry: z.literal(true),
        geometryStatement: providerGeometryStatementSchema,
      })
      .strict(),
    z
      .object({
        ...baseShape,
        ...providerAiAuthoredExampleProvenanceShape,
        isGeometry: z.literal(false),
        geometryStatement: z.null(),
      })
      .strict(),
  ]);
}

function createLessonSummaryProviderNonMathExampleTransportSchema<
  TKind extends "ILLUSTRATION" | "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE",
>(
  exampleKind: TKind,
  figureSchema: typeof transportFiguresSchema = transportFiguresSchema,
) {
  const blockType = (
    exampleKind === "ILLUSTRATION" ? "example" : "exercise"
  ) as TKind extends "ILLUSTRATION" ? "example" : "exercise";
  const baseShape = {
    type: z.literal(blockType),
    exampleKind: z.literal(exampleKind),
    problem: lessonSummaryProviderProblemFieldSchema,
    solution: lessonSummaryProviderSolutionFieldSchema,
    answer: lessonSummaryProviderAnswerFieldSchema,
    figures: figureSchema,
  };
  return z.union([
    z
      .object({
        ...baseShape,
        ...providerSourcedExampleProvenanceShape,
      })
      .strict(),
    z
      .object({
        ...baseShape,
        ...providerAiAuthoredExampleProvenanceShape,
      })
      .strict(),
  ]);
}

export const lessonSummaryIllustrationTransportSchema =
  createLessonSummaryProviderExampleTransportSchema("ILLUSTRATION");
export const lessonSummaryStandardExerciseTransportSchema =
  createLessonSummaryProviderExampleTransportSchema("STANDARD_EXERCISE");
export const lessonSummaryRealWorldExerciseTransportSchema =
  createLessonSummaryProviderExampleTransportSchema("REAL_WORLD_EXERCISE");
const lessonSummaryNonMathIllustrationTransportSchema =
  createLessonSummaryProviderNonMathExampleTransportSchema("ILLUSTRATION");
const lessonSummaryNonMathStandardExerciseTransportSchema =
  createLessonSummaryProviderNonMathExampleTransportSchema("STANDARD_EXERCISE");
const lessonSummaryNonMathRealWorldExerciseTransportSchema =
  createLessonSummaryProviderNonMathExampleTransportSchema("REAL_WORLD_EXERCISE");

const lessonSummaryNonMathSectionItemSchema = z.discriminatedUnion("itemType", [
  z
    .object({
      itemType: z.literal("UNIT"),
      theory: lessonSummaryTheoryBlockTransportSchema,
      example: lessonSummaryNonMathIllustrationTransportSchema,
    })
    .strict(),
  z
    .object({
      itemType: z.literal("NOTE"),
      note: lessonSummaryProviderNoteTransportSchema,
    })
    .strict(),
]);

/**
 * Transport contract used for the single paid provider call. It keeps the root
 * ownership structure strict while deferring per-block semantic checks to the
 * recovery mapper, so one local defect cannot discard the whole lesson.
 */
function createLessonSummaryProviderTransportOutputBaseSchema(
  targetGrade: number | null = null,
  counts?: LessonSummaryApplicationExerciseCounts,
) {
  const illustrationSchema = createLessonSummaryProviderExampleTransportSchema(
    "ILLUSTRATION",
    transportFiguresSchema,
    targetGrade,
  );
  const standardExerciseSchema = createLessonSummaryProviderExampleTransportSchema(
    "STANDARD_EXERCISE",
    transportFiguresSchema,
    targetGrade,
  );
  const realWorldExerciseSchema = createLessonSummaryProviderExampleTransportSchema(
    "REAL_WORLD_EXERCISE",
    transportFiguresSchema,
    targetGrade,
  );
  const sectionItemSchema = z.discriminatedUnion("itemType", [
    z
      .object({
        itemType: z.literal("UNIT"),
        theory: lessonSummaryTheoryBlockTransportSchema,
        example: illustrationSchema,
      })
      .strict(),
    z
      .object({
        itemType: z.literal("NOTE"),
        note: lessonSummaryProviderNoteTransportSchema,
      })
      .strict(),
  ]);
  return z
    .object({
      title: transportText(240),
      objectives: z
        .array(transportText(500))
        .min(1)
        .max(19)
        .describe(LESSON_SUMMARY_OBJECTIVES_DESCRIPTION),
      theorySections: z
        .array(
          z
            .object({
              displayHeading: transportText(240),
              sourceEvidence: sourceEvidenceSchema,
              items: z.array(sectionItemSchema).min(1).max(60),
            })
            .strict(),
        )
        .min(1)
        .max(19)
        .describe(LESSON_SUMMARY_THEORY_SECTIONS_DESCRIPTION),
      applicationExercises: z
        .object({
          standardExercises: counts
            ? z.array(standardExerciseSchema).length(counts.standardExerciseCount)
            : z.array(standardExerciseSchema),
          realWorldExercises: counts
            ? z.array(realWorldExerciseSchema).length(counts.realWorldExerciseCount)
            : z.array(realWorldExerciseSchema),
        })
        .strict(),
    })
    .strict()
    .describe(LESSON_SUMMARY_PROVIDER_ROOT_FORMATTING_DESCRIPTION);
}

const lessonSummaryProviderTransportOutputBaseSchema =
  createLessonSummaryProviderTransportOutputBaseSchema();

function createLessonSummaryProviderNonMathTransportOutputSchema(
  counts?: LessonSummaryApplicationExerciseCounts,
) {
  return z
    .object({
      title: transportText(240),
      objectives: z
        .array(transportText(500))
        .min(1)
        .max(19)
        .describe(LESSON_SUMMARY_OBJECTIVES_DESCRIPTION),
      theorySections: z
        .array(
          z
            .object({
              displayHeading: transportText(240),
              sourceEvidence: sourceEvidenceSchema,
              items: z.array(lessonSummaryNonMathSectionItemSchema).min(1).max(60),
            })
            .strict(),
        )
        .min(1)
        .max(19)
        .describe(LESSON_SUMMARY_THEORY_SECTIONS_DESCRIPTION),
      applicationExercises: z
        .object({
          standardExercises: counts
            ? z
                .array(lessonSummaryNonMathStandardExerciseTransportSchema)
                .length(counts.standardExerciseCount)
            : z.array(lessonSummaryNonMathStandardExerciseTransportSchema),
          realWorldExercises: counts
            ? z
                .array(lessonSummaryNonMathRealWorldExerciseTransportSchema)
                .length(counts.realWorldExerciseCount)
            : z.array(lessonSummaryNonMathRealWorldExerciseTransportSchema),
        })
        .strict(),
    })
    .strict()
    .describe(LESSON_SUMMARY_PROVIDER_ROOT_FORMATTING_DESCRIPTION);
}

/**
 * Select the provider schema by subject. Subject-specific fields stay in the
 * matching schema instead of leaking into requests for another course domain.
 * Passing `counts` locks the schema sent to the provider; omitting it keeps the
 * backend ingestion/editor schema tolerant of count mismatches.
 */
export function getLessonSummaryProviderTransportOutputSchema(
  subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL",
  _figureRequirement: LessonSummaryFigureRequirement = "CONTEXTUAL",
  targetGrade: number | null = null,
  counts?: LessonSummaryApplicationExerciseCounts,
) {
  return subjectKey === "MATH"
    ? createLessonSummaryProviderTransportOutputBaseSchema(targetGrade, counts)
    : createLessonSummaryProviderNonMathTransportOutputSchema(counts);
}

export const lessonSummaryProviderTransportOutputSchema =
  lessonSummaryProviderTransportOutputBaseSchema;

export type LessonSummaryProviderTransportOutput =
  | z.infer<typeof lessonSummaryProviderTransportOutputBaseSchema>
  | z.infer<ReturnType<typeof createLessonSummaryProviderNonMathTransportOutputSchema>>;

export type StemFigurePlanDraft = z.infer<typeof stemFigurePlanDraftSchema>;
export type StemFigureRenderPlan = z.infer<typeof stemFigureRenderPlanSchema>;
export type StemFigureProviderPlanDraft = z.infer<
  typeof stemFigureProviderPlanDraftSchema
>;

export type LessonSummaryProviderTheoryBlock = z.infer<
  typeof lessonSummaryTheoryBlockTransportSchema
>;
export type LessonSummaryProviderExampleBlock =
  | z.infer<typeof lessonSummaryIllustrationTransportSchema>
  | z.infer<typeof lessonSummaryStandardExerciseTransportSchema>
  | z.infer<typeof lessonSummaryRealWorldExerciseTransportSchema>
  | z.infer<typeof lessonSummaryNonMathIllustrationTransportSchema>
  | z.infer<typeof lessonSummaryNonMathStandardExerciseTransportSchema>
  | z.infer<typeof lessonSummaryNonMathRealWorldExerciseTransportSchema>;

export const lessonSummaryWarningDetailSchema = z
  .object({
    code: nonEmptyText(100),
    path: nonEmptyText(500),
    message: nonEmptyText(1_000),
    severity: z.enum(["INFO", "WARNING"]),
  })
  .strict();

export type LessonSummaryWarningDetail = z.infer<typeof lessonSummaryWarningDetailSchema>;

/** Persisted/API-compatible flat section/block contract. */
export const lessonSummaryOutputSchema = z
  .object({
    lessonId: nonEmptyText(240),
    targetGrade: z.number().int().min(1).max(12).nullable().optional(),
    title: nonEmptyText(240),
    objectives: z.array(nonEmptyText(500)).min(1).max(19).nullable(),
    sections: z
      .array(
        z
          .object({
            order: z.number().int().positive(),
            displayHeading: nonEmptyText(240),
            sourceEvidence: sourceEvidenceSchema,
            blocks: z.array(lessonSummaryMvpBlockSchema).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    warnings: z.array(nonEmptyText(1_000)).nullable().optional(),
    warningDetails: z
      .array(lessonSummaryWarningDetailSchema)
      .max(100)
      .nullable()
      .optional(),
    reviewIssues: z.array(lessonSummaryReviewIssueSchema).max(100).optional(),
  })
  .strict();

export const lessonSummaryJobInputSchema = z
  .object({
    documentIds: z.array(z.uuid()).min(1).max(20),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    requestDraftId: z.uuid(),
    requestHash: z.string().regex(/^[a-f0-9]{64}$/),
    packetHash: z.string().regex(/^[a-f0-9]{64}$/),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    useTextbookSourceImages: z.boolean().default(false),
    autoEnhanceTextbookSourceImages: z.boolean().default(false),
    targetGrade: z.number().int().min(1).max(12).nullable().default(null),
    subjectKey: lessonSummarySubjectKeySchema,
    subjectName: z.string().trim().min(1).max(120),
    subjectSlug: z.string().trim().min(1).max(140),
    style: lessonSummaryStyleSchema,
    styleInstructions: z.string().trim().max(1_000).default(""),
    length: lessonSummaryLengthSchema.default("standard"),
    targetWordCount: z.number().int().min(50).max(5_000).nullable().default(null),
    standardExerciseCount: z
      .number()
      .int()
      .min(LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT)
      .max(LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT)
      .default(LESSON_SUMMARY_DEFAULT_STANDARD_EXERCISE_COUNT),
    realWorldExerciseCount: z
      .number()
      .int()
      .min(LESSON_SUMMARY_MIN_APPLICATION_EXERCISE_COUNT)
      .max(LESSON_SUMMARY_MAX_APPLICATION_EXERCISE_COUNT)
      .default(LESSON_SUMMARY_DEFAULT_REAL_WORLD_EXERCISE_COUNT),
    extraInstructions: z.string().trim().max(2_000).default(""),
    systemInstructions: z
      .string()
      .max(LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS)
      .default(""),
    userPrompt: z.string().max(16_000).default(""),
    imageRouteSnapshot: z.record(z.string(), z.unknown()).optional(),
    model: z.string().max(200).optional(),
    temperature: z.number().min(0).max(1).optional(),
    reasoningEffort: z.enum(AI_REASONING_EFFORT_LEVELS).optional(),
    schemaReferenceStrategy: z.enum(["inline", "ref", "ref_v2"]).default("inline"),
    promptCacheKeyEnabled: z.boolean().default(false),
    promptCacheRetention: z.enum(["in_memory", "24h"]).default("in_memory"),
    maxOutputTokens: z
      .number()
      .int()
      .min(500)
      .max(LESSON_SUMMARY_MAX_CONFIGURED_OUTPUT_TOKENS)
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.autoEnhanceTextbookSourceImages && !value.useTextbookSourceImages) {
      context.addIssue({
        code: "custom",
        path: ["autoEnhanceTextbookSourceImages"],
        message: "Chỉ có thể tự động làm nét khi dùng ảnh gốc sách giáo khoa.",
      });
    }
  });

export type LessonSummaryOutput = z.infer<typeof lessonSummaryOutputSchema>;
export type LessonSummaryJobInput = z.infer<typeof lessonSummaryJobInputSchema>;
