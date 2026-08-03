import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-08-03T08:00:00.000Z";
const model = {
  id: "model-openai",
  provider: "OPENAI",
  externalKey: "gpt-4.1-mini",
  displayName: "GPT-4.1 mini",
  capabilities: { structuredOutput: true },
  status: "ACTIVE",
  credentialConfigured: true,
};
const price = {
  id: "price-openai",
  billingMode: "TOKEN",
  currency: "USD",
  sourceUrl: "https://openai.com/api/pricing/",
  effectiveFrom: now,
  effectiveTo: null,
  createdAt: now,
  rates: [
    { id: "rate-input", metric: "INPUT_TOKEN", unitSize: 1_000_000, unitPriceUsd: 0.4, tierFrom: null, tierTo: null },
    { id: "rate-cached", metric: "CACHED_INPUT_TOKEN", unitSize: 1_000_000, unitPriceUsd: 0.1, tierFrom: null, tierTo: null },
    { id: "rate-output", metric: "OUTPUT_TOKEN", unitSize: 1_000_000, unitPriceUsd: 1.6, tierFrom: null, tierTo: null },
  ],
};
const budgets = [
  { scope: "ALL", monthlyLimitVnd: 3_000_000, warningThresholds: [70, 90, 100], hardStop: false, version: 1, usedVnd: 245_000, usedPercent: 8.17, updatedAt: now },
  { scope: "AI", monthlyLimitVnd: 2_000_000, warningThresholds: [70, 90, 100], hardStop: false, version: 1, usedVnd: 185_000, usedPercent: 9.25, updatedAt: now },
  { scope: "OCR", monthlyLimitVnd: 1_000_000, warningThresholds: [70, 90, 100], hardStop: false, version: 1, usedVnd: 60_000, usedPercent: 6, updatedAt: now },
];

test.describe("Admin Cài đặt AI", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
    await setupProviderOperationsMock(page);
  });

  test("hiển thị cấu hình model, OCR, chi phí và bảng giá", async ({ page }) => {
    await page.goto("/admin/ai-settings");

    await expect(page.getByRole("heading", { name: "Cài đặt AI" })).toBeVisible();
    await expect(page.getByText("Chi phí tháng này")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sinh quiz" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Lưu cấu hình model" })).toBeEnabled();

    await page.getByRole("tab", { name: "OCR & tài liệu" }).click();
    await expect(page.getByText("Mathpix credential")).toBeVisible();
    await expect(page.getByText("Giá OCR hiện tại")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lưu thiết lập OCR" })).toBeEnabled();

    await page.getByRole("tab", { name: "Chi phí & sử dụng" }).click();
    await expect(page.getByRole("heading", { name: "Chi phí theo thời gian" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ngân sách tháng" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Biểu đồ chi phí provider" })).toBeVisible();
    await expect(page.getByText("GPT-4.1 mini").last()).toBeVisible();

    await page.getByRole("tab", { name: "Bảng giá provider" }).click();
    await expect(page.getByRole("heading", { name: "GPT-4.1 mini" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nguồn giá chính thức" })).toHaveAttribute("href", "https://openai.com/api/pricing/");
    await expect(page.getByRole("heading", { name: "Lịch sử thay đổi" })).toBeVisible();

    await page.getByRole("button", { name: "Thêm phiên bản giá" }).first().click();
    const dialog = page.getByRole("dialog", { name: "GPT-4.1 mini" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Lưu phiên bản giá" }).click();
    await expect(dialog).toBeHidden();

    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});

async function seedAdminSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    role: "ADMIN",
    sub: "admin-user",
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript((session) => {
    window.localStorage.setItem("classhero.auth.session", JSON.stringify(session));
  }, {
    accessToken,
    refreshToken: "refresh-token",
    remember: true,
    user: { email: "admin@classhero.test", fullName: "Nguyễn Admin", id: "admin-user", phone: null, role: "ADMIN", username: "admin" },
  });
}

async function setupProviderOperationsMock(page: Page) {
  await page.route("**/api/v1/admin/provider-operations/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === "POST" && path.endsWith("/price-versions")) {
      return fulfillJson(route, 201, { data: price });
    }
    if (path.endsWith("/overview")) return fulfillJson(route, 200, { data: { period: { from: "2026-08-01", to: "2026-08-31" }, totalCostVnd: 245_000, savedCostVnd: 35_000, calls: 128, successCount: 126, failedCount: 2, successRate: 98.44, budgets, accounting: accounting(), latestUsageAt: now } });
    if (path.endsWith("/ai-configurations")) return fulfillJson(route, 200, { data: { configurations: ["SUMMARY", "QUIZ", "FLASHCARD", "TEST"].map((feature) => ({ feature, primaryCatalogItemId: model.id, fallbackCatalogItemId: null, temperature: 0.2, maxOutputTokens: 4096, version: 1, updatedAt: now })), models: [model] } });
    if (path.endsWith("/ocr-settings")) return fulfillJson(route, 200, { data: { provider: "MATHPIX", paidEnabled: true, cacheEnabled: true, credentialConfigured: true, monthlyBudgetVnd: 1_000_000, hardStop: false, accounting: accounting(), services: [{ id: "ocr-mathpix", provider: "MATHPIX", displayName: "Mathpix PDF OCR", externalKey: "mathpix-pdf", status: "ACTIVE", latestPrice: { ...price, id: "price-ocr", billingMode: "PAGE", sourceUrl: "https://mathpix.com/pricing", rates: [{ id: "rate-page", metric: "PAGE", unitSize: 1, unitPriceUsd: 0.005, tierFrom: 0, tierTo: null }] } }] } });
    if (path.endsWith("/budgets")) return fulfillJson(route, 200, { data: budgets });
    if (path.endsWith("/usage/timeline")) return fulfillJson(route, 200, { data: { from: "2026-07-05", to: "2026-08-03", granularity: url.searchParams.get("granularity") ?? "DAY", points: [{ bucket: "03/08", costVnd: 25_000, savedCostVnd: 3_000, calls: 12, failed: 0, totalTokens: 42_000, pages: 8 }] } });
    if (path.endsWith("/usage/breakdown")) return fulfillJson(route, 200, { data: [{ category: "AI_MODEL", provider: "OPENAI", catalogItemId: model.id, model: { displayName: model.displayName, externalKey: model.externalKey }, feature: "QUIZ", calls: 12, costVnd: 25_000, savedCostVnd: 3_000, totalTokens: 42_000, pages: 0 }] });
    if (path.endsWith("/usage/events")) return fulfillJson(route, 200, { data: { items: [{ id: "usage-1", category: "AI_MODEL", provider: "OPENAI", feature: "QUIZ", status: "SUCCEEDED", cacheStatus: null, totalTokens: 3_500, pages: 0, costVnd: 2_100, estimatedSavedCostVnd: 0, latencyMs: 850, createdAt: now, catalogItem: { displayName: model.displayName, externalKey: model.externalKey } }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } });
    if (path.endsWith("/catalog")) return fulfillJson(route, 200, { data: [{ ...model, category: "AI_MODEL", priceVersions: [price], deprecationNote: null, updatedAt: now }] });
    if (path.endsWith("/audit-history")) return fulfillJson(route, 200, { data: [{ id: "audit-1", action: "PROVIDER_PRICE_VERSION_CREATED", entityType: "PROVIDER_PRICE_VERSION", actorUserId: "admin-user", createdAt: now }] });
    return fulfillJson(route, 404, { error: { code: "MOCK_NOT_FOUND", message: path } });
  });
}

function accounting() {
  return { timezone: "Asia/Ho_Chi_Minh", weekStartsOn: 1, fxRateVndPerUsd: 25_500, priceFreshnessDays: 30, version: 1, updatedAt: now };
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({ body: JSON.stringify(body), contentType: "application/json", status });
}

function createUnsignedToken(payload: Record<string, unknown>) {
  return [Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"), Buffer.from(JSON.stringify(payload)).toString("base64url"), "signature"].join(".");
}
