import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildLessonSummarySubjectSystemPrompt } from "#api/modules/ai/utils/lesson-summary-prompt";
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
    root: "src/modules/quiz-figures/utils/prompts",
    suffix: "quiz-figure-system-prompt.ts",
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
      "src/modules/quiz-figures/utils/prompts/quiz-figure-system-prompt-resolver.ts",
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
      expect(phaseOne).toContain("`requiresQuestionFigure` phải là đúng một boolean");
      expect(phaseOne).not.toContain("caption");
      expect(phaseOne).toContain("phép kiểm kê visual delta");
      expect(phaseOne).toContain(
        "cấm chọn `NONE`, kể cả khi lời giải bằng chữ đã tự đủ nghĩa",
      );
      expect(phaseOne).toContain("Counterexample giữ `NONE`");
      expect(phaseOne).toContain("Counterexample bắt buộc `EXTEND_QUESTION`");

      const question = buildQuizFigureSystemPrompt(snapshot, "QUESTION");
      const extension = buildQuizFigureSystemPrompt(snapshot, "EXTEND_QUESTION");
      const redraw = buildQuizFigureSystemPrompt(snapshot, "REDRAW_AS_MODEL");
      for (const prompt of [question, extension, redraw]) {
        expect(prompt).toContain(subject.name);
        expectCompleteSpatialLabelPolicy(prompt);
      }
      expect(question).toContain("HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ");
      expect(question).toContain(
        "lập nội bộ whitelist gồm đúng các dữ kiện được phát biểu trực tiếp",
      );
      expect(question).toContain("Cấm biến hệ quả suy luận thành dữ kiện nhìn thấy");
      expect(question).not.toContain("caption");
      expect(extension).toContain("HỢP ĐỒNG LƯỢT MỞ RỘNG HÌNH LỜI GIẢI");
      expect(redraw).toContain("HỢP ĐỒNG LƯỢT VẼ LẠI HÌNH LỜI GIẢI");
      expect(question).not.toContain("requiredModeledObjects");
      expect(extension).not.toContain("requiredModeledObjects");
      expect(redraw).toContain("requiredModeledObjects");
    }
  });

  it("keeps Quiz refinement prompts dedicated, concise and isolated by subject", () => {
    const uniqueRules = {
      MATH: [
        "bảng biến thiên",
        "cung góc",
        "đường tròn $(O)$",
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
      for (const mode of ["QUESTION", "EXTEND_QUESTION", "REDRAW_AS_MODEL"] as const) {
        const prompt = buildQuizFigureRefinementSystemPrompt(snapshot, mode);
        expect(prompt).toContain(subject.name);
        expect(prompt).toContain("Danh sách lỗi trên chỉ là ví dụ");
        expect(prompt).toContain("không phải danh sách đóng");
        expect(prompt).toContain("toàn bộ latexSource hoàn chỉnh");
        expect(prompt).not.toContain("REGENERATE");
        expect(prompt).not.toContain("EDIT_CURRENT");
        expect(prompt).not.toContain("extensionLatex");
        expect(prompt).not.toContain("adminInstructions");
        expect(prompt).not.toContain("HỢP ĐỒNG LƯỢT VẼ HÌNH ĐỀ");
        expect(prompt).not.toContain("HỢP ĐỒNG LƯỢT MỞ RỘNG HÌNH LỜI GIẢI");
        expect(prompt).not.toContain("HỢP ĐỒNG LƯỢT VẼ LẠI HÌNH LỜI GIẢI");
        for (const rule of uniqueRules[subject.key]) {
          expect(prompt).toContain(rule);
        }
        expectCompleteSpatialLabelPolicy(prompt);
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
      }
      expect(source).toContain("ẢNH NGUỒN VÀ PHẠM VI");
      expect(edit).toContain("currentLatexSource là code hiện tại");
      expect(generated).toContain("blockContent là nguồn sự thật chuyên môn duy nhất");
      expect(repair).toContain("PHẠM VI SỬA VÀ ĐẦU RA");
    }
  });

  it("keeps the Math circle-name/center-label invariant in every figure mode", () => {
    const quizSource = readFileSync(
      resolve(
        process.cwd(),
        "src/modules/quiz-figures/utils/prompts/math-quiz-figure-system-prompt.ts",
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

    expect(quizSource.match(/`\$\(O\)\$` chỉ là cách gọi đường tròn/gu)).toHaveLength(3);
    expect(stemSource.match(/`\$\(O\)\$` chỉ là cách gọi đường tròn/gu)).toHaveLength(7);

    const math = { key: "MATH", name: "Toán", slug: "toan" } as const;
    for (const prompt of [
      buildQuizFigureSystemPrompt(math, "QUESTION"),
      buildQuizFigureSystemPrompt(math, "EXTEND_QUESTION"),
      buildQuizFigureSystemPrompt(math, "REDRAW_AS_MODEL"),
    ]) {
      expect(prompt).toContain("không phải một nhãn canvas");
    }

    for (const mode of [
      "REGENERATE_FROM_SOURCE",
      "EDIT_CURRENT_SOURCE",
      "GENERATE_FROM_BLOCK",
      "REPAIR",
    ] as const) {
      expect(buildStemFigureSystemPrompt(math, mode)).toContain(
        "cấm đặt thêm node `$(O)$`",
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
