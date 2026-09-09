import { expect, test, type Page, type Route } from "@playwright/test";
import { serializeAdminAiGenerationPayload } from "@/features/admin/ai-generation/api/admin-ai-generation-api";
import type { AdminTestGenerationPayload } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-tests-m6-4";

test("Test AI payload only carries the Test target and shared Quiz generation fields", () => {
  const payload = {
    type: "TEST",
    targetQuizSetId: "legacy-quiz-target",
    targetTestSetId: "test-set-1",
    durationSeconds: 900,
    difficultyRatioJson: { EASY: 20, MEDIUM: 60, HARD: 20 },
    documentIds: ["document-1"],
    questionCount: 10,
    difficulty: "MIXED",
    questionTypes: ["MULTIPLE_CHOICE"],
    style: "student_friendly",
  } as AdminTestGenerationPayload & {
    difficultyRatioJson: Record<string, number>;
    durationSeconds: number;
    targetQuizSetId: string;
  };

  expect(serializeAdminAiGenerationPayload(payload)).toEqual({
    targetTestSetId: "test-set-1",
    documentIds: ["document-1"],
    questionCount: 10,
    difficulty: "MIXED",
    questionTypes: ["MULTIPLE_CHOICE"],
    style: "student_friendly",
  });
});

test("admin creates a timed test set and a question from lesson detail", async ({
  page,
}) => {
  await seedAdminSession(page);
  await setupTestsApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Test" }).click();

  await expect(page.getByRole("heading", { name: "Quản lý Bài kiểm tra" })).toBeVisible();
  await page.getByRole("button", { name: "Thêm bộ đề" }).click();

  const setDialog = page.getByRole("dialog", { name: "Thêm bộ đề" });
  await expect(setDialog.getByLabel("Tên bộ đề")).toHaveValue("Bộ đề 1");
  await expect(setDialog.getByLabel("Thời gian làm bài (phút)")).toHaveValue("15");
  await setDialog.getByLabel("Thời gian làm bài (phút)").fill("20");
  await setDialog.getByRole("button", { name: "Thêm bộ đề" }).click();

  await expect(page.getByRole("tab", { name: /Bộ đề 1/ })).toBeVisible();
  await expect(page.getByText("20 phút", { exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Hành động bộ Test" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Thêm bộ đề" }).click();
  await expect(setDialog.getByLabel("Tên bộ đề")).toHaveValue("Bộ đề 2");
  await setDialog.getByRole("button", { name: "Thêm bộ đề" }).click();

  const testTabs = page.getByRole("tablist", { name: "Các bộ đề" }).getByRole("tab");
  await expect(testTabs).toHaveCount(2);
  await expect(testTabs.nth(0)).toContainText("Bộ đề 1");
  await expect(testTabs.nth(1)).toContainText("Bộ đề 2");
  await expect(testTabs.nth(1)).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Thêm câu hỏi" }).first().click();
  const questionDialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  await expect(questionDialog.getByText("Hình đề", { exact: true })).toBeVisible();
  await expect(questionDialog.getByText("Hình lời giải", { exact: true })).toBeVisible();
  await questionDialog.getByLabel("Loại câu hỏi").click();
  await expect(
    page.getByRole("option", { name: "Đúng / Sai nhiều mệnh đề" }),
  ).toBeVisible();
  await page.getByRole("option", { name: "Đúng / Sai nhiều mệnh đề" }).click();
  await questionDialog
    .getByRole("textbox", { name: "Nội dung câu hỏi" })
    .fill("Xác định tính đúng sai của các mệnh đề sau.");
  await questionDialog
    .getByRole("textbox", { name: "Nội dung mệnh đề 1" })
    .fill("Số 2 là số chẵn.");
  await questionDialog
    .getByRole("textbox", { name: "Nội dung mệnh đề 2" })
    .fill("Số 3 là số chẵn.");
  await questionDialog.getByRole("button", { name: "Sai" }).nth(1).click();
  await questionDialog.getByRole("button", { name: "Thêm câu hỏi" }).click();

  await expect(questionDialog).toBeHidden();
  await expect(
    page
      .getByTestId("quiz-question-navigation-MULTI_STATEMENT_TRUE_FALSE")
      .getByText("Đúng / Sai nhiều mệnh đề", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Số 2 là số chẵn.", { exact: true })).toBeVisible();
  await expect(page.getByText("Số 3 là số chẵn.", { exact: true })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Chọn câu hỏi Test" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("Tạo mới Test opens the shared Quiz AI modal without duration", async ({ page }) => {
  await seedAdminSession(page);
  await setupTestsApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Test" }).click();
  await page.getByRole("button", { name: "Thêm bộ đề" }).click();
  await page
    .getByRole("dialog", { name: "Thêm bộ đề" })
    .getByRole("button", { name: "Thêm bộ đề" })
    .click();

  const testCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Test", exact: true }),
  });
  await testCard.getByRole("button", { name: "Tạo mới" }).click();

  const dialog = page.getByRole("dialog", { name: "Tạo Test bằng AI" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Bộ đề được chọn")).toBeVisible();
  await expect(dialog.getByLabel("Số câu hỏi")).toBeVisible();
  await expect(dialog.getByLabel("Số câu thực tế")).toBeVisible();
  await expect(dialog.getByLabel("Mức độ")).toBeVisible();
  await expect(dialog.getByText("Loại câu hỏi", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Cách trình bày")).toBeVisible();
  await expect(dialog.getByLabel("Model", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Model tạo hình", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("Cấu hình này chỉ được dùng khi câu Test cần sinh hình minh họa."),
  ).toBeVisible();
  await expect(dialog.getByText(/Thời gian làm bài/i)).toHaveCount(0);
  await expect(dialog.locator('[name*="duration" i]')).toHaveCount(0);
  await expectNoFrameworkOverlay(page);
});

test("Test AI creates Bộ đề 1 when the lesson has no Test set", async ({ page }) => {
  await seedAdminSession(page);
  await setupTestsApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Test" }).click();
  const testCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Test", exact: true }),
  });
  await testCard.getByRole("button", { name: "Tạo mới" }).click();

  const dialog = page.getByRole("dialog", { name: "Tạo Test bằng AI" });
  await expect(dialog.getByLabel("Bộ đề được chọn")).toContainText("Chưa có bộ đề");
  await expect(
    dialog.getByText(
      "Hệ thống sẽ tạo “Bộ đề 1” với thời gian mặc định 15 phút. Bạn có thể đổi thời gian tại phần sửa bộ đề.",
    ),
  ).toBeVisible();
  await dialog.getByLabel("Tài liệu dùng để tạo").click();
  await page.getByRole("option", { name: /Tài liệu Test/ }).click();
  const startButton = dialog.getByRole("button", { name: "Bắt đầu tạo" });
  await expect(startButton).toBeEnabled();

  const generateRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith(
        `/admin/lessons/${lessonId}/test-sets/generate-ai`,
      ),
  );
  await startButton.click();
  const generateRequest = await generateRequestPromise;
  expect(generateRequest.postDataJSON()).not.toHaveProperty("targetTestSetId");
  expect(generateRequest.postDataJSON()).not.toHaveProperty("durationSeconds");
  await expect(dialog).toBeHidden();
  await expectNoFrameworkOverlay(page);
});

test("admin formula input keeps its focused placeholder clear and keyboard toggle aligned", async ({
  page,
}, testInfo) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(error.message);
  });

  await seedAdminSession(page);
  await setupTestsApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Test" }).click();
  await page.getByRole("button", { name: "Thêm bộ đề" }).click();
  await page
    .getByRole("dialog", { name: "Thêm bộ đề" })
    .getByRole("button", { name: "Thêm bộ đề" })
    .click();
  await page.getByRole("button", { name: "Thêm câu hỏi" }).first().click();

  const questionDialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  await questionDialog
    .getByRole("button", { name: "Chèn công thức Toán, Lý, Hóa" })
    .nth(1)
    .click();

  const mathfield = questionDialog.locator(
    'math-field[aria-label="Nhập công thức trực quan"]',
  );
  await expect(mathfield).toBeVisible({ timeout: 20_000 });
  await mathfield.focus();

  const layout = await mathfield.evaluate((element) => {
    const shadowRoot = element.shadowRoot;
    const fieldRect = element.getBoundingClientRect();
    const keyboardToggle = shadowRoot?.querySelector<HTMLElement>(
      '[part~="virtual-keyboard-toggle"]',
    );
    const placeholder = shadowRoot?.querySelector<HTMLElement>(
      ".ML__content-placeholder .ML__text",
    );
    const container = shadowRoot?.querySelector<HTMLElement>('[part~="container"]');
    const containerRect = container?.getBoundingClientRect();
    const toggleRect = keyboardToggle?.getBoundingClientRect();

    return {
      containerWidth: containerRect?.width ?? 0,
      fieldWidth: fieldRect.width,
      placeholderBackground: placeholder
        ? getComputedStyle(placeholder).backgroundColor
        : "",
      rightGap: toggleRect
        ? fieldRect.right - toggleRect.right
        : Number.POSITIVE_INFINITY,
      verticalCenterDelta: toggleRect
        ? Math.abs(
            fieldRect.top +
              fieldRect.height / 2 -
              (toggleRect.top + toggleRect.height / 2),
          )
        : Number.POSITIVE_INFINITY,
    };
  });

  expect(layout.placeholderBackground).toBe("rgba(0, 0, 0, 0)");
  expect(layout.containerWidth).toBeGreaterThan(layout.fieldWidth - 40);
  expect(layout.rightGap).toBeGreaterThan(0);
  expect(layout.rightGap).toBeLessThan(32);
  expect(layout.verticalCenterDelta).toBeLessThanOrEqual(1);

  const keyboardToggle = mathfield.locator('[part~="virtual-keyboard-toggle"]');
  await keyboardToggle.click();
  await expect(mathfield).toHaveAttribute("data-virtual-keyboard-open", "");
  await expect(keyboardToggle).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      keyboardToggle.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");
  await mathfield.focus();
  await expect(mathfield).toHaveAttribute("data-virtual-keyboard-open", "");
  await keyboardToggle.evaluate((element) => {
    element.dispatchEvent(new PointerEvent("pointerleave"));
  });
  await mathfield.screenshot({
    path: testInfo.outputPath("formula-input-focused-keyboard-open.png"),
  });

  await page.evaluate(() => {
    window.localStorage.setItem("classhero-theme", "dark");
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
  });
  const darkThemeColors = await mathfield.evaluate((element) => {
    const shadowRoot = element.shadowRoot;
    const placeholder = shadowRoot?.querySelector<HTMLElement>(
      ".ML__content-placeholder .ML__text",
    );
    const keyboardToggle = shadowRoot?.querySelector<HTMLElement>(
      '[part~="virtual-keyboard-toggle"]',
    );

    return {
      keyboardBackground: keyboardToggle
        ? getComputedStyle(keyboardToggle).backgroundColor
        : "",
      placeholderBackground: placeholder
        ? getComputedStyle(placeholder).backgroundColor
        : "",
    };
  });
  expect(darkThemeColors.placeholderBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkThemeColors.keyboardBackground).not.toBe("rgba(0, 0, 0, 0)");
  const darkVirtualKeyboardColors = await page
    .locator(".ML__keyboard")
    .evaluate((element) => {
      const styles = getComputedStyle(element);

      return {
        background: styles.getPropertyValue("--_background").trim(),
        keycapBackground: styles.getPropertyValue("--_keycap-background").trim(),
        keycapText: styles.getPropertyValue("--_keycap-text").trim(),
      };
    });
  expect(darkVirtualKeyboardColors).toEqual({
    background: "#0f172a",
    keycapBackground: "#1e293b",
    keycapText: "#f8fafc",
  });
  await mathfield.screenshot({
    path: testInfo.outputPath("formula-input-focused-keyboard-open-dark.png"),
  });
  await page.screenshot({
    path: testInfo.outputPath("formula-virtual-keyboard-open-dark.png"),
  });

  expect(browserErrors).toEqual([]);
  await expectNoFrameworkOverlay(page);
});

async function seedAdminSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
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

async function setupTestsApiMock(page: Page) {
  const sets: Array<Record<string, unknown>> = [];
  const questionsBySet = new Map<string, Array<Record<string, unknown>>>();

  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();

    if (
      method === "GET" &&
      pathname === `/admin/lessons/${lessonId}/ai-generation-panel`
    ) {
      return fulfillJson(route, 200, {
        data: {
          lesson: { id: lessonId, title: "Buổi 1: Kiến thức nền" },
          readiness: {
            summaryReady: true,
            generationReady: true,
            quizReady: true,
            readyDocumentCount: 1,
            embeddedDocumentCount: 1,
            reason: null,
            quizReason: null,
          },
          documents: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Tài liệu Test",
              kind: "SUPPLEMENT",
              status: "READY",
              chunkCount: 1,
              pageRange: { pageStart: 1, pageEnd: 1 },
              embeddingReady: true,
              canUseForSummary: true,
              canUseForQuiz: true,
              canUseForFlashcard: true,
              unavailableReason: null,
              quizUnavailableReason: null,
              flashcardUnavailableReason: null,
            },
          ],
          summaryConfiguration: modelConfiguration("gpt-summary"),
          summaryFigureConfiguration: modelConfiguration("gpt-summary-figure"),
          quizConfiguration: modelConfiguration("gpt-quiz"),
          quizFigureConfiguration: modelConfiguration("gpt-quiz-figure"),
          testConfiguration: modelConfiguration("gpt-test"),
          testFigureConfiguration: modelConfiguration("gpt-test-figure"),
          flashcardConfiguration: modelConfiguration("gpt-flashcard"),
          flashcardFigureConfiguration: modelConfiguration("gpt-flashcard-figure"),
          jobs: { SUMMARY: null, QUIZ: null, FLASHCARD: null, TEST: null },
        },
      });
    }

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}`) {
      return fulfillJson(route, 200, {
        data: {
          id: lessonId,
          learningPathId: "path-math-8",
          chapterId: "chapter-1",
          courseTitle: "Toán 8",
          chapterTitle: "Chương 1",
          orderIndex: 1,
          title: "Buổi 1: Kiến thức nền",
          shortDescription: null,
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

    if (method === "GET" && pathname === "/admin/learning-paths/path-math-8") {
      return fulfillJson(route, 200, {
        data: { id: "path-math-8", title: "Toán 8" },
      });
    }

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/test-sets`) {
      return fulfillJson(route, 200, { data: sets });
    }

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/quiz-sets`) {
      return fulfillJson(route, 200, { data: [] });
    }

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/flashcard-sets`) {
      return fulfillJson(route, 200, { data: [] });
    }

    if (method === "POST" && pathname === `/admin/lessons/${lessonId}/test-sets`) {
      const body = request.postDataJSON() as {
        difficulty: string;
        durationSeconds: number;
        title: string;
      };
      const set = {
        id: `test-set-${sets.length + 1}`,
        lessonId,
        ...body,
        difficultyRatioJson: null,
        source: "ADMIN",
        reviewStatus: "APPROVED",
        questionCount: 0,
        totalScore: "10",
        sortOrder: sets.length,
        _count: { questions: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sets.push(set);
      questionsBySet.set(String(set.id), []);
      const { _count: _omittedCount, ...createdSetResponse } = set;
      return fulfillJson(route, 201, { data: createdSetResponse });
    }

    if (
      method === "POST" &&
      pathname === `/admin/lessons/${lessonId}/test-sets/generate-ai/preview`
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      return fulfillJson(route, 200, {
        data: {
          requestDraftId: "22222222-2222-4222-8222-222222222222",
          requestHash: "a".repeat(64),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          promptVersion: "quiz-v1",
          schemaVersion: "quiz-v1",
          systemPrompt: "Shared Quiz system prompt",
          userPrompt: "Shared Quiz user prompt",
          inputPrompt: "Shared Quiz input",
          openAiFileUploadRequest: { purpose: "user_data", file: "packet.pdf" },
          openAiRequest: {
            model: "gpt-test",
            instructions: "Shared Quiz system prompt",
            input: [],
            text: { format: {} },
            max_output_tokens: 8_000,
          },
          context: {
            lessonTitle: "Buổi 1: Kiến thức nền",
            documentCount: 1,
            chunkCount: 1,
            estimatedTokens: 1_000,
            textInputTokens: 100,
            pdfInputTokens: 900,
            contextTokens: 1_000,
            maxContextTokens: 100_000,
            packet: {
              filename: "packet.pdf",
              pageCount: 1,
              sizeBytes: 1_000,
              packetHash: "b".repeat(64),
              manifestHash: "c".repeat(64),
              detail: "high",
              manifest: {
                version: 1,
                lessonId,
                packetHash: "b".repeat(64),
                pageCount: 1,
                pages: [
                  {
                    packetPageNumber: 1,
                    sourceKey: "D01",
                    lessonDocumentId: "11111111-1111-4111-8111-111111111111",
                    sourceDocumentId: "11111111-1111-4111-8111-111111111111",
                    sourceFileId: "file-test",
                    sourcePdfPageNumber: 1,
                    printedPageLabel: "1",
                    pageRangeId: "range-test",
                    documentTitle: "Tài liệu Test",
                    segmentOrder: 0,
                  },
                ],
              },
            },
            chunks: [],
          },
          configuration: {
            ...modelConfiguration("gpt-test"),
            targetTestSet: {
              id: String(body.targetTestSetId),
              title: "Bộ đề 1",
              durationSeconds: 900,
            },
            selectedModel: "gpt-test",
          },
          estimatedCost: {
            available: true,
            inputUpperBoundUsd: 0.001,
            inputUpperBoundVnd: 25,
            outputUpperBoundUsd: 0.002,
            outputUpperBoundVnd: 50,
            upperBoundUsd: 0.003,
            upperBoundVnd: 75,
            fxRateVndPerUsd: 25_000,
          },
        },
      });
    }

    if (
      method === "POST" &&
      pathname === `/admin/lessons/${lessonId}/test-sets/generate-ai`
    ) {
      return fulfillJson(route, 202, {
        data: { mode: "QUEUED", jobId: "test-job-1", status: "QUEUED" },
      });
    }

    const questionsMatch = pathname.match(/^\/admin\/test-sets\/([^/]+)\/questions$/);
    if (questionsMatch && method === "GET") {
      return fulfillJson(route, 200, {
        data: questionsBySet.get(questionsMatch[1] ?? "") ?? [],
      });
    }
    if (questionsMatch && method === "POST") {
      const setId = questionsMatch[1] ?? "";
      const body = request.postDataJSON() as Record<string, unknown>;
      const questions = questionsBySet.get(setId) ?? [];
      const question = {
        id: `test-question-${questions.length + 1}`,
        testSetId: setId,
        lessonId,
        ...body,
        optionsJson: body.optionsJson ?? null,
        hintJson: body.hintJson ?? null,
        gradingConfigJson: body.gradingConfigJson ?? null,
        explanation: null,
        points: null,
        effectivePoints: 10,
        reviewStatus: "APPROVED",
      };
      questions.push(question);
      questionsBySet.set(setId, questions);
      const set = sets.find((item) => item.id === setId);
      if (set) {
        set.questionCount = questions.length;
        set._count = { questions: questions.length };
      }
      return fulfillJson(route, 201, { data: question });
    }

    return fulfillJson(route, 404, {
      error: { code: "NOT_FOUND", message: `${method} ${pathname}` },
    });
  });
}

function modelConfiguration(model: string) {
  return {
    isDefaultConfigured: true,
    resolvedProvider: "OPENAI",
    resolvedModel: model,
    temperature: 0.1,
    reasoningEffort: null,
    maxOutputTokens: 8_000,
    modelOptions: [
      {
        provider: "OPENAI",
        model,
        available: true,
        capabilities: {
          aiConfiguration: "TEMPERATURE",
          pdfInput: true,
          pdfDetailLevels: ["high"],
        },
      },
    ],
  };
}

function createUnsignedToken(payload: Record<string, unknown>) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function expectNoFrameworkOverlay(page: Page) {
  expect(await page.locator("[data-nextjs-dialog]").count()).toBe(0);
  await expect(page.locator("body")).not.toHaveText(
    /Application error|Unhandled Runtime Error/,
  );
}
