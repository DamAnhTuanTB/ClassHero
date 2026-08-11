import { mkdirSync, writeFileSync } from "node:fs";
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

const runLiveTest = liveEnv.RUN_OPENAI_LIVE_TESTS === "1";
const liveRunId = (liveEnv.M9_2_SCHEMA_REF_LIVE_RUN_ID ?? "run")
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "-");
const schemaReferenceStrategies = readStrategies(
  liveEnv.M9_2_SCHEMA_REF_LIVE_STRATEGIES ?? "ref,inline",
);
const supportedTheoryCategories = new Set<TheoryCategory>([
  "TWO_LEGS",
  "HYPOTENUSE_LEG",
]);
const chunks = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    content:
      "Bài 15. Ba trường hợp bằng nhau của tam giác vuông. Nếu hai cạnh góc vuông của tam giác vuông này lần lượt bằng hai cạnh góc vuông của tam giác vuông kia thì hai tam giác vuông đó bằng nhau. Nếu cạnh huyền và một cạnh góc vuông tương ứng bằng nhau thì hai tam giác vuông bằng nhau.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    content:
      "Ví dụ. Cho tam giác ABC vuông tại B và tam giác ADC vuông tại D. Biết AB = AD và AC là cạnh huyền chung. Chứng minh tam giác ABC bằng tam giác ADC. Bài tập vận dụng. Hai thanh giằng tạo thành hai tam giác vuông có cạnh huyền và một cạnh góc vuông tương ứng bằng nhau. Chứng minh hai khung bằng nhau.",
  },
];

describe.skipIf(!runLiveTest)("M9.2 OpenAI lesson summary live smoke", () => {
  it("compares live output quality between inline and ref schemas", async () => {
    const apiKey = liveEnv.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for the live smoke test.");
    }
    const provider = new OpenAiProvider({
      apiKey,
      requestTimeoutMs: 120_000,
      embeddingModel: liveEnv.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: Number(liveEnv.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
      chatModel: liveEnv.OPENAI_CHAT_MODEL ?? "gpt-4.1",
      structuredModel: liveEnv.OPENAI_STRUCTURED_MODEL ?? "gpt-4.1",
    });
    const artifactDirectory = resolve(
      process.cwd(),
      "../../tmp/m9-2-schema-ref-live-comparison",
      liveRunId,
    );
    mkdirSync(artifactDirectory, { recursive: true });
    const comparisons = [];

    // Run the new path first. If OpenAI rejects `$defs/$ref`, the test stops
    // before spending a second call on the already-proven inline baseline.
    for (const schemaReferenceStrategy of schemaReferenceStrategies) {
      const request = buildLessonSummaryStructuredInput({
        lessonId: "lesson-live",
        lessonTitle: "Bài 15: Ba trường hợp bằng nhau của tam giác vuông",
        targetGrade: 7,
        documentIds: ["document-live"],
        sourceHash: "live-source",
        chunks,
        configuration: {
          style: "student_friendly",
          styleInstructions: "",
          length: "standard",
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
        lessonId: "lesson-live",
        output: recovery.output,
        contextChunks: chunks,
        reviewIssuesByPath: recovery.reviewIssuesByPath,
        rootReviewIssues: recovery.rootReviewIssues,
        targetGrade: 7,
      });

      expect(summary.sections.at(-1)).toMatchObject({
        displayHeading: "Bài tập vận dụng",
        blocks: [
          expect.objectContaining({ type: "example" }),
          expect.objectContaining({ type: "example" }),
        ],
      });
      expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
      expect(result.usage?.totalTokens).toBeGreaterThan(0);

      const issueCount = countReviewIssues(summary);
      const visualMetrics = readVisualMetrics(summary);
      const triangleDiagramMetrics = readTriangleDiagramMetrics(summary);
      const theoryMetrics = readTheoryMetrics(result.data);
      expect(issueCount).toBe(0);
      expect(visualMetrics.missingRequiredVisuals).toBe(0);
      expect(triangleDiagramMetrics.diagramsMissingSecondTriangle).toBe(0);
      expect(triangleDiagramMetrics.exactSourceExampleDiagram).toBe(true);

      const comparison = {
        schemaReferenceStrategy,
        schemaCharacters: JSON.stringify(structuredTextFormat).length,
        provider: result.provider,
        model: result.model,
        usage: result.usage ?? null,
        latencyMs: result.latencyMs ?? null,
        issueCount,
        ...visualMetrics,
        ...triangleDiagramMetrics,
        ...theoryMetrics,
        theorySectionCount: result.data.theorySections.length,
        persistedSectionCount: summary.sections.length,
      };
      comparisons.push(comparison);

      writeFileSync(
        resolve(artifactDirectory, `live-bai-15-${schemaReferenceStrategy}.json`),
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            ...comparison,
            providerOutput: result.data,
            summary,
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      console.info(`[M9.2 LIVE ${schemaReferenceStrategy}] ${JSON.stringify(comparison)}`);
    }

    const refResult = comparisons.find(
      (comparison) => comparison.schemaReferenceStrategy === "ref",
    );
    const inlineResult = comparisons.find(
      (comparison) => comparison.schemaReferenceStrategy === "inline",
    );
    const refV2Result = comparisons.find(
      (comparison) => comparison.schemaReferenceStrategy === "ref_v2",
    );
    if (refResult && inlineResult) {
      expect(refResult.schemaCharacters).toBeLessThan(
        inlineResult.schemaCharacters / 5,
      );
      expect(refResult.issueCount).toBe(inlineResult.issueCount);
      expect(refResult.missingRequiredVisuals).toBe(
        inlineResult.missingRequiredVisuals,
      );
    }
    if (refResult && refV2Result) {
      expect(refV2Result.schemaCharacters).toBeLessThan(
        refResult.schemaCharacters,
      );
      expect(refV2Result.issueCount).toBe(refResult.issueCount);
      expect(refV2Result.missingRequiredVisuals).toBe(
        refResult.missingRequiredVisuals,
      );
    }

    writeFileSync(
      resolve(artifactDirectory, "comparison.json"),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), comparisons }, null, 2)}\n`,
      "utf8",
    );
  }, 360_000);
});

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

function readVisualMetrics(summary: LessonSummaryOutput) {
  const visualBlocks = summary.sections.flatMap((section) => section.blocks);
  const requiredVisualBlocks = visualBlocks.filter((block) => block.type !== "note");
  return {
    blockCount: visualBlocks.length,
    diagramCount: visualBlocks.filter((block) => block.visual != null).length,
    requiredVisualCount: requiredVisualBlocks.length,
    missingRequiredVisuals: requiredVisualBlocks.filter(
      (block) => block.visual == null,
    ).length,
  };
}

function readTriangleDiagramMetrics(summary: LessonSummaryOutput) {
  const blocks = summary.sections.flatMap((section) => section.blocks);
  const diagramSpecs = blocks.flatMap((block) =>
    block.visual?.kind === "DIAGRAM_SPEC" ? [block.visual.spec] : [],
  );
  const diagramsWithTwoTriangles = diagramSpecs.filter(
    (spec) => countTriangles(spec) === 2,
  ).length;
  const sourceExample = blocks.find(
    (block) => block.type === "example" && block.problem.includes("ADC"),
  );

  return {
    diagramsWithTwoTriangles,
    diagramsMissingSecondTriangle:
      diagramSpecs.length - diagramsWithTwoTriangles,
    exactSourceExampleDiagram:
      sourceExample?.visual?.kind === "DIAGRAM_SPEC" &&
      isExactSourceExampleDiagram(sourceExample.visual.spec),
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

function isExactSourceExampleDiagram(spec: DiagramSpec) {
  const pointLabelsById = new Map(
    spec.points.map((point) => [point.id, point.label]),
  );
  const segmentKeysById = new Map<string, string>();
  const segmentKeys = new Set(
    spec.primitives.flatMap((primitive) => {
      if (primitive.type !== "SEGMENT") {
        return [];
      }
      const fromLabel = pointLabelsById.get(primitive.from);
      const toLabel = pointLabelsById.get(primitive.to);
      if (!fromLabel || !toLabel) {
        return [];
      }
      const segmentKey = makeUndirectedEdgeKey(fromLabel, toLabel);
      segmentKeysById.set(primitive.id, segmentKey);
      return [segmentKey];
    }),
  );
  const rightAngleVertices = new Set(
    spec.markers.flatMap((marker) => {
      if (marker.type !== "RIGHT_ANGLE") {
        return [];
      }
      const vertexLabel = pointLabelsById.get(marker.vertex);
      return vertexLabel ? [vertexLabel] : [];
    }),
  );
  const equalLengthPairs = new Set(
    spec.markers.flatMap((marker) => {
      if (marker.type !== "EQUAL_LENGTH") {
        return [];
      }
      const markedSegments = marker.segmentIds
        .map((segmentId) => segmentKeysById.get(segmentId))
        .filter((segmentKey): segmentKey is string => segmentKey !== undefined)
        .sort();
      return markedSegments.length === marker.segmentIds.length
        ? [markedSegments.join(",")]
        : [];
    }),
  );

  return (
    ["A|B", "B|C", "A|C", "A|D", "C|D"].every((segmentKey) =>
      segmentKeys.has(segmentKey),
    ) &&
    rightAngleVertices.has("B") &&
    rightAngleVertices.has("D") &&
    equalLengthPairs.has("A|B,A|D") &&
    countTriangles(spec) === 2
  );
}

function makeUndirectedEdgeKey(first: string, second: string) {
  return [first, second].sort().join("|");
}

type DiagramSpec = Extract<
  NonNullable<LessonSummaryOutput["sections"][number]["blocks"][number]["visual"]>,
  { kind: "DIAGRAM_SPEC" }
>["spec"];

type TheoryCategory =
  | "TWO_LEGS"
  | "HYPOTENUSE_LEG"
  | "HYPOTENUSE_ACUTE_ANGLE"
  | "OTHER";

function readStrategies(value: string): AiStructuredSchemaReferenceStrategy[] {
  const allowed = new Set<AiStructuredSchemaReferenceStrategy>([
    "inline",
    "ref",
    "ref_v2",
  ]);
  const strategies = value
    .split(",")
    .map((strategy) => strategy.trim())
    .filter(
      (strategy): strategy is AiStructuredSchemaReferenceStrategy =>
        allowed.has(strategy as AiStructuredSchemaReferenceStrategy),
    );
  if (strategies.length === 0) {
    throw new Error("At least one live schema strategy is required.");
  }
  return [...new Set(strategies)];
}

function readTheoryMetrics(output: {
  theorySections: Array<{
    units: Array<{ theory: { title: string; content: string } }>;
  }>;
}) {
  const theoryCategories = output.theorySections.flatMap((section) =>
    section.units.map((unit) => classifyTheoryCategory(unit.theory)),
  );

  return {
    theoryUnitCount: theoryCategories.length,
    theoryCategories,
    unexpectedTheoryCategories: theoryCategories.filter(
      (category) => !supportedTheoryCategories.has(category),
    ),
  };
}

function classifyTheoryCategory(theory: {
  title: string;
  content: string;
}): TheoryCategory {
  const text = `${theory.title} ${theory.content}`.toLocaleLowerCase("vi");
  if (text.includes("cạnh huyền") && text.includes("góc nhọn")) {
    return "HYPOTENUSE_ACUTE_ANGLE";
  }
  if (text.includes("cạnh huyền") && text.includes("cạnh góc vuông")) {
    return "HYPOTENUSE_LEG";
  }
  if (text.includes("hai cạnh góc vuông")) {
    return "TWO_LEGS";
  }
  return "OTHER";
}
