import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { config as loadEnv } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { validateEnv, type EnvConfig } from "#api/config/env.validation";
import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";
import { lessonSummaryProviderOutputSchema } from "#api/modules/ai/types/lesson-summary.types";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import {
  buildLessonSummarySourceCandidates,
  buildLessonSummarySourceTopics,
} from "#api/modules/ai/utils/lesson-summary-source-candidates";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { normalizeOcrPages } from "#api/workers/utils/ocr-artifact-normalizer";

loadEnv({ path: resolve(process.cwd(), "../../.env"), override: false });

const runLiveTest = process.env.RUN_M9_2_PDF_LIVE_MATRIX === "1";
const selectedLiveCases = new Set(
  (process.env.M9_2_PDF_LIVE_CASES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const sourcePdf = resolve(
  process.cwd(),
  "../../Toan-7-Tap-1-lam-net-300ppi-OCR-searchable.pdf",
);
const models = ["gpt-4.1", "gpt-5.4", "gpt-5.6-luna"] as const;
const artifactDirectory = resolve(
  process.cwd(),
  "../../tmp/pdfs/lesson-summary-v2/live-matrix-v22",
);
const lessons = [
  {
    key: "alg-bai-2",
    group: "Số/Đại số",
    title: "Bài 2. Cộng, trừ, nhân, chia số hữu tỉ",
    firstPdfPage: 11,
    lastPdfPage: 14,
  },
  {
    key: "alg-bai-3",
    group: "Số/Đại số",
    title: "Bài 3. Lũy thừa với số mũ tự nhiên của một số hữu tỉ",
    firstPdfPage: 17,
    lastPdfPage: 20,
  },
  {
    key: "alg-bai-6",
    group: "Số/Đại số",
    title: "Bài 6. Số vô tỉ. Căn bậc hai số học",
    firstPdfPage: 30,
    lastPdfPage: 33,
  },
  {
    key: "geo-bai-8",
    group: "Hình học",
    title: "Bài 8. Góc ở vị trí đặc biệt. Tia phân giác của một góc",
    firstPdfPage: 41,
    lastPdfPage: 46,
  },
  {
    key: "geo-bai-12",
    group: "Hình học",
    title: "Bài 12. Tổng các góc trong một tam giác",
    firstPdfPage: 61,
    lastPdfPage: 63,
  },
  {
    key: "geo-bai-14",
    group: "Hình học",
    title: "Bài 14. Trường hợp bằng nhau thứ hai và thứ ba của tam giác",
    firstPdfPage: 71,
    lastPdfPage: 74,
  },
] as const;

describe.skipIf(!runLiveTest)("M9.2 PDF contract-v2 OpenAI live matrix", () => {
  let provider: OpenAiProvider;
  const contexts = new Map<string, RetrievedChunk[]>();
  const totals = {
    generationCalls: 0,
    auditCalls: 0,
    input: 0,
    cachedInput: 0,
    output: 0,
    tokens: 0,
  };

  beforeAll(async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the PDF matrix.");
    const env = validateEnv(process.env);
    const configService = new ConfigService<EnvConfig, true>(env, true);
    const storage = new ObjectStorageService(configService);
    const cache = new OcrArtifactCacheService(storage, configService);
    const pdfBuffer = readFileSync(sourcePdf);
    const contentHash = createHash("sha256").update(pdfBuffer).digest("hex");
    const descriptor = cache.createDescriptor(contentHash, env.OCR_PROVIDER);
    if (!(await cache.hasArtifact(descriptor))) {
      throw new Error(
        "Mathpix artifact cache is missing. This test never starts paid OCR automatically.",
      );
    }
    const bundle = await cache.loadBundle(descriptor);
    const pages = normalizeOcrPages(bundle, bundle.numPages);
    provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 180_000,
      embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: "gpt-4.1",
      structuredModel: "gpt-4.1",
    });
    mkdirSync(artifactDirectory, { recursive: true });

    lessons.forEach((lesson, lessonIndex) => {
      const lessonPages = pages.slice(lesson.firstPdfPage - 1, lesson.lastPdfPage);
      const chunks = lessonPages.map((page, pageIndex) => ({
        id: stableChunkId(lessonIndex, pageIndex),
        content: page.mathpixMarkdown ?? page.markdown ?? page.text,
        metadata: {
          sourceFile: basename(sourcePdf),
          pdfPage: page.pageNumber,
          printedPage: page.printedPage,
        },
      }));
      if (chunks.some((chunk) => chunk.content.length === 0)) {
        throw new Error(`Ghostscript returned an empty page for ${lesson.key}.`);
      }
      if (buildLessonSummarySourceCandidates(chunks).length < 3) {
        throw new Error(`Not enough source candidates for ${lesson.key}.`);
      }
      if (buildLessonSummarySourceTopics(chunks).length < 1) {
        throw new Error(`No source topic extracted for ${lesson.key}.`);
      }
      if (
        !buildLessonSummarySourceCandidates(chunks).some(
          (candidate) => candidate.kindHint === "REAL_WORLD_EXERCISE",
        )
      ) {
        throw new Error(`No real-world source candidate for ${lesson.key}.`);
      }
      contexts.set(lesson.key, chunks);
    });
  }, 60_000);

  afterAll(() => {
    console.info(`[M9.2 PDF MATRIX TOTAL] ${JSON.stringify(totals)}`);
  });

  for (const lesson of lessons) {
    for (const model of models) {
      const caseKey = `${lesson.key}:${model}`;
      it.skipIf(selectedLiveCases.size > 0 && !selectedLiveCases.has(caseKey))(
        `${lesson.group} | ${lesson.title} | ${model}`,
        async () => {
          const chunks = contexts.get(lesson.key);
          if (!chunks) throw new Error(`Missing context for ${lesson.key}.`);
          const request = buildLessonSummaryStructuredInput({
            lessonId: `lesson-${lesson.key}`,
            lessonTitle: lesson.title,
            documentIds: [`document-${lesson.key}`],
            sourceHash: `pdf-${lesson.key}`,
            chunks,
            configuration: {
              style: "student_friendly",
              styleInstructions: "",
              length: "detailed",
              targetWordCount: null,
              extraInstructions: "",
            },
          });
          const startedAt = Date.now();
          const { result, persisted } = await generateSummaryForReview({
            provider,
            request,
            model,
            lessonId: `lesson-${lesson.key}`,
            chunks,
            totals,
          });
          const finalSection = persisted.sections.at(-1);
          const theorySections = persisted.sections.slice(0, -1);

          expect(finalSection?.displayHeading).toBe("Bài tập vận dụng");
          expect(finalSection?.blocks).toHaveLength(2);
          expect(
            theorySections.every((section) =>
              section.blocks.every((block, index) =>
                block.type === "knowledge" ||
                block.type === "theorem" ||
                block.type === "property" ||
                block.type === "procedure"
                  ? section.blocks[index - 1]?.type === "example" ||
                    section.blocks[index + 1]?.type === "example"
                  : true,
              ),
            ),
          ).toBe(true);

          const auditResult = await auditLessonSummary({
            provider,
            lessonTitle: lesson.title,
            chunks,
            persisted,
            providerOutput: result.data,
          });
          addUsage(totals, auditResult.usage);
          totals.auditCalls += 1;
          writeFileSync(
            resolve(artifactDirectory, `${lesson.key}--${model}.json`),
            `${JSON.stringify(
              {
                lesson,
                model,
                generationUsage: result.usage,
                warningCount: persisted.warnings?.length ?? 0,
                auditUsage: auditResult.usage,
                providerOutput: result.data,
                persistedOutput: persisted,
                semanticAudit: auditResult.data,
              },
              null,
              2,
            )}\n`,
            "utf8",
          );
          expect(auditResult.data.overallPass, auditResult.data.summary).toBe(true);
          expect(
            auditResult.data.theoryExamplePairs.every(
              (pair) =>
                pair.relevant && pair.mathematicallyCorrect && pair.studentAppropriate,
            ),
          ).toBe(true);
          expect(auditResult.data.applicationExercisesCorrect).toBe(true);
          expect(auditResult.data.coverageSufficient).toBe(true);
          expect(auditResult.data.granularityGood).toBe(true);
          const expectedPairCount = result.data.theorySections.reduce(
            (sum, section) => sum + section.units.length,
            0,
          );
          expect(auditResult.data.theoryExamplePairs).toHaveLength(expectedPairCount);
          expect(
            new Set(
              auditResult.data.theoryExamplePairs.map(
                (pair) => `${pair.sectionIndex}:${pair.unitIndex}`,
              ),
            ).size,
          ).toBe(expectedPairCount);
          console.info(
            `[M9.2 PDF MATRIX PASS] ${JSON.stringify({
              lesson: lesson.key,
              group: lesson.group,
              model: result.model,
              theorySections: theorySections.length,
              theoryUnits: result.data.theorySections.reduce(
                (sum, section) => sum + section.units.length,
                0,
              ),
              inputTokens: result.usage?.promptTokens ?? null,
              cachedInputTokens: result.usage?.cachedInputTokens ?? null,
              outputTokens: result.usage?.completionTokens ?? null,
              totalTokens: result.usage?.totalTokens ?? null,
              latencyMs: result.latencyMs ?? Date.now() - startedAt,
              warningCount: persisted.warnings?.length ?? 0,
              audit: auditResult.data.summary,
            })}`,
          );
        },
        300_000,
      );
    }
  }
});

async function generateSummaryForReview(input: {
  provider: OpenAiProvider;
  request: ReturnType<typeof buildLessonSummaryStructuredInput>;
  model: (typeof models)[number];
  lessonId: string;
  chunks: RetrievedChunk[];
  totals: {
    generationCalls: number;
    input: number;
    cachedInput: number;
    output: number;
    tokens: number;
  };
}) {
  const result = await input.provider.generateStructured(
    { ...input.request, model: input.model, maxTokens: 8_000 },
    lessonSummaryProviderOutputSchema,
  );
  addUsage(input.totals, result.usage);
  input.totals.generationCalls += 1;
  const persisted = mapLessonSummaryProviderOutput({
    lessonId: input.lessonId,
    output: result.data,
    contextChunks: input.chunks,
  });
  return { result, persisted };
}

const semanticAuditSchema = z
  .object({
    overallPass: z.boolean(),
    coverageSufficient: z.boolean(),
    granularityGood: z.boolean(),
    applicationExercisesCorrect: z.boolean(),
    languageAndPresentationGood: z.boolean(),
    theoryExamplePairs: z.array(
      z
        .object({
          sectionIndex: z.number().int().nonnegative(),
          unitIndex: z.number().int().nonnegative(),
          relevant: z.boolean(),
          mathematicallyCorrect: z.boolean(),
          studentAppropriate: z.boolean(),
          presentationGood: z.boolean(),
          issues: z.array(z.string()),
        })
        .strict(),
    ),
    summary: z.string(),
  })
  .strict();

async function auditLessonSummary(input: {
  provider: OpenAiProvider;
  lessonTitle: string;
  chunks: RetrievedChunk[];
  persisted: unknown;
  providerOutput: unknown;
}) {
  return input.provider.generateStructured(
    {
      systemPrompt: [
        "Bạn là giáo viên Toán THCS độc lập, nghiêm khắc và đang kiểm định một bản kiến thức cho học sinh lớp 7.",
        "Chỉ đánh giá dựa trên SOURCE và SUMMARY được cung cấp; không nương tay vì JSON đúng cấu trúc.",
        "Với từng unit trong PAIR_CONTRACT, kiểm tra illustration có liên hệ trực tiếp với theory cùng unit, placement BEFORE/AFTER có đúng mạch sư phạm và lời giải/đáp án có đúng toán học hay không.",
        "BEFORE_THEORY phù hợp cho hoạt động khám phá dẫn tới kiến thức; không phạt vì nó chưa áp dụng định lí nếu lời giải chỉ dùng quan sát/lập luận được phép trước theory. AFTER_THEORY phải áp dụng trực tiếp theory đã nêu.",
        "coverageSufficient chỉ đánh giá đã bao phủ các source topic và kiến thức cốt lõi hay chưa. KHÔNG yêu cầu đưa mọi ví dụ, hoạt động, luyện tập, vận dụng hoặc bài tập trong SOURCE vào SUMMARY.",
        "granularityGood chỉ true khi mỗi theory block tập trung vào một tiểu chủ đề mạch lạc. Các quy tắc được SOURCE chủ động đặt chung trong cùng heading như cộng/trừ hoặc nhân/chia được xem là một tiểu chủ đề; không được tách cơ học chỉ vì có hai phép toán. Chỉ để false khi block dồn các khái niệm hoặc nhóm quy tắc khác ranh giới nguồn. Không áp đặt số ý tối đa khi các ý thực sự cùng một tiểu chủ đề.",
        "Kiểm tra đúng hai bài cuối có đúng loại bài thông thường/bài toán thực tế, đều lấy từ SOURCE và lời giải đúng. Không phạt việc chọn một bài khác trong SOURCE nếu vẫn đúng loại.",
        "Đánh giá riêng chất lượng biên tập: tiếng Việt tự nhiên, vừa sức lớp 7, tiêu đề gọn, LaTeX sạch, xuống dòng hợp lý. Chỉ đánh giá nội dung AI tự viết; không quy lỗi cho AI vì lỗi OCR nhỏ còn sót trong đề bài nguồn.",
        "overallPass chỉ phụ thuộc độ bao phủ kiến thức cốt lõi, độ hạt theory block hợp lý, tính liên quan và tính đúng toán học. Lỗi biên tập nhỏ khiến languageAndPresentationGood hoặc presentationGood=false và phải ghi issue, nhưng không bắt overallPass=false vì admin còn review/chỉnh JSON thủ công.",
      ].join("\n"),
      userPrompt: JSON.stringify({
        lessonTitle: input.lessonTitle,
        source: input.chunks.map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
        })),
        summary: input.persisted,
        pairContract: input.providerOutput,
      }),
      contextSerialization: "json",
      temperature: 0,
      maxTokens: 6_000,
      model: "gpt-5.4",
      reasoningEffort: "low",
      outputName: "lesson_summary_semantic_audit",
      promptVersion: "lesson-summary-semantic-audit-v2",
      schemaVersion: "lesson-summary-semantic-audit-schema-v1",
    },
    semanticAuditSchema,
  );
}

function addUsage(
  totals: {
    input: number;
    cachedInput: number;
    output: number;
    tokens: number;
  },
  usage:
    | {
        promptTokens?: number;
        cachedInputTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      }
    | undefined,
) {
  totals.input += usage?.promptTokens ?? 0;
  totals.cachedInput += usage?.cachedInputTokens ?? 0;
  totals.output += usage?.completionTokens ?? 0;
  totals.tokens += usage?.totalTokens ?? 0;
}

function stableChunkId(lessonIndex: number, pageIndex: number) {
  return `10000000-0000-4000-8000-${String(lessonIndex * 100 + pageIndex + 1).padStart(12, "0")}`;
}
