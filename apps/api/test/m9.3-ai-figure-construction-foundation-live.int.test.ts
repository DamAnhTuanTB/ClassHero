import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  buildQuestionFigureInput,
  generatedQuizQuestionFigureSchema,
} from "#api/modules/quiz-figures/types/quiz-figure-generation.types";
import { assertQuizFigureLatexSource } from "#api/modules/quiz-figures/utils/quiz-figure-source-policy";

loadEnv({ path: resolve(process.cwd(), ".env"), override: false, quiet: true });
loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_CONSTRUCTION_FOUNDATION_LIVE_TESTS === "1";
const outputDirectory =
  process.env.OPENAI_CONSTRUCTION_FOUNDATION_OUTPUT_DIR ??
  "/tmp/ai-figure-construction-foundation-live";
const maximumBudgetVnd = 5_000;

type SubjectKey = "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";

type LiveCase = {
  label: string;
  subjectKey: SubjectKey;
  targetGrade: number;
  problem: string;
  quantitativeGraph?: boolean;
};

const subjects = {
  MATH: { key: "MATH", name: "Toán", slug: "toan" },
  PHYSICS: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
  CHEMISTRY: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
  GENERAL: { key: "GENERAL", name: "Khoa học tổng hợp", slug: "khoa-hoc-tong-hop" },
} as const;

const parabolaProblem =
  "Vẽ đồ thị hàm số y = 3/2 x^2 trên hệ trục Oxy, trong cửa sổ có gốc tọa độ và các giá trị x từ -2 đến 2. Hình dùng để quan sát dạng parabol.";

const cases: LiveCase[] = [
  {
    label: "math-cable-large-domain",
    subjectKey: "MATH",
    targetGrade: 10,
    problem:
      "Một dây cáp có dạng parabol y = ax^2. Gốc tọa độ O là điểm giữa mặt cầu, trục Oy vuông góc với mặt cầu và hai điểm treo dây có tọa độ (-150;60) và (150;60), trong đó các độ dài tính bằng mét. Tính độ cao của dây cáp so với mặt cầu tại vị trí có hoành độ x = 90.",
    quantitativeGraph: true,
  },
  ...Array.from({ length: 5 }, (_, index) => ({
    label: `math-parabola-variance-${index + 1}`,
    subjectKey: "MATH" as const,
    targetGrade: 9,
    problem: parabolaProblem,
    quantitativeGraph: true,
  })),
  {
    label: "math-shifted-parabola",
    subjectKey: "MATH",
    targetGrade: 10,
    problem:
      "Vẽ đồ thị y = (x - 1)^2 - 2 trên hệ trục Oxy, hiển thị gốc và miền x từ -2 đến 4 để thấy đỉnh cùng hai nhánh đối xứng.",
    quantitativeGraph: true,
  },
  {
    label: "math-line",
    subjectKey: "MATH",
    targetGrade: 8,
    problem:
      "Vẽ đồ thị đường thẳng y = 2x + 1 trên hệ trục Oxy, hiển thị gốc và miền x từ -2 đến 2.",
    quantitativeGraph: true,
  },
  {
    label: "math-absolute-value",
    subjectKey: "MATH",
    targetGrade: 10,
    problem:
      "Vẽ đồ thị y = |x| - 1 trên hệ trục Oxy, hiển thị gốc và miền x từ -3 đến 3.",
    quantitativeGraph: true,
  },
  {
    label: "math-rational",
    subjectKey: "MATH",
    targetGrade: 12,
    problem:
      "Vẽ đồ thị y = 1/x trên hệ trục Oxy trong miền từ -3 đến 3, bỏ x = 0, thể hiện rõ hai nhánh và các tiệm cận là hai trục.",
    quantitativeGraph: true,
  },
  {
    label: "math-cubic",
    subjectKey: "MATH",
    targetGrade: 12,
    problem:
      "Vẽ đồ thị y = x^3 - 3x trên hệ trục Oxy trong miền x từ -2.2 đến 2.2, hiển thị gốc và các điểm đặc trưng tạo nên hình dạng.",
    quantitativeGraph: true,
  },
  {
    label: "math-exponential",
    subjectKey: "MATH",
    targetGrade: 11,
    problem:
      "Vẽ đồ thị y = 2^x trên hệ trục Oxy trong miền x từ -3 đến 3, hiển thị gốc và các mốc đơn vị.",
    quantitativeGraph: true,
  },
  {
    label: "math-trigonometric",
    subjectKey: "MATH",
    targetGrade: 11,
    problem:
      "Vẽ đồ thị y = sin x trên hệ trục Oxy từ -pi đến pi, hiển thị gốc, các zero và cực trị của một chu kỳ.",
    quantitativeGraph: true,
  },
  {
    label: "math-number-line",
    subjectKey: "MATH",
    targetGrade: 7,
    problem:
      "Biểu diễn khoảng nghiệm -2 < x <= 3 trên trục số có chiều dương, gốc 0, vạch đơn vị và đúng đầu mút mở-đóng.",
  },
  {
    label: "math-solution-region",
    subjectKey: "MATH",
    targetGrade: 10,
    problem:
      "Biểu diễn miền nghiệm của hệ x + y <= 4, x >= 0, y >= 0 trên hệ trục Oxy, với đường biên và phần tô đúng quy ước.",
  },
  {
    label: "math-variation-table",
    subjectKey: "MATH",
    targetGrade: 12,
    problem:
      "Vẽ bảng biến thiên của hàm y = x^3 - 3x với các mốc x = -1 và x = 1, đủ hàng x, y', y và mũi tên biến thiên.",
  },
  {
    label: "math-plane-geometry",
    subjectKey: "MATH",
    targetGrade: 8,
    problem:
      "Cho tam giác ABC vuông tại A, đường cao AH vuông góc BC tại H. Vẽ hình thể hiện đầy đủ các điểm, cạnh, chân đường cao và dấu vuông góc được nêu.",
  },
  {
    label: "math-solid-geometry",
    subjectKey: "MATH",
    targetGrade: 11,
    problem:
      "Vẽ hình chóp S.ABCD có đáy ABCD là hình bình hành, thể hiện đủ năm đỉnh, các cạnh thấy-khuất và đường chéo AC.",
  },
  {
    label: "physics-velocity-time",
    subjectKey: "PHYSICS",
    targetGrade: 10,
    problem:
      "Vẽ đồ thị vận tốc-thời gian: vật bắt đầu tại (0 s, 0 m/s), tăng đều đến (2 s, 4 m/s), giữ 4 m/s đến 5 s rồi giảm đều về 0 m/s tại 7 s.",
    quantitativeGraph: true,
  },
  {
    label: "physics-free-body",
    subjectKey: "PHYSICS",
    targetGrade: 10,
    problem:
      "Vẽ sơ đồ lực của một vật đặt trên mặt phẳng ngang: trọng lực P hướng xuống, phản lực N hướng lên, lực kéo F hướng sang phải và lực ma sát hướng sang trái, tất cả neo đúng vào vật.",
  },
  {
    label: "physics-circuit",
    subjectKey: "PHYSICS",
    targetGrade: 9,
    problem:
      "Vẽ mạch kín gồm một nguồn điện, công tắc đóng, ampe kế và hai điện trở R1, R2 mắc song song; thể hiện rõ junction và mọi dây nối.",
  },
  {
    label: "physics-optics",
    subjectKey: "PHYSICS",
    targetGrade: 9,
    problem:
      "Vẽ phép dựng ảnh của vật AB qua thấu kính hội tụ: có trục chính, quang tâm O, hai tiêu điểm F và F', cùng hai tia chuẩn độc lập từ đỉnh B.",
  },
  {
    label: "physics-thermometer",
    subjectKey: "PHYSICS",
    targetGrade: 6,
    problem:
      "Vẽ nhiệt kế có thang từ 0 đến 100 độ C, vạch chia 10 độ C và cột chất lỏng dừng chính xác ở 40 độ C.",
  },
  {
    label: "chemistry-particles",
    subjectKey: "CHEMISTRY",
    targetGrade: 6,
    problem:
      "Vẽ mô hình một bình kín chứa 4 phân tử O2 và 2 phân tử N2, mỗi phân tử gồm hai nguyên tử liên kết; có ranh giới bình và legend bằng sample mark.",
  },
  {
    label: "chemistry-molecule",
    subjectKey: "CHEMISTRY",
    targetGrade: 10,
    problem:
      "Vẽ công thức cấu tạo của phân tử axit axetic CH3COOH, thể hiện đúng các node nguyên tử và bậc liên kết.",
  },
  {
    label: "chemistry-reaction",
    subjectKey: "CHEMISTRY",
    targetGrade: 8,
    problem:
      "Vẽ sơ đồ phản ứng 2H2 + O2 tạo thành 2H2O, gồm đủ node chất, hệ số và mũi tên nối từ chất tham gia sang sản phẩm.",
  },
  {
    label: "chemistry-energy-profile",
    subjectKey: "CHEMISTRY",
    targetGrade: 10,
    problem:
      "Vẽ đồ thị năng lượng phản ứng: chất phản ứng ở mức 2, trạng thái chuyển tiếp ở mức 5 và sản phẩm ở mức 1; trục tiến trình phản ứng từ 0 đến 6.",
    quantitativeGraph: true,
  },
  {
    label: "chemistry-apparatus",
    subjectKey: "CHEMISTRY",
    targetGrade: 8,
    problem:
      "Vẽ bộ dụng cụ điều chế và thu khí oxi bằng cách đun nóng ống nghiệm chứa KMnO4, dẫn khí qua ống nối vào bình thu khí úp trong chậu nước.",
  },
  {
    label: "general-flowchart",
    subjectKey: "GENERAL",
    targetGrade: 3,
    problem:
      "Vẽ lưu đồ bốn bước theo thứ tự: Quan sát, Đặt câu hỏi, Thử nghiệm, Kết luận; mỗi node nối đúng bằng mũi tên.",
  },
  {
    label: "general-bar-chart",
    subjectKey: "GENERAL",
    targetGrade: 6,
    problem:
      "Vẽ biểu đồ cột số cây của lớp 6A, 6B, 6C lần lượt là 10, 15, 20 cây; có baseline, trục số, đơn vị, tick và nhãn category.",
  },
  {
    label: "general-line-chart",
    subjectKey: "GENERAL",
    targetGrade: 7,
    problem:
      "Vẽ biểu đồ đường nhiệt độ lúc 6h, 9h, 12h, 15h lần lượt là 20, 24, 30, 27 độ C; có marker từng giá trị, trục, tick và đơn vị.",
  },
];
const requestedLabels = new Set(
  (process.env.OPENAI_CONSTRUCTION_FOUNDATION_CASES ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean),
);
const liveCases = requestedLabels.size
  ? cases.filter((testCase) => requestedLabels.has(testCase.label))
  : cases;

describe.skipIf(!runLiveTest)("AI figure construction-foundation live matrix", () => {
  it("creates, compiles and preserves the minimum foundation across visual families", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_CONSTRUCTION_FOUNDATION_MODEL ?? "gpt-5.6-luna";
    const reasoningEffort =
      process.env.OPENAI_CONSTRUCTION_FOUNDATION_REASONING_EFFORT === "medium"
        ? "medium"
        : "high";
    const maxOutputTokens = Number(
      process.env.OPENAI_CONSTRUCTION_FOUNDATION_MAX_OUTPUT_TOKENS ?? 3_000,
    );
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      generationRequestTimeoutMs: 180_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: model,
      structuredModel: model,
    });
    const usage = { calls: 0, input: 0, cachedInput: 0, output: 0 };
    const results: Array<{
      label: string;
      subjectKey: SubjectKey;
      svgFile: string | null;
      errors: string[];
    }> = [];
    await mkdir(outputDirectory, { recursive: true });

    for (const testCase of liveCases) {
      const estimatedCostVnd = conservativeCostVnd(usage.input, usage.output);
      if (estimatedCostVnd >= maximumBudgetVnd - 1_000) {
        results.push({
          label: testCase.label,
          subjectKey: testCase.subjectKey,
          svgFile: null,
          errors: [`BUDGET_GUARD:${Math.round(estimatedCostVnd)}VND`],
        });
        break;
      }

      const input = buildQuestionFigureInput({
        subject: subjects[testCase.subjectKey],
        targetGrade: testCase.targetGrade,
        plan: { version: 1, role: "QUESTION", problem: testCase.problem },
      });
      const result = await provider.generateStructured(
        { ...input, model, reasoningEffort, maxTokens: maxOutputTokens },
        generatedQuizQuestionFigureSchema,
      );
      const source = result.data.latexSource;
      const errors: string[] = [];

      try {
        assertQuizFigureLatexSource(source, { requireExtensionMarker: true });
      } catch (error) {
        errors.push(
          `SOURCE_POLICY:${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (testCase.quantitativeGraph) errors.push(...checkGraphFoundation(source));
      errors.push(...checkPicOperands(source));

      const render = await renderQuizFigure(source, testCase.subjectKey);
      if (!render.ok || !render.svg) {
        errors.push(`RENDER:${render.code ?? "FAILED"}:${render.log ?? ""}`);
      }

      const texFile = `${testCase.label}.tex`;
      const svgFile = render.svg ? `${testCase.label}.svg` : null;
      await writeFile(resolve(outputDirectory, texFile), source);
      if (svgFile && render.svg)
        await writeFile(resolve(outputDirectory, svgFile), render.svg);

      usage.calls += 1;
      usage.input += result.usage?.promptTokens ?? 0;
      usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
      usage.output += result.usage?.completionTokens ?? 0;
      results.push({
        label: testCase.label,
        subjectKey: testCase.subjectKey,
        svgFile,
        errors,
      });

      console.info(
        `[CONSTRUCTION FOUNDATION LIVE] ${JSON.stringify({
          label: testCase.label,
          subject: testCase.subjectKey,
          promptVersion: input.promptVersion,
          reasoningEffort,
          maxOutputTokens,
          promptTokens: result.usage?.promptTokens ?? null,
          cachedInputTokens: result.usage?.cachedInputTokens ?? null,
          completionTokens: result.usage?.completionTokens ?? null,
          latencyMs: result.latencyMs ?? null,
          renderDurationMs: render.durationMs ?? null,
          errors,
          conservativeCostVnd: Math.round(conservativeCostVnd(usage.input, usage.output)),
        })}`,
      );
    }

    await Promise.all([
      writeFile(
        resolve(outputDirectory, "manifest.json"),
        JSON.stringify({ usage, results }, null, 2),
      ),
      writeFile(resolve(outputDirectory, "index.html"), buildContactSheet(results)),
    ]);

    const failures = results.filter((result) => result.errors.length > 0);
    console.info(
      `[CONSTRUCTION FOUNDATION LIVE TOTAL] ${JSON.stringify({
        ...usage,
        reasoningEffort,
        maxOutputTokens,
        cases: liveCases.length,
        failures: failures.map((result) => result.label),
        conservativeCostVnd: Math.round(conservativeCostVnd(usage.input, usage.output)),
        outputDirectory,
      })}`,
    );
    expect(usage.calls).toBe(liveCases.length);
    expect(conservativeCostVnd(usage.input, usage.output)).toBeLessThanOrEqual(
      maximumBudgetVnd,
    );
    expect(failures).toEqual([]);
  }, 2_400_000);
});

function checkGraphFoundation(source: string) {
  const errors: string[] = [];
  if (!/\$O\$|\{\s*0\s*\}|\{\$\s*0\s*\$\}|\\foreach[^\n]*\{0[,}]/u.test(source))
    errors.push("GRAPH_ORIGIN");
  if (!/densely\s+dashed/u.test(source)) errors.push("GRAPH_DASHED_GUIDES");
  if (!/\\fill|circle\s*\(|circle[^}\n]*fill|fill[^}\n]*circle|mark\s*=/u.test(source))
    errors.push("GRAPH_MARKERS");
  if (!/\\foreach|xtick|ytick|node[^\n]*\{\$?-?[1-9]/u.test(source))
    errors.push("GRAPH_NUMBERED_TICKS");
  return errors;
}

function checkPicOperands(source: string) {
  return /\\pic[^\n]*\{\s*(?:right angle|angle)\s*=\s*\(/u.test(source)
    ? ["TIKZ_PIC_RAW_COORDINATE_OPERAND"]
    : [];
}

function conservativeCostVnd(inputTokens: number, outputTokens: number) {
  const usd = (inputTokens * 1.25 + outputTokens * 6) / 1_000_000;
  return usd * 26_000;
}

function buildContactSheet(
  results: Array<{
    label: string;
    subjectKey: SubjectKey;
    svgFile: string | null;
    errors: string[];
  }>,
) {
  const cards = results
    .map(
      (result) => `<article>
  <h2>${result.label}</h2>
  <p>${result.subjectKey} · ${result.errors.length ? result.errors.join(", ") : "PASS"}</p>
  ${result.svgFile ? `<img src="./${result.svgFile}" alt="${result.label}">` : "<div>Không có SVG</div>"}
</article>`,
    )
    .join("\n");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Construction foundation live</title>
<style>body{font-family:system-ui;margin:20px;background:#eef2f7}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{background:white;border:1px solid #ccd6e2;border-radius:12px;padding:12px}h2{font-size:15px;margin:0 0 4px}p{font-size:12px;margin:0 0 8px;color:#526173}img{width:100%;height:360px;object-fit:contain;background:white}@media(max-width:1000px){main{grid-template-columns:1fr}}</style></head><body><main>${cards}</main></body></html>`;
}

async function renderQuizFigure(latexSource: string, subjectKey: SubjectKey) {
  const response = await fetch("http://127.0.0.1:8080/render", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.TEX_RENDERER_TOKEN ?? "local-tex-renderer-token"}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ latexSource, subjectKey }),
  });
  return (await response.json()) as {
    ok?: boolean;
    svg?: string;
    code?: string;
    log?: string;
    durationMs?: number;
  };
}
