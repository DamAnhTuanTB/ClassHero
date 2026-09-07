import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { stemFigureLatexSourceSchema } from "@learning-path/shared";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import type {
  AiOutputSchema,
  AiStructuredInput,
} from "#api/modules/ai/types/ai-text.types";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

loadEnv({ path: resolve(process.cwd(), ".env"), override: false, quiet: true });
loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false, quiet: true });

const runLiveTest = process.env.RUN_OPENAI_STEM_FOUNDATION_LIVE_TESTS === "1";
const outputDirectory =
  process.env.OPENAI_STEM_FOUNDATION_OUTPUT_DIR ??
  "/tmp/ai-stem-construction-foundation-live";
const additionalBudgetVnd = 5_000;

type SubjectKey = "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";

type StemLiveCase = {
  label: string;
  subjectKey: SubjectKey;
  targetGrade: number;
  title: string;
  content: string;
  quantitativeGraph?: boolean;
  solutionFigure?: {
    problem: string;
    solution: string;
  };
};

const subjects = {
  MATH: { key: "MATH", name: "Toán", slug: "toan" },
  PHYSICS: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
  CHEMISTRY: { key: "CHEMISTRY", name: "Hóa học", slug: "hoa-hoc" },
  GENERAL: { key: "GENERAL", name: "Khoa học tổng hợp", slug: "khoa-hoc-tong-hop" },
} as const;

const cases: StemLiveCase[] = [
  {
    label: "stem-math-example-solution",
    subjectKey: "MATH",
    targetGrade: 8,
    title: "Đường cao trong tam giác",
    content: "",
    solutionFigure: {
      problem: "Cho tam giác ABC vuông tại A. Tính khoảng cách từ A đến BC.",
      solution:
        "Kẻ đường cao AH vuông góc với BC tại H. Dùng hệ thức AB·AC = AH·BC để xác định AH.",
    },
  },
  {
    label: "stem-math-parabola",
    subjectKey: "MATH",
    targetGrade: 9,
    title: "Đồ thị hàm số bậc hai",
    content:
      "Minh họa đồ thị y = 3/2 x^2 trên hệ trục Oxy từ x = -2 đến x = 2 để học sinh nhận biết đỉnh và tính đối xứng.",
    quantitativeGraph: true,
  },
  {
    label: "stem-math-variation-table",
    subjectKey: "MATH",
    targetGrade: 12,
    title: "Bảng biến thiên",
    content:
      "Minh họa bảng biến thiên của y = x^3 - 3x, với các mốc -1 và 1, đủ hàng x, y', y và chiều biến thiên.",
  },
  {
    label: "stem-math-geometry",
    subjectKey: "MATH",
    targetGrade: 8,
    title: "Đường cao trong tam giác vuông",
    content:
      "Minh họa tam giác ABC vuông tại A, đường cao AH vuông góc BC tại H; thể hiện đầy đủ các điểm và dấu vuông góc.",
  },
  {
    label: "stem-physics-velocity-time",
    subjectKey: "PHYSICS",
    targetGrade: 10,
    title: "Đồ thị vận tốc-thời gian",
    content:
      "Minh họa vật tăng đều từ (0 s, 0 m/s) đến (2 s, 4 m/s), giữ 4 m/s đến 5 s rồi giảm về 0 m/s tại 7 s.",
    quantitativeGraph: true,
  },
  {
    label: "stem-physics-circuit",
    subjectKey: "PHYSICS",
    targetGrade: 9,
    title: "Mạch điện song song",
    content:
      "Minh họa mạch kín gồm nguồn, công tắc đóng, ampe kế và hai điện trở R1, R2 mắc song song, đủ dây và junction.",
  },
  {
    label: "stem-physics-optics",
    subjectKey: "PHYSICS",
    targetGrade: 9,
    title: "Dựng ảnh qua thấu kính hội tụ",
    content:
      "Minh họa vật AB, trục chính, quang tâm O, hai tiêu điểm F và F', cùng hai tia chuẩn độc lập để dựng ảnh.",
  },
  {
    label: "stem-chemistry-energy",
    subjectKey: "CHEMISTRY",
    targetGrade: 10,
    title: "Đồ thị năng lượng phản ứng",
    content:
      "Minh họa chất phản ứng ở mức 2, trạng thái chuyển tiếp ở mức 5 và sản phẩm ở mức 1 trên trục tiến trình từ 0 đến 6.",
    quantitativeGraph: true,
  },
  {
    label: "stem-chemistry-particles",
    subjectKey: "CHEMISTRY",
    targetGrade: 6,
    title: "Mô hình tiểu phân",
    content:
      "Minh họa bình kín chứa 4 phân tử O2 và 2 phân tử N2; mỗi phân tử có hai nguyên tử liên kết và legend bằng sample mark.",
  },
  {
    label: "stem-chemistry-apparatus",
    subjectKey: "CHEMISTRY",
    targetGrade: 8,
    title: "Điều chế và thu khí oxi",
    content:
      "Minh họa đun nóng ống nghiệm chứa KMnO4, ống dẫn khí nối liên tục tới bình thu khí úp trong chậu nước.",
  },
  {
    label: "stem-general-flowchart",
    subjectKey: "GENERAL",
    targetGrade: 3,
    title: "Các bước tìm hiểu khoa học",
    content:
      "Minh họa bốn bước Quan sát, Đặt câu hỏi, Thử nghiệm, Kết luận bằng các node và mũi tên đúng thứ tự.",
  },
  {
    label: "stem-general-bar-chart",
    subjectKey: "GENERAL",
    targetGrade: 6,
    title: "Biểu đồ số cây",
    content:
      "Minh họa biểu đồ cột ba lớp 6A, 6B, 6C lần lượt trồng 10, 15, 20 cây, đủ trục, tick, đơn vị và category.",
  },
  {
    label: "stem-general-line-chart",
    subjectKey: "GENERAL",
    targetGrade: 7,
    title: "Nhiệt độ theo thời gian",
    content:
      "Minh họa biểu đồ đường tại 6h, 9h, 12h, 15h lần lượt là 20, 24, 30, 27 độ C, có marker, trục, tick và đơn vị.",
  },
];
const requestedLabels = new Set(
  (process.env.OPENAI_STEM_FOUNDATION_CASES ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean),
);
const liveCases = requestedLabels.size
  ? cases.filter((testCase) => requestedLabels.has(testCase.label))
  : cases;

describe.skipIf(!runLiveTest)("StemFigure construction-foundation live matrix", () => {
  it("creates and compiles foundation-complete figures from lesson blocks", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the live test.");

    const model = process.env.OPENAI_STEM_FOUNDATION_MODEL ?? "gpt-5.6-luna";
    const reasoningEffort =
      process.env.OPENAI_STEM_FOUNDATION_REASONING_EFFORT === "high" ? "high" : "medium";
    const maxOutputTokens = Number(
      process.env.OPENAI_STEM_FOUNDATION_MAX_OUTPUT_TOKENS ?? 3_000,
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
    const service = new StemFigureRepairService(
      {
        generateStructured: async <TOutput>(
          _context: unknown,
          input: AiStructuredInput,
          schema: AiOutputSchema<TOutput>,
        ) => {
          const result = await provider.generateStructured(
            { ...input, model, reasoningEffort, maxTokens: maxOutputTokens },
            schema,
          );
          usage.calls += 1;
          usage.input += result.usage?.promptTokens ?? 0;
          usage.cachedInput += result.usage?.cachedInputTokens ?? 0;
          usage.output += result.usage?.completionTokens ?? 0;
          return result;
        },
      } as never,
      { get: () => 120_000 } as never,
    );
    await mkdir(outputDirectory, { recursive: true });

    for (const testCase of liveCases) {
      if (conservativeCostVnd(usage.input, usage.output) >= additionalBudgetVnd - 1_000)
        break;
      const source = await service.createNew({
        figureId: "00000000-0000-4000-8000-000000000001",
        revisionId: "00000000-0000-4000-8000-000000000002",
        aiGenerationId: null,
        backgroundJobId: "00000000-0000-4000-8000-000000000003",
        jobAttempt: 1,
        subject: subjects[testCase.subjectKey],
        brief: buildBrief(testCase),
        referenceImages: [],
      });
      const errors: string[] = [];
      const parsed = stemFigureLatexSourceSchema.safeParse(source);
      if (!parsed.success) errors.push(`SOURCE_SCHEMA:${parsed.error.message}`);
      if (testCase.quantitativeGraph) errors.push(...checkGraphFoundation(source));
      if (testCase.solutionFigure) errors.push(...checkSolutionFigure(source));

      const render = await renderFigure(source, testCase.subjectKey);
      if (!render.ok || !render.svg)
        errors.push(`RENDER:${render.code ?? "FAILED"}:${render.log ?? ""}`);
      const svgFile = render.svg ? `${testCase.label}.svg` : null;
      await writeFile(resolve(outputDirectory, `${testCase.label}.tex`), source);
      if (svgFile && render.svg)
        await writeFile(resolve(outputDirectory, svgFile), render.svg);
      results.push({
        label: testCase.label,
        subjectKey: testCase.subjectKey,
        svgFile,
        errors,
      });
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
      `[STEM FOUNDATION LIVE TOTAL] ${JSON.stringify({
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
      additionalBudgetVnd,
    );
    expect(failures).toEqual([]);
  }, 1_800_000);
});

function buildBrief(testCase: StemLiveCase): StemFigureGenerationBrief {
  return {
    figurePlanContractVersion: 3,
    figureOrigin: "GENERATED_FROM_BRIEF",
    targetGrade: testCase.targetGrade,
    blockPath: "sections.0.blocks.0",
    blockContent: testCase.solutionFigure
      ? {
          type: "example",
          problem: testCase.solutionFigure.problem,
          solution: testCase.solutionFigure.solution,
        }
      : {
          type: "knowledge",
          title: testCase.title,
          content: testCase.content,
        },
    sourceReferences: [],
    referenceAssets: [],
    referenceImageMode: "NONE",
    adminInstructions: null,
  };
}

function checkSolutionFigure(source: string) {
  const errors: string[] = [];
  if (!/\{\$?H\$?\}/u.test(source)) errors.push("SOLUTION_AUXILIARY_POINT_H");
  if (!/right\s+angle|vuông|perp|rectangle/u.test(source)) {
    errors.push("SOLUTION_PERPENDICULAR_MARKER");
  }
  return errors;
}

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

function conservativeCostVnd(inputTokens: number, outputTokens: number) {
  return ((inputTokens * 1.25 + outputTokens * 6) / 1_000_000) * 26_000;
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
      (result) =>
        `<article><h2>${result.label}</h2><p>${result.subjectKey} · ${result.errors.length ? result.errors.join(", ") : "PASS"}</p>${result.svgFile ? `<img src="./${result.svgFile}" alt="${result.label}">` : "<div>Không có SVG</div>"}</article>`,
    )
    .join("\n");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Stem foundation live</title><style>body{font-family:system-ui;margin:20px;background:#eef2f7}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{background:white;border:1px solid #ccd6e2;border-radius:12px;padding:12px}h2{font-size:15px;margin:0 0 4px}p{font-size:12px;margin:0 0 8px;color:#526173}img{width:100%;height:360px;object-fit:contain;background:white}</style></head><body><main>${cards}</main></body></html>`;
}

async function renderFigure(latexSource: string, subjectKey: SubjectKey) {
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
  };
}
