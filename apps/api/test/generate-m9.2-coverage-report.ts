import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileLessonSummaryDiagramIntent } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

import { mathDiagramFixtureMatchesInventoryCell } from "./fixtures/math-diagram/coverage-mapping";
import { mathDiagramLiveGateACases } from "./fixtures/math-diagram/live-gate-a-cases";
import { semanticDiagramVisualCases } from "./fixtures/math-diagram/semantic-visual-cases";

type InventoryCell = {
  cellId: string;
  family: string;
  archetype: string;
  semanticVariant: string;
  difficulty: "SIMPLE" | "MEDIUM" | "HARD";
  status: "PLANNED" | "PARTIAL" | "SUPPORTED" | "UNSUPPORTED";
  compilerKey: string;
  referenceIds: string[];
  exactPageAudit: "PENDING" | "VERIFIED";
};

type Inventory = {
  version: number;
  classification: {
    status: "IN_PROGRESS" | "LOCKED";
    exactPageAuditComplete: boolean;
  };
  cells: InventoryCell[];
};

type GoldenManifest = {
  summary: {
    fixtureCount: number;
    screenshotCount: number;
    passedFixtureCount: number;
    failedFixtureCount: number;
  };
  records: Array<{ fixtureId: string; decision: string }>;
};

type LiveGateReview = {
  status: "APPROVED";
  paidCommittedVnd: number;
};

type LiveGateBArtifact = {
  lessons: Array<{
    diagrams: Array<{ family: string; archetype: string }>;
  }>;
};

type PaidLedger = {
  entries: Array<{ usageEventId?: string | null }>;
};

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixtureRoot = fileURLToPath(new URL("./fixtures/math-diagram/", import.meta.url));
const inventoryPath = path.join(fixtureRoot, "curriculum-inventory.json");
const inventorySource = readFileSync(inventoryPath, "utf8");
const inventory = JSON.parse(inventorySource) as Inventory;
const goldenManifest = JSON.parse(
  readFileSync(
    path.join(
      repositoryRoot,
      "anh-chup-hinh-toan-dat-chuan/reference-golden-manifest.json",
    ),
    "utf8",
  ),
) as GoldenManifest;
const liveGateAReview = JSON.parse(
  readFileSync(
    path.join(
      repositoryRoot,
      "anh-chup-hinh-toan-dat-chuan/v51-live-gate-a-final-manual-review.json",
    ),
    "utf8",
  ),
) as LiveGateReview;
const liveGateBReview = JSON.parse(
  readFileSync(
    path.join(
      repositoryRoot,
      "anh-chup-hinh-toan-dat-chuan/v51-live-gate-b-manual-review.json",
    ),
    "utf8",
  ),
) as LiveGateReview;
const liveGateBArtifact = JSON.parse(
  readFileSync(path.join(repositoryRoot, "tmp/m9-2-v51-live-gate-b/review.json"), "utf8"),
) as LiveGateBArtifact;
const paidLedgers = [
  "tmp/m9-2-v51-live-gate-a/ledger.json",
  "tmp/m9-2-v51-live-gate-b/ledger.json",
].map(
  (relativePath) =>
    JSON.parse(
      readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
    ) as PaidLedger,
);

const approvedFixtureIds = new Set(
  goldenManifest.records
    .filter((record) => record.decision === "PASS")
    .map((record) => record.fixtureId),
);
const compiledFixtures = semanticDiagramVisualCases.map((visualCase) => ({
  fixtureId: visualCase.caseId,
  family: visualCase.intent.family,
  difficulty: visualCase.intent.difficulty,
  compilerKey: compileLessonSummaryDiagramIntent(visualCase.intent).diagnostics
    .compilerKey,
}));
const approvedLiveFixtureIds = new Set(
  liveGateAReview.status === "APPROVED"
    ? mathDiagramLiveGateACases.map((liveCase) => liveCase.sourceFixtureId)
    : [],
);
const approvedLiveArchetypes = new Set(
  liveGateBReview.status === "APPROVED"
    ? liveGateBArtifact.lessons.flatMap((lesson) =>
        lesson.diagrams.map((diagram) => `${diagram.family}:${diagram.archetype}`),
      )
    : [],
);
const paidProviderCalls = new Set(
  paidLedgers.flatMap((ledger) =>
    ledger.entries.flatMap((entry) => (entry.usageEventId ? [entry.usageEventId] : [])),
  ),
).size;

const cells = inventory.cells.map((cell) => {
  const fixtureIds = compiledFixtures
    .filter((fixture) =>
      mathDiagramFixtureMatchesInventoryCell({
        cellId: cell.cellId,
        cellCompilerKey: cell.compilerKey,
        fixtureId: fixture.fixtureId,
        fixtureCompilerKey: fixture.compilerKey,
      }),
    )
    .map((fixture) => fixture.fixtureId);
  const compilerRepresented = fixtureIds.length > 0;
  const localGoldenPassed =
    compilerRepresented &&
    fixtureIds.every((fixtureId) => approvedFixtureIds.has(fixtureId));
  const liveGatePassed =
    fixtureIds.some((fixtureId) => approvedLiveFixtureIds.has(fixtureId)) ||
    approvedLiveArchetypes.has(`${cell.family}:${cell.archetype}`);
  const releaseEligible =
    localGoldenPassed && liveGatePassed && cell.exactPageAudit === "VERIFIED";
  return {
    ...cell,
    fixtureIds,
    compilerRepresented,
    localGoldenPassed,
    liveGatePassed,
    releaseEligible,
  };
});

const familyIds = [...new Set(cells.map((cell) => cell.family))].sort();
const families = familyIds.map((family) => {
  const familyCells = cells.filter((cell) => cell.family === family);
  return {
    family,
    eligibleCells: familyCells.length,
    compilerRepresentedCells: familyCells.filter((cell) => cell.compilerRepresented)
      .length,
    localGoldenPassedCells: familyCells.filter((cell) => cell.localGoldenPassed).length,
    liveGatePassedCells: familyCells.filter((cell) => cell.liveGatePassed).length,
    releaseEligibleCells: familyCells.filter((cell) => cell.releaseEligible).length,
    sourcePageVerifiedCells: familyCells.filter(
      (cell) => cell.exactPageAudit === "VERIFIED",
    ).length,
    supportedCells: familyCells.filter((cell) => cell.status === "SUPPORTED").length,
  };
});

const report = {
  version: 1,
  generatedAt: new Date().toISOString(),
  inventoryVersion: inventory.version,
  inventorySha256: createHash("sha256").update(inventorySource).digest("hex"),
  classificationStatus: inventory.classification.status,
  releaseStatus: "IN_PROGRESS",
  disclaimer:
    "Compiler representation and local golden review are development gates, not supported coverage. A cell remains unsupported until source, live-provider and full release gates pass.",
  totals: {
    eligibleCells: cells.length,
    compilerRepresentedCells: cells.filter((cell) => cell.compilerRepresented).length,
    localGoldenPassedCells: cells.filter((cell) => cell.localGoldenPassed).length,
    liveGatePassedCells: cells.filter((cell) => cell.liveGatePassed).length,
    releaseEligibleCells: cells.filter((cell) => cell.releaseEligible).length,
    sourcePageVerifiedCells: cells.filter((cell) => cell.exactPageAudit === "VERIFIED")
      .length,
    supportedCells: cells.filter((cell) => cell.status === "SUPPORTED").length,
    deterministicFixtures: compiledFixtures.length,
    approvedDeterministicFixtures: goldenManifest.summary.passedFixtureCount,
    approvedScreenshots: goldenManifest.summary.screenshotCount,
    paidProviderCalls,
    paidSpendVnd: liveGateBReview.paidCommittedVnd,
  },
  difficulty: ["SIMPLE", "MEDIUM", "HARD"].map((difficulty) => {
    const difficultyCells = cells.filter((cell) => cell.difficulty === difficulty);
    return {
      difficulty,
      eligibleCells: difficultyCells.length,
      compilerRepresentedCells: difficultyCells.filter((cell) => cell.compilerRepresented)
        .length,
      localGoldenPassedCells: difficultyCells.filter((cell) => cell.localGoldenPassed)
        .length,
      liveGatePassedCells: difficultyCells.filter((cell) => cell.liveGatePassed).length,
      releaseEligibleCells: difficultyCells.filter((cell) => cell.releaseEligible).length,
      supportedCells: difficultyCells.filter((cell) => cell.status === "SUPPORTED")
        .length,
    };
  }),
  families,
  liveEvidence: {
    gateAStatus: liveGateAReview.status,
    gateASpendVnd: liveGateAReview.paidCommittedVnd,
    gateBStatus: liveGateBReview.status,
    totalCommittedSpendVnd: liveGateBReview.paidCommittedVnd,
    providerUsageEvents: paidProviderCalls,
  },
  cells,
};

const outputDirectory = path.join(repositoryRoot, "anh-chup-hinh-toan-dat-chuan");
mkdirSync(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, "coverage-report-v51.json");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write(
  `Coverage report: ${report.totals.compilerRepresentedCells}/${report.totals.eligibleCells} compiler-represented cells, ${report.totals.supportedCells} released; ${outputPath}\n`,
);
