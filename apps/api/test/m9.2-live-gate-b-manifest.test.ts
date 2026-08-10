import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mathDiagramLiveGateBLessons } from "./fixtures/math-diagram/live-gate-b-lessons";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const referenceCatalog = JSON.parse(
  readFileSync(
    path.join(
      repositoryRoot,
      "apps/api/test/fixtures/math-diagram/reference-catalog.json",
    ),
    "utf8",
  ),
) as { references: Array<{ referenceId: string; status: string }> };

describe("M9.2 Gate B real lesson manifest", () => {
  it("contains exactly one simple, medium and hard lesson for every grade 3-9", () => {
    expect(mathDiagramLiveGateBLessons).toHaveLength(21);
    for (let grade = 3; grade <= 9; grade += 1) {
      const lessons = mathDiagramLiveGateBLessons.filter(
        (lesson) => lesson.grade === grade,
      );
      expect(lessons).toHaveLength(3);
      expect(lessons.map((lesson) => lesson.difficulty).sort()).toEqual([
        "HARD",
        "MEDIUM",
        "SIMPLE",
      ]);
      expect(new Set(lessons.map((lesson) => lesson.title)).size).toBe(3);
    }
  });

  it("plans coverage for every supported diagram family at least twice", () => {
    const familyCounts = new Map<string, number>();
    mathDiagramLiveGateBLessons.forEach((lesson) => {
      new Set(
        "coverageFamilies" in lesson ? lesson.coverageFamilies : lesson.expectedFamilies,
      ).forEach((family) =>
        familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1),
      );
    });
    expect([...familyCounts.entries()].sort()).toEqual(
      expect.arrayContaining([
        ["ADVANCED_GEOMETRY", expect.any(Number)],
        ["ALGEBRA_GRAPH", expect.any(Number)],
        ["DATA_STATISTICS", expect.any(Number)],
        ["ELEMENTARY_MODEL", expect.any(Number)],
        ["NUMBER_COORDINATE", expect.any(Number)],
        ["PLANE_GEOMETRY", expect.any(Number)],
        ["SET_SCHEMATIC", expect.any(Number)],
        ["SPATIAL_APPLIED", expect.any(Number)],
      ]),
    );
    expect([...familyCounts.values()].every((count) => count >= 2)).toBe(true);
  });

  it("uses verified official references and non-empty unique reader pages", () => {
    const verifiedReferences = new Set(
      referenceCatalog.references
        .filter((reference) => reference.status === "VERIFIED_OFFICIAL")
        .map((reference) => reference.referenceId),
    );
    expect(new Set(mathDiagramLiveGateBLessons.map((lesson) => lesson.caseId)).size).toBe(
      mathDiagramLiveGateBLessons.length,
    );
    mathDiagramLiveGateBLessons.forEach((lesson) => {
      expect(verifiedReferences.has(lesson.referenceId)).toBe(true);
      expect(lesson.officialReaderUrl).toMatch(/^https:\/\/taphuan\.nxbgd\.vn\//u);
      expect(lesson.readerPages.length).toBeGreaterThan(0);
      expect(new Set(lesson.readerPages).size).toBe(lesson.readerPages.length);
      expect(lesson.readerPages.every((page) => Number.isInteger(page) && page > 0)).toBe(
        true,
      );
      expect(lesson.minimumDiagramCount).toBeGreaterThan(0);
    });
  });
});
