import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildLessonSummarySubjectSystemPrompt } from "#api/modules/ai/utils/lesson-summary-prompt";
import { buildQuestionFigureStructuredInput } from "#api/modules/question-figures/types/question-figure-generation.types";
import { buildQuestionFigureSystemPrompt } from "#api/modules/question-figures/utils/prompts/question-figure-system-prompt-resolver";
import {
  buildQuizFigureRefinementSystemPrompt,
  buildQuizFigureSystemPrompt,
} from "#api/modules/quiz-figures/utils/prompts/quiz-figure-system-prompt-resolver";
import type { QuizSubjectSnapshot } from "#api/modules/quiz/types/quiz-generation.types";
import { buildQuizSubjectSystemPrompt } from "#api/modules/quiz/utils/quiz-generation-prompt";
import { buildStemFigureSystemPrompt } from "#api/modules/stem-figures/utils/prompts/stem-figure-system-prompt-resolver";

const subjects = [
  { id: "math", key: "MATH", name: "Toán", slug: "toan" },
  { id: "physics", key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
  { id: "chemistry", key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
  { id: "general", key: "GENERAL", name: "Môn khác", slug: "mon-khac" },
] as const;

const promptRoots = [
  {
    root: "src/modules/quiz/utils/prompts",
    suffix: "quiz-system-prompt.ts",
  },
  {
    root: "src/modules/question-figures/utils/prompts",
    suffix: "question-figure-system-prompt.ts",
  },
  {
    root: "src/modules/solution-figures/utils/prompts",
    suffix: "solution-figure-system-prompt.ts",
  },
  {
    root: "src/modules/ai/utils/prompts/lesson-summary",
    suffix: "lesson-summary-system-prompt.ts",
  },
  {
    root: "src/modules/stem-figures/utils/prompts",
    suffix: "stem-figure-system-prompt.ts",
  },
] as const;

function expectCompleteSpatialLabelPolicy(prompt: string) {
  expect(prompt).toContain("### LIÊN THUỘC KHÔNG GIAN CỦA NHÃN");
  expect(prompt).toContain(
    "tên điểm, đỉnh, nút, mốc hoặc nhãn định danh ngắn phải dùng chính coordinate",
  );
  expect(prompt).toContain("ngay phía ngoài cung với khe hở nhỏ");
  expect(prompt).toContain("điều chỉnh đồng bộ bán kính cung và vị trí nhãn");
  expect(prompt).toContain("`node[midway, ...]` hoặc `node[pos=..., ...]`");
  expect(prompt).toContain("bắt buộc dùng leader line");
  expect(prompt).toContain("midpoint trống vẫn hợp lệ nhưng không bắt buộc");
  expect(prompt).toContain("cụm nhãn chật dù hai bounding box chưa giao nhau");
  expect(prompt).toContain("phía pháp tuyến đối diện với tên điểm/nút");
  expect(prompt).toContain("Một miền trong hình còn trống vẫn là phía trống");
  expect(prompt).toContain(
    "chỉ giảm khoảng hở nhưng giữ hai nhãn cùng phía không giải quyết",
  );
  expect(prompt).toContain(
    "bounding box nhãn đo ở phía đối diện sẽ thật sự chạm hay che nét",
  );
  expect(prompt).toContain("cấm đổi phía máy móc");
  expect(prompt).toContain(
    "đặt cả trị số, khoảng cách mảnh và đơn vị trong cùng `\\mathrm{...}`",
  );
  expect(prompt).toContain("lệnh font chỉ bọc đơn vị");
  expect(prompt).toContain("hay cách trộn math/text tương đương");
  expect(prompt).toMatch(/\{\$\\mathrm\{(?:10|25)\\,/u);
  expect(prompt).toMatch(/cấm `\{\$(?:10|25)\\,\\mathrm\{/u);
  expect(prompt).toContain("Counterexample typography:");
  expect(prompt).toMatch(
    /(?:bảo toàn phần typography ngoài phạm vi được phép thay đổi|chỉ giữ typography của candidate khi không mâu thuẫn authority)/u,
  );
  expect(prompt).toContain("phân cấp cỡ chữ là invariant bắt buộc");
  expect(prompt).toContain("là nhãn chính và giữ cỡ baseline");
  expect(prompt).toContain("nhãn phụ không định danh như số đo hoặc biểu thức góc");
  expect(prompt).toContain("phải mặc định nhỏ hơn nhãn chính bằng `font=\\small`");
  expect(prompt).toContain("Không để nhãn phụ ở cùng cỡ baseline");
  expect(prompt).toContain("Sau mỗi lần chọn hoặc đổi cấp chữ");
  expect(prompt).toContain("gần nhất có thể với đúng coordinate/path/cung sở hữu");
  expect(prompt).toContain("chỉ chừa khe hở tối thiểu để không chạm nét");
  expect(prompt).toContain("cấm thu nhỏ rồi giữ vị trí cũ làm nhãn trôi xa");
  expect(prompt).toContain("Cỡ chữ mặc định chỉ là baseline");
  expect(prompt).toContain("`font=\\small`");
  expect(prompt).toContain("`font=\\footnotesize`");
  expect(prompt).toContain("`\\scriptsize`");
  expect(prompt).toContain("thu nhỏ nhãn ngắn để chữa một anchor sai");
  expect(prompt).toContain("cấm giữ nguyên khoảng hở cũ làm nhãn trôi vào vùng trắng");
  expect(prompt).toContain("Các nhãn cùng vai trò phải dùng cấp chữ nhất quán");
  expect(prompt).toContain("Counterexample:");
  expect(prompt).toContain("gần bounding box nhãn nhất phải là đúng đối tượng sở hữu");
}

function expectQuizVisibleIdentifierAuthority(prompt: string) {
  expect(prompt).toContain(
    "Tên hoặc nhãn định danh nhìn thấy là nội dung ngữ nghĩa, không phải chi tiết trang trí",
  );
  expect(prompt).toContain("cấm tự gán chữ cái, chữ số hoặc tên tiện ích");
  expect(prompt).toContain("không được render thành text node");
  expect(prompt).toContain("current source và ảnh candidate không phải authority");
  expect(prompt).toContain(
    "mọi nhãn định danh nhìn thấy không truy được về authority phải bị xóa",
  );
  expect(prompt).toContain("Counterexample hợp lệ:");
}

function expectGeneratedStemVisibleIdentifierAuthority(prompt: string) {
  expect(prompt).toContain(
    "Với hình tự thiết kế từ block, tên hoặc nhãn định danh nhìn thấy chỉ được render khi",
  );
  expect(prompt).toContain("Đối tượng chưa được đặt tên phải giữ không nhãn");
  expect(prompt).toContain("không được render thành text node");
  expect(prompt).toContain("Counterexample hợp lệ:");
}

function expectSubjectVisualCompleteness(
  prompt: string,
  subject: (typeof subjects)[number]["key"],
) {
  expectTikzNumericStabilityPolicy(prompt);
  if (subject === "MATH") {
    expect(prompt).toContain("(\\x/15)*(\\x/25)");
    expect(prompt).toContain("### THÀNH PHẦN TỐI THIỂU THEO HỌ HÌNH TOÁN");
    expect(prompt).toContain("móng hình");
    expect(prompt).toContain("`$O$`");
    expect(prompt).toMatch(/parabol.*đỉnh.*một cặp/u);
    expect(prompt).toContain("densely dashed");
    expect(prompt).toContain("tick có số");
    expect(prompt).toContain(
      "một đơn vị số học trên hai trục bắt buộc có cùng độ dài render",
    );
    expect(prompt).toContain("dùng cùng một hệ số đổi cho cả hai trục");
    expect(prompt).toContain("chỉ đặt `x=` bằng `y=` trong TikZ không đủ");
    expect(prompt).toContain(
      "Không áp dụng tỉ lệ 1:1 khi hai trục biểu diễn đại lượng hoặc đơn vị khác nhau",
    );
    expect(prompt).toContain("giữ tick đặc biệt và bỏ tick đều lân cận");
    expect(prompt).toContain("Bỏ chú thích nền thừa");
    expect(prompt).toContain("nằm ngoài dải số tick");
    expect(prompt).toContain("đầu mút mở-đóng");
    expect(prompt).toMatch(/hình không gian/iu);
    expect(prompt).toMatch(/cạnh thấy[-/]khuất/u);
    return;
  }
  expect(prompt).not.toContain(
    "một đơn vị số học trên hai trục bắt buộc có cùng độ dài render",
  );
  if (subject === "PHYSICS") {
    expect(prompt).toContain("### THÀNH PHẦN TỐI THIỂU THEO HỌ HÌNH VẬT LÝ");
    expect(prompt).toContain("móng hình");
    expect(prompt).toContain("điểm đổi chế độ/độ dốc");
    expect(prompt).toContain("densely dashed");
    expect(prompt).toContain("điểm đặt");
    expect(prompt).toMatch(/[Jj]unction/u);
    expect(prompt).toContain("số tia chuẩn");
    expect(prompt).toContain("zero thành `00`");
    expect(prompt).toContain("lặp đơn vị tại cùng một vị trí");
    return;
  }
  if (subject === "CHEMISTRY") {
    expect(prompt).toContain("### THÀNH PHẦN TỐI THIỂU THEO HỌ HÌNH HÓA HỌC");
    expect(prompt).toContain("móng hình");
    expect(prompt).toMatch(/mô hình tiểu phân/iu);
    expect(prompt).toContain("legend");
    expect(prompt).toContain("densely dashed");
    expect(prompt).toContain("đầu vào-đầu ra");
    expect(prompt).toContain("cấm `\\mathrm` ngoài math mode");
    return;
  }
  expect(prompt).toContain("### THÀNH PHẦN TỐI THIỂU CHO BIỂU DIỄN TỔNG QUÁT");
  expect(prompt).toContain("móng hình");
  expect(prompt).toContain("giao nhau trên canvas không tự tạo liên kết");
  expect(prompt).toContain("Style TikZ nội bộ phải dùng tên có prefix riêng");
  expect(prompt).toContain("legend");
  expect(prompt).toContain("sơ đồ định tính không bị ép có trục");
}

function expectTikzNumericStabilityPolicy(prompt: string) {
  expect(prompt).toContain("### ỔN ĐỊNH CÚ PHÁP VÀ SỐ HỌC PGF/TIKZ");
  expect(prompt).toContain("fixed-point");
  expect(prompt).toContain("`scale`, `xscale` hoặc `yscale`");
  expect(prompt).toContain("TikZ `\\pic` với `angle` hoặc `right angle`");
  expect(prompt).toContain("`X--V--Y`");
  expect(prompt).toContain("tên coordinate/node đã khai báo");
  expect(prompt).toContain("viết không có ngoặc tròn");
  expect(prompt).toContain("tọa độ thô, biểu thức calc hoặc dạng `(X)--(V)--(Y)`");
  expect(prompt).toContain("Counterexample:");
}

describe("subject-owned AI system prompt architecture", () => {
  it("keeps a complete source file for every subject in every Quiz/Summary phase", () => {
    for (const promptRoot of promptRoots) {
      for (const subject of subjects) {
        const path = resolve(
          process.cwd(),
          promptRoot.root,
          `${subject.id}-${promptRoot.suffix}`,
        );
        expect(existsSync(path), path).toBe(true);
        const source = readFileSync(path, "utf8");
        expect(source).toContain(`const ${subject.key}_`);
        expect(source).not.toMatch(
          /COMMON_SYSTEM_PROMPT|GLOBAL_VISUAL_POLICY|COMMON_OUTPUT_CONTRACT/u,
        );
        expect(source.match(/^import /gmu)).toHaveLength(1);
        expect(source).toMatch(/^import type /u);
        for (const sibling of subjects) {
          if (sibling.id === subject.id) continue;
          expect(source).not.toContain(`/${sibling.id}-`);
        }
      }
    }
  });

  it("keeps dispatchers free of system-prompt prose and runtime prompt concatenation", () => {
    for (const path of [
      "src/modules/quiz/utils/prompts/quiz-system-prompt-resolver.ts",
      "src/modules/question-figures/utils/prompts/question-figure-system-prompt-resolver.ts",
      "src/modules/quiz-figures/utils/prompts/quiz-figure-system-prompt-resolver.ts",
      "src/modules/solution-figures/utils/prompts/solution-figure-system-prompt-resolver.ts",
      "src/modules/ai/utils/prompts/lesson-summary/lesson-summary-system-prompt-resolver.ts",
      "src/modules/stem-figures/utils/prompts/stem-figure-system-prompt-resolver.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source).not.toContain("### ");
      expect(source).not.toContain("SYSTEM PROMPT ");
      expect(source).not.toContain('.join("\\n")');
    }
  });

  it("selects every Quiz mode only after resolving the owning subject", () => {
    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const phaseOne = buildQuizSubjectSystemPrompt(snapshot);
      expect(phaseOne).toContain(subject.name);
      expect(phaseOne).toContain(
        "`requiresQuestionFigure` là cờ boolean quyết định có tạo hình xuất hiện trước khi học sinh trả lời hay không",
      );
      expect(phaseOne).toContain("Phase 1 chỉ trả hai boolean độc lập");
      expect(phaseOne).not.toContain("caption");
      expect(phaseOne).toContain("kiểm kê nội bộ");
      expect(phaseOne).toContain("Đặt `solutionFigure=true` khi và chỉ khi");
      expect(phaseOne).not.toContain("solutionFigureMode");
      expect(phaseOne).not.toContain("solutionFigurePlan");

      const question = buildQuizFigureSystemPrompt(snapshot, "QUESTION");
      const solution = buildQuizFigureSystemPrompt(snapshot, "SOLUTION");
      for (const prompt of [question, solution]) {
        expect(prompt).toContain(subject.name);
        expectCompleteSpatialLabelPolicy(prompt);
        expectQuizVisibleIdentifierAuthority(prompt);
      }
      expect(question).toContain("HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ");
      expect(question).toContain(
        "lập nội bộ whitelist gồm đúng các dữ kiện được phát biểu trực tiếp",
      );
      expect(question).toContain("Cấm biến hệ quả suy luận thành dữ kiện nhìn thấy");
      expect(question).not.toContain("caption");
      expect(solution).toContain("HỢP ĐỒNG LƯỢT TẠO HÌNH LỜI GIẢI");
      expect(solution).toContain("solution là nguồn có độ ưu tiên cao nhất");
      expect(solution).toContain("hoàn toàn độc lập với hình đề");
      expect(question).not.toContain("requiredModeledObjects");
      expect(solution).not.toContain("requiredModeledObjects");
    }
  });

  it("uses one problem-only Question Figure Core for Summary and Quiz adapters", () => {
    for (const subject of subjects) {
      const problem = `Đề bài cần vẽ của ${subject.name}.`;
      const directPrompt = buildQuestionFigureSystemPrompt(subject);
      const coreInput = buildQuestionFigureStructuredInput({
        subject,
        problem,
        targetGrade: 8,
      });
      const quizInput = buildQuizFigureSystemPrompt(
        subject as QuizSubjectSnapshot,
        "QUESTION",
      );

      expect(coreInput.systemPrompt).toBe(directPrompt);
      expect(quizInput).toBe(directPrompt);
      expect(coreInput.promptVersion).toBe(
        `question-figure-${subject.key.toLowerCase()}-v1-shared`,
      );
      expect(coreInput.schemaVersion).toBe("question-figure-schema-v1");
      expect(coreInput.promptCache).toEqual({
        namespace: "question-figure",
        keyEnabled: true,
        retention: "in_memory",
      });
      expect(JSON.parse(coreInput.userPrompt)).toEqual({
        role: "QUESTION",
        aiMode: "REGENERATE",
        targetGrade: 8,
        problem,
      });
      expect(coreInput.userPrompt).not.toMatch(/solution|answer|hint|option/iu);
      expect(coreInput.inputImages).toEqual([]);
    }
  });

  it("enforces logical derivation continuity in every Quiz and Summary subject prompt only", () => {
    const subjectSpecificRules = {
      MATH: ["độ dài dương", "khai căn"],
      PHYSICS: ["đại lượng vật lí", "điều kiện vật lí"],
      CHEMISTRY: ["đại lượng hóa học", "miền vật lí-hóa học"],
      GENERAL: ["không ép nội dung thuần văn xuôi thành công thức", "phù hợp ngữ cảnh"],
    } as const;

    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const quiz = buildQuizSubjectSystemPrompt(snapshot);
      const summary = buildLessonSummarySubjectSystemPrompt(subject);

      for (const prompt of [quiz, summary]) {
        expect(prompt).toContain("TÍNH LIÊN TỤC CỦA PHÉP BIẾN ĐỔI");
        expect(prompt).toContain("quan hệ logic giữa các dòng");
        expect(prompt).toContain("mỗi display chỉ có một dấu `=`");
        expect(prompt).toContain("Counterexample hợp lệ");
        for (const rule of subjectSpecificRules[subject.key]) {
          expect(prompt).toContain(rule);
        }
      }

      expect(quiz).toContain(
        "Trong cùng lượt viết chuỗi biến đổi, từng cặp dòng kề nhau",
      );
      expect(summary).toContain("đối chiếu từng cặp dòng kề nhau");
      expect(summary).toContain("Với `SOURCE_EXACT`");

      for (const figurePrompt of [
        buildQuizFigureSystemPrompt(snapshot, "QUESTION"),
        buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK"),
      ]) {
        expect(figurePrompt).not.toContain("TÍNH LIÊN TỤC CỦA PHÉP BIẾN ĐỔI");
      }
    }
  });

  it("keeps Phase 1 model review semantic while deterministic checks stay outside prompts", () => {
    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const quiz = buildQuizSubjectSystemPrompt(snapshot);
      const summary = buildLessonSummarySubjectSystemPrompt(subject);

      expect(quiz).not.toContain("LATEX TRONG JSON");
      expect(quiz).not.toContain("Rà mọi field hiển thị trước khi trả JSON");
      expect(quiz).not.toContain("tự rà mọi field có LaTeX");
      expect(quiz).toContain("KIỂM CHỨNG");
      expect(quiz.match(/LƯỢT TỰ GIẢI VÀ KIỂM CHỨNG THEO TỪNG CÂU/gu)).toHaveLength(1);
      expect(quiz).not.toContain("LƯỢT KIỂM TRA NHẤT QUÁN CUỐI CHO CẢ BỘ");
      expect(quiz).toContain("đúng lượt cục bộ của candidate này");
      expect(quiz).toContain("cấm audit hoặc tự giải lại toàn bộ bộ câu");
      expect(quiz).toContain("không dựng một lời giải thứ hai");
      expect(quiz).not.toContain("kiểm tra độc lập");
      expect(quiz).not.toContain("Trước khi trả JSON, chỉ với mỗi câu đã được chọn");
      expect(quiz).not.toMatch(/(?:Trước|trước) khi trả (?:JSON|output|kết quả JSON)/u);
      expect(quiz).not.toMatch(/trước khi trả kết quả JSON, phải rà soát mọi trường/iu);
      expect(quiz).not.toMatch(
        /Trước khi trả output, (?:phải )?(?:đối chiếu từng cặp dòng|rà từng ký hiệu|rà mọi `solution`)/u,
      );

      expect(summary).toContain("Đọc PDF một lần để lập inventory");
      expect(summary).toContain("tính đúng");
      expect(summary).toContain("căn cứ nguồn/provenance");
      expect(summary).toContain("không chạy audit hay rescan toàn bộ output");
      expect(summary).toContain("kiểm tra cục bộ");
      expect(summary).not.toContain("âm thầm kiểm tra taxonomy");
    }
  });

  it("declares and stabilizes standard notation in every learner-facing text prompt only", () => {
    const subjectSpecificRules = {
      MATH: ["công thức Toán", "đơn vị hoặc miền giá trị"],
      PHYSICS: ["công thức Vật lý", "vật/hệ hoặc mốc/chiều"],
      CHEMISTRY: ["công thức Hóa học", "chất/đối tượng nào", "chỉ số phân biệt"],
      GENERAL: ["ký hiệu chuẩn của domain", "nội dung thuần văn xuôi"],
    } as const;

    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const quiz = buildQuizSubjectSystemPrompt(snapshot);
      const summary = buildLessonSummarySubjectSystemPrompt(subject);

      for (const prompt of [quiz, summary]) {
        expect(prompt).toContain("KHAI BÁO VÀ ỔN ĐỊNH KÝ HIỆU");
        expect(prompt).toContain("giới thiệu đúng một lần trước lần dùng đầu tiên");
        expect(prompt).toContain("Gọi $q$ là ...");
        expect(prompt).toContain("Counterexample hợp lệ");
        for (const rule of subjectSpecificRules[subject.key]) {
          expect(prompt).toContain(rule);
        }
      }

      expect(quiz).toContain("Trong cùng lượt viết field chứa ký hiệu");
      expect(summary).toContain("Trong local pass của block, mọi ký hiệu mới");
      expect(summary).toContain("Với `SOURCE_EXACT`");

      for (const figurePrompt of [
        buildQuizFigureSystemPrompt(snapshot, "QUESTION"),
        buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK"),
      ]) {
        expect(figurePrompt).not.toContain("KHAI BÁO VÀ ỔN ĐỊNH KÝ HIỆU");
      }
    }
  });

  it("keeps every Quiz and Summary problem unambiguous and figure-ready", () => {
    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const quiz = buildQuizSubjectSystemPrompt(snapshot);
      const summary = buildLessonSummarySubjectSystemPrompt(subject);

      for (const prompt of [quiz, summary]) {
        expect(prompt).toContain("chỉ có một cách hiểu chuyên môn");
        expect(prompt).toContain("các dữ kiện");
        expect(prompt).toContain("có thể dựng hai hình khác nhau về quan hệ");
        expect(prompt).toContain("không tồn tại cấu hình thỏa đồng thời mọi dữ kiện");
        expect(prompt).toContain("Không ép nêu chi tiết trang trí");
      }

      expect(quiz).toContain("phải bỏ và viết lại");
      expect(quiz).toContain("worker vẽ hình đề chỉ dùng `problem`");
      expect(quiz).toContain(
        "không được kỳ vọng lấy dữ kiện từ PDF, `options`, `statements`, `hint`, `solution`",
      );
      expect(summary).toContain("chỉ làm rõ quan hệ được nguồn hỗ trợ, không tự đoán");
    }
  });

  it("keeps visible intermediate-proof obligations isolated to Math text prompts", () => {
    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const quiz = buildQuizSubjectSystemPrompt(snapshot);
      const summary = buildLessonSummarySubjectSystemPrompt(subject);

      if (subject.key === "MATH") {
        for (const prompt of [quiz, summary]) {
          expect(prompt).toContain("MẠCH SUY LUẬN VÀ NHÃN KẾT LUẬN");
          expect(prompt).toContain("không phải dữ kiện đã cho");
          expect(prompt).toContain("Từ (1) và (2), suy ra");
          expect(prompt).toContain("Từ căn cứ thứ nhất, suy ra $P$.`");
          expect(prompt).not.toContain("Từ căn cứ thứ nhất, suy ra $P$. (1)");
          expect(prompt).toContain("mọi nhãn đã gắn phải được viện dẫn ít nhất một lần");
          expect(prompt).toContain("không đặt hai kết luận mang nhãn cùng dòng");
          expect(prompt).toContain("Nếu mạch là $A\\Rightarrow B$");
          expect(prompt).toContain("Từ căn cứ thứ hai, suy ra $Q=k$. (1)");
          expect(prompt).toContain("Theo định lý, suy ra $Q=R$.");
          expect(prompt).toContain("Từ (1), suy ra $R=k$.");
          expect(prompt).toMatch(/Q=R\$.+`\n\n\s+`Từ \(1\)/u);
        }
        expect(quiz).toContain("Trong cùng lượt viết mạch suy luận");
        expect(summary).toContain("chỉ giữ nhãn có tham chiếu về sau");
        expect(summary).toContain("Với `SOURCE_EXACT`");
      } else {
        expect(quiz).not.toContain("MẠCH SUY LUẬN VÀ NHÃN KẾT LUẬN");
        expect(summary).not.toContain("MẠCH SUY LUẬN VÀ NHÃN KẾT LUẬN");
        expect(quiz).not.toContain("Từ (1) và (2), suy ra");
        expect(summary).not.toContain("Từ (1) và (2), suy ra");
        expect(summary).not.toContain("Từ (3) và giả thiết $S$, suy ra $T$");
      }

      for (const figurePrompt of [
        buildQuizFigureSystemPrompt(snapshot, "QUESTION"),
        buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK"),
      ]) {
        expect(figurePrompt).not.toContain("MẠCH SUY LUẬN VÀ NHÃN KẾT LUẬN");
      }
    }
  });

  it("keeps Quiz refinement prompts dedicated, concise and isolated by subject", () => {
    const uniqueRules = {
      MATH: [
        "bảng biến thiên",
        "cung góc",
        "Mọi đường tròn hình học phải có đúng một marker tại tâm",
        "nhãn trục, hàm số hoặc ô bảng",
      ],
      PHYSICS: [
        "điểm đặt",
        "cực tính",
        "tia tới/phản xạ/khúc xạ",
        "đại lượng kèm đơn vị, vector, nhãn linh kiện",
      ],
      CHEMISTRY: [
        "hóa trị",
        "ống nối",
        "chiều phản ứng",
        "công thức, điện tích, trạng thái, điều kiện phản ứng",
      ],
      GENERAL: [
        "không mượn mặc định quy tắc chuyên môn",
        "nhãn trục, bảng, quy trình hoặc đoạn mô tả",
      ],
    } as const;

    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      for (const mode of ["QUESTION", "SOLUTION"] as const) {
        const prompt = buildQuizFigureRefinementSystemPrompt(snapshot, mode);
        expect(prompt).toContain(subject.name);
        expect(prompt).toContain("Danh sách lỗi trên chỉ là ví dụ");
        expect(prompt).toContain("không phải danh sách đóng");
        expect(prompt).toContain("CỔNG THOÁT ANCHOR CŨ");
        expect(prompt).toContain(
          "source cuối bắt buộc đặt tên điểm/nút và nhãn đo ở hai phía pháp tuyến đối diện",
        );
        expect(prompt).toContain(
          "trượt nhẹ nhưng vẫn giữ cùng phía là tinh chỉnh thất bại",
        );
        expect(prompt).not.toContain("REGENERATE");
        expect(prompt).toContain("toàn bộ latexSource hoàn chỉnh");
        expect(prompt).not.toContain("extensionLatex");
        expect(prompt).not.toContain("exactQuestionLatexSource");
        expect(prompt).toContain("Nếu user input có adminInstructions");
        expect(prompt).not.toContain("HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ");
        expect(prompt).not.toContain("HỢP ĐỒNG LƯỢT MỞ RỘNG HÌNH LỜI GIẢI");
        expect(prompt).not.toContain("HỢP ĐỒNG LƯỢT VẼ LẠI HÌNH LỜI GIẢI");
        for (const rule of uniqueRules[subject.key]) {
          expect(prompt).toContain(rule);
        }
        expectCompleteSpatialLabelPolicy(prompt);
        expectQuizVisibleIdentifierAuthority(prompt);
      }
    }

    const math = buildQuizFigureRefinementSystemPrompt(subjects[0], "QUESTION");
    const physics = buildQuizFigureRefinementSystemPrompt(subjects[1], "QUESTION");
    const chemistry = buildQuizFigureRefinementSystemPrompt(subjects[2], "QUESTION");
    const general = buildQuizFigureRefinementSystemPrompt(subjects[3], "QUESTION");
    expect(math).not.toContain("hóa trị");
    expect(math).not.toContain("cực tính");
    expect(physics).not.toContain("bảng biến thiên");
    expect(physics).not.toContain("hóa trị");
    expect(chemistry).not.toContain("bảng biến thiên");
    expect(chemistry).not.toContain("tia tới/phản xạ/khúc xạ");
    expect(general).not.toContain("bảng biến thiên");
    expect(general).not.toContain("cực tính");
    expect(general).not.toContain("hóa trị");
  });

  it("selects every Summary/StemFigure mode only inside the owning subject", () => {
    for (const subject of subjects) {
      const summary = buildLessonSummarySubjectSystemPrompt(subject);
      expect(summary).toContain(subject.name);
      expect(summary).not.toContain("`caption`");
      expect(summary).toContain(
        "Dòng chú thích trong tài liệu nguồn chỉ là bằng chứng nhận diện hình",
      );

      const source = buildStemFigureSystemPrompt(subject, "REGENERATE_FROM_SOURCE");
      const sourceWithAdmin = buildStemFigureSystemPrompt(
        subject,
        "REGENERATE_FROM_SOURCE",
        { hasAdminInstructions: true },
      );
      const edit = buildStemFigureSystemPrompt(subject, "EDIT_CURRENT_SOURCE");
      const editWithAdmin = buildStemFigureSystemPrompt(subject, "EDIT_CURRENT_SOURCE", {
        hasAdminInstructions: true,
      });
      const generated = buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK");
      const generatedWithAdmin = buildStemFigureSystemPrompt(
        subject,
        "GENERATE_FROM_BLOCK",
        { hasAdminInstructions: true },
      );
      const repair = buildStemFigureSystemPrompt(subject, "REPAIR");
      for (const prompt of [
        source,
        sourceWithAdmin,
        edit,
        editWithAdmin,
        generated,
        generatedWithAdmin,
        repair,
      ]) {
        expect(prompt).toContain(subject.name);
        expect(prompt).not.toContain("caption");
        expectCompleteSpatialLabelPolicy(prompt);
        expectTikzNumericStabilityPolicy(prompt);
      }
      expect(source).toContain("ẢNH NGUỒN VÀ PHẠM VI");
      expect(edit).toContain("currentLatexSource là code hiện tại");
      expect(generated).toContain("blockContent là nguồn sự thật chuyên môn duy nhất");
      expectGeneratedStemVisibleIdentifierAuthority(generated);
      expectGeneratedStemVisibleIdentifierAuthority(generatedWithAdmin);
      for (const prompt of [source, sourceWithAdmin, edit, editWithAdmin, repair]) {
        expect(prompt).not.toContain(
          "Với hình tự thiết kế từ block, tên hoặc nhãn định danh nhìn thấy",
        );
      }
      expect(repair).toContain("PHẠM VI SỬA VÀ ĐẦU RA");
    }
  });

  it("applies visual-family completeness to every semantic figure mode without redesigning technical repair", () => {
    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const question = buildQuizFigureSystemPrompt(snapshot, "QUESTION");
      const solution = buildQuizFigureSystemPrompt(snapshot, "SOLUTION");

      for (const prompt of [question, solution]) {
        expectSubjectVisualCompleteness(prompt, subject.key);
      }
      expect(question).toContain("Móng hình trung tính luôn bắt buộc");
      expect(question).toContain("lộ đáp án");
      expect(solution).toContain("hoàn toàn độc lập với hình đề");

      for (const mode of ["QUESTION", "SOLUTION"] as const) {
        const refinementPrompt = buildQuizFigureRefinementSystemPrompt(snapshot, mode);
        expectSubjectVisualCompleteness(refinementPrompt, subject.key);
        expect(refinementPrompt).toContain("Nếu user input có adminInstructions");
        expect(refinementPrompt).toContain("không được thêm dữ kiện");
        expect(refinementPrompt).toContain("ghi đè authority");
      }

      const source = buildStemFigureSystemPrompt(subject, "REGENERATE_FROM_SOURCE");
      const edit = buildStemFigureSystemPrompt(subject, "EDIT_CURRENT_SOURCE", {
        hasAdminInstructions: true,
      });
      const generated = buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK");
      const repair = buildStemFigureSystemPrompt(subject, "REPAIR");
      for (const prompt of [source, edit, generated]) {
        expectSubjectVisualCompleteness(prompt, subject.key);
      }
      expect(source).toMatch(/Ảnh (?:vẫn )?khóa baseline/u);
      expect(source).toContain("không tự bổ sung");
      expect(edit).toContain("đúng phạm vi sửa được authority");
      expect(generated).toContain("chuẩn completeness bắt buộc");
      expect(repair).not.toContain("THÀNH PHẦN TỐI THIỂU");
    }

    const math = buildQuizFigureSystemPrompt(subjects[0], "QUESTION");
    const physics = buildQuizFigureSystemPrompt(subjects[1], "QUESTION");
    const chemistry = buildQuizFigureSystemPrompt(subjects[2], "QUESTION");
    const general = buildQuizFigureSystemPrompt(subjects[3], "QUESTION");
    expect(math).not.toContain("đỉnh hoạt hóa");
    expect(physics).not.toContain("bảng biến thiên/xét dấu");
    expect(chemistry).not.toContain("cạnh thấy-khuất");
    expect(general).not.toContain("cực trị/điểm ngoặt");
    expect(general).not.toContain("Junction");
  });

  it("keeps visible-identifier provenance vocabulary owned by each figure subject", () => {
    const expectedVocabulary = {
      MATH: "các đỉnh của một hình",
      PHYSICS: "vật, điểm, nút mạch, tia, vector, linh kiện",
      CHEMISTRY: "chất, tiểu phân, dụng cụ, vị trí, bộ phận",
      GENERAL: "node, mốc, bước, vùng, trục, hàng/cột",
    } as const;

    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      const quizPrompt = buildQuizFigureSystemPrompt(snapshot, "QUESTION");
      const stemPrompt = buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK");
      expect(quizPrompt).toContain(expectedVocabulary[subject.key]);
      expect(stemPrompt).toContain(expectedVocabulary[subject.key]);
    }
  });

  it("requires a center marker for every Math geometric circle in every figure mode", () => {
    const quizSource = readFileSync(
      resolve(
        process.cwd(),
        "src/modules/solution-figures/utils/prompts/math-solution-figure-system-prompt.ts",
      ),
      "utf8",
    );
    const questionSource = readFileSync(
      resolve(
        process.cwd(),
        "src/modules/question-figures/utils/prompts/math-question-figure-system-prompt.ts",
      ),
      "utf8",
    );
    const stemSource = readFileSync(
      resolve(
        process.cwd(),
        "src/modules/stem-figures/utils/prompts/math-stem-figure-system-prompt.ts",
      ),
      "utf8",
    );

    expect(quizSource.match(/Lệnh TikZ `circle` chỉ dùng làm chấm điểm/gu)).toHaveLength(
      1,
    );
    expect(
      questionSource.match(/Lệnh TikZ `circle` chỉ dùng làm chấm điểm/gu),
    ).toHaveLength(1);
    expect(stemSource.match(/Lệnh TikZ `circle` chỉ dùng làm chấm điểm/gu)).toHaveLength(
      7,
    );

    const math = { key: "MATH", name: "Toán", slug: "toan" } as const;
    const questionPrompt = buildQuizFigureSystemPrompt(math, "QUESTION");
    const solutionPrompt = buildQuizFigureSystemPrompt(math, "SOLUTION");

    for (const prompt of [questionPrompt, solutionPrompt]) {
      expect(prompt).toContain("Mọi đường tròn hình học được render trên canvas");
      expect(prompt).toContain("bắt buộc có đúng một điểm đánh dấu");
      expect(prompt).toContain("marker không nhãn");
      expect(prompt).toContain("Các đường tròn đồng tâm dùng chung một marker");
      expect(prompt).toContain("không phải đường tròn hình học");
    }
    for (const mode of ["QUESTION", "SOLUTION"] as const) {
      const prompt = buildQuizFigureRefinementSystemPrompt(math, mode);
      expect(prompt).toContain("Mọi đường tròn hình học phải có đúng một marker tại tâm");
      expect(prompt).toContain("tâm chưa được authority đặt tên giữ marker không nhãn");
    }

    for (const [mode, hasAdminInstructions] of [
      ["REGENERATE_FROM_SOURCE", false],
      ["REGENERATE_FROM_SOURCE", true],
      ["EDIT_CURRENT_SOURCE", false],
      ["EDIT_CURRENT_SOURCE", true],
      ["GENERATE_FROM_BLOCK", false],
      ["GENERATE_FROM_BLOCK", true],
      ["REPAIR", false],
    ] as const) {
      const prompt = buildStemFigureSystemPrompt(math, mode, { hasAdminInstructions });
      expect(prompt).toContain("Mọi đường tròn hình học được render trên canvas");
      expect(prompt).toContain("bắt buộc có đúng một điểm đánh dấu");
      expect(prompt).toContain("nếu chưa đặt tên thì chỉ vẽ marker");
      expect(prompt).toContain("Các đường tròn đồng tâm dùng chung một marker");
      expect(prompt).toContain("không phải đường tròn hình học");
    }

    for (const subject of subjects.filter((subject) => subject.key !== "MATH")) {
      const snapshot = subject as QuizSubjectSnapshot;
      expect(buildQuizFigureSystemPrompt(snapshot, "QUESTION")).not.toContain(
        "Mọi đường tròn hình học",
      );
      expect(buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK")).not.toContain(
        "Mọi đường tròn hình học",
      );
    }
  });

  it("runs one final semantic verification for authored Phase 2 figures", () => {
    const semanticGate = "### KIỂM CHỨNG CHUYÊN MÔN CUỐI";
    const countSemanticGates = (prompt: string) => prompt.split(semanticGate).length - 1;

    for (const subject of subjects) {
      const snapshot = subject as QuizSubjectSnapshot;
      for (const mode of [
        "REGENERATE_FROM_SOURCE",
        "EDIT_CURRENT_SOURCE",
        "GENERATE_FROM_BLOCK",
        "GENERATE_SOLUTION_FROM_BLOCK",
      ] as const) {
        const prompt = buildStemFigureSystemPrompt(subject, mode);
        expect(countSemanticGates(prompt)).toBe(1);
        expect(prompt).not.toMatch(/trước khi trả (?:source|kết quả)/iu);
        expect(prompt).not.toContain("tự kiểm source cuối");
      }

      expect(countSemanticGates(buildStemFigureSystemPrompt(subject, "REPAIR"))).toBe(0);

      for (const mode of ["QUESTION", "SOLUTION"] as const) {
        const authoredPrompt = buildQuizFigureSystemPrompt(snapshot, mode);
        const refinementPrompt = buildQuizFigureRefinementSystemPrompt(snapshot, mode);
        expect(countSemanticGates(authoredPrompt)).toBe(1);
        expect(countSemanticGates(refinementPrompt)).toBe(1);
        expect(authoredPrompt).not.toMatch(/trước khi trả (?:source|kết quả)/iu);
        expect(refinementPrompt).not.toMatch(/trước khi trả (?:source|kết quả)/iu);
      }
    }
  });

  it("keeps independent equal-length marker groups distinct in every Math figure mode", () => {
    const math = { key: "MATH", name: "Toán", slug: "toan" } as const;
    const stemPrompts = [
      buildStemFigureSystemPrompt(math, "REGENERATE_FROM_SOURCE"),
      buildStemFigureSystemPrompt(math, "REGENERATE_FROM_SOURCE", {
        hasAdminInstructions: true,
      }),
      buildStemFigureSystemPrompt(math, "EDIT_CURRENT_SOURCE"),
      buildStemFigureSystemPrompt(math, "EDIT_CURRENT_SOURCE", {
        hasAdminInstructions: true,
      }),
      buildStemFigureSystemPrompt(math, "GENERATE_FROM_BLOCK"),
      buildStemFigureSystemPrompt(math, "GENERATE_FROM_BLOCK", {
        hasAdminInstructions: true,
      }),
      buildStemFigureSystemPrompt(math, "REPAIR"),
    ];
    const quizPrompts = [
      ...(["QUESTION", "SOLUTION"] as const).map((mode) =>
        buildQuizFigureSystemPrompt(math, mode),
      ),
      ...(["QUESTION", "SOLUTION"] as const).map((mode) =>
        buildQuizFigureRefinementSystemPrompt(math, mode),
      ),
    ];

    for (const prompt of [...stemPrompts, ...quizPrompts]) {
      expect(prompt).toContain("chia các đoạn thành từng nhóm quan hệ bằng nhau");
      expect(prompt).toMatch(
        /nhóm độc lập.*(?:kiểu hoặc số vạch khác nhau|marker khác nhau)/u,
      );
      expect(prompt).toContain(
        "Không gộp hai nhóm chỉ vì mỗi nhóm đều phát sinh từ quan hệ trung điểm",
      );
      expect(prompt).toContain("authority khẳng định mọi đoạn");
      expect(prompt).toContain("Vạch chia trục/hệ trục");
      expect(prompt).toContain("marker điểm dựng");
      expect(prompt).toContain("marker đầu mút mở-đóng");
      expect(prompt).toContain("`.25`");
      expect(prompt).toContain("`.75`");
      expect(prompt).toMatch(/(?:tối đa hai nét|mỗi glyph tối đa hai nét)/u);
      expect(prompt).toMatch(/(?:không|cấm).*(?:3–5 vạch|bó cụm vạch tại `\.5`)/u);
    }

    expect(buildStemFigureSystemPrompt(math, "REPAIR")).toContain(
      "không tự tách, gộp hay đổi marker group ngoài phạm vi",
    );
    for (const subject of subjects.filter((subject) => subject.key !== "MATH")) {
      const snapshot = subject as QuizSubjectSnapshot;
      expect(buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK")).not.toContain(
        "chia các đoạn thành từng nhóm quan hệ bằng nhau",
      );
      for (const mode of ["QUESTION", "SOLUTION"] as const) {
        expect(buildQuizFigureSystemPrompt(snapshot, mode)).not.toContain(
          "chia các đoạn thành từng nhóm quan hệ bằng nhau",
        );
        expect(buildQuizFigureRefinementSystemPrompt(snapshot, mode)).not.toContain(
          "chia các đoạn thành từng nhóm quan hệ bằng nhau",
        );
      }
    }
  });

  it("locks TikZ angle orientation and distinct angle-marker groups in every Math figure mode", () => {
    const math = { key: "MATH", name: "Toán", slug: "toan" } as const;
    const prompts = [
      buildStemFigureSystemPrompt(math, "REGENERATE_FROM_SOURCE"),
      buildStemFigureSystemPrompt(math, "EDIT_CURRENT_SOURCE"),
      buildStemFigureSystemPrompt(math, "GENERATE_FROM_BLOCK"),
      buildStemFigureSystemPrompt(math, "REPAIR"),
      buildQuizFigureSystemPrompt(math, "QUESTION"),
      buildQuizFigureSystemPrompt(math, "SOLUTION"),
      buildQuizFigureRefinementSystemPrompt(math, "QUESTION"),
      buildQuizFigureRefinementSystemPrompt(math, "SOLUTION"),
    ];

    for (const prompt of prompts) {
      expect(prompt).toContain("`angle=X--V--Y` luôn quét ngược chiều kim đồng hồ");
      expect(prompt).toContain("góc cực `0, 90, 180, 270`");
      expect(prompt).toContain("chiều kim đồng hồ");
      expect(prompt).toContain("`angle=Prev--V--Next`");
      expect(prompt).toContain("đi ngược chiều kim đồng hồ");
      expect(prompt).toContain("`angle=Next--V--Prev`");
      expect(prompt).toContain("độ quét nhỏ hơn `180°`");
      expect(prompt).toContain("chia các góc thành từng nhóm quan hệ");
      expect(prompt).toContain("Các góc được khẳng định bằng nhau");
      expect(prompt).toContain("các góc được authority cho giá trị khác nhau");
      expect(prompt).toContain("hai biểu thức chứa biến khác nhau mặc định");
      expect(prompt).toContain(
        "dùng số cung khác nhau theo thứ tự ổn định `1, 2, 3, ...`",
      );
      expect(prompt).toContain(
        "Chỉ thay `angle radius` của duy nhất một cung đơn không tạo thành marker group khác",
      );
      expect(prompt).toContain("Mọi cung đều phải là path `solid` độc lập");
      expect(prompt).toContain("chênh lệch bán kính đúng `0.05cm`");
      expect(prompt).toContain("có đầu phẳng `line cap=butt`");
      expect(prompt).toContain("cấm dùng `double`, `dashed`, `densely dashed`, `dotted`");
      expect(prompt).toContain("Nhóm hai cung phải là hai cung thật");
      expect(prompt).toContain("nhóm ba cung phải là ba cung thật");
      expect(prompt).toContain("không tự thêm cung chỉ để phân nhóm");
      expect(prompt).toContain("chia các đoạn thành từng nhóm quan hệ bằng nhau");
      expect(prompt).toContain("`\\draw ... arc`");
      expect(prompt).toContain("độ quét literal");
      expect(prompt).toMatch(/khác số đo cùng (?:chung )?một đỉnh/u);
    }

    for (const subject of subjects.filter((subject) => subject.key !== "MATH")) {
      const snapshot = subject as QuizSubjectSnapshot;
      expect(buildQuizFigureSystemPrompt(snapshot, "QUESTION")).not.toContain(
        "`angle=Next--V--Prev`",
      );
      expect(buildStemFigureSystemPrompt(subject, "GENERATE_FROM_BLOCK")).not.toContain(
        "chia các góc thành từng nhóm quan hệ",
      );
    }
  });

  it("removes the former shared subject-profile and visual-policy modules", () => {
    for (const path of [
      "src/modules/quiz-figures/utils/quiz-figure-subject-visual-policy.ts",
      "src/modules/stem-figures/utils/stem-figure-subject-visual-policy.ts",
    ]) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(false);
    }
  });
});
