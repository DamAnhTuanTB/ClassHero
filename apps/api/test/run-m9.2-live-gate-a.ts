import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ConfigService } from "@nestjs/config";
import {
  AiGenerationType,
  ProviderCatalogCategory,
  ProviderUsageMetric,
} from "@prisma/client";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import {
  lessonSummaryProviderDiagramInputSchema,
  mapLessonSummaryProviderDiagramInput,
} from "#api/modules/ai/types/lesson-summary-provider-diagram.types";
import { canonicalAdvancedPointLabels } from "#api/modules/ai/utils/diagram-compilers/compile-advanced-geometry-diagram";
import { canonicalSpatialPointLabels } from "#api/modules/ai/utils/diagram-compilers/compile-spatial-diagram";
import { canonicalVennGroup } from "#api/modules/ai/utils/diagram-compilers/compile-schematic-diagram";
import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";

import {
  mathDiagramLiveGateACases,
  type MathDiagramLiveGateABatch,
  type MathDiagramLiveGateACase,
} from "./fixtures/math-diagram/live-gate-a-cases";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
loadEnv({ path: path.join(repositoryRoot, ".env"), override: false, quiet: true });

const MODEL = "gpt-5.4";
const REASONING_EFFORT = "medium" as const;
const PROMPT_VERSION = "lesson-summary-prompt-v51";
const SCHEMA_VERSION = "lesson-summary-schema-v39";
const INPUT_TOKEN_UPPER_BOUND = 14_000;
const OUTPUT_TOKEN_UPPER_BOUND = 2_000;
const REQUEST_UPPER_BOUND_VND = 1_658;
const GATE_A_HARD_CAP_VND = 125_000;
const WAVE_HARD_CAP_VND = 320_000;
const outputDirectory = path.join(repositoryRoot, "tmp/m9-2-v51-live-gate-a");
const ledgerPath = path.join(outputDirectory, "ledger.json");
const reviewPath = path.join(outputDirectory, "review.json");

const liveOutputSchema = z
  .object({
    caseId: z.string().trim().min(1).max(120),
    diagramSpec: lessonSummaryProviderDiagramInputSchema,
  })
  .strict();

type LedgerEntry = {
  ledgerKey?: string;
  caseId: string;
  batch: MathDiagramLiveGateABatch;
  attempt?: number;
  status:
    | "RUNNING"
    | "PROVIDER_CACHED"
    | "SUCCEEDED"
    | "REJECTED_SEMANTIC"
    | "FAILED_CONSERVATIVE";
  reservedVnd: number;
  settledVnd: number | null;
  usageEventId: string | null;
  cachePath: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

type Ledger = {
  version: 1;
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  gateAHardCapVnd: number;
  waveHardCapVnd: number;
  entries: LedgerEntry[];
};

type LiveArtifact = {
  version: 1;
  generatedAt: string;
  case: MathDiagramLiveGateACase;
  provider: "OPENAI";
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  providerRequestId: string | null;
  usage: {
    promptTokens: number;
    cachedInputTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  settledCostVnd: number;
  latencyMs: number | null;
  semanticOutput: z.infer<typeof liveOutputSchema>;
  compiledDiagramSpec: ReturnType<typeof mapLessonSummaryProviderDiagramInput>;
  audit: { passed: boolean; issues: string[] };
};

type RawProviderArtifact = {
  version: 1;
  generatedAt: string;
  caseId: string;
  provider: "OPENAI";
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  providerRequestId: string | null;
  usage: LiveArtifact["usage"];
  settledCostVnd: number;
  latencyMs: number | null;
  semanticOutput: z.infer<typeof liveOutputSchema>;
};

const systemPrompt = `Bạn là bộ phân tích ngữ nghĩa hình vẽ Toán lớp 3–9.
Chỉ trả một object gồm caseId và diagramSpec.
- diagramSpec bắt buộc dùng envelope { kind: "INTENT", intent: ... }; không dùng RAW_SPEC.
- Chọn đúng family và archetype theo ý nghĩa đề, giữ đúng lớp và mức khó được yêu cầu.
- Chỉ điền dữ kiện toán học có nghĩa. Backend tự dựng tọa độ, điểm lấy mẫu, vạch chia, marker và vị trí nhãn.
- Không tự thêm quan hệ, số đo, điểm hoặc ký hiệu không có trong đề.
- Đồ thị phải có các hoành độ dựng tiêu biểu, đối xứng khi cần và không chứa x=0 với hàm y=a/x.
- Tên điểm là tên ngắn duy nhất; mọi dữ liệu bảng/biểu đồ phải khớp số lượng hàng, cột, nhóm và giá trị.
- Trước khi trả, kiểm tra lại mọi số liệu và quan hệ toán học.`;

function getUserPrompt(liveCase: MathDiagramLiveGateACase) {
  return [
    `caseId: ${liveCase.caseId}`,
    `Lớp: ${liveCase.grade}`,
    `Mức khó của hình: ${liveCase.difficulty}`,
    `Tiêu đề: ${liveCase.title}`,
    `Đề bài: ${liveCase.problem}`,
    "Hãy trả diagram intent tối giản nhưng đủ để backend vẽ hình chính xác theo đề.",
  ].join("\n");
}

function readLedger(): Ledger {
  if (!existsSync(ledgerPath)) {
    return {
      version: 1,
      model: MODEL,
      reasoningEffort: REASONING_EFFORT,
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      gateAHardCapVnd: GATE_A_HARD_CAP_VND,
      waveHardCapVnd: WAVE_HARD_CAP_VND,
      entries: [],
    };
  }
  return JSON.parse(readFileSync(ledgerPath, "utf8")) as Ledger;
}

function writeJsonAtomic(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, filePath);
}

function committedVnd(ledger: Ledger) {
  return ledger.entries.reduce(
    (total, entry) =>
      total +
      ((entry.status === "SUCCEEDED" ||
        entry.status === "PROVIDER_CACHED" ||
        entry.status === "REJECTED_SEMANTIC") &&
      entry.settledVnd !== null
        ? entry.settledVnd
        : entry.reservedVnd),
    0,
  );
}

function cacheFilePath(liveCase: MathDiagramLiveGateACase) {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        model: MODEL,
        reasoningEffort: REASONING_EFFORT,
        promptVersion: PROMPT_VERSION,
        schemaVersion: SCHEMA_VERSION,
        caseId: liveCase.caseId,
        systemPrompt,
        userPrompt: getUserPrompt(liveCase),
      }),
    )
    .digest("hex")
    .slice(0, 16);
  return path.join(outputDirectory, `${liveCase.caseId}-${fingerprint}.json`);
}

function rawProviderCacheFilePath(liveCase: MathDiagramLiveGateACase) {
  return `${cacheFilePath(liveCase)}.provider.json`;
}

function ledgerEntriesForCase(ledger: Ledger, caseId: string) {
  return ledger.entries.filter((entry) => entry.caseId === caseId);
}

function canUseExplicitRetry(
  ledger: Ledger,
  liveCase: MathDiagramLiveGateACase,
  retryCaseIds: ReadonlySet<string>,
  maximumAttempt: number,
) {
  if (!retryCaseIds.has(liveCase.caseId)) return false;
  const entries = ledgerEntriesForCase(ledger, liveCase.caseId);
  return (
    entries.some(
      (entry) =>
        entry.status === "FAILED_CONSERVATIVE" ||
        entry.status === "REJECTED_SEMANTIC" ||
        entry.status === "PROVIDER_CACHED" ||
        entry.status === "SUCCEEDED",
    ) &&
    Math.max(...entries.map((entry) => entry.attempt ?? 1), 0) < maximumAttempt
  );
}

function requestedRetryCaseIds() {
  const raw =
    process.env.M9_2_RETRY_CASE_IDS?.trim() ||
    process.env.M9_2_RETRY_CASE_ID?.trim() ||
    "";
  return new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
}

function comparableIntent(intent: LessonSummaryDiagramIntent) {
  const { caption: _caption, ...withoutCaption } = intent;
  if (intent.family === "ELEMENTARY_MODEL") {
    if (intent.archetype === "MULTIPLICATION_ARRAY") {
      const {
        caption: _ignored,
        rowLabel: _rowLabel,
        columnLabel: _columnLabel,
        ...core
      } = intent;
      return core;
    }
    if (intent.archetype === "TAPE_COMPARISON") {
      const { caption: _ignored, bars, ...core } = intent;
      return {
        ...core,
        bars: bars.map(({ partLabels: _partLabels, ...bar }) => bar),
      };
    }
    if (intent.archetype === "FRACTION_MODEL") {
      const { caption: _ignored, fractionLabel: _fractionLabel, ...core } = intent;
      return core;
    }
    if (intent.archetype === "MEASUREMENT_SCALE") {
      const { caption: _ignored, step: _step, ...core } = intent;
      return core;
    }
  }
  if (intent.family === "NUMBER_COORDINATE") {
    if (intent.archetype === "NUMBER_LINE") {
      const { min: _min, max: _max, step: _step, caption: _ignored, ...core } = intent;
      return core;
    }
    if (intent.archetype === "INTERVAL") {
      const {
        min: _min,
        max: _max,
        step: _step,
        caption: _ignored,
        intervalLabel: _intervalLabel,
        ...core
      } = intent;
      return core;
    }
    if (intent.archetype === "COORDINATE_POINTS") {
      const {
        xMin: _xMin,
        xMax: _xMax,
        yMin: _yMin,
        yMax: _yMax,
        xStep: _xStep,
        yStep: _yStep,
        caption: _ignored,
        ...core
      } = intent;
      return core;
    }
    const {
      xMin: _xMin,
      xMax: _xMax,
      yMin: _yMin,
      yMax: _yMax,
      tickStep: _tickStep,
      caption: _ignored,
      ...core
    } = intent;
    return core;
  }
  if (intent.family === "PLANE_GEOMETRY") {
    const measures = intent.measures.map((measure) => {
      if (intent.archetype !== "CIRCLE_PARTS" || intent.variant !== "ARC_SECTOR") {
        return measure;
      }
      const normalized = measure.target
        .normalize("NFKC")
        .replaceAll(/\s/gu, "")
        .toUpperCase();
      return {
        ...measure,
        target:
          normalized === "ANGLE" ||
          normalized.startsWith("∠") ||
          normalized.startsWith("\\ANGLE") ||
          normalized.startsWith("GÓC")
            ? "ANGLE"
            : measure.target,
      };
    });
    return {
      ...withoutCaption,
      measures: measures.sort((left, right) =>
        `${left.target}|${left.text}`.localeCompare(`${right.target}|${right.text}`),
      ),
    };
  }
  if (intent.family === "ALGEBRA_GRAPH") {
    const {
      xMin: _xMin,
      xMax: _xMax,
      yMin: _yMin,
      yMax: _yMax,
      xStep: _xStep,
      yStep: _yStep,
      caption: _ignored,
      functions,
      ...core
    } = intent;
    return {
      ...core,
      functions: functions
        .map(({ id: _id, ...graphFunction }) => {
          const constructionXs = [...new Set(graphFunction.constructionXs)].sort(
            (left, right) => left - right,
          );
          return {
            ...graphFunction,
            constructionXs:
              graphFunction.kind === "LINEAR" && constructionXs.length > 2
                ? [constructionXs[0], constructionXs.at(-1)]
                : constructionXs,
          };
        })
        .sort((left, right) => {
          const kindOrder = { QUADRATIC: 0, LINEAR: 1, INVERSE: 2 } as const;
          return (
            kindOrder[left.kind] - kindOrder[right.kind] ||
            left.label.localeCompare(right.label)
          );
        }),
    };
  }
  if (
    intent.family === "DATA_STATISTICS" &&
    (intent.archetype === "BAR_CHART" ||
      intent.archetype === "LINE_CHART" ||
      intent.archetype === "HISTOGRAM" ||
      intent.archetype === "PIE_CHART")
  ) {
    const { caption: _ignored, yStep: _yStep, ...core } = intent;
    return core;
  }
  if (intent.family === "SET_SCHEMATIC") {
    const labelsById = new Map(intent.nodes.map((node) => [node.id, node.label]));
    const vennSetLabels =
      intent.archetype === "VENN_UNIVERSE"
        ? intent.setLabels.slice(1)
        : intent.setLabels;
    return {
      intentVersion: intent.intentVersion,
      grade: intent.grade,
      difficulty: intent.difficulty,
      family: intent.family,
      archetype: intent.archetype,
      nodes: intent.nodes
        .map((node) => ({
          label: node.label,
          group:
            intent.archetype === "VENN" || intent.archetype === "VENN_UNIVERSE"
              ? canonicalVennGroup(node.group, vennSetLabels)
              : node.group,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
      edges: intent.edges
        .map((edge) => ({
          from: labelsById.get(edge.from) ?? edge.from,
          to: labelsById.get(edge.to) ?? edge.to,
          label: edge.label,
        }))
        .sort((left, right) =>
          `${left.from}|${left.to}|${left.label}`.localeCompare(
            `${right.from}|${right.to}|${right.label}`,
          ),
        ),
      setLabels: intent.setLabels,
    };
  }
  if (intent.family === "ADVANCED_GEOMETRY") {
    return {
      ...withoutCaption,
      pointLabels: canonicalAdvancedPointLabels(intent),
      measures: [...intent.measures].sort((left, right) =>
        `${left.target}|${left.text}`.localeCompare(`${right.target}|${right.text}`),
      ),
    };
  }
  if (
    intent.family === "SPATIAL_APPLIED" &&
    intent.archetype === "CYLINDER"
  ) {
    const canonicalPointLabels = canonicalSpatialPointLabels(intent);
    const [bottomCenter = "O", topCenter = "O′", radiusEnd = "A"] =
      canonicalPointLabels;
    const normalizeTarget = (target: string) =>
      [...target.toLowerCase()].sort().join("");
    const radiusTarget = normalizeTarget(`${bottomCenter}${radiusEnd}`);
    const heightTarget = normalizeTarget(`${bottomCenter}${topCenter}`);
    return {
      ...withoutCaption,
      pointLabels: canonicalPointLabels,
      dimensions: intent.dimensions.map((dimension) => {
        const target = normalizeTarget(dimension.target);
        if (target === "r" || target === "radius" || target === radiusTarget) {
          return { ...dimension, target: "radius" };
        }
        if (target === "h" || target === "height" || target === heightTarget) {
          return { ...dimension, target: "height" };
        }
        return dimension;
      }),
    };
  }
  if (intent.family === "SPATIAL_APPLIED") {
    return {
      ...withoutCaption,
      pointLabels: canonicalSpatialPointLabels(intent),
      dimensions: [...intent.dimensions].sort((left, right) =>
        `${left.target}|${left.value}|${left.unit}`.localeCompare(
          `${right.target}|${right.value}|${right.unit}`,
        ),
      ),
    };
  }
  return withoutCaption;
}

function compileRawArtifact(
  liveCase: MathDiagramLiveGateACase,
  rawArtifact: RawProviderArtifact,
): LiveArtifact {
  const auditIssues = auditSemanticOutput(liveCase, rawArtifact.semanticOutput);
  if (auditIssues.length > 0) {
    throw new Error(
      `${liveCase.caseId} failed semantic audit: ${auditIssues.join(" ")}`,
    );
  }
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    case: liveCase,
    provider: "OPENAI",
    model: rawArtifact.model,
    reasoningEffort: REASONING_EFFORT,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    providerRequestId: rawArtifact.providerRequestId,
    usage: rawArtifact.usage,
    settledCostVnd: rawArtifact.settledCostVnd,
    latencyMs: rawArtifact.latencyMs,
    semanticOutput: rawArtifact.semanticOutput,
    compiledDiagramSpec: mapLessonSummaryProviderDiagramInput(
      rawArtifact.semanticOutput.diagramSpec,
    ),
    audit: { passed: true, issues: [] },
  };
}

function auditSemanticOutput(
  liveCase: MathDiagramLiveGateACase,
  output: z.infer<typeof liveOutputSchema>,
) {
  const issues: string[] = [];
  if (output.caseId !== liveCase.caseId) {
    issues.push(`Expected caseId ${liveCase.caseId}, received ${output.caseId}.`);
  }
  if (!("kind" in output.diagramSpec) || output.diagramSpec.kind !== "INTENT") {
    issues.push("Provider returned RAW_SPEC or an unwrapped legacy spec instead of INTENT.");
    return issues;
  }
  const intent = output.diagramSpec.intent;
  if (intent.family !== liveCase.expectedFamily) {
    issues.push(`Expected family ${liveCase.expectedFamily}, received ${intent.family}.`);
  }
  if (intent.archetype !== liveCase.expectedArchetype) {
    issues.push(
      `Expected archetype ${liveCase.expectedArchetype}, received ${intent.archetype}.`,
    );
  }
  if (intent.grade !== liveCase.grade) {
    issues.push(`Expected grade ${liveCase.grade}, received ${intent.grade}.`);
  }
  if (intent.difficulty !== liveCase.difficulty) {
    issues.push(
      `Expected difficulty ${liveCase.difficulty}, received ${intent.difficulty}.`,
    );
  }
  if (
    JSON.stringify(comparableIntent(intent)) !==
    JSON.stringify(comparableIntent(liveCase.expectedIntent))
  ) {
    issues.push("The mathematical data or required construction semantics differ from the test case.");
  }
  return issues;
}

function finalCacheAuditIssues(liveCase: MathDiagramLiveGateACase) {
  const cachePath = cacheFilePath(liveCase);
  if (!existsSync(cachePath)) return null;
  const artifact = JSON.parse(readFileSync(cachePath, "utf8")) as LiveArtifact;
  return auditSemanticOutput(liveCase, artifact.semanticOutput);
}

function rejectCachedArtifact(
  ledger: Ledger,
  liveCase: MathDiagramLiveGateACase,
  filePath: string,
  issues: string[],
) {
  const rejectedPath = `${filePath}.rejected-semantic-${Date.now()}.json`;
  renameSync(filePath, rejectedPath);
  const entry = [...ledgerEntriesForCase(ledger, liveCase.caseId)]
    .reverse()
    .find(
      (candidate) =>
        candidate.status === "SUCCEEDED" || candidate.status === "PROVIDER_CACHED",
    );
  if (entry) {
    entry.status = "REJECTED_SEMANTIC";
    entry.finishedAt = new Date().toISOString();
    entry.error = issues.join(" ");
    writeJsonAtomic(ledgerPath, ledger);
  }
  process.stdout.write(`[REJECTED CACHE] ${liveCase.caseId}: ${issues.join(" ")}\n`);
}

function requestedBatches() {
  const raw = process.env.M9_2_GATE_A_BATCH?.trim().toUpperCase() || "CALIBRATION";
  if (raw === "ALL") return new Set<MathDiagramLiveGateABatch>(["CALIBRATION", "CORE", "EDGE"]);
  return new Set<MathDiagramLiveGateABatch>([
    z.enum(["CALIBRATION", "CORE", "EDGE"]).parse(raw),
  ]);
}

function buildReviewArtifact() {
  const artifacts = mathDiagramLiveGateACases.flatMap((liveCase) => {
    const cachePath = cacheFilePath(liveCase);
    return existsSync(cachePath)
      ? [JSON.parse(readFileSync(cachePath, "utf8")) as LiveArtifact]
      : [];
  });
  writeJsonAtomic(reviewPath, {
    version: 1,
    source: "PAID_OPENAI_GATE_A",
    model: MODEL,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    examples: artifacts.map((artifact) => ({
      caseId: artifact.case.caseId,
      batch: artifact.case.batch,
      title: artifact.case.title,
      problem: artifact.case.problem,
      family: artifact.case.expectedFamily,
      difficulty: artifact.case.difficulty,
      diagramSpec: mapLessonSummaryProviderDiagramInput(
        artifact.semanticOutput.diagramSpec,
      ),
      providerRequestId: artifact.providerRequestId,
      usage: artifact.usage,
      settledCostVnd: artifact.settledCostVnd,
      audit: artifact.audit,
    })),
  });
}

async function main() {
  mkdirSync(outputDirectory, { recursive: true });
  const batches = requestedBatches();
  const selectedCases = mathDiagramLiveGateACases.filter((liveCase) =>
    batches.has(liveCase.batch),
  );
  const ledger = readLedger();
  const retryCaseIds = requestedRetryCaseIds();
  const maximumAttempt = z.coerce.number().int().min(2).max(4).parse(
    process.env.M9_2_MAX_ATTEMPT ?? "2",
  );
  const validCachedCases = selectedCases.filter((liveCase) => {
    const issues = finalCacheAuditIssues(liveCase);
    return issues !== null && issues.length === 0;
  });
  const invalidCachedCases = selectedCases.filter((liveCase) => {
    const issues = finalCacheAuditIssues(liveCase);
    return issues !== null && issues.length > 0;
  });
  const providerCachedCases = selectedCases.filter(
    (liveCase) =>
      !existsSync(cacheFilePath(liveCase)) &&
      existsSync(rawProviderCacheFilePath(liveCase)) &&
      auditSemanticOutput(
        liveCase,
        (JSON.parse(
          readFileSync(rawProviderCacheFilePath(liveCase), "utf8"),
        ) as RawProviderArtifact).semanticOutput,
      ).length === 0,
  );
  const newCases = selectedCases.filter((liveCase) => {
    if (validCachedCases.includes(liveCase) || providerCachedCases.includes(liveCase)) {
      return false;
    }
    const entries = ledgerEntriesForCase(ledger, liveCase.caseId);
    return (
      entries.length === 0 ||
      canUseExplicitRetry(ledger, liveCase, retryCaseIds, maximumAttempt)
    );
  });
  const blockedCases = selectedCases.filter((liveCase) => {
    if (validCachedCases.includes(liveCase) || providerCachedCases.includes(liveCase)) {
      return false;
    }
    const entries = ledgerEntriesForCase(ledger, liveCase.caseId);
    return (
      entries.length > 0 &&
      !canUseExplicitRetry(ledger, liveCase, retryCaseIds, maximumAttempt)
    );
  });
  const currentCommittedVnd = committedVnd(ledger);
  process.stdout.write(
    `${JSON.stringify(
      {
        model: MODEL,
        reasoningEffort: REASONING_EFFORT,
        batches: [...batches],
        selectedCases: selectedCases.length,
        cacheHits: validCachedCases.length,
        invalidCacheCases: invalidCachedCases.map((liveCase) => liveCase.caseId),
        recoverableProviderCacheHits: providerCachedCases.length,
        newPaidCalls: newCases.length,
        blockedCases: blockedCases.map((liveCase) => liveCase.caseId),
        explicitRetryCaseIds: [...retryCaseIds],
        maximumAttempt,
        inputTokenUpperBoundPerCall: INPUT_TOKEN_UPPER_BOUND,
        outputTokenUpperBoundPerCall: OUTPUT_TOKEN_UPPER_BOUND,
        requestUpperBoundVnd: REQUEST_UPPER_BOUND_VND,
        currentCommittedVnd,
        nextBatchUpperBoundVnd: newCases.length * REQUEST_UPPER_BOUND_VND,
        gateAHardCapVnd: GATE_A_HARD_CAP_VND,
        waveHardCapVnd: WAVE_HARD_CAP_VND,
      },
      null,
      2,
    )}\n`,
  );

  if (process.env.RUN_M9_2_PAID_LIVE !== "1") {
    process.stdout.write("Preview only. Set RUN_M9_2_PAID_LIVE=1 to call OpenAI.\n");
    buildReviewArtifact();
    return;
  }
  if (blockedCases.length > 0) {
    throw new Error(
      `Cases require explicit review or M9_2_RETRY_CASE_ID: ${blockedCases
        .map((liveCase) => liveCase.caseId)
        .join(", ")}`,
    );
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
  if (currentCommittedVnd + newCases.length * REQUEST_UPPER_BOUND_VND > GATE_A_HARD_CAP_VND) {
    throw new Error("Gate A local hard cap would be exceeded before the next provider call.");
  }

  const configService = new ConfigService<EnvConfig, true>({
    DATABASE_URL: process.env.DATABASE_URL,
  } as EnvConfig);
  const prisma = new PrismaService(configService);
  const usageService = new ProviderUsageService(prisma);
  const provider = new OpenAiProvider({
    apiKey: process.env.OPENAI_API_KEY,
    requestTimeoutMs: 180_000,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? 1536),
    chatModel: MODEL,
    structuredModel: MODEL,
  });

  try {
    const catalogItem = await prisma.providerCatalogItem.findFirstOrThrow({
      where: {
        category: ProviderCatalogCategory.AI_MODEL,
        provider: "OPENAI",
        externalKey: MODEL,
      },
      select: { id: true },
    });
    const activeRates = await usageService.getActiveRates(catalogItem.id);
    if (!activeRates.priceVersionId || activeRates.rates.length === 0) {
      throw new Error(`No active provider price found for ${MODEL}.`);
    }

    for (const liveCase of selectedCases) {
      const cachePath = cacheFilePath(liveCase);
      const rawCachePath = rawProviderCacheFilePath(liveCase);
      if (existsSync(cachePath)) {
        const issues = finalCacheAuditIssues(liveCase) ?? [];
        if (issues.length === 0) {
          process.stdout.write(`[CACHE] ${liveCase.caseId}\n`);
          continue;
        }
        rejectCachedArtifact(ledger, liveCase, cachePath, issues);
      }
      let existingEntries = ledgerEntriesForCase(ledger, liveCase.caseId);
      const providerCachedEntry = [...existingEntries]
        .reverse()
        .find((entry) => entry.status === "PROVIDER_CACHED");
      if (existsSync(rawCachePath)) {
        const rawArtifact = JSON.parse(
          readFileSync(rawCachePath, "utf8"),
        ) as RawProviderArtifact;
        const rawIssues = auditSemanticOutput(liveCase, rawArtifact.semanticOutput);
        if (rawIssues.length > 0) {
          rejectCachedArtifact(ledger, liveCase, rawCachePath, rawIssues);
          existingEntries = ledgerEntriesForCase(ledger, liveCase.caseId);
        } else {
        const artifact = compileRawArtifact(liveCase, rawArtifact);
        writeJsonAtomic(cachePath, artifact);
        if (providerCachedEntry) {
          providerCachedEntry.status = "SUCCEEDED";
          providerCachedEntry.finishedAt = new Date().toISOString();
          providerCachedEntry.error = null;
          writeJsonAtomic(ledgerPath, ledger);
        }
        buildReviewArtifact();
        process.stdout.write(`[RECOVERED] ${liveCase.caseId} from provider cache\n`);
        continue;
        }
      }
      const explicitRetry = canUseExplicitRetry(
        ledger,
        liveCase,
        retryCaseIds,
        maximumAttempt,
      );
      if (existingEntries.length > 0 && !explicitRetry) {
        throw new Error(
          `${liveCase.caseId} has a ledger entry without a valid cache; review it before retrying.`,
        );
      }
      if (committedVnd(ledger) + REQUEST_UPPER_BOUND_VND > GATE_A_HARD_CAP_VND) {
        throw new Error("Gate A local hard cap reached before provider call.");
      }

      const attempt = explicitRetry
        ? Math.max(...existingEntries.map((entry) => entry.attempt ?? 1), 0) + 1
        : 1;
      const ledgerEntry: LedgerEntry = {
        ledgerKey: explicitRetry
          ? `${liveCase.caseId}#retry${attempt - 1}`
          : liveCase.caseId,
        caseId: liveCase.caseId,
        batch: liveCase.batch,
        attempt,
        status: "RUNNING",
        reservedVnd: REQUEST_UPPER_BOUND_VND,
        settledVnd: null,
        usageEventId: null,
        cachePath: path.relative(repositoryRoot, cachePath),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
      };
      ledger.entries.push(ledgerEntry);
      writeJsonAtomic(ledgerPath, ledger);

      const usageEvent = await usageService.reserveAndStart(
        {
          category: ProviderCatalogCategory.AI_MODEL,
          provider: "OPENAI",
          catalogItemId: catalogItem.id,
          priceVersionId: activeRates.priceVersionId,
          feature: AiGenerationType.DIAGRAM_RENDER,
          attempt,
          cacheStatus: "MISS",
        },
        {
          idempotencyKey: `m9.2-v51-gate-a:${MODEL}:${liveCase.caseId}${
            explicitRetry ? `:retry${attempt - 1}` : ""
          }`,
          usageUpperBound: {
            promptTokens: INPUT_TOKEN_UPPER_BOUND,
            completionTokens: OUTPUT_TOKEN_UPPER_BOUND,
            totalTokens: INPUT_TOKEN_UPPER_BOUND + OUTPUT_TOKEN_UPPER_BOUND,
            requestCount: 1,
          },
          rates: activeRates.rates,
          requiredMetrics: [
            ProviderUsageMetric.INPUT_TOKEN,
            ProviderUsageMetric.OUTPUT_TOKEN,
          ],
        },
      );
      ledgerEntry.usageEventId = usageEvent.id;
      writeJsonAtomic(ledgerPath, ledger);

      try {
        const result = await provider.generateStructured(
          {
            systemPrompt,
            userPrompt: getUserPrompt(liveCase),
            contextChunks: [],
            contextSerialization: "json",
            maxTokens: OUTPUT_TOKEN_UPPER_BOUND,
            model: MODEL,
            reasoningEffort: REASONING_EFFORT,
            outputName: "m9_2_gate_a_diagram_intent",
            promptVersion: PROMPT_VERSION,
            schemaVersion: SCHEMA_VERSION,
          },
          liveOutputSchema,
        );
        const settled = await usageService.succeed(usageEvent.id, {
          promptTokens: result.usage?.promptTokens ?? 0,
          cachedInputTokens: result.usage?.cachedInputTokens ?? 0,
          completionTokens: result.usage?.completionTokens ?? 0,
          totalTokens: result.usage?.totalTokens ?? 0,
          requestCount: 1,
          providerRequestId: result.providerRequestId,
          latencyMs: result.latencyMs,
          rawUsage: result.usage,
          rates: activeRates.rates,
        });
        const rawArtifact: RawProviderArtifact = {
          version: 1,
          generatedAt: new Date().toISOString(),
          caseId: liveCase.caseId,
          provider: "OPENAI",
          model: result.model,
          reasoningEffort: REASONING_EFFORT,
          promptVersion: PROMPT_VERSION,
          schemaVersion: SCHEMA_VERSION,
          providerRequestId: result.providerRequestId ?? null,
          usage: {
            promptTokens: result.usage?.promptTokens ?? 0,
            cachedInputTokens: result.usage?.cachedInputTokens ?? 0,
            completionTokens: result.usage?.completionTokens ?? 0,
            totalTokens: result.usage?.totalTokens ?? 0,
          },
          settledCostVnd: settled.costVnd,
          latencyMs: result.latencyMs ?? null,
          semanticOutput: result.data,
        };
        writeJsonAtomic(rawCachePath, rawArtifact);
        ledgerEntry.status = "PROVIDER_CACHED";
        ledgerEntry.settledVnd = settled.costVnd;
        writeJsonAtomic(ledgerPath, ledger);

        const artifact = compileRawArtifact(liveCase, rawArtifact);
        writeJsonAtomic(cachePath, artifact);
        ledgerEntry.status = "SUCCEEDED";
        ledgerEntry.finishedAt = new Date().toISOString();
        writeJsonAtomic(ledgerPath, ledger);
        buildReviewArtifact();
        process.stdout.write(
          `[PAID] ${liveCase.caseId} cost=${settled.costVnd}VND audit=${artifact.audit.passed ? "PASS" : "FAIL"}\n`,
        );
      } catch (error) {
        if (ledgerEntry.status === "RUNNING") {
          await usageService.fail(usageEvent.id, error).catch(() => undefined);
          ledgerEntry.status = "FAILED_CONSERVATIVE";
        }
        ledgerEntry.finishedAt = new Date().toISOString();
        ledgerEntry.error = error instanceof Error ? error.message : String(error);
        writeJsonAtomic(ledgerPath, ledger);
        throw error;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  buildReviewArtifact();
  process.stdout.write(
    `Gate A batch complete. Committed spend: ${committedVnd(ledger)} VND. Review artifact: ${reviewPath}\n`,
  );
}

void main();
