import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { compileLessonSummaryDiagramIntent } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

import { semanticDiagramVisualCases } from "./fixtures/math-diagram/semantic-visual-cases";
import { mathDiagramFixtureMatchesInventoryCell } from "./fixtures/math-diagram/coverage-mapping";

const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/math-diagram/", import.meta.url),
);

const referenceCatalogSchema = z
  .object({
    version: z.literal(1),
    series: z.literal("Kết nối tri thức với cuộc sống"),
    accessedAt: z.iso.date(),
    copyrightUse: z.literal("REVIEW_ONLY"),
    references: z
      .array(
        z
          .object({
            referenceId: z.string().min(1),
            sourceKind: z.enum(["CURRICULUM", "SGK", "SBT", "SGV", "TRAINING"]),
            publisher: z.string().min(1),
            grade: z.number().int().min(3).max(9).nullable(),
            volume: z.number().int().min(1).max(2).nullable(),
            title: z.string().min(1),
            url: z.url().refine(
              (value) =>
                value.startsWith("https://moet.gov.vn/") ||
                value.startsWith("https://taphuan.nxbgd.vn/"),
              "Coverage references must use the official MOET or NXBGDVN catalog.",
            ),
            comparisonClaims: z
              .array(
                z.enum([
                  "CURRICULUM_SCOPE",
                  "GRADE_PROGRESSION",
                  "EXACT_FIGURE",
                  "SAME_ARCHETYPE",
                  "NOTATION_CONVENTION",
                ]),
              )
              .min(1),
            status: z.literal("VERIFIED_OFFICIAL"),
          })
          .strict(),
      )
      .min(15),
  })
  .strict();

const inventorySchema = z
  .object({
    version: z.literal(1),
    series: z.literal("Kết nối tri thức với cuộc sống"),
    scope: z
      .object({
        grades: z.array(z.number().int().min(3).max(9)).length(7),
        includedDifficulties: z
          .array(z.enum(["SIMPLE", "MEDIUM", "HARD"]))
          .length(3),
        excludedDifficulty: z.literal("VERY_COMPLEX"),
        targetCoveragePercent: z.number().min(90).max(100),
        minimumCoveragePercent: z.number().min(90).max(100),
      })
      .strict(),
    classification: z
      .object({
        status: z.enum(["IN_PROGRESS", "LOCKED"]),
        bookCatalogComplete: z.boolean(),
        exactPageAuditComplete: z.boolean(),
        note: z.string().min(1),
      })
      .strict(),
    cells: z
      .array(
        z
          .object({
            cellId: z.string().min(1),
            family: z.enum([
              "ELEMENTARY_MODEL",
              "NUMBER_COORDINATE",
              "ALGEBRA_GRAPH",
              "DATA_STATISTICS",
              "PLANE_GEOMETRY",
              "ADVANCED_GEOMETRY",
              "SPATIAL_APPLIED",
              "SET_SCHEMATIC",
            ]),
            archetype: z.string().min(1),
            semanticVariant: z.string().min(1),
            difficulty: z.enum(["SIMPLE", "MEDIUM", "HARD"]),
            grades: z.array(z.number().int().min(3).max(9)).min(1),
            status: z.enum([
              "PLANNED",
              "PARTIAL",
              "SUPPORTED",
              "UNSUPPORTED",
              "VERY_COMPLEX_EXCLUDED",
            ]),
            compilerKey: z.string().regex(/^[a-z]+(?:[.-][a-z]+)*\.v\d+$/u),
            referenceIds: z.array(z.string().min(1)).min(1),
            exactPageAudit: z.enum(["PENDING", "VERIFIED"]),
          })
          .strict(),
      )
      .min(24),
  })
  .strict();

const sourcePageAuditSchema = z
  .object({
    version: z.literal(1),
    series: z.literal("Kết nối tri thức với cuộc sống"),
    auditedAt: z.iso.date(),
    records: z
      .array(
        z
          .object({
            referenceId: z.string().min(1),
            printedPages: z.array(z.number().int().positive()).min(1),
            topics: z.array(z.string().min(1)).min(1),
            evidencePages: z
              .array(
                z
                  .object({
                    readerPage: z.number().int().positive(),
                    printedPage: z.number().int().positive().optional(),
                    evidenceUrl: z.url().refine(
                      (value) =>
                        value.startsWith("https://cdn3.olm.vn/upload/taphuan/"),
                      "Page evidence must be the image served by the official NXBGDVN reader.",
                    ),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

function readFixture(fileName: string): unknown {
  return JSON.parse(readFileSync(`${fixtureDirectory}${fileName}`, "utf8"));
}

describe("M9.2 math diagram coverage control plane", () => {
  it("catalogs the official curriculum and both SGK volumes for grades 3-9", () => {
    const catalog = referenceCatalogSchema.parse(readFixture("reference-catalog.json"));
    const referenceIds = catalog.references.map((reference) => reference.referenceId);

    expect(new Set(referenceIds).size).toBe(referenceIds.length);
    expect(catalog.references.filter((reference) => reference.sourceKind === "SGK")).toHaveLength(
      14,
    );
    for (let grade = 3; grade <= 9; grade += 1) {
      expect(
        catalog.references
          .filter((reference) => reference.grade === grade)
          .map((reference) => reference.volume)
          .sort(),
      ).toEqual([1, 2]);
    }
  });

  it("covers all eight families and all three eligible difficulty levels", () => {
    const catalog = referenceCatalogSchema.parse(readFixture("reference-catalog.json"));
    const inventory = inventorySchema.parse(readFixture("curriculum-inventory.json"));
    const referenceIds = new Set(
      catalog.references.map((reference) => reference.referenceId),
    );
    const cellIds = inventory.cells.map((cell) => cell.cellId);

    expect(new Set(cellIds).size).toBe(cellIds.length);
    expect(new Set(inventory.cells.map((cell) => cell.family)).size).toBe(8);
    expect(new Set(inventory.cells.map((cell) => cell.difficulty))).toEqual(
      new Set(["SIMPLE", "MEDIUM", "HARD"]),
    );
    for (const cell of inventory.cells) {
      expect(cell.referenceIds.every((referenceId) => referenceIds.has(referenceId))).toBe(
        true,
      );
      if (cell.status === "SUPPORTED") {
        expect(cell.exactPageAudit).toBe("VERIFIED");
      }
    }
  });

  it("does not overclaim source classification or supported coverage", () => {
    const inventory = inventorySchema.parse(readFixture("curriculum-inventory.json"));
    const supported = inventory.cells.filter((cell) => cell.status === "SUPPORTED");

    expect(inventory.classification.status).toBe("IN_PROGRESS");
    expect(inventory.classification.exactPageAuditComplete).toBe(false);
    expect(supported).toHaveLength(0);
  });

  it("maps every deterministic compiler fixture to the curriculum inventory", () => {
    const inventory = inventorySchema.parse(readFixture("curriculum-inventory.json"));
    const inventoryCompilerKeys = new Set(
      inventory.cells.map((cell) => cell.compilerKey),
    );
    const compiledFixtures = semanticDiagramVisualCases.map((visualCase) => ({
      fixtureId: visualCase.caseId,
      compilerKey:
        compileLessonSummaryDiagramIntent(visualCase.intent).diagnostics.compilerKey,
    }));

    expect(
      compiledFixtures.every((fixture) =>
        inventoryCompilerKeys.has(fixture.compilerKey),
      ),
    ).toBe(true);
    expect(
      inventory.cells.every((cell) =>
        compiledFixtures.some((fixture) =>
          mathDiagramFixtureMatchesInventoryCell({
            cellId: cell.cellId,
            cellCompilerKey: cell.compilerKey,
            fixtureId: fixture.fixtureId,
            fixtureCompilerKey: fixture.compilerKey,
          }),
        ),
      ),
    ).toBe(true);
  });

  it("ties every verified page audit to an official catalog entry and reader image", () => {
    const catalog = referenceCatalogSchema.parse(readFixture("reference-catalog.json"));
    const audit = sourcePageAuditSchema.parse(readFixture("source-page-audit.json"));
    const referenceIds = new Set(
      catalog.references.map((reference) => reference.referenceId),
    );

    expect(new Set(audit.records.map((record) => record.referenceId)).size).toBe(
      audit.records.length,
    );
    expect(audit.records.every((record) => referenceIds.has(record.referenceId))).toBe(
      true,
    );
    for (const record of audit.records) {
      expect(
        new Set(record.evidencePages.map((page) => page.readerPage)).size,
      ).toBe(record.evidencePages.length);
    }
  });
});
