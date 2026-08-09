import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const screenshotRoot = path.join(repositoryRoot, "tmp/m9-2-v50-review-captures");
const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-diagram-visual-review";
const sourceChunkId = "11111111-1111-4111-8111-111111111111";

type JsonRecord = Record<string, unknown>;

const visualCases = [
  {
    key: "textbook-algebra-recovered",
    theme: "light",
    content: buildCoverageSummary(
      "Hồi quy SGK: tọa độ, đại số, bảng và biểu đồ",
      readJson(
        "tmp/m9-2-diagram-coverage-textbook_regression-recovered-v43-gpt-5.4-2026-03-05.json",
      ),
      ["coordinate_points", "linear_system", "value_table", "line_chart"],
    ),
  },
  {
    key: "textbook-parabola",
    theme: "light",
    content: buildCoverageSummary(
      "Hồi quy SGK: parabol và đường thẳng",
      readJson("tmp/m9-2-diagram-coverage-textbook_graph_retry-recovered-v46.json"),
    ),
  },
  {
    key: "textbook-geometry-dark",
    theme: "dark",
    content: buildCoverageSummary(
      "Hồi quy SGK: hình học, đồng hồ và sơ đồ",
      readJson("tmp/m9-2-diagram-coverage-textbook_geometry_retry-recovered-v46.json"),
    ),
  },
  {
    key: "grade9-geometry-complex-dark",
    theme: "dark",
    content: buildCoverageSummary(
      "Hình học phức tạp lớp 9: đường tròn và tiếp tuyến",
      readJson(
        "tmp/m9-2-diagram-coverage-grade9_geometry_complex-recovered-v43-gpt-5.4.json",
      ),
    ),
  },
  {
    key: "extended-grade3-6",
    theme: "light",
    content: buildCoverageSummary(
      "Mở rộng lớp 3–6: số học, trục số và hình học",
      readJson("tmp/m9-2-diagram-coverage-extended_grade3_9-recovered-v43-gpt-5.4.json"),
      [
        "multiplication_array",
        "tape_diagram",
        "fraction_number_line",
        "composite_rectilinear",
        "circle_radius_diameter",
        "regular_hexagon_symmetry",
      ],
    ),
  },
  {
    key: "extended-grade7-9-dark",
    theme: "dark",
    content: buildCoverageSummary(
      "Mở rộng lớp 7–9: đại số, thống kê và hình học nâng cao",
      readJson("tmp/m9-2-diagram-coverage-extended_grade3_9-recovered-v43-gpt-5.4.json"),
      [
        "direct_variation_graph",
        "triangle_median_centroid",
        "histogram_grouped",
        "trapezoid_midline",
        "right_triangle_altitude",
        "intersecting_chords",
      ],
    ),
  },
  {
    key: "real-algebra-lesson-1-v43",
    theme: "light",
    content: buildRealLessonExampleSummary(
      readJson("tmp/pdfs/lesson-summary-v3/live-matrix-v42/alg-bai-1--gpt-5.4.json"),
    ),
  },
  {
    key: "real-geometry-lesson-15-v43",
    theme: "dark",
    content: buildRealLessonExampleSummary(
      readJson("tmp/pdfs/lesson-summary-v3/live-matrix-v42/geo-bai-15--gpt-5.4.json"),
    ),
  },
  {
    key: "real-geometry-lesson-15-v50-live",
    theme: "light",
    content: buildBai15V50LiveReviewSummary(),
  },
] as const;

mkdirSync(screenshotRoot, { recursive: true });

test.describe.configure({ mode: "serial" });

for (const visualCase of visualCases) {
  test(`${visualCase.key} renders without clipping or browser errors`, async ({
    page,
  }, testInfo) => {
    const screenshotVariant =
      testInfo.project.name === "chromium-desktop" ? "" : `-${testInfo.project.name}`;
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await seedAdminSession(page, visualCase.theme);
    await setupMock(page, visualCase.content);
    await page.goto(`/admin/lessons/${lessonId}`);

    await page.getByRole("tab", { name: "Kiến thức" }).click();
    await expect(page.getByRole("tab", { name: "Kiến thức" })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 15_000 },
    );
    const diagrams = page.locator("figure").filter({ has: page.locator("svg") });
    const expectedCount = countDiagramVisuals(visualCase.content);
    await expect(diagrams).toHaveCount(expectedCount, { timeout: 15_000 });
    expect(expectedCount).toBeGreaterThan(0);
    if (visualCase.key === "grade9-geometry-complex-dark") {
      await expect(
        diagrams.nth(0).locator('[data-diagram-marker-type="ANGLE"]'),
      ).toHaveCount(0);
      await expect(
        diagrams.nth(0).locator('[data-diagram-marker-type="RIGHT_ANGLE"]'),
      ).toHaveCount(1);
      await expect(
        diagrams.nth(1).locator('[data-diagram-center-marker="true"]'),
      ).toHaveCount(1);
      await expect(
        diagrams.nth(2).locator('[data-diagram-center-marker="true"]'),
      ).toHaveCount(1);
    }
    if (visualCase.key === "textbook-parabola") {
      const parabolaDiagram = diagrams.nth(0);
      await expect(
        parabolaDiagram.locator('[data-diagram-axis-tick="true"]'),
      ).toHaveCount(15);
      await expect(parabolaDiagram.locator("svg text", { hasText: "O" })).toHaveCount(1);
      await expect(parabolaDiagram.locator("svg text", { hasText: /^0$/u })).toHaveCount(
        0,
      );
      await expect(
        parabolaDiagram.locator(
          '[data-diagram-label-anchor-point-id="tickXneg2A"][data-diagram-label-text="-2"]',
        ),
      ).toHaveCount(1);
      for (const pointId of [
        "pt_q1",
        "pt_M",
        "pt_q5",
        "pt_q9",
        "pt_q13",
        "pt_q15",
        "pt_N",
      ]) {
        await expect(
          parabolaDiagram.locator(`[data-diagram-point-id="${pointId}"]`),
        ).toHaveCount(1);
        await expect(
          parabolaDiagram.locator(
            `[data-diagram-graph-construction-point="true"][data-diagram-point-id="${pointId}"]`,
          ),
        ).toHaveCount(1);
      }
      const constructionPoints = {
        pt_q1: { name: "A", projectionCount: 2 },
        pt_M: { name: "M", projectionCount: 1 },
        pt_q5: { name: "B", projectionCount: 2 },
        pt_q9: { name: "C", projectionCount: 1 },
        pt_q13: { name: "D", projectionCount: 2 },
        pt_q15: { name: "E", projectionCount: 1 },
        pt_N: { name: "N", projectionCount: 2 },
      } as const;
      for (const [pointId, constructionPoint] of Object.entries(constructionPoints)) {
        await expect(
          parabolaDiagram.locator(`[data-diagram-point-label-id="${pointId}"]`),
        ).toHaveText(constructionPoint.name);
        await expect(
          parabolaDiagram.locator(
            `[data-diagram-coordinate-projection-point-id="${pointId}"]`,
          ),
        ).toHaveCount(constructionPoint.projectionCount);
      }
      const constructionRadii = await parabolaDiagram
        .locator('[data-diagram-graph-construction-point="true"]')
        .evaluateAll((points) =>
          points.map((point) => Number(point.getAttribute("r") ?? "0")),
        );
      expect(Math.min(...constructionRadii)).toBeGreaterThanOrEqual(0.07);
      const negativeFourLabel = parabolaDiagram.locator(
        '[data-diagram-label-anchor-point-id="tickYneg4A"][data-diagram-label-text="-4"]',
      );
      const negativeFourAnchorDelta = await negativeFourLabel.evaluate((label) =>
        Math.abs(Number(label.getAttribute("x")) - -0.08),
      );
      expect(negativeFourAnchorDelta).toBeLessThanOrEqual(0.4);
    }
    if (visualCase.key === "textbook-geometry-dark") {
      await expect(
        diagrams.nth(2).locator('[data-diagram-center-marker="true"]'),
      ).toHaveCount(1);
    }
    if (visualCase.key === "real-algebra-lesson-1-v43") {
      await expect(
        diagrams.nth(1).locator('[data-diagram-marker-type="EQUAL_LENGTH"]'),
      ).toHaveCount(0);
      await expect(
        diagrams.nth(0).locator('[data-diagram-axis-tick="true"]'),
      ).toHaveCount(13);
      const maximumTickHeight = await diagrams
        .nth(0)
        .locator('[data-diagram-axis-tick="true"]')
        .evaluateAll((ticks) =>
          Math.max(...ticks.map((tick) => tick.getBoundingClientRect().height)),
        );
      expect(maximumTickHeight).toBeLessThanOrEqual(10);
      for (const pointId of ["P", "Q"]) {
        const point = diagrams.nth(0).locator(`[data-diagram-point-id="${pointId}"]`);
        const label = diagrams
          .nth(0)
          .locator(`[data-diagram-point-label-id="${pointId}"]`);
        await expect(point).toHaveCount(1);
        await expect(label).toHaveCount(1);
        const horizontalAnchorDelta = await Promise.all([
          point.getAttribute("cx"),
          label.getAttribute("x"),
        ]).then(([pointX, labelX]) => {
          if (!pointX || !labelX) throw new Error(`Missing ${pointId} SVG anchors.`);
          return Math.abs(Number(pointX) - Number(labelX));
        });
        expect(horizontalAnchorDelta).toBeLessThanOrEqual(0.001);
        const verticalPointLabelDelta = await Promise.all([
          point.getAttribute("cy"),
          label.getAttribute("y"),
        ]).then(([pointY, labelY]) => {
          if (!pointY || !labelY) throw new Error(`Missing ${pointId} SVG anchors.`);
          return Math.abs(Number(pointY) - Number(labelY));
        });
        expect(verticalPointLabelDelta).toBeLessThanOrEqual(0.75);
        const value = pointId === "P" ? "5/4" : "-5/4";
        const valueLabel = diagrams
          .nth(0)
          .locator(
            `[data-diagram-label-anchor-point-id="${pointId}"][data-diagram-label-text="${value}"]`,
          );
        const verticalValueLabelDelta = await Promise.all([
          point.getAttribute("cy"),
          valueLabel.getAttribute("y"),
        ]).then(([pointY, valueY]) => {
          if (!pointY || !valueY) throw new Error(`Missing ${pointId} value anchors.`);
          return Math.abs(Number(pointY) - Number(valueY));
        });
        expect(verticalValueLabelDelta).toBeLessThanOrEqual(0.3);
      }
      const minimumNumberLineLabelHeight = await diagrams
        .nth(0)
        .locator(
          '[data-diagram-point-label-id="P"], [data-diagram-point-label-id="Q"], [data-diagram-label-text="5/4"], [data-diagram-label-text="-5/4"]',
        )
        .evaluateAll((labels) =>
          Math.min(...labels.map((label) => label.getBoundingClientRect().height)),
        );
      expect(minimumNumberLineLabelHeight).toBeGreaterThanOrEqual(8);
      const minimumNumberLinePointNameHeight = await diagrams
        .locator("[data-diagram-point-label-id]")
        .evaluateAll((labels) =>
          Math.min(...labels.map((label) => label.getBoundingClientRect().height)),
        );
      expect(minimumNumberLinePointNameHeight).toBeGreaterThanOrEqual(10);
    }
    if (visualCase.key === "textbook-algebra-recovered") {
      await expect(
        diagrams.nth(0).locator('[data-diagram-axis-tick="true"]'),
      ).toHaveCount(13);
      await expect(
        diagrams.nth(3).locator('[data-diagram-axis-tick="true"]'),
      ).toHaveCount(10);
      const maximumAxisTickSize = await diagrams
        .nth(0)
        .locator('[data-diagram-axis-tick="true"]')
        .evaluateAll((ticks) =>
          Math.max(
            ...ticks.map((tick) => {
              const box = tick.getBoundingClientRect();
              return Math.max(box.width, box.height);
            }),
          ),
        );
      const maximumChartTickSize = await diagrams
        .nth(3)
        .locator('[data-diagram-axis-tick="true"]')
        .evaluateAll((ticks) =>
          Math.max(
            ...ticks.map((tick) => {
              const box = tick.getBoundingClientRect();
              return Math.max(box.width, box.height);
            }),
          ),
        );
      const minimumTableTextHeight = await diagrams
        .nth(2)
        .locator("svg text")
        .evaluateAll((labels) =>
          Math.min(...labels.map((label) => label.getBoundingClientRect().height)),
        );
      expect(maximumAxisTickSize).toBeLessThanOrEqual(10);
      expect(maximumChartTickSize).toBeLessThanOrEqual(10);
      expect(minimumTableTextHeight).toBeGreaterThanOrEqual(12);
    }
    if (visualCase.key === "extended-grade3-6") {
      await expect(
        diagrams.nth(4).locator('[data-diagram-center-marker="true"]'),
      ).toHaveCount(1);
      await expect(
        diagrams.nth(2).locator('[data-diagram-marker-type="EQUAL_LENGTH"]'),
      ).toHaveCount(0);
      await expect(
        diagrams.nth(2).locator('[data-diagram-axis-tick="true"]'),
      ).toHaveCount(9);
      const maximumTickHeight = await diagrams
        .nth(2)
        .locator('[data-diagram-axis-tick="true"]')
        .evaluateAll((ticks) =>
          Math.max(...ticks.map((tick) => tick.getBoundingClientRect().height)),
        );
      expect(maximumTickHeight).toBeLessThanOrEqual(10);
      await expect(diagrams.nth(1).locator("svg text", { hasText: "15" })).toHaveCount(1);
      await expect(diagrams.nth(1).locator("svg text", { hasText: "25" })).toHaveCount(1);
      await expect(diagrams.nth(1).locator("svg text", { hasText: "10" })).toHaveCount(1);
    }
    if (visualCase.key === "extended-grade7-9-dark") {
      await expect(diagrams.nth(0).locator("circle[data-diagram-point-id]")).toHaveCount(
        2,
      );
      await expect(
        diagrams.nth(3).locator('[data-diagram-marker-type="PARALLEL"]'),
      ).toHaveCount(0);
    }
    if (visualCase.key === "real-geometry-lesson-15-v50-live") {
      const minimumPointLabelHeight = await diagrams
        .locator("[data-diagram-point-label-id]")
        .evaluateAll((labels) =>
          Math.min(...labels.map((label) => label.getBoundingClientRect().height)),
        );
      expect(minimumPointLabelHeight).toBeGreaterThanOrEqual(9.5);
      await expect(
        diagrams.nth(0).locator('[data-diagram-marker-type="RIGHT_ANGLE"]'),
      ).toHaveCount(2);
      await expect(
        diagrams.nth(0).locator('[data-diagram-marker-type="EQUAL_LENGTH"]'),
      ).toHaveCount(4);
      await expect(
        diagrams.nth(1).locator('[data-diagram-marker-type="RIGHT_ANGLE"]'),
      ).toHaveCount(2);
      await expect(
        diagrams.nth(1).locator('[data-diagram-marker-type="EQUAL_LENGTH"]'),
      ).toHaveCount(2);
    }

    const metrics = await diagrams.evaluateAll((figures) =>
      figures.map((figure, figureIndex) => {
        const svg = figure.querySelector("svg");
        if (!svg)
          return {
            clippedText: 1,
            overlappingText: ["missing-svg"],
            overlappingTextPairs: ["missing-svg"],
            width: 0,
            height: 0,
          };
        const svgBox = svg.getBoundingClientRect();
        const textNodes = [...svg.querySelectorAll("text")];
        const clippedText = textNodes.filter((text) => {
          const box = text.getBoundingClientRect();
          return (
            box.left < svgBox.left - 2 ||
            box.right > svgBox.right + 2 ||
            box.top < svgBox.top - 2 ||
            box.bottom > svgBox.bottom + 2
          );
        }).length;
        const geometries = [
          ...svg.querySelectorAll<SVGGeometryElement>(
            "line, path, polyline, polygon, circle, ellipse",
          ),
        ].filter((geometry) => !geometry.closest("defs"));
        const overlappingText = textNodes.flatMap((text) => {
          const box = text.getBoundingClientRect();
          const inset = Math.min(0.5, box.height * 0.03);
          const overlappingGeometry = geometries.find((geometry) => {
            const matrix = geometry.getScreenCTM();
            if (!matrix || typeof geometry.getTotalLength !== "function") return false;
            const length = geometry.getTotalLength();
            const steps = Math.min(640, Math.max(2, Math.ceil(length / 1.25)));
            return Array.from({ length: steps + 1 }, (_, index) =>
              geometry.getPointAtLength((length * index) / steps).matrixTransform(matrix),
            ).some(
              (point) =>
                point.x > box.left + inset &&
                point.x < box.right - inset &&
                point.y > box.top + inset &&
                point.y < box.bottom - inset,
            );
          });
          return overlappingGeometry
            ? [
                `figure-${figureIndex + 1}:${text.textContent?.trim() || "(empty)"}:${overlappingGeometry.tagName.toLowerCase()}:${overlappingGeometry.getAttribute("x1") ?? overlappingGeometry.getAttribute("cx") ?? "shape"}`,
              ]
            : [];
        });
        const overlappingTextPairs = textNodes.flatMap((text, textIndex) => {
          const box = text.getBoundingClientRect();
          return textNodes.slice(textIndex + 1).flatMap((otherText) => {
            const otherBox = otherText.getBoundingClientRect();
            const overlapWidth =
              Math.min(box.right, otherBox.right) - Math.max(box.left, otherBox.left);
            const overlapHeight =
              Math.min(box.bottom, otherBox.bottom) - Math.max(box.top, otherBox.top);
            return overlapWidth > 0.5 && overlapHeight > 0.5
              ? [
                  `figure-${figureIndex + 1}:${text.textContent?.trim() || "(empty)"}<->${otherText.textContent?.trim() || "(empty)"}`,
                ]
              : [];
          });
        });
        return {
          clippedText,
          overlappingText,
          overlappingTextPairs,
          width: svgBox.width,
          height: svgBox.height,
        };
      }),
    );
    for (let index = 0; index < expectedCount; index += 1) {
      const diagram = diagrams.nth(index);
      await diagram.evaluate((figure) =>
        figure.scrollIntoView({ behavior: "auto", block: "center" }),
      );
      await page.waitForTimeout(50);
      await isolateDiagramCapture(diagram);
      try {
        await diagram.screenshot({
          animations: "disabled",
          caret: "hide",
          path: path.join(
            screenshotRoot,
            `${visualCase.key}-${String(index + 1).padStart(2, "0")}${screenshotVariant}.png`,
          ),
          scale: "css",
        });
      } finally {
        await restoreDiagramCapture(diagram);
      }
    }
    await page.screenshot({
      path: path.join(
        screenshotRoot,
        `${visualCase.key}-overview${screenshotVariant}.png`,
      ),
      fullPage: false,
    });

    expect(metrics.every((metric) => metric.clippedText === 0)).toBe(true);
    expect(metrics.flatMap((metric) => metric.overlappingText)).toEqual([]);
    expect(metrics.flatMap((metric) => metric.overlappingTextPairs)).toEqual([]);
    expect(metrics.every((metric) => metric.width > 100 && metric.height > 30)).toBe(
      true,
    );

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client + 1);
    expect(await page.locator("[data-nextjs-dialog]").count()).toBe(0);
    expect(browserErrors).toEqual([]);
  });
}

async function isolateDiagramCapture(diagram: ReturnType<Page["locator"]>) {
  await diagram.evaluate((figure) => {
    document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
      if (element === figure || element.contains(figure) || figure.contains(element)) {
        return;
      }
      element.dataset.mathDiagramReviewVisibility = element.style.visibility;
      element.style.setProperty("visibility", "hidden", "important");
    });
  });
}

async function restoreDiagramCapture(diagram: ReturnType<Page["locator"]>) {
  await diagram.evaluate(() => {
    document
      .querySelectorAll<HTMLElement>("[data-math-diagram-review-visibility]")
      .forEach((element) => {
        const previousVisibility = element.dataset.mathDiagramReviewVisibility ?? "";
        element.style.removeProperty("visibility");
        if (previousVisibility) element.style.visibility = previousVisibility;
        delete element.dataset.mathDiagramReviewVisibility;
      });
  });
}

test("blocks a function graph that omits coordinate axes", async ({ page }, testInfo) => {
  const artifact = readJson(
    "tmp/m9-2-diagram-coverage-visual_regressions-v42-gpt-5.4.json",
  );
  const content = buildCoverageSummary("Hình parabol bị contract từ chối", artifact, [
    "quadratic_line",
  ]);
  await seedAdminSession(page, "light");
  await setupMock(page, content);
  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Kiến thức" }).click();
  await expect(page.getByText(/Sơ đồ chưa hợp lệ/u)).toBeVisible();
  await expect(page.locator("figure").filter({ has: page.locator("svg") })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: path.join(
      screenshotRoot,
      `blocked-parabola-missing-axes-${testInfo.project.name}.png`,
    ),
    fullPage: false,
  });
});

function readJson(relativePath: string): JsonRecord {
  return JSON.parse(
    readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
  ) as JsonRecord;
}

function buildCoverageSummary(
  title: string,
  artifact: JsonRecord,
  selectedCaseIds?: string[],
): JsonRecord {
  const allExamples = artifact.examples as Array<{
    caseId: string;
    title: string;
    problem: string;
    diagramSpec: unknown;
  }>;
  const examples = selectedCaseIds
    ? allExamples.filter((example) => selectedCaseIds.includes(example.caseId))
    : allExamples;
  return {
    lessonId,
    title,
    objectives: ["Kiểm tra chất lượng hình minh họa."],
    sections: [
      {
        order: 1,
        sourceHeading: title,
        displayHeading: title,
        sourceChunkIds: [sourceChunkId],
        blocks: examples.map((example) => ({
          type: "example",
          problem: `**${example.title}**\n\n${example.problem}`,
          solution: "Quan sát hình minh họa được dựng đúng theo dữ kiện.",
          answer: "Hình đã được kiểm tra bằng contract diagramSpec.",
          visual: { kind: "DIAGRAM_SPEC", spec: example.diagramSpec },
        })),
      },
    ],
  };
}

function buildRealLessonExampleSummary(artifact: JsonRecord): JsonRecord {
  const persistedOutput = artifact.persistedOutput as JsonRecord;
  const sections = persistedOutput.sections as Array<{
    blocks: Array<JsonRecord>;
    [key: string]: unknown;
  }>;
  return {
    ...persistedOutput,
    sections: sections
      .map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => block.type === "example"),
      }))
      .filter((section) => section.blocks.length > 0),
  };
}

function buildBai15V50LiveReviewSummary(): JsonRecord {
  const point = (
    id: string,
    x: number,
    y: number,
    label: string,
    labelPosition: string,
  ) => ({ id, x, y, label, pointStyle: "NONE", labelPosition });
  const segment = (id: string, from: string, to: string) => ({
    id,
    type: "SEGMENT",
    from,
    to,
    style: "SOLID",
  });
  return {
    lessonId,
    title: "Bài 15. Ba trường hợp bằng nhau của tam giác vuông",
    objectives: ["Kiểm tra hình minh họa cạnh huyền - cạnh góc vuông."],
    sections: [
      {
        order: 1,
        sourceHeading: "Cạnh huyền và một cạnh góc vuông",
        displayHeading: "Cạnh huyền và một cạnh góc vuông",
        sourceChunkIds: [sourceChunkId],
        blocks: [
          {
            type: "theorem",
            title: "Trường hợp cạnh huyền - cạnh góc vuông",
            content:
              "Nếu cạnh huyền và một cạnh góc vuông của tam giác vuông này bằng cạnh huyền và một cạnh góc vuông của tam giác vuông kia thì hai tam giác vuông đó bằng nhau.",
            visual: {
              kind: "DIAGRAM_SPEC",
              spec: {
                version: 1,
                coordinateSystem: "CARTESIAN",
                viewBox: { minX: -1, minY: -1, width: 14, height: 5 },
                toScale: true,
                points: [
                  point("A", 0, 0, "A", "BOTTOM_LEFT"),
                  point("B", 4, 0, "B", "BOTTOM_RIGHT"),
                  point("C", 0, 3, "C", "TOP_LEFT"),
                  point("A_prime", 8, 0, "A′", "BOTTOM_LEFT"),
                  point("B_prime", 12, 0, "B′", "BOTTOM_RIGHT"),
                  point("C_prime", 8, 3, "C′", "TOP_LEFT"),
                ],
                primitives: [
                  segment("sAB", "A", "B"),
                  segment("sAC", "A", "C"),
                  segment("sBC", "B", "C"),
                  segment("sA1B1", "A_prime", "B_prime"),
                  segment("sA1C1", "A_prime", "C_prime"),
                  segment("sB1C1", "B_prime", "C_prime"),
                ],
                markers: [
                  { type: "RIGHT_ANGLE", vertex: "A", armPointIds: ["B", "C"] },
                  {
                    type: "RIGHT_ANGLE",
                    vertex: "A_prime",
                    armPointIds: ["B_prime", "C_prime"],
                  },
                  {
                    type: "EQUAL_LENGTH",
                    segmentIds: ["sBC", "sB1C1"],
                    markCount: 1,
                  },
                  {
                    type: "EQUAL_LENGTH",
                    segmentIds: ["sAB", "sA1B1"],
                    markCount: 2,
                  },
                ],
                labels: [],
                caption:
                  "Hai tam giác vuông có cạnh huyền và một cạnh góc vuông tương ứng bằng nhau.",
              },
            },
          },
          {
            type: "example",
            problem:
              "Cho tam giác $ABC$ vuông tại $B$ và tam giác $ADC$ vuông tại $D$. Biết $AB=AD$. Chứng minh $\\triangle ABC=\\triangle ADC$.",
            solution:
              "- $AC$ là cạnh huyền chung.\n- $AB=AD$.\n- Suy ra $\\triangle ABC=\\triangle ADC$ theo trường hợp cạnh huyền - cạnh góc vuông.",
            answer: "$\\triangle ABC=\\triangle ADC$.",
            visual: {
              kind: "DIAGRAM_SPEC",
              spec: {
                version: 1,
                coordinateSystem: "CARTESIAN",
                viewBox: { minX: -1, minY: -3.5, width: 7, height: 7 },
                toScale: true,
                points: [
                  point("A2", 0, 0, "A", "LEFT"),
                  point("C2", 5, 0, "C", "RIGHT"),
                  point("B2", 1.8, 2.4, "B", "TOP_LEFT"),
                  point("D2", 1.8, -2.4, "D", "BOTTOM_LEFT"),
                ],
                primitives: [
                  segment("sA2B2", "A2", "B2"),
                  segment("sB2C2", "B2", "C2"),
                  segment("sA2C2", "A2", "C2"),
                  segment("sA2D2", "A2", "D2"),
                  segment("sD2C2", "D2", "C2"),
                ],
                markers: [
                  {
                    type: "RIGHT_ANGLE",
                    vertex: "B2",
                    armPointIds: ["A2", "C2"],
                  },
                  {
                    type: "RIGHT_ANGLE",
                    vertex: "D2",
                    armPointIds: ["A2", "C2"],
                  },
                  {
                    type: "EQUAL_LENGTH",
                    segmentIds: ["sA2B2", "sA2D2"],
                    markCount: 1,
                  },
                ],
                labels: [],
                caption: "Minh họa trường hợp cạnh huyền - cạnh góc vuông.",
              },
            },
          },
        ],
      },
    ],
  };
}

function countDiagramVisuals(content: JsonRecord): number {
  const sections = content.sections as Array<{ blocks: Array<JsonRecord> }>;
  return sections.reduce(
    (count, section) =>
      count +
      section.blocks.filter(
        (block) =>
          (block.visual as { kind?: string } | undefined)?.kind === "DIAGRAM_SPEC",
      ).length,
    0,
  );
}

async function seedAdminSession(page: Page, theme: "light" | "dark") {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    role: "ADMIN",
    sub: "admin-user",
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(
    ({ session, selectedTheme }) => {
      window.localStorage.setItem("classhero.auth.session", JSON.stringify(session));
      window.localStorage.setItem("classhero-theme", selectedTheme);
    },
    {
      selectedTheme: theme,
      session: {
        accessToken,
        refreshToken: "refresh-token",
        remember: true,
        user: {
          email: "admin@classhero.test",
          fullName: "Nguyễn Admin",
          id: "admin-user",
          phone: null,
          role: "ADMIN",
          username: "admin",
        },
      },
    },
  );
}

async function setupMock(page: Page, content: JsonRecord) {
  const now = new Date().toISOString();
  const summary = {
    id: "summary-visual-review",
    lessonId,
    contentJson: {
      type: "lesson_summary_blocks",
      version: 2,
      data: content,
    },
    source: "AI",
    reviewStatus: "NEEDS_REVIEW",
    aiGenerationId: "generation-visual-review",
    createdAt: now,
    updatedAt: now,
  };
  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/v1", "");
    if (request.method() === "GET" && pathname === `/admin/lessons/${lessonId}`) {
      return fulfillJson(route, 200, {
        data: {
          id: lessonId,
          learningPathId: "path-math",
          chapterId: "chapter-diagrams",
          courseTitle: "Toán 3–9",
          chapterTitle: "Kiểm thử hình minh họa",
          orderIndex: 1,
          title: String(content.title),
          shortDescription: "Kiểm thử diagramSpec realtime.",
          lessonType: "BASIC",
          liveUrl: null,
          scheduledAt: null,
          examOpenAt: null,
          videoUrl: null,
          completionMinScore: 7,
          trialEnabled: false,
          status: "PUBLISHED",
          customVideoSettings: null,
        },
      });
    }
    if (request.method() === "GET" && pathname === "/admin/learning-paths/path-math") {
      return fulfillJson(route, 200, {
        data: {
          id: "path-math",
          title: "Toán 3–9",
          grade: 7,
          subject: "MATH",
          status: "PUBLISHED",
          chapters: [],
        },
      });
    }
    if (
      request.method() === "GET" &&
      pathname === `/admin/lessons/${lessonId}/ai-generation-panel`
    ) {
      return fulfillJson(route, 200, {
        data: {
          lesson: { id: lessonId, title: String(content.title), targetGrade: 7 },
          readiness: {
            summaryReady: true,
            generationReady: true,
            readyDocumentCount: 1,
            embeddedDocumentCount: 1,
            reason: null,
          },
          documents: [],
          jobs: { SUMMARY: null, QUIZ: null, FLASHCARD: null, TEST: null },
        },
      });
    }
    if (request.method() === "GET" && pathname === `/admin/lessons/${lessonId}/summary`) {
      return fulfillJson(route, 200, { data: summary });
    }
    if (
      request.method() === "GET" &&
      ["quiz-sets", "flashcard-sets", "test-sets"].some(
        (resource) => pathname === `/admin/lessons/${lessonId}/${resource}`,
      )
    ) {
      return fulfillJson(route, 200, { data: [] });
    }
    return fulfillJson(route, 404, {
      error: { code: "MOCK_NOT_FOUND", message: `${request.method()} ${pathname}` },
    });
  });
}

function createUnsignedToken(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
