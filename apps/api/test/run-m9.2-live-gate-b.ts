import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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

import { PrismaService } from "#api/common/prisma/prisma.service";
import { validateEnv, type EnvConfig } from "#api/config/env.validation";
import { OpenAiProvider } from "#api/modules/ai/providers/openai.provider";
import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";
import type { LessonSummaryProviderDiagramInput } from "#api/modules/ai/types/lesson-summary-provider-diagram.types";
import {
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  lessonSummaryProviderOutputSchema,
  type LessonSummaryProviderOutput,
} from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { normalizeOcrPages } from "#api/workers/utils/ocr-artifact-normalizer";

import {
  mathDiagramLiveGateBLessons,
  type MathDiagramLiveGateBLesson,
} from "./fixtures/math-diagram/live-gate-b-lessons";
import {
  prepareOfficialReaderSource,
  stableUuid,
  type MathDiagramLiveGateBSourceEvidence,
} from "./fixtures/math-diagram/live-gate-b-source";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
loadEnv({ path: path.join(repositoryRoot, ".env"), override: false, quiet: true });

const MODEL = "gpt-5.4";
const REASONING_EFFORT = "medium" as const;
const INPUT_TOKEN_UPPER_BOUND = 130_000;
const OUTPUT_TOKEN_UPPER_BOUND = 16_000;
const REQUEST_UPPER_BOUND_VND = 14_408;
const GATE_B_HARD_CAP_VND = 195_000;
const WAVE_HARD_CAP_VND = 320_000;
const MAXIMUM_PAID_RETRIES = 5;
const outputDirectory = path.join(repositoryRoot, "tmp/m9-2-v51-live-gate-b");
const ledgerPath = path.join(outputDirectory, "ledger.json");
const reviewPath = path.join(outputDirectory, "review.json");
const sourceReviewPath = path.join(outputDirectory, "source-review.json");
const gateALedgerPath = path.join(repositoryRoot, "tmp/m9-2-v51-live-gate-a/ledger.json");
const sourcePdf = path.join(
  repositoryRoot,
  "Toan-7-Tap-1-lam-net-300ppi-OCR-searchable.pdf",
);
let memoizedCompilerFingerprint: string | null = null;

type PreparedLesson = {
  lesson: MathDiagramLiveGateBLesson;
  chunks: RetrievedChunk[];
  evidence: MathDiagramLiveGateBSourceEvidence[];
  sourceHash: string;
  titleAudit: { passed: boolean; matchedTerms: string[]; requiredTerms: string[] };
};

type LedgerEntry = {
  caseId: string;
  attempt: number;
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
  gateBHardCapVnd: number;
  waveHardCapVnd: number;
  entries: LedgerEntry[];
};

type Usage = {
  promptTokens: number;
  cachedInputTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type RawProviderArtifact = {
  version: 1;
  generatedAt: string;
  caseId: string;
  sourceHash: string;
  provider: "OPENAI";
  model: string;
  reasoningEffort: string;
  promptVersion: string;
  schemaVersion: string;
  providerRequestId: string | null;
  usage: Usage;
  settledCostVnd: number;
  latencyMs: number | null;
  providerOutput: LessonSummaryProviderOutput;
};

type DiagramRecord = {
  path: string;
  family: string | null;
  archetype: string | null;
  inputKind: "INTENT" | "RAW_SPEC" | "LEGACY";
};

type LiveArtifact = RawProviderArtifact & {
  compilerFingerprint: string;
  lesson: MathDiagramLiveGateBLesson;
  sourceEvidence: MathDiagramLiveGateBSourceEvidence[];
  persistedOutput: ReturnType<typeof mapLessonSummaryProviderOutput>;
  diagrams: DiagramRecord[];
  audit: { passed: true; issues: [] };
};

function readLedger(): Ledger {
  if (!existsSync(ledgerPath)) {
    return {
      version: 1,
      model: MODEL,
      reasoningEffort: REASONING_EFFORT,
      promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
      schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
      gateBHardCapVnd: GATE_B_HARD_CAP_VND,
      waveHardCapVnd: WAVE_HARD_CAP_VND,
      entries: [],
    };
  }
  return JSON.parse(readFileSync(ledgerPath, "utf8")) as Ledger;
}

function committedVnd(entries: readonly LedgerEntry[]) {
  return entries.reduce(
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

function gateACommittedVnd() {
  if (!existsSync(gateALedgerPath)) return 0;
  const ledger = JSON.parse(readFileSync(gateALedgerPath, "utf8")) as {
    entries: LedgerEntry[];
  };
  return committedVnd(ledger.entries);
}

function writeJsonAtomic(filePath: string, value: unknown) {
  const temporaryPath = `${filePath}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, filePath);
}

function requestedLessons() {
  const selected = new Set(
    (process.env.M9_2_GATE_B_CASES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (selected.size === 0) return [...mathDiagramLiveGateBLessons];
  const unknown = [...selected].filter(
    (caseId) => !mathDiagramLiveGateBLessons.some((lesson) => lesson.caseId === caseId),
  );
  if (unknown.length > 0)
    throw new Error(`Unknown Gate B case IDs: ${unknown.join(", ")}.`);
  return mathDiagramLiveGateBLessons.filter((lesson) => selected.has(lesson.caseId));
}

function requestedRetryCaseIds() {
  return new Set(
    (process.env.M9_2_GATE_B_RETRY_CASES ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

async function prepareLesson(
  lesson: MathDiagramLiveGateBLesson,
  env: EnvConfig,
): Promise<PreparedLesson> {
  const official = await prepareOfficialReaderSource({ lesson, repositoryRoot });
  const chunks =
    lesson.sourceMode === "LOCAL_MATHPIX_CACHE"
      ? await replaceWithMathpixChunks(lesson, official.chunks, env)
      : official.chunks;
  const sourceHash = createHash("sha256")
    .update(chunks.map((chunk) => `${chunk.id}\n${chunk.content}`).join("\n---\n"))
    .digest("hex");
  const titleAudit = auditSourceTitle(lesson, chunks);
  return {
    lesson,
    chunks,
    evidence: official.evidence,
    sourceHash,
    titleAudit,
  };
}

async function replaceWithMathpixChunks(
  lesson: MathDiagramLiveGateBLesson,
  officialChunks: RetrievedChunk[],
  env: EnvConfig,
) {
  if (!existsSync(sourcePdf)) throw new Error(`Missing local source PDF: ${sourcePdf}.`);
  const configService = new ConfigService<EnvConfig, true>(env, true);
  const storage = new ObjectStorageService(configService);
  const cache = new OcrArtifactCacheService(storage, configService);
  const pdf = readFileSync(sourcePdf);
  const contentHash = createHash("sha256").update(pdf).digest("hex");
  const descriptor = cache.createDescriptor(contentHash, env.OCR_PROVIDER);
  if (!(await cache.hasArtifact(descriptor))) {
    throw new Error(
      "Mathpix cache is missing; Gate B never starts paid OCR automatically.",
    );
  }
  const bundle = await cache.loadBundle(descriptor);
  const pages = normalizeOcrPages(bundle, bundle.numPages);
  return lesson.readerPages.map((readerPage, index) => {
    const page = pages[readerPage - 1];
    if (!page) throw new Error(`${lesson.caseId} has no Mathpix page ${readerPage}.`);
    const content = page.mathpixMarkdown ?? page.markdown ?? page.text;
    if (!content.trim())
      throw new Error(`${lesson.caseId} Mathpix page ${readerPage} is empty.`);
    return {
      id: stableUuid(`${lesson.caseId}:reader-page:${readerPage}`),
      content,
      metadata: {
        ...officialChunks[index]?.metadata,
        sourceFile: path.basename(sourcePdf),
        pdfPage: page.pageNumber,
        printedPage: page.printedPage,
        ocrSource: "LOCAL_MATHPIX_CACHE",
      },
    } satisfies RetrievedChunk;
  });
}

function normalizeWords(value: string) {
  const stopWords = new Set([
    "bai",
    "cac",
    "cho",
    "cua",
    "den",
    "hinh",
    "la",
    "mot",
    "nhung",
    "toan",
    "va",
    "voi",
  ]);
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/gu, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLowerCase()
    .replaceAll(/[^a-z0-9²]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length >= 2 && !stopWords.has(word));
}

function auditSourceTitle(
  lesson: MathDiagramLiveGateBLesson,
  chunks: readonly RetrievedChunk[],
) {
  const requiredTerms = [...new Set(normalizeWords(lesson.title))];
  const source = normalizeWords(chunks.map((chunk) => chunk.content).join(" "));
  const sourceTerms = new Set(source);
  const matchedTerms = requiredTerms.filter((term) => sourceTerms.has(term));
  const requiredMatchCount = Math.min(2, requiredTerms.length);
  return {
    passed: requiredTerms.length > 0 && matchedTerms.length >= requiredMatchCount,
    matchedTerms,
    requiredTerms,
  };
}

function requestFor(prepared: PreparedLesson) {
  return buildLessonSummaryStructuredInput({
    lessonId: `lesson-${prepared.lesson.caseId}`,
    lessonTitle: prepared.lesson.title,
    documentIds: [`document-${prepared.lesson.caseId}`],
    sourceHash: prepared.sourceHash,
    chunks: prepared.chunks,
    configuration: {
      style: "student_friendly",
      styleInstructions: "",
      length: "detailed",
      targetWordCount: null,
      extraInstructions: [
        `Đây là bài Toán lớp ${prepared.lesson.grade}.`,
        "Mọi hình có archetype được hỗ trợ phải dùng diagramSpec INTENT; không dùng RAW_SPEC.",
        "Giữ hình tối giản, đúng quy ước SGK và chỉ thêm nhãn/marker có ý nghĩa toán học.",
      ].join(" "),
    },
  });
}

function cachePaths(prepared: PreparedLesson) {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        model: MODEL,
        reasoningEffort: REASONING_EFFORT,
        promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
        schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
        compilerFingerprint: compilerFingerprint(),
        lesson: {
          caseId: prepared.lesson.caseId,
          grade: prepared.lesson.grade,
          title: prepared.lesson.title,
        },
        sourceHash: prepared.sourceHash,
      }),
    )
    .digest("hex")
    .slice(0, 16);
  const compiled = path.join(
    outputDirectory,
    `${prepared.lesson.caseId}-${fingerprint}.json`,
  );
  return { compiled, raw: `${compiled}.provider.json` };
}

function compilerFingerprint() {
  if (memoizedCompilerFingerprint) return memoizedCompilerFingerprint;
  const compilerDirectory = path.join(
    repositoryRoot,
    "apps/api/src/modules/ai/utils/diagram-compilers",
  );
  const files = readdirSync(compilerDirectory)
    .filter((fileName) => fileName.endsWith(".ts"))
    .sort()
    .map((fileName) => path.join(compilerDirectory, fileName));
  files.push(
    path.join(repositoryRoot, "packages/shared/src/schemas/lesson-summary-diagram.ts"),
  );
  const hash = createHash("sha256");
  for (const filePath of files) {
    hash.update(path.relative(repositoryRoot, filePath));
    hash.update(readFileSync(filePath));
  }
  memoizedCompilerFingerprint = hash.digest("hex").slice(0, 16);
  return memoizedCompilerFingerprint;
}

function reusableRawCachePath(prepared: PreparedLesson, preferredPath: string) {
  if (existsSync(preferredPath)) return preferredPath;
  const recoverablePromptVersions = new Set([
    LESSON_SUMMARY_PROMPT_VERSION,
    ...(process.env.M9_2_GATE_B_RECOVER_PROMPT_VERSIONS ?? "")
      .split(",")
      .map((version) => version.trim())
      .filter(Boolean),
  ]);
  const prefix = `${prepared.lesson.caseId}-`;
  for (const fileName of readdirSync(outputDirectory)) {
    if (!fileName.startsWith(prefix) || !fileName.endsWith(".json.provider.json")) {
      continue;
    }
    const candidatePath = path.join(outputDirectory, fileName);
    try {
      const candidate = JSON.parse(
        readFileSync(candidatePath, "utf8"),
      ) as RawProviderArtifact;
      if (
        candidate.caseId === prepared.lesson.caseId &&
        candidate.sourceHash === prepared.sourceHash &&
        candidate.model.startsWith(MODEL) &&
        recoverablePromptVersions.has(candidate.promptVersion) &&
        candidate.schemaVersion === LESSON_SUMMARY_SCHEMA_VERSION
      ) {
        return candidatePath;
      }
    } catch {
      // Ignore an unrelated or partially written cache candidate.
    }
  }
  return null;
}

function isCurrentCompiledCache(filePath: string) {
  if (!existsSync(filePath)) return false;
  try {
    const artifact = JSON.parse(readFileSync(filePath, "utf8")) as Partial<LiveArtifact>;
    return artifact.compilerFingerprint === compilerFingerprint();
  } catch {
    return false;
  }
}

function collectDiagrams(output: LessonSummaryProviderOutput) {
  const diagrams: Array<{ path: string; spec: LessonSummaryProviderDiagramInput }> = [];
  output.theorySections.forEach((section, sectionIndex) => {
    section.units.forEach((unit, unitIndex) => {
      if (unit.theory.diagramSpec) {
        diagrams.push({
          path: `theorySections.${sectionIndex}.units.${unitIndex}.theory`,
          spec: unit.theory.diagramSpec,
        });
      }
      if (unit.illustration.diagramSpec) {
        diagrams.push({
          path: `theorySections.${sectionIndex}.units.${unitIndex}.illustration`,
          spec: unit.illustration.diagramSpec,
        });
      }
    });
  });
  if (output.applicationExercises.standardExercise.diagramSpec) {
    diagrams.push({
      path: "applicationExercises.standardExercise",
      spec: output.applicationExercises.standardExercise.diagramSpec,
    });
  }
  if (output.applicationExercises.realWorldExercise.diagramSpec) {
    diagrams.push({
      path: "applicationExercises.realWorldExercise",
      spec: output.applicationExercises.realWorldExercise.diagramSpec,
    });
  }
  return diagrams;
}

function diagramRecord(input: {
  path: string;
  spec: LessonSummaryProviderDiagramInput;
}): DiagramRecord {
  if (!("kind" in input.spec)) {
    return { path: input.path, family: null, archetype: null, inputKind: "LEGACY" };
  }
  if (input.spec.kind === "RAW_SPEC") {
    return { path: input.path, family: null, archetype: null, inputKind: "RAW_SPEC" };
  }
  return {
    path: input.path,
    family: input.spec.intent.family,
    archetype: input.spec.intent.archetype,
    inputKind: "INTENT",
  };
}

function auditProviderOutput(
  prepared: PreparedLesson,
  output: LessonSummaryProviderOutput,
) {
  const diagrams = collectDiagrams(output).map(diagramRecord);
  const issues: string[] = [];
  if (diagrams.length < prepared.lesson.minimumDiagramCount) {
    issues.push(
      `Expected at least ${prepared.lesson.minimumDiagramCount} diagrams, received ${diagrams.length}.`,
    );
  }
  const nonIntent = diagrams.filter((diagram) => diagram.inputKind !== "INTENT");
  if (nonIntent.length > 0) {
    issues.push(
      `Non-INTENT diagrams: ${nonIntent.map((diagram) => diagram.path).join(", ")}.`,
    );
  }
  const families = new Set(diagrams.map((diagram) => diagram.family).filter(Boolean));
  const missingFamilies = prepared.lesson.expectedFamilies.filter(
    (family) => !families.has(family),
  );
  if (missingFamilies.length > 0) {
    issues.push(`Missing expected families: ${missingFamilies.join(", ")}.`);
  }
  if (output.applicationExercises.displayHeading !== "Bài tập vận dụng") {
    issues.push("Application heading is invalid.");
  }
  return { diagrams, issues };
}

function compileRawArtifact(
  prepared: PreparedLesson,
  raw: RawProviderArtifact,
): LiveArtifact {
  const { diagrams, issues } = auditProviderOutput(prepared, raw.providerOutput);
  if (issues.length > 0) {
    throw new Error(
      `${prepared.lesson.caseId} semantic audit failed: ${issues.join(" ")}`,
    );
  }
  const persistedOutput = mapLessonSummaryProviderOutput({
    lessonId: `lesson-${prepared.lesson.caseId}`,
    output: raw.providerOutput,
    contextChunks: prepared.chunks,
  });
  return {
    ...raw,
    compilerFingerprint: compilerFingerprint(),
    lesson: prepared.lesson,
    sourceEvidence: prepared.evidence,
    persistedOutput,
    diagrams,
    audit: { passed: true, issues: [] },
  };
}

function buildReviewArtifact(preparedLessons: readonly PreparedLesson[]) {
  const lessons = preparedLessons.flatMap((prepared) => {
    const { compiled } = cachePaths(prepared);
    return isCurrentCompiledCache(compiled)
      ? [JSON.parse(readFileSync(compiled, "utf8")) as LiveArtifact]
      : [];
  });
  writeJsonAtomic(reviewPath, {
    version: 1,
    source: "PAID_OPENAI_GATE_B_FULL_LESSON",
    model: MODEL,
    promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
    schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
    lessons,
  });
}

function ledgerEntriesForCase(ledger: Ledger, caseId: string) {
  return ledger.entries.filter((entry) => entry.caseId === caseId);
}

function mayRetry(ledger: Ledger, caseId: string, requestedRetries: ReadonlySet<string>) {
  const entries = ledgerEntriesForCase(ledger, caseId);
  return (
    requestedRetries.has(caseId) &&
    entries.length > 0 &&
    entries.length <= MAXIMUM_PAID_RETRIES
  );
}

async function main() {
  mkdirSync(outputDirectory, { recursive: true });
  const env = validateEnv(process.env);
  const selectedLessons = requestedLessons();
  const preparedLessons: PreparedLesson[] = [];
  for (const lesson of selectedLessons)
    preparedLessons.push(await prepareLesson(lesson, env));
  writeJsonAtomic(sourceReviewPath, {
    version: 1,
    generatedAt: new Date().toISOString(),
    lessons: preparedLessons.map((prepared) => ({
      caseId: prepared.lesson.caseId,
      title: prepared.lesson.title,
      referenceId: prepared.lesson.referenceId,
      sourceMode: prepared.lesson.sourceMode,
      sourceHash: prepared.sourceHash,
      titleAudit: prepared.titleAudit,
      evidence: prepared.evidence,
    })),
  });

  const failedSourceAudits = preparedLessons.filter(
    (prepared) => !prepared.titleAudit.passed,
  );
  const ledger = readLedger();
  const requestedRetries = requestedRetryCaseIds();
  const cached = preparedLessons.filter((prepared) =>
    isCurrentCompiledCache(cachePaths(prepared).compiled),
  );
  const recoverable = preparedLessons.filter((prepared) => {
    const paths = cachePaths(prepared);
    return (
      !isCurrentCompiledCache(paths.compiled) &&
      reusableRawCachePath(prepared, paths.raw) !== null
    );
  });
  const payable = preparedLessons.filter((prepared) => {
    const paths = cachePaths(prepared);
    if (
      isCurrentCompiledCache(paths.compiled) ||
      reusableRawCachePath(prepared, paths.raw) !== null
    ) {
      return false;
    }
    const entries = ledgerEntriesForCase(ledger, prepared.lesson.caseId);
    return (
      entries.length === 0 || mayRetry(ledger, prepared.lesson.caseId, requestedRetries)
    );
  });
  const blocked = preparedLessons.filter((prepared) => {
    const paths = cachePaths(prepared);
    if (
      isCurrentCompiledCache(paths.compiled) ||
      reusableRawCachePath(prepared, paths.raw) !== null
    ) {
      return false;
    }
    const entries = ledgerEntriesForCase(ledger, prepared.lesson.caseId);
    return (
      entries.length > 0 && !mayRetry(ledger, prepared.lesson.caseId, requestedRetries)
    );
  });
  const gateACommitted = gateACommittedVnd();
  const gateBCommitted = committedVnd(ledger.entries);
  process.stdout.write(
    `${JSON.stringify(
      {
        model: MODEL,
        reasoningEffort: REASONING_EFFORT,
        selectedLessons: selectedLessons.map((lesson) => lesson.caseId),
        sourceAuditsPassed: preparedLessons.length - failedSourceAudits.length,
        failedSourceAudits: failedSourceAudits.map((prepared) => ({
          caseId: prepared.lesson.caseId,
          titleAudit: prepared.titleAudit,
        })),
        cacheHits: cached.length,
        recoverableProviderCacheHits: recoverable.length,
        newPaidCalls: payable.length,
        blockedCases: blocked.map((prepared) => prepared.lesson.caseId),
        inputTokenUpperBoundPerCall: INPUT_TOKEN_UPPER_BOUND,
        outputTokenUpperBoundPerCall: OUTPUT_TOKEN_UPPER_BOUND,
        requestUpperBoundVnd: REQUEST_UPPER_BOUND_VND,
        gateACommittedVnd: gateACommitted,
        gateBCommittedVnd: gateBCommitted,
        waveCommittedVnd: gateACommitted + gateBCommitted,
        nextSelectionUpperBoundVnd: payable.length * REQUEST_UPPER_BOUND_VND,
        gateBHardCapVnd: GATE_B_HARD_CAP_VND,
        waveHardCapVnd: WAVE_HARD_CAP_VND,
      },
      null,
      2,
    )}\n`,
  );

  if (failedSourceAudits.length > 0) {
    throw new Error("Gate B source-title audit failed; no paid request was made.");
  }
  if (process.env.RUN_M9_2_GATE_B_PAID_LIVE !== "1") {
    process.stdout.write(
      "Preview only. Set RUN_M9_2_GATE_B_PAID_LIVE=1 to call OpenAI.\n",
    );
    buildReviewArtifact(preparedLessons);
    return;
  }
  if (blocked.length > 0) {
    throw new Error(
      `Cases require explicit review/retry: ${blocked
        .map((prepared) => prepared.lesson.caseId)
        .join(", ")}.`,
    );
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");

  const configService = new ConfigService<EnvConfig, true>(env, true);
  const prisma = new PrismaService(configService);
  const usageService = new ProviderUsageService(prisma);
  const provider = new OpenAiProvider({
    apiKey: process.env.OPENAI_API_KEY,
    requestTimeoutMs: 300_000,
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

    for (const prepared of preparedLessons) {
      const paths = cachePaths(prepared);
      if (isCurrentCompiledCache(paths.compiled)) {
        process.stdout.write(`[CACHE] ${prepared.lesson.caseId}\n`);
        continue;
      }
      if (existsSync(paths.compiled)) {
        renameSync(paths.compiled, `${paths.compiled}.superseded-${Date.now()}.json`);
      }
      const reusableRawPath = reusableRawCachePath(prepared, paths.raw);
      if (reusableRawPath) {
        const raw = JSON.parse(
          readFileSync(reusableRawPath, "utf8"),
        ) as RawProviderArtifact;
        if (reusableRawPath !== paths.raw) writeJsonAtomic(paths.raw, raw);
        const artifact = compileRawArtifact(prepared, raw);
        writeJsonAtomic(paths.compiled, artifact);
        const entry = [...ledgerEntriesForCase(ledger, prepared.lesson.caseId)]
          .reverse()
          .find(
            (candidate) =>
              candidate.status === "PROVIDER_CACHED" ||
              candidate.status === "REJECTED_SEMANTIC",
          );
        if (entry) {
          entry.status = "SUCCEEDED";
          entry.finishedAt = new Date().toISOString();
          entry.error = null;
          writeJsonAtomic(ledgerPath, ledger);
        }
        buildReviewArtifact(preparedLessons);
        process.stdout.write(`[RECOVERED] ${prepared.lesson.caseId}\n`);
        continue;
      }

      const existingEntries = ledgerEntriesForCase(ledger, prepared.lesson.caseId);
      const retry = mayRetry(ledger, prepared.lesson.caseId, requestedRetries);
      if (existingEntries.length > 0 && !retry) {
        throw new Error(`${prepared.lesson.caseId} requires an explicit retry decision.`);
      }
      const currentGateB = committedVnd(ledger.entries);
      const currentWave = gateACommittedVnd() + currentGateB;
      if (currentGateB + REQUEST_UPPER_BOUND_VND > GATE_B_HARD_CAP_VND) {
        throw new Error("Gate B local hard cap reached before provider call.");
      }
      if (currentWave + REQUEST_UPPER_BOUND_VND > WAVE_HARD_CAP_VND) {
        throw new Error("M9.2 wave hard cap reached before provider call.");
      }
      const attempt = existingEntries.length + 1;
      const entry: LedgerEntry = {
        caseId: prepared.lesson.caseId,
        attempt,
        status: "RUNNING",
        reservedVnd: REQUEST_UPPER_BOUND_VND,
        settledVnd: null,
        usageEventId: null,
        cachePath: path.relative(repositoryRoot, paths.compiled),
        startedAt: new Date().toISOString(),
        finishedAt: null,
        error: null,
      };
      ledger.entries.push(entry);
      writeJsonAtomic(ledgerPath, ledger);

      const usageEvent = await usageService.reserveAndStart(
        {
          category: ProviderCatalogCategory.AI_MODEL,
          provider: "OPENAI",
          catalogItemId: catalogItem.id,
          priceVersionId: activeRates.priceVersionId,
          feature: AiGenerationType.SUMMARY,
          attempt,
          cacheStatus: "MISS",
        },
        {
          idempotencyKey: `m9.2-v51-gate-b:${MODEL}:${prepared.lesson.caseId}:${prepared.sourceHash.slice(0, 16)}${
            retry ? `:retry${attempt - 1}` : ""
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
      entry.usageEventId = usageEvent.id;
      writeJsonAtomic(ledgerPath, ledger);

      try {
        const result = await provider.generateStructured(
          {
            ...requestFor(prepared),
            model: MODEL,
            reasoningEffort: REASONING_EFFORT,
            maxTokens: OUTPUT_TOKEN_UPPER_BOUND,
          },
          lessonSummaryProviderOutputSchema,
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
        const raw: RawProviderArtifact = {
          version: 1,
          generatedAt: new Date().toISOString(),
          caseId: prepared.lesson.caseId,
          sourceHash: prepared.sourceHash,
          provider: "OPENAI",
          model: result.model,
          reasoningEffort: REASONING_EFFORT,
          promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
          schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
          providerRequestId: result.providerRequestId ?? null,
          usage: {
            promptTokens: result.usage?.promptTokens ?? 0,
            cachedInputTokens: result.usage?.cachedInputTokens ?? 0,
            completionTokens: result.usage?.completionTokens ?? 0,
            totalTokens: result.usage?.totalTokens ?? 0,
          },
          settledCostVnd: settled.costVnd,
          latencyMs: result.latencyMs ?? null,
          providerOutput: result.data,
        };
        writeJsonAtomic(paths.raw, raw);
        entry.status = "PROVIDER_CACHED";
        entry.settledVnd = settled.costVnd;
        writeJsonAtomic(ledgerPath, ledger);

        const artifact = compileRawArtifact(prepared, raw);
        writeJsonAtomic(paths.compiled, artifact);
        entry.status = "SUCCEEDED";
        entry.finishedAt = new Date().toISOString();
        writeJsonAtomic(ledgerPath, ledger);
        buildReviewArtifact(preparedLessons);
        process.stdout.write(
          `[PAID] ${prepared.lesson.caseId} cost=${settled.costVnd}VND diagrams=${artifact.diagrams.length}\n`,
        );
      } catch (error) {
        if (entry.status === "RUNNING") {
          await usageService.fail(usageEvent.id, error).catch(() => undefined);
          entry.status = "FAILED_CONSERVATIVE";
        } else if (entry.status === "PROVIDER_CACHED") {
          entry.status = "REJECTED_SEMANTIC";
        }
        entry.finishedAt = new Date().toISOString();
        entry.error = error instanceof Error ? error.message : String(error);
        writeJsonAtomic(ledgerPath, ledger);
        throw error;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  buildReviewArtifact(preparedLessons);
  process.stdout.write(
    `Gate B selection complete. Gate B committed: ${committedVnd(ledger.entries)} VND.\n`,
  );
}

void main();
