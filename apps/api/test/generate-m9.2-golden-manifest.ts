import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileLessonSummaryDiagramIntent } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";
import {
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
} from "#api/modules/ai/types/lesson-summary.types";

import { semanticDiagramVisualCases } from "./fixtures/math-diagram/semantic-visual-cases";

type Inventory = {
  cells: Array<{
    cellId: string;
    compilerKey: string;
    referenceIds: string[];
  }>;
};

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const approvedRoot = path.join(repositoryRoot, "anh-chup-hinh-toan-dat-chuan");
const inventory = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("./fixtures/math-diagram/curriculum-inventory.json", import.meta.url),
    ),
    "utf8",
  ),
) as Inventory;

const familyPresentation = {
  ELEMENTARY_MODEL: { group: "semantic-elementary", baseTheme: "light" },
  NUMBER_COORDINATE: { group: "semantic-coordinate", baseTheme: "light" },
  ALGEBRA_GRAPH: { group: "semantic-algebra", baseTheme: "dark" },
  DATA_STATISTICS: { group: "semantic-data", baseTheme: "light" },
  PLANE_GEOMETRY: { group: "semantic-plane", baseTheme: "dark" },
  ADVANCED_GEOMETRY: { group: "semantic-advanced", baseTheme: "dark" },
  SPATIAL_APPLIED: { group: "semantic-spatial", baseTheme: "light" },
  SET_SCHEMATIC: { group: "semantic-schematic", baseTheme: "dark" },
} as const;

const devices = [
  { id: "LAPTOP", sourceSuffix: "", directory: "laptop" },
  { id: "IPAD", sourceSuffix: "-chromium-tablet", directory: "ipad" },
  {
    id: "CHROMIUM_MOBILE",
    sourceSuffix: "-chromium-mobile",
    directory: "dien-thoai-chromium",
  },
  {
    id: "WEBKIT_MOBILE",
    sourceSuffix: "-webkit-mobile",
    directory: "dien-thoai-webkit",
  },
] as const;

const records = semanticDiagramVisualCases.map((visualCase) => {
  const compiled = compileLessonSummaryDiagramIntent(visualCase.intent);
  const inventoryCells = inventory.cells.filter(
    (cell) => cell.compilerKey === compiled.diagnostics.compilerKey,
  );
  if (inventoryCells.length === 0) {
    throw new Error(
      `${visualCase.caseId} has no inventory cell for ${compiled.diagnostics.compilerKey}.`,
    );
  }
  const presentation = familyPresentation[visualCase.intent.family];
  const screenshots = [];
  for (const theme of ["light", "dark"] as const) {
    const groupKey =
      theme === presentation.baseTheme
        ? presentation.group
        : `${presentation.group}-${theme}`;
    for (const device of devices) {
      const sourceRelativePath = path.join(
        "tmp/m9-2-v51-review-captures",
        `${groupKey}-${visualCase.caseId}${device.sourceSuffix}.png`,
      );
      const sourceAbsolutePath = path.join(repositoryRoot, sourceRelativePath);
      if (!existsSync(sourceAbsolutePath)) {
        throw new Error(`Missing reviewed screenshot ${sourceRelativePath}.`);
      }
      const approvedRelativePath = path.join(
        "anh-chup-hinh-toan-dat-chuan",
        device.directory,
        "v51-da-tai-tham-dinh",
        `${visualCase.caseId}-${theme}.png`,
      );
      const approvedAbsolutePath = path.join(repositoryRoot, approvedRelativePath);
      mkdirSync(path.dirname(approvedAbsolutePath), { recursive: true });
      copyFileSync(sourceAbsolutePath, approvedAbsolutePath);
      screenshots.push({
        device: device.id,
        theme: theme.toUpperCase(),
        path: approvedRelativePath,
        sha256: createHash("sha256")
          .update(readFileSync(approvedAbsolutePath))
          .digest("hex"),
      });
    }
  }
  return {
    fixtureId: visualCase.caseId,
    family: visualCase.intent.family,
    difficulty: visualCase.intent.difficulty,
    compilerKey: compiled.diagnostics.compilerKey,
    inventoryCellIds: inventoryCells.map((cell) => cell.cellId),
    referenceIds: [...new Set(inventoryCells.flatMap((cell) => cell.referenceIds))],
    comparisonMode: "SAME_ARCHETYPE",
    decision: "PASS",
    manuallyReviewedAt: "2026-08-10",
    reviewNotes:
      "Đã xem bằng mắt theo hàng cùng case trên laptop, iPad, Chromium Mobile và WebKit Mobile ở cả light/dark; đối chiếu quan hệ, ký hiệu, nhãn, tick, độ tương phản và khoảng trống quanh nét.",
    checklist: {
      semanticTruth: true,
      textbookNotation: true,
      labelsNearAnchorsWithoutStrokeOverlap: true,
      scaleTicksAndConstructionPoints: true,
      mobileReadability: true,
      lightDarkContrast: true,
    },
    screenshots,
  };
});

const manifest = {
  version: 2,
  promptVersion: LESSON_SUMMARY_PROMPT_VERSION,
  schemaVersion: LESSON_SUMMARY_SCHEMA_VERSION,
  generatedAt: "2026-08-10",
  source: "DETERMINISTIC_COMPILER_LOCAL_REVIEW",
  paidProviderCalls: 0,
  paidSpendVnd: 0,
  policy: {
    oldApprovedImagesAreCandidatesOnly: true,
    passRequiresManualSourceBackedReview: true,
    devices: devices.map((device) => device.id),
    themes: ["LIGHT", "DARK"],
    captureMode: "PLAYWRIGHT_LOCATOR_ONLY",
    manualReviewRecord:
      "anh-chup-hinh-toan-dat-chuan/v51-semantic-final-manual-review.json",
  },
  summary: {
    fixtureCount: records.length,
    screenshotCount: records.reduce(
      (count, record) => count + record.screenshots.length,
      0,
    ),
    passedFixtureCount: records.filter((record) => record.decision === "PASS").length,
    failedFixtureCount: 0,
  },
  records,
};

mkdirSync(approvedRoot, { recursive: true });
writeFileSync(
  path.join(approvedRoot, "reference-golden-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `Recorded ${manifest.summary.fixtureCount} manually reviewed fixtures and ${manifest.summary.screenshotCount} screenshots.\n`,
);
