import { mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page, type Route } from "@playwright/test";

const repositoryRoot = path.resolve(process.cwd(), "../..");
const selectedCaseIds = new Set(
  (process.env.M9_2_GATE_B_SCREENSHOT_CASES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const reviewArtifact = JSON.parse(
  readFileSync(
    path.join(repositoryRoot, "tmp/m9-2-v51-live-gate-b/review.json"),
    "utf8",
  ),
) as {
  lessons: Array<{
    caseId: string;
    compilerFingerprint: string;
    lesson: { caseId: string; grade: number; title: string };
    persistedOutput: LessonSummary;
  }>;
};
const selectedLessons = reviewArtifact.lessons.filter(
  (artifact) =>
    selectedCaseIds.size === 0 || selectedCaseIds.has(artifact.lesson.caseId),
);
const screenshotRoot = path.join(
  repositoryRoot,
  "tmp/m9-2-v51-live-gate-b/screenshots/pending",
);
const apiBaseUrl = "http://localhost:4000/api/v1";

type SummaryBlock = {
  type: string;
  visual?: { kind: string; spec?: unknown };
};

type LessonSummary = {
  lessonId: string;
  title: string;
  sections: Array<{
    blocks: SummaryBlock[];
  }>;
};

test.describe.configure({ mode: "serial" });

for (const theme of ["light", "dark"] as const) {
  test(`live Gate B full lessons ${theme} pass layout checks`, async ({ page }, testInfo) => {
    test.setTimeout(10 * 60_000);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await seedAdminSession(page, theme);

    for (const artifact of selectedLessons) {
      const lessonId = `lesson-${artifact.lesson.caseId}`;
      await setupMock(page, artifact.persistedOutput, lessonId, artifact.lesson.grade);
      await page.goto(`/admin/lessons/${lessonId}`);
      await page.getByRole("tab", { name: "Kiến thức" }).click();

      const visualBlocks = artifact.persistedOutput.sections.flatMap((section) =>
        section.blocks.filter((block) => block.visual?.kind === "DIAGRAM_SPEC"),
      );
      const diagrams = page.locator("figure").filter({ has: page.locator("svg") });
      await expect(diagrams).toHaveCount(visualBlocks.length, { timeout: 20_000 });
      const metrics = await collectLayoutMetrics(diagrams);
      await expect(
        diagrams.locator('[data-diagram-arrowhead="true"][fill="context-stroke"]'),
      ).toHaveCount(0);
      if (theme === "dark") {
        const arrowheadFills = await diagrams
          .locator('[data-diagram-arrowhead="true"]')
          .evaluateAll((arrowheads) =>
            arrowheads.map((arrowhead) => getComputedStyle(arrowhead).fill),
          );
        expect(arrowheadFills.every((fill) => fill !== "rgb(0, 0, 0)")).toBe(true);
      }

      const device = projectFolder(testInfo.project.name);
      const outputDirectory = path.join(
        screenshotRoot,
        artifact.lesson.caseId,
        artifact.compilerFingerprint,
        device,
        theme,
      );
      mkdirSync(outputDirectory, { recursive: true });
      for (const [index, block] of visualBlocks.entries()) {
        const diagram = diagrams.nth(index);
        await diagram.evaluate((figure) =>
          figure.scrollIntoView({ behavior: "auto", block: "center" }),
        );
        await isolateDiagramCapture(diagram);
        try {
          const screenshotPath = path.join(
            outputDirectory,
            `${String(index + 1).padStart(2, "0")}-${block.type}.png`,
          );
          await captureVerifiedDiagram(page, diagram, screenshotPath);
        } finally {
          await restoreDiagramCapture(diagram);
        }
      }
      expect(metrics.every((metric) => metric.clippedText === 0)).toBe(true);
      expect(metrics.flatMap((metric) => metric.geometryOverlaps)).toEqual([]);
      expect(metrics.flatMap((metric) => metric.textOverlaps)).toEqual([]);
      expect(metrics.every((metric) => metric.width > 100 && metric.height > 30)).toBe(
        true,
      );

      const pageWidth = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client + 1);
      await page.unroute(`${apiBaseUrl}/**`);
    }
    expect(await page.locator("[data-nextjs-dialog]").count()).toBe(0);
    expect(browserErrors).toEqual([]);
  });
}

async function captureVerifiedDiagram(
  page: Page,
  diagram: ReturnType<Page["locator"]>,
  screenshotPath: string,
) {
  const svg = diagram.locator("svg");
  await expect(svg).toBeVisible();
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

async function collectLayoutMetrics(diagrams: ReturnType<Page["locator"]>) {
  return diagrams.evaluateAll((figures) =>
    figures.map((figure, figureIndex) => {
      const svg = figure.querySelector("svg");
      if (!svg) {
        return {
          clippedText: 1,
          geometryOverlaps: ["missing-svg"],
          textOverlaps: ["missing-svg"],
          width: 0,
          height: 0,
        };
      }
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
          ? [`figure-${figureIndex + 1}:${text.textContent?.trim() || "(empty)"}`]
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

async function setupMock(
  page: Page,
  content: LessonSummary,
  lessonId: string,
  grade: number,
) {
  const now = new Date().toISOString();
  const summary = {
    id: `summary-${lessonId}`,
    lessonId,
    contentJson: { type: "lesson_summary_blocks", version: 2, data: content },
    source: "AI",
    reviewStatus: "NEEDS_REVIEW",
    aiGenerationId: `generation-${lessonId}`,
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
          courseTitle: `Toán ${grade}`,
          chapterTitle: "Kiểm thử bài thật",
          orderIndex: 1,
          title: content.title,
          shortDescription: "Kiểm thử full lesson diagramSpec live.",
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
          title: `Toán ${grade}`,
          grade,
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
          lesson: { id: lessonId, title: content.title, targetGrade: grade },
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
