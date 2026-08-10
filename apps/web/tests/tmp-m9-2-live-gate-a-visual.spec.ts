import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const selectedBatch = (
  process.env.M9_2_LIVE_SCREENSHOT_BATCH?.trim().toUpperCase() || "CALIBRATION"
) as "CALIBRATION" | "CORE" | "EDGE" | "ALL";
const screenshotRoot = path.join(
  repositoryRoot,
  "tmp/m9-2-v51-live-gate-a/screenshots/pending",
  selectedBatch.toLowerCase(),
);
const completeReviewArtifact = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "tmp/m9-2-v51-live-gate-a/review.json"),
    "utf8",
  ),
) as {
  examples: Array<{
    caseId: string;
    batch: "CALIBRATION" | "CORE" | "EDGE";
    title: string;
    problem: string;
    diagramSpec: unknown;
  }>;
};
const reviewArtifact = {
  examples: completeReviewArtifact.examples.filter(
    (example) => selectedBatch === "ALL" || example.batch === selectedBatch,
  ),
};
const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-live-gate-a-review";
const sourceChunkId = "22222222-2222-4222-8222-222222222222";

test.describe.configure({ mode: "serial" });

for (const theme of ["light", "dark"] as const) {
  test(`live Gate A ${selectedBatch.toLowerCase()} ${theme} passes layout checks`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(10 * 60_000);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await seedAdminSession(page, theme);
    await setupMock(page, buildSummary());
    await page.goto(`/admin/lessons/${lessonId}`);
    await page.getByRole("tab", { name: "Kiến thức" }).click();

    const diagrams = page.locator("figure").filter({ has: page.locator("svg") });
    await expect(diagrams).toHaveCount(reviewArtifact.examples.length, {
      timeout: 15_000,
    });
    const metrics = await collectLayoutMetrics(diagrams);
    expect(metrics.flatMap((metric) => metric.clippedText)).toEqual([]);
    expect(metrics.flatMap((metric) => metric.geometryOverlaps)).toEqual([]);
    expect(metrics.flatMap((metric) => metric.textOverlaps)).toEqual([]);
    expect(metrics.every((metric) => metric.width > 100 && metric.height > 30)).toBe(
      true,
    );

    const device = projectFolder(testInfo.project.name);
    const outputDirectory = path.join(screenshotRoot, device, theme);
    mkdirSync(outputDirectory, { recursive: true });
    for (const [index, example] of reviewArtifact.examples.entries()) {
      const diagram = diagrams.nth(index);
      await diagram.evaluate((figure) =>
        figure.scrollIntoView({ behavior: "auto", block: "center" }),
      );
      await isolateDiagramCapture(diagram);
      try {
        const screenshotPath = path.join(outputDirectory, `${example.caseId}.png`);
        await captureVerifiedDiagram(page, diagram, screenshotPath);
      } finally {
        await restoreDiagramCapture(diagram);
      }
    }

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client + 1);
    expect(await page.locator("[data-nextjs-dialog]").count()).toBe(0);
    expect(browserErrors).toEqual([]);
  });
}

function projectFolder(projectName: string) {
  const folders: Record<string, string> = {
    "chromium-mobile": "dien-thoai-chromium",
    "webkit-mobile": "dien-thoai-webkit",
    "chromium-tablet": "ipad",
    "chromium-desktop": "laptop",
  };
  const folder = folders[projectName];
  if (!folder) throw new Error(`Unsupported screenshot project ${projectName}.`);
  return folder;
}

async function captureVerifiedDiagram(
  page: Page,
  diagram: ReturnType<Page["locator"]>,
  screenshotPath: string,
) {
  await expect(diagram.locator("svg")).toBeVisible();
  let screenshotSize = 0;
  let uniqueColorCount = 0;
  let lumaStandardDeviation = 0;
  let contentVerticalSpanRatio = 0;
  let contentHorizontalSpanRatio = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await diagram.scrollIntoViewIfNeeded();
    await diagram.evaluate(async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    const screenshot = await diagram.screenshot({
      animations: "disabled",
      caret: "hide",
      path: screenshotPath,
      scale: "device",
    });
    screenshotSize = statSync(screenshotPath).size;
    const screenshotStats = await inspectScreenshotPixels(diagram, screenshot);
    uniqueColorCount = screenshotStats.uniqueColorCount;
    lumaStandardDeviation = screenshotStats.lumaStandardDeviation;
    contentVerticalSpanRatio = screenshotStats.contentVerticalSpanRatio;
    contentHorizontalSpanRatio = screenshotStats.contentHorizontalSpanRatio;
    if (
      screenshotSize > 4_000 &&
      uniqueColorCount > 12 &&
      lumaStandardDeviation > 0.035 &&
      (contentVerticalSpanRatio > 0.18 || contentHorizontalSpanRatio > 0.35)
    ) {
      return;
    }
    await page.waitForTimeout(120 * attempt);
  }
  expect(screenshotSize).toBeGreaterThan(4_000);
  expect(uniqueColorCount).toBeGreaterThan(12);
  expect(lumaStandardDeviation).toBeGreaterThan(0.035);
  expect(
    contentVerticalSpanRatio > 0.18 || contentHorizontalSpanRatio > 0.35,
  ).toBe(true);
}

async function inspectScreenshotPixels(
  diagram: ReturnType<Page["locator"]>,
  screenshot: Buffer,
) {
  return diagram.evaluate(async (_figure, encodedPng) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encodedPng}`;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to decode diagram screenshot."));
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return {
        uniqueColorCount: 0,
        lumaStandardDeviation: 0,
        contentVerticalSpanRatio: 0,
        contentHorizontalSpanRatio: 0,
      };
    }
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(1, Math.floor(Math.sqrt(pixels.length / 4 / 160_000)));
    const colors = new Set<number>();
    let sampleCount = 0;
    let meanLuma = 0;
    let lumaSquaredDifferenceSum = 0;
    for (let y = 0; y < canvas.height; y += stride) {
      for (let x = 0; x < canvas.width; x += stride) {
        const offset = (y * canvas.width + x) * 4;
        colors.add(
          (pixels[offset]! << 24) |
            (pixels[offset + 1]! << 16) |
            (pixels[offset + 2]! << 8) |
            pixels[offset + 3]!,
        );
        const luma =
          pixels[offset]! * 0.2126 +
          pixels[offset + 1]! * 0.7152 +
          pixels[offset + 2]! * 0.0722;
        sampleCount += 1;
        const delta = luma - meanLuma;
        meanLuma += delta / sampleCount;
        lumaSquaredDifferenceSum += delta * (luma - meanLuma);
      }
    }
    const lumaStandardDeviation =
      Math.sqrt(lumaSquaredDifferenceSum / Math.max(sampleCount, 1)) / 255;
    const contentThreshold = Math.max(18, lumaStandardDeviation * 255 * 0.55);
    let contentMinY = canvas.height;
    let contentMaxY = -1;
    let contentMinX = canvas.width;
    let contentMaxX = -1;
    for (let y = 0; y < canvas.height; y += stride) {
      for (let x = 0; x < canvas.width; x += stride) {
        const offset = (y * canvas.width + x) * 4;
        const luma =
          pixels[offset]! * 0.2126 +
          pixels[offset + 1]! * 0.7152 +
          pixels[offset + 2]! * 0.0722;
        if (Math.abs(luma - meanLuma) >= contentThreshold) {
          contentMinY = Math.min(contentMinY, y);
          contentMaxY = Math.max(contentMaxY, y);
          contentMinX = Math.min(contentMinX, x);
          contentMaxX = Math.max(contentMaxX, x);
        }
      }
    }
    return {
      uniqueColorCount: colors.size,
      lumaStandardDeviation,
      contentVerticalSpanRatio:
        contentMaxY < contentMinY ? 0 : (contentMaxY - contentMinY) / canvas.height,
      contentHorizontalSpanRatio:
        contentMaxX < contentMinX ? 0 : (contentMaxX - contentMinX) / canvas.width,
    };
  }, screenshot.toString("base64"));
}

function buildSummary() {
  return {
    lessonId,
    title: `Live Gate A ${selectedBatch.toLowerCase()}`,
    objectives: ["Kiểm tra hình live sau khi qua semantic compiler."],
    sections: [
      {
        order: 1,
        sourceHeading: `Live Gate A ${selectedBatch.toLowerCase()}`,
        displayHeading: `Live Gate A ${selectedBatch.toLowerCase()}`,
        sourceChunkIds: [sourceChunkId],
        blocks: reviewArtifact.examples.map((example) => ({
          type: "example",
          problem: `**${example.title}**\n\n${example.problem}`,
          solution: "Hình được sinh live và biên dịch deterministic.",
          answer: "Kiểm tra bằng contract và ảnh chụp đa thiết bị.",
          visual: { kind: "DIAGRAM_SPEC", spec: example.diagramSpec },
        })),
      },
    ],
  };
}

async function collectLayoutMetrics(diagrams: ReturnType<Page["locator"]>) {
  return diagrams.evaluateAll((figures) =>
    figures.map((figure, figureIndex) => {
      const svg = figure.querySelector("svg");
      if (!svg) {
        return {
          clippedText: ["missing-svg"],
          geometryOverlaps: ["missing-svg"],
          textOverlaps: ["missing-svg"],
          width: 0,
          height: 0,
        };
      }
      const svgBox = svg.getBoundingClientRect();
      const textNodes = [...svg.querySelectorAll("text")];
      const clippedText = textNodes.flatMap((text) => {
        const box = text.getBoundingClientRect();
        return box.left < svgBox.left - 2 ||
          box.right > svgBox.right + 2 ||
          box.top < svgBox.top - 2 ||
          box.bottom > svgBox.bottom + 2
          ? [
              `figure-${figureIndex + 1}:${text.textContent?.trim() || "(empty)"}:${box.x.toFixed(1)},${box.y.toFixed(1)},${box.width.toFixed(1)},${box.height.toFixed(1)}`,
            ]
          : [];
      });
      const geometries = [
        ...svg.querySelectorAll<SVGGeometryElement>(
          "line, path, polyline, polygon, circle, ellipse",
        ),
      ].filter((geometry) => !geometry.closest("defs"));
      const geometryOverlaps = textNodes.flatMap((text) => {
        if (text.getAttribute("data-diagram-container-label") === "true") return [];
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
              `figure-${figureIndex + 1}:${text.textContent?.trim() || "(empty)"}:${overlappingGeometry.tagName.toLowerCase()}[${overlappingGeometry.getAttribute("x1") ?? ""},${overlappingGeometry.getAttribute("y1") ?? ""}->${overlappingGeometry.getAttribute("x2") ?? ""},${overlappingGeometry.getAttribute("y2") ?? ""}]:${box.x.toFixed(1)},${box.y.toFixed(1)},${box.width.toFixed(1)},${box.height.toFixed(1)}`,
            ]
          : [];
      });
      const textOverlaps = textNodes.flatMap((text, textIndex) => {
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
        geometryOverlaps,
        textOverlaps,
        width: svgBox.width,
        height: svgBox.height,
      };
    }),
  );
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

async function setupMock(page: Page, content: Record<string, unknown>) {
  const now = new Date().toISOString();
  const summary = {
    id: "summary-live-gate-a",
    lessonId,
    contentJson: { type: "lesson_summary_blocks", version: 2, data: content },
    source: "AI",
    reviewStatus: "NEEDS_REVIEW",
    aiGenerationId: "generation-live-gate-a",
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
          shortDescription: "Kiểm thử diagramSpec live.",
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
