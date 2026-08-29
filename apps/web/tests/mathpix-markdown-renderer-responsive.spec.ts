import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const rendererStyles = readFileSync(
  resolve(process.cwd(), "components/shared/mathpix-markdown-renderer.css"),
  "utf8",
);
const mathContentStyles = readFileSync(
  resolve(process.cwd(), "components/common/content/math-content-typography.css"),
  "utf8",
);

test("lets KaTeX inherit the weight of bold Math, Physics, and Chemistry headings", () => {
  expect(rendererStyles).toContain(".mmd-content--inherit-math-weight .katex");
  expect(mathContentStyles).toContain(
    ".math-content-typography--inherit-math-weight .katex",
  );
  expect(rendererStyles).toMatch(
    /\.mmd-content--inherit-math-weight \.katex\s*\{\s*font-weight: inherit;/u,
  );
  expect(mathContentStyles).toMatch(
    /\.math-content-typography--inherit-math-weight \.katex\s*\{\s*font-weight: inherit;/u,
  );
});

test("keeps a wide display formula readable and scrolls only its local block", async ({
  page,
}) => {
  await page.setContent(`
    <style>${rendererStyles}</style>
    <main class="mmd-content" style="width: 300px">
      <div class="math-block" data-testid="wide-formula">
        <mjx-container jax="SVG" display="true">
          <svg width="800" height="40" viewBox="0 0 800 40"></svg>
        </mjx-container>
      </div>
    </main>
  `);

  const metrics = await page.getByTestId("wide-formula").evaluate((element) => {
    const formula = element.querySelector("svg");
    if (!formula) throw new Error("Missing formula SVG");
    return {
      blockClientWidth: element.clientWidth,
      blockScrollWidth: element.scrollWidth,
      formulaWidth: formula.getBoundingClientRect().width,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
    };
  });

  expect(metrics.formulaWidth).toBe(800);
  expect(metrics.formulaWidth).toBeGreaterThan(metrics.blockClientWidth);
  expect(metrics.blockScrollWidth).toBeGreaterThan(metrics.blockClientWidth);
  expect(metrics.pageScrollWidth).toBe(metrics.pageClientWidth);
});

test("keeps a short display formula centered without forcing horizontal scroll", async ({
  page,
}) => {
  await page.setContent(`
    <style>${rendererStyles}</style>
    <main class="mmd-content" style="width: 300px">
      <div class="math-block" data-testid="short-formula">
        <mjx-container jax="SVG" display="true">
          <svg width="120" height="40" viewBox="0 0 120 40"></svg>
        </mjx-container>
      </div>
    </main>
  `);

  const metrics = await page.getByTestId("short-formula").evaluate((element) => {
    const formula = element.querySelector("svg");
    if (!formula) throw new Error("Missing formula SVG");
    const blockRect = element.getBoundingClientRect();
    const formulaRect = formula.getBoundingClientRect();
    return {
      blockClientWidth: element.clientWidth,
      blockScrollWidth: element.scrollWidth,
      leftGap: formulaRect.left - blockRect.left,
      rightGap: blockRect.right - formulaRect.right,
    };
  });

  expect(metrics.blockScrollWidth).toBe(metrics.blockClientWidth);
  expect(Math.abs(metrics.leftGap - metrics.rightGap)).toBeLessThan(1);
});
