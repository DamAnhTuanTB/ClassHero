import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-08-03T08:00:00.000Z";
const model = {
  id: "model-openai",
  provider: "OPENAI",
  externalKey: "gpt-4.1-mini",
  displayName: "GPT-4.1 mini",
  capabilities: {
    features: ["SUMMARY", "QUIZ", "FLASHCARD", "TEST", "CHAT"],
    structuredOutput: true,
    aiConfiguration: "TEMPERATURE",
  },
  status: "ACTIVE",
  credentialConfigured: true,
};
const modelCatalog = [
  ["OPENAI", "gpt-5.6-sol", "GPT-5.6 Sol"],
  ["OPENAI", "gpt-5.6-terra", "GPT-5.6 Terra"],
  ["OPENAI", "gpt-5.6-luna", "GPT-5.6 Luna"],
  ["OPENAI", "gpt-5.4", "GPT-5.4"],
  ["OPENAI", "gpt-5.4-mini", "GPT-5.4 mini"],
  ["OPENAI", "gpt-5.4-nano", "GPT-5.4 nano"],
  ["OPENAI", "gpt-4.1", "GPT-4.1"],
  ["OPENAI", "gpt-4.1-nano", "GPT-4.1 nano"],
  ["GEMINI", "gemini-3.6-flash", "Gemini 3.6 Flash"],
  ["GEMINI", "gemini-3.5-flash", "Gemini 3.5 Flash"],
  ["GEMINI", "gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite"],
  ["GEMINI", "gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
  ["GEMINI", "gemini-2.5-pro", "Gemini 2.5 Pro"],
  ["GEMINI", "gemini-2.5-flash", "Gemini 2.5 Flash"],
  ["GEMINI", "gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite"],
] as const;
const models = [
  model,
  ...modelCatalog.map(([provider, externalKey, displayName]) => ({
    ...model,
    id: `model-${externalKey}`,
    provider,
    externalKey,
    displayName,
  })),
  {
    ...model,
    id: "model-text-embedding-3-small",
    externalKey: "text-embedding-3-small",
    displayName: "Text Embedding 3 Small",
    capabilities: { features: ["EMBEDDING"], dimensions: [1536] },
  },
];
const price = {
  id: "price-openai",
  billingMode: "TOKEN",
  currency: "USD",
  sourceUrl: "https://openai.com/api/pricing/",
  effectiveFrom: now,
  effectiveTo: null,
  createdAt: now,
  rates: [
    {
      id: "rate-input",
      metric: "INPUT_TOKEN",
      unitSize: 1_000_000,
      unitPriceUsd: 0.4,
      tierFrom: null,
      tierTo: null,
    },
    {
      id: "rate-cached",
      metric: "CACHED_INPUT_TOKEN",
      unitSize: 1_000_000,
      unitPriceUsd: 0.1,
      tierFrom: null,
      tierTo: null,
    },
    {
      id: "rate-output",
      metric: "OUTPUT_TOKEN",
      unitSize: 1_000_000,
      unitPriceUsd: 1.6,
      tierFrom: null,
      tierTo: null,
    },
  ],
};
const budgets = [
  {
    scope: "ALL",
    monthlyLimitVnd: 3_000_000,
    warningThresholds: [70, 90, 100],
    hardStop: false,
    version: 1,
    usedVnd: 245_000,
    reservedVnd: 25_000,
    availableVnd: 2_730_000,
    enforcementState: "MONITORING",
    usedPercent: 8.17,
    updatedAt: now,
  },
  {
    scope: "AI",
    monthlyLimitVnd: 2_000_000,
    warningThresholds: [70, 90, 100],
    hardStop: false,
    version: 1,
    usedVnd: 185_000,
    reservedVnd: 20_000,
    availableVnd: 1_795_000,
    enforcementState: "MONITORING",
    usedPercent: 9.25,
    updatedAt: now,
  },
  {
    scope: "OCR",
    monthlyLimitVnd: 1_000_000,
    warningThresholds: [70, 90, 100],
    hardStop: false,
    version: 1,
    usedVnd: 60_000,
    reservedVnd: 5_000,
    availableVnd: 935_000,
    enforcementState: "MONITORING",
    usedPercent: 6,
    updatedAt: now,
  },
];

test.describe("Admin Cài đặt AI", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
    await setupProviderOperationsMock(page);
  });

  test("đặt giới hạn input và output ở Thiết lập mặc định", async ({ page }) => {
    await page.goto("/admin/ai-settings");

    const featureNavigation = page.getByRole("navigation", {
      name: "Chọn tính năng cần thiết lập",
    });
    await expect(
      page.getByRole("heading", { name: "Tóm tắt video bằng AI" }),
    ).toBeVisible();
    await expect(featureNavigation.getByRole("button")).toHaveText([
      "Tóm tắt video bằng AI",
      "Sinh Kiến thức",
      "Sinh câu hỏi ôn tập",
      "Sinh thẻ ghi nhớ",
      "Sinh bài kiểm tra",
      "Chat với AI",
    ]);
    await expect(page.getByLabel("Giới hạn token đầu vào").first()).toHaveValue("200000");
    await expect(page.getByLabel("Giới hạn token đầu ra").first()).toHaveValue("4096");

    await page.getByRole("combobox", { name: "Mô hình thay thế" }).click();
    await page.getByRole("option", { name: "GPT-5.6 Sol" }).click();
    await expect(page.getByLabel("Giới hạn token đầu vào")).toHaveCount(2);
    const videoFallbackInputLimit = page
      .getByLabel("Giới hạn token đầu vào")
      .last();
    await expect(videoFallbackInputLimit).toHaveValue("200000");
    await videoFallbackInputLimit.fill("150000");

    await featureNavigation.getByRole("button", { name: "Sinh Kiến thức" }).click();
    const phaseOneCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Phase 1 · Tạo nội dung" }),
    });
    const phaseTwoCard = page.locator("article").filter({
      has: page.getByRole("heading", { name: "Phase 2 · Tạo hình" }),
    });
    const [phaseOneBox, phaseTwoBox] = await Promise.all([
      phaseOneCard.boundingBox(),
      phaseTwoCard.boundingBox(),
    ]);
    expect(phaseOneBox).not.toBeNull();
    expect(phaseTwoBox).not.toBeNull();
    if (!phaseOneBox || !phaseTwoBox) throw new Error("Không đo được hai card phase.");
    expect(phaseTwoBox.y).toBeGreaterThanOrEqual(phaseOneBox.y + phaseOneBox.height);

    await featureNavigation.getByRole("button", { name: "Chat với AI" }).click();
    await expect(page.getByRole("heading", { name: "Chat với AI" })).toBeVisible();
    await expect(page.getByText("Tạo câu trả lời", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Giới hạn token đầu vào")).toHaveValue("20000");
    const chatOutputLimit = page.getByLabel("Giới hạn token đầu ra").first();
    await expect(chatOutputLimit).toHaveValue("1200");
    await chatOutputLimit.fill("1500");

    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        response.url().endsWith("/admin/provider-operations/ai-configurations"),
    );
    await page.getByRole("button", { name: "Lưu thay đổi" }).click();
    const updateRequest = (await updateResponse).request();
    const updateBody = updateRequest.postDataJSON() as {
      configurations: Array<{
        feature: string;
        purpose: string;
        fallbackMaxInputTokens: number | null;
        maxOutputTokens: number;
      }>;
      chatSettings: {
        embeddingCatalogItemId: string;
        maxImagesPerMessage: number;
        maxImageBytes: number;
        studentDailyMessageLimit: number;
        studentDailyImageLimit: number;
      };
    };
    expect(updateBody.configurations).toHaveLength(10);
    expect(
      updateBody.configurations.find(
        (configuration) =>
          configuration.feature === "CHAT" && configuration.purpose === "TEXT",
      ),
    ).toMatchObject({ maxOutputTokens: 1500 });
    expect(
      updateBody.configurations.find(
        (configuration) =>
          configuration.feature === "VIDEO_SUMMARY" &&
          configuration.purpose === "TEXT",
      ),
    ).toMatchObject({ fallbackMaxInputTokens: 150000 });
    expect(updateBody.chatSettings).toMatchObject({
      embeddingCatalogItemId: "model-text-embedding-3-small",
      maxImagesPerMessage: 5,
      maxImageBytes: 10 * 1024 * 1024,
      studentDailyMessageLimit: 20,
      studentDailyImageLimit: 20,
    });

    await page.getByRole("tab", { name: "Quản lý model" }).click();
    await expect(page.getByLabel("Giới hạn token đầu vào")).toHaveCount(0);
    await expect(page.getByLabel("Giới hạn token đầu ra")).toHaveCount(0);
  });

  for (const theme of ["light", "dark"] as const) {
    test(`hiển thị cấu hình model, chi phí và quản lý model ở theme ${theme}`, async ({
      page,
    }) => {
      await page.addInitScript((initialTheme) => {
        window.localStorage.setItem("classhero-theme", initialTheme);
      }, theme);
      await page.goto("/admin/ai-settings");

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("heading", { name: "Cài đặt AI" })).toBeVisible();
      await expect(page.getByText("Chi phí tháng này")).toBeVisible();
      await expect(page.getByText("245.000 VNĐ")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sinh câu hỏi ôn tập" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Sinh câu hỏi ôn tập" }).click();
      await expect(
        page.getByRole("heading", { name: "Sinh câu hỏi ôn tập" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
      await expect(page.getByLabel("Giới hạn token đầu vào").first()).toHaveValue(
        "200000",
      );
      await expect(page.getByLabel("Giới hạn token đầu ra").first()).toHaveValue("4096");
      await page.getByRole("combobox", { name: "Mô hình chính" }).first().click();
      await expect(page.getByRole("option", { name: "GPT-5.6 Terra" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Gemini 3.6 Flash" })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.getByRole("tab", { name: "Chi phí sử dụng" }).click();
      await expect(
        page.getByRole("heading", { name: "Chi phí theo thời gian" }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Ngân sách tháng" })).toBeVisible();
      const budgetFields = page.getByLabel("Mức chi tối đa mỗi tháng");
      await expect(budgetFields).toHaveCount(3);
      await expect(budgetFields.nth(0)).toHaveValue("3.000.000");
      await expect(budgetFields.nth(1)).toHaveValue("2.000.000");
      await expect(budgetFields.nth(2)).toHaveValue("1.000.000");
      await expect(budgetFields.nth(0).locator("..").getByText("VNĐ")).toBeVisible();
      const allServicesBudget = page.locator("article").filter({
        has: page.getByText("Tất cả dịch vụ", { exact: true }),
      });
      await expect(allServicesBudget.getByText("Đang giữ")).toBeVisible();
      await expect(allServicesBudget.getByText("25.000 VNĐ")).toBeVisible();
      await expect(allServicesBudget.getByText("Còn lại")).toBeVisible();
      await expect(allServicesBudget.getByText("2.730.000 VNĐ")).toBeVisible();
      await budgetFields.nth(0).fill("3500000");
      await expect(budgetFields.nth(0)).toHaveValue("3.500.000");
      await expect(
        page.getByRole("img", { name: "Biểu đồ chi phí sử dụng" }),
      ).toBeVisible();
      await expect(page.getByText("GPT-4.1 mini").last()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Tất cả lượt gọi provider" }),
      ).toBeVisible();
      await expect(page.getByText("Tạo hình minh họa · Thành công")).toBeVisible();
      await expect(page.getByText("Tổng 7 lượt: 8.614 VNĐ")).toBeVisible();

      await page.getByRole("tab", { name: "Quản lý model" }).click();
      await expect(
        page.getByRole("heading", { name: "OpenAI", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Gemini", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "GPT-4.1 mini" })).toBeVisible();
      await expect(page.getByText("≈ 10.200 VNĐ").first()).toBeVisible();

      await page.getByRole("button", { name: "Cập nhật giá" }).first().click();
      const dialog = page.getByRole("dialog", {
        name: "Cập nhật giá GPT-4.1 mini",
      });
      await expect(dialog).toBeVisible();
      await expectDialogFitsViewport(page, dialog);
      await dialog.getByLabel("Giá (USD)").first().fill("0.5");
      await dialog.getByRole("button", { name: "Lưu bảng giá" }).click();
      await expect(dialog).toBeHidden();

      await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
      await expectNoHorizontalOverflow(page);
    });
  }
});

async function expectDialogFitsViewport(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
) {
  const viewport = page.viewportSize();
  const clientViewport = await page.evaluate(() => ({
    height: document.documentElement.clientHeight,
    width: document.documentElement.clientWidth,
  }));
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.height).toBeLessThanOrEqual(viewport.height - 24);
  await expect
    .poll(async () => {
      const currentBox = await dialog.boundingBox();
      return currentBox
        ? Math.abs(currentBox.x + currentBox.width / 2 - clientViewport.width / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(8);
  await expect
    .poll(async () => {
      const currentBox = await dialog.boundingBox();
      return currentBox
        ? Math.abs(currentBox.y + currentBox.height / 2 - clientViewport.height / 2)
        : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(8);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function seedAdminSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    role: "ADMIN",
    sub: "admin-user",
  });
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(
    (session) => {
      window.localStorage.setItem("classhero.auth.session", JSON.stringify(session));
    },
    {
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
  );
}

async function setupProviderOperationsMock(page: Page) {
  await page.route("**/api/v1/admin/provider-operations/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() === "POST" && path.endsWith("/price-versions")) {
      return fulfillJson(route, 201, { data: price });
    }
    if (path.endsWith("/overview"))
      return fulfillJson(route, 200, {
        data: {
          period: { from: "2026-08-01", to: "2026-08-31" },
          totalCostVnd: 245_000,
          savedCostVnd: 35_000,
          calls: 128,
          successCount: 126,
          failedCount: 2,
          successRate: 98.44,
          budgets,
          accounting: accounting(),
          latestUsageAt: now,
        },
      });
    if (path.endsWith("/ai-configurations"))
      return fulfillJson(route, 200, {
        data: {
          configurations: [
            ...["SUMMARY", "QUIZ", "FLASHCARD", "TEST"].flatMap((feature) =>
              ["TEXT", "IMAGE"].map((purpose) => ({
                feature,
                purpose,
                primaryCatalogItemId: model.id,
                fallbackCatalogItemId: null,
                temperature: 0.2,
                reasoningEffort: null,
                maxInputTokens: 200_000,
                maxOutputTokens: 4096,
                fallbackTemperature: null,
                fallbackReasoningEffort: null,
                fallbackMaxInputTokens: null,
                fallbackMaxOutputTokens: null,
                version: 1,
                updatedAt: now,
              })),
            ),
            {
              feature: "VIDEO_SUMMARY",
              purpose: "TEXT",
              primaryCatalogItemId: model.id,
              fallbackCatalogItemId: null,
              temperature: 0.2,
              reasoningEffort: null,
              maxInputTokens: 200_000,
              maxOutputTokens: 4096,
              fallbackTemperature: null,
              fallbackReasoningEffort: null,
              fallbackMaxInputTokens: null,
              fallbackMaxOutputTokens: null,
              version: 1,
              updatedAt: now,
            },
            {
              feature: "CHAT",
              purpose: "TEXT",
              primaryCatalogItemId: model.id,
              fallbackCatalogItemId: null,
              temperature: 0.2,
              reasoningEffort: null,
              maxInputTokens: 20_000,
              maxOutputTokens: 1_200,
              fallbackTemperature: null,
              fallbackReasoningEffort: null,
              fallbackMaxInputTokens: null,
              fallbackMaxOutputTokens: null,
              version: 1,
              updatedAt: now,
            },
          ],
          models,
          chatSettings: {
            embeddingCatalogItemId: "model-text-embedding-3-small",
            embeddingProvider: "OPENAI",
            embeddingModel: "text-embedding-3-small",
            embeddingDimensions: 1536,
            maxImagesPerMessage: 5,
            maxImageBytes: 10 * 1024 * 1024,
            allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
            studentDailyMessageLimit: 20,
            studentDailyImageLimit: 20,
            version: 1,
          },
        },
      });
    if (path.endsWith("/ocr-settings"))
      return fulfillJson(route, 200, {
        data: {
          provider: "MATHPIX",
          paidEnabled: true,
          cacheEnabled: true,
          credentialConfigured: true,
          monthlyBudgetVnd: 1_000_000,
          hardStop: false,
          accounting: accounting(),
          services: [
            {
              id: "ocr-mathpix",
              provider: "MATHPIX",
              displayName: "Mathpix PDF OCR",
              externalKey: "mathpix-pdf",
              status: "ACTIVE",
              latestPrice: {
                ...price,
                id: "price-ocr",
                billingMode: "PAGE",
                sourceUrl: "https://mathpix.com/pricing",
                rates: [
                  {
                    id: "rate-page",
                    metric: "PAGE",
                    unitSize: 1,
                    unitPriceUsd: 0.005,
                    tierFrom: 0,
                    tierTo: null,
                  },
                ],
              },
            },
          ],
        },
      });
    if (path.endsWith("/budgets")) return fulfillJson(route, 200, { data: budgets });
    if (path.endsWith("/usage/timeline"))
      return fulfillJson(route, 200, {
        data: {
          from: "2026-07-05",
          to: "2026-08-03",
          granularity: url.searchParams.get("granularity") ?? "DAY",
          points: [
            {
              bucket: "03/08",
              costVnd: 25_000,
              savedCostVnd: 3_000,
              calls: 12,
              failed: 0,
              totalTokens: 42_000,
              pages: 8,
            },
          ],
        },
      });
    if (path.endsWith("/usage/breakdown"))
      return fulfillJson(route, 200, {
        data: [
          {
            category: "AI_MODEL",
            provider: "OPENAI",
            catalogItemId: model.id,
            model: { displayName: model.displayName, externalKey: model.externalKey },
            feature: "QUIZ",
            calls: 12,
            costVnd: 25_000,
            savedCostVnd: 3_000,
            totalTokens: 42_000,
            pages: 0,
          },
        ],
      });
    if (path.endsWith("/usage/events"))
      return fulfillJson(route, 200, {
        data: {
          items: [
            {
              id: "usage-1",
              category: "AI_MODEL",
              provider: "OPENAI",
              feature: "QUIZ",
              status: "SUCCEEDED",
              cacheStatus: null,
              totalTokens: 3_500,
              pages: 0,
              costVnd: 2_100,
              estimatedSavedCostVnd: 0,
              latencyMs: 850,
              createdAt: now,
              backgroundJob: {
                queue: "DIAGRAM_RENDERING",
                resourceType: "STEM_FIGURE",
              },
              aiGeneration: {
                id: "generation-1",
                type: "SUMMARY",
                totalCostVnd: 8_614,
                usageEventCount: 7,
              },
              catalogItem: {
                displayName: model.displayName,
                externalKey: model.externalKey,
              },
            },
          ],
          pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        },
      });
    if (path.endsWith("/catalog"))
      return fulfillJson(route, 200, {
        data: [
          {
            ...model,
            category: "AI_MODEL",
            priceVersions: [price],
            deprecationNote: null,
            updatedAt: now,
          },
          {
            ...model,
            id: "model-gemini",
            provider: "GEMINI",
            externalKey: "gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
            category: "AI_MODEL",
            priceVersions: [
              {
                ...price,
                id: "price-gemini",
                sourceUrl: "https://ai.google.dev/gemini-api/docs/pricing",
              },
            ],
            deprecationNote: null,
            updatedAt: now,
          },
        ],
      });
    if (path.endsWith("/audit-history"))
      return fulfillJson(route, 200, {
        data: [
          {
            id: "audit-1",
            action: "PROVIDER_PRICE_VERSION_CREATED",
            entityType: "PROVIDER_PRICE_VERSION",
            actorUserId: "admin-user",
            createdAt: now,
          },
        ],
      });
    return fulfillJson(route, 404, { error: { code: "MOCK_NOT_FOUND", message: path } });
  });
}

function accounting() {
  return {
    timezone: "Asia/Ho_Chi_Minh",
    weekStartsOn: 1,
    fxRateVndPerUsd: 25_500,
    priceFreshnessDays: 30,
    version: 1,
    updatedAt: now,
  };
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

function createUnsignedToken(payload: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}
