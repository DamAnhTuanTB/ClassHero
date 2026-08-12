import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";

import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import type { AiStructuredSchemaReferenceStrategy } from "#api/modules/ai/types/ai-text.types";
import {
  type LessonSummaryOutput,
  lessonSummaryOutputSchema,
  lessonSummaryProviderTransportOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { recoverLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-recovery";

const liveEnv: NodeJS.ProcessEnv = { ...process.env };
loadEnv({
  path: resolve(process.cwd(), "../../.env"),
  override: false,
  processEnv: liveEnv,
  quiet: true,
});

const runLiveTest = liveEnv.RUN_OPENAI_SMALL_LIVE_TESTS === "1";
const liveRunId = normalizeRunId(
  liveEnv.M9_2_SCHEMA_REF_SMALL_LIVE_RUN_ID ?? "historical",
);
const schemaReferenceStrategies = readStrategies(
  liveEnv.M9_2_SCHEMA_REF_SMALL_LIVE_STRATEGIES ?? "ref,inline",
);
const artifactDirectory = resolve(
  process.cwd(),
  "../../tmp/m9-2-schema-ref-small-live-comparison",
  liveRunId,
);
const smallCases = [
  {
    id: "grade-3-addition-commutative",
    lessonTitle: "Tính chất giao hoán của phép cộng",
    targetGrade: 3,
    chunk: {
      id: "33333333-3333-4333-8333-333333333333",
      content:
        "Tính chất giao hoán của phép cộng: Khi đổi chỗ các số hạng trong một tổng thì tổng không thay đổi, $a+b=b+a$. Ví dụ: $7+5=5+7=12$.",
    },
    requiredTerms: ["giao hoán", "đổi chỗ"],
    unexpectedTerms: ["kết hợp", "phân phối"],
    expectsTriangleDiagrams: false,
  },
  {
    id: "grade-8-square-of-sum",
    lessonTitle: "Bình phương của một tổng",
    targetGrade: 8,
    chunk: {
      id: "44444444-4444-4444-8444-444444444444",
      content:
        "Bình phương của một tổng được tính theo công thức $(a+b)^2=a^2+2ab+b^2$. Ví dụ: $(x+3)^2=x^2+6x+9$.",
    },
    requiredTerms: ["bình phương của một tổng", "2ab"],
    unexpectedTerms: ["bình phương của một hiệu", "lập phương"],
    expectsTriangleDiagrams: false,
  },
  {
    id: "grade-7-triangle-angle-sum",
    lessonTitle: "Tổng ba góc của một tam giác",
    targetGrade: 7,
    chunk: {
      id: "55555555-5555-4555-8555-555555555555",
      content:
        "Tổng ba góc của một tam giác bằng $180^\\circ$. Ví dụ: Tam giác $ABC$ có $\\widehat{A}=50^\\circ$, $\\widehat{B}=60^\\circ$, suy ra $\\widehat{C}=70^\\circ$.",
    },
    requiredTerms: ["tổng ba góc", "180"],
    unexpectedTerms: ["góc ngoài", "tam giác đồng dạng"],
    expectsTriangleDiagrams: true,
  },
] as const;

describe.skipIf(!runLiveTest)(
  "M9.2 OpenAI small-source schema ref live comparison",
  () => {
    it("compares inline and ref output on three small source examples", async () => {
      const provider = createProvider();
      mkdirSync(artifactDirectory, { recursive: true });
      const allComparisons: SmallLiveComparison[] = [];

      for (const smallCase of smallCases) {
        const caseDirectory = resolve(artifactDirectory, smallCase.id);
        mkdirSync(caseDirectory, { recursive: true });
        const caseComparisons: SmallLiveComparison[] = [];

        for (const schemaReferenceStrategy of schemaReferenceStrategies) {
          const artifactPath = resolve(caseDirectory, `${schemaReferenceStrategy}.json`);
          const cachedComparison = readCachedComparison(artifactPath);
          if (cachedComparison) {
            caseComparisons.push(cachedComparison);
            allComparisons.push(cachedComparison);
            console.info(
              `[M9.2 SMALL CACHE ${smallCase.id} ${schemaReferenceStrategy}] ${JSON.stringify(cachedComparison)}`,
            );
            continue;
          }
          const chunks = [smallCase.chunk];
          const request = buildLessonSummaryStructuredInput({
            lessonId: `lesson-${smallCase.id}`,
            lessonTitle: smallCase.lessonTitle,
            targetGrade: smallCase.targetGrade,
            documentIds: [`document-${smallCase.id}`],
            sourceHash: `live-small-${smallCase.id}`,
            chunks,
            configuration: {
              style: "student_friendly",
              styleInstructions: "",
              length: "concise",
              targetWordCount: null,
              extraInstructions: "",
              schemaReferenceStrategy,
              promptCacheKeyEnabled: schemaReferenceStrategy === "ref_v2",
              promptCacheRetention:
                schemaReferenceStrategy === "ref_v2" ? "24h" : "in_memory",
            },
          });
          const structuredTextFormat = buildAiStructuredTextFormat(
            lessonSummaryProviderTransportOutputSchema,
            request.outputName,
            request.schemaReferenceStrategy,
          );
          const result = await provider.generateStructured(
            {
              ...request,
              model: "gpt-5.4",
              reasoningEffort: "medium",
            },
            lessonSummaryProviderTransportOutputSchema,
          );
          const recovery = recoverLessonSummaryProviderOutput({
            output: result.data,
            contextChunks: chunks,
          });
          const summary = mapLessonSummaryProviderOutput({
            lessonId: `lesson-${smallCase.id}`,
            output: recovery.output,
            contextChunks: chunks,
            reviewIssuesByPath: recovery.reviewIssuesByPath,
            diagramProvenanceByPath: recovery.diagramProvenanceByPath,
            rootReviewIssues: recovery.rootReviewIssues,
            targetGrade: smallCase.targetGrade,
          });
          const theoryText = result.data.theorySections
            .flatMap((section) => section.units)
            .map((unit) => `${unit.theory.title} ${unit.theory.content}`)
            .join("\n")
            .toLocaleLowerCase("vi");
          const diagramMetrics = readDiagramMetrics(summary);
          const comparison: SmallLiveComparison = {
            caseId: smallCase.id,
            schemaReferenceStrategy,
            schemaCharacters: JSON.stringify(structuredTextFormat).length,
            provider: result.provider,
            model: result.model,
            usage: result.usage ?? null,
            latencyMs: result.latencyMs ?? null,
            issueCount: countReviewIssues(summary),
            theoryUnitCount: result.data.theorySections.reduce(
              (total, section) => total + section.units.length,
              0,
            ),
            requiredTermHits: smallCase.requiredTerms.filter((term) =>
              theoryText.includes(term.toLocaleLowerCase("vi")),
            ),
            unexpectedTermHits: smallCase.unexpectedTerms.filter((term) =>
              theoryText.includes(term.toLocaleLowerCase("vi")),
            ),
            persistedSectionCount: summary.sections.length,
            ...diagramMetrics,
          };

          expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
          expect(result.usage?.totalTokens).toBeGreaterThan(0);
          caseComparisons.push(comparison);
          allComparisons.push(comparison);
          writeFileSync(
            artifactPath,
            `${JSON.stringify(
              {
                generatedAt: new Date().toISOString(),
                source: smallCase,
                ...comparison,
                providerOutput: result.data,
                summary,
              },
              null,
              2,
            )}\n`,
            "utf8",
          );
          console.info(
            `[M9.2 SMALL LIVE ${smallCase.id} ${schemaReferenceStrategy}] ${JSON.stringify(comparison)}`,
          );
        }

        for (const result of caseComparisons) {
          expect(result.issueCount).toBe(0);
          expect(result.requiredTermHits.length).toBeGreaterThan(0);
          if (smallCase.expectsTriangleDiagrams) {
            expect(result.diagramCount).toBeGreaterThan(0);
            expect(result.diagramsWithoutTriangles).toBe(0);
          }
        }
        const refResult = caseComparisons.find(
          (comparison) => comparison.schemaReferenceStrategy === "ref",
        );
        const refV2Result = caseComparisons.find(
          (comparison) => comparison.schemaReferenceStrategy === "ref_v2",
        );
        const inlineResult = caseComparisons.find(
          (comparison) => comparison.schemaReferenceStrategy === "inline",
        );
        if (refResult && inlineResult) {
          expect(refResult.schemaCharacters).toBeLessThan(
            inlineResult.schemaCharacters / 5,
          );
        }
        if (refResult && refV2Result) {
          expect(refV2Result.schemaCharacters).toBeLessThan(refResult.schemaCharacters);
        }

        writeFileSync(
          resolve(caseDirectory, "comparison.json"),
          `${JSON.stringify(
            { generatedAt: new Date().toISOString(), comparisons: caseComparisons },
            null,
            2,
          )}\n`,
          "utf8",
        );
      }

      writeFileSync(
        resolve(artifactDirectory, "comparison.json"),
        `${JSON.stringify(
          { generatedAt: new Date().toISOString(), comparisons: allComparisons },
          null,
          2,
        )}\n`,
        "utf8",
      );
    }, 720_000);
  },
);

function createProvider() {
  const apiKey = liveEnv.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the live smoke test.");
  }
  return new OpenAiProvider({
    apiKey,
    requestTimeoutMs: 120_000,
    embeddingModel: liveEnv.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions: Number(liveEnv.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
    chatModel: liveEnv.OPENAI_CHAT_MODEL ?? "gpt-4.1",
    structuredModel: liveEnv.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1",
  });
}

function readCachedComparison(artifactPath: string) {
  if (!existsSync(artifactPath)) {
    return null;
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    providerOutput: unknown;
    summary: unknown;
  } & SmallLiveComparison;
  lessonSummaryProviderTransportOutputSchema.parse(artifact.providerOutput);
  lessonSummaryOutputSchema.parse(artifact.summary);
  return {
    caseId: artifact.caseId,
    schemaReferenceStrategy: artifact.schemaReferenceStrategy,
    schemaCharacters: artifact.schemaCharacters,
    provider: artifact.provider,
    model: artifact.model,
    usage: artifact.usage,
    latencyMs: artifact.latencyMs,
    issueCount: artifact.issueCount,
    theoryUnitCount: artifact.theoryUnitCount,
    requiredTermHits: artifact.requiredTermHits,
    unexpectedTermHits: artifact.unexpectedTermHits,
    persistedSectionCount: artifact.persistedSectionCount,
    blockCount: artifact.blockCount,
    diagramCount: artifact.diagramCount,
    triangleCounts: artifact.triangleCounts,
    diagramsWithoutTriangles: artifact.diagramsWithoutTriangles,
  };
}

function countReviewIssues(summary: LessonSummaryOutput) {
  return summary.sections.reduce(
    (total, section) =>
      total +
      section.blocks.reduce(
        (blockTotal, block) => blockTotal + (block.reviewIssues?.length ?? 0),
        0,
      ),
    summary.reviewIssues?.length ?? 0,
  );
}

function readDiagramMetrics(summary: LessonSummaryOutput) {
  const diagramSpecs = summary.sections.flatMap((section) =>
    section.blocks.flatMap((block) =>
      block.visual?.kind === "DIAGRAM_SPEC" ? [block.visual.spec] : [],
    ),
  );
  const triangleCounts = diagramSpecs.map(countTriangles);
  return {
    blockCount: summary.sections.reduce(
      (total, section) => total + section.blocks.length,
      0,
    ),
    diagramCount: diagramSpecs.length,
    triangleCounts,
    diagramsWithoutTriangles: triangleCounts.filter((count) => count === 0).length,
  };
}

function countTriangles(spec: DiagramSpec) {
  const pointIds = spec.points.map((point) => point.id);
  const segmentKeys = new Set(
    spec.primitives.flatMap((primitive) =>
      primitive.type === "SEGMENT"
        ? [makeUndirectedEdgeKey(primitive.from, primitive.to)]
        : [],
    ),
  );
  let triangleCount = 0;

  for (let first = 0; first < pointIds.length; first += 1) {
    for (let second = first + 1; second < pointIds.length; second += 1) {
      for (let third = second + 1; third < pointIds.length; third += 1) {
        const firstId = pointIds[first];
        const secondId = pointIds[second];
        const thirdId = pointIds[third];
        if (
          firstId !== undefined &&
          secondId !== undefined &&
          thirdId !== undefined &&
          segmentKeys.has(makeUndirectedEdgeKey(firstId, secondId)) &&
          segmentKeys.has(makeUndirectedEdgeKey(firstId, thirdId)) &&
          segmentKeys.has(makeUndirectedEdgeKey(secondId, thirdId))
        ) {
          triangleCount += 1;
        }
      }
    }
  }

  return triangleCount;
}

function makeUndirectedEdgeKey(first: string, second: string) {
  return [first, second].sort().join("|");
}

type DiagramSpec = Extract<
  NonNullable<LessonSummaryOutput["sections"][number]["blocks"][number]["visual"]>,
  { kind: "DIAGRAM_SPEC" }
>["spec"];

type SmallLiveComparison = {
  caseId: string;
  schemaReferenceStrategy: AiStructuredSchemaReferenceStrategy;
  schemaCharacters: number;
  provider: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedInputTokens?: number;
  } | null;
  latencyMs: number | null;
  issueCount: number;
  theoryUnitCount: number;
  requiredTermHits: readonly string[];
  unexpectedTermHits: readonly string[];
  persistedSectionCount: number;
  blockCount: number;
  diagramCount: number;
  triangleCounts: number[];
  diagramsWithoutTriangles: number;
};

function normalizeRunId(value: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9_-]/gu, "-");
  if (!normalized) throw new Error("Small live run id must not be empty.");
  return normalized;
}

function readStrategies(value: string): AiStructuredSchemaReferenceStrategy[] {
  const allowed = new Set<AiStructuredSchemaReferenceStrategy>([
    "inline",
    "ref",
    "ref_v2",
  ]);
  const strategies = value
    .split(",")
    .map((strategy) => strategy.trim())
    .filter((strategy): strategy is AiStructuredSchemaReferenceStrategy =>
      allowed.has(strategy as AiStructuredSchemaReferenceStrategy),
    );
  if (strategies.length === 0) {
    throw new Error("At least one live schema strategy is required.");
  }
  return [...new Set(strategies)];
}
