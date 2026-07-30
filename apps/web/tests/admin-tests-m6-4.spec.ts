import { expect, test, type Page, type Route } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-tests-m6-4";

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
  await expect(page.getByText("Đúng / Sai nhiều mệnh đề", { exact: true })).toBeVisible();
  await expect(page.getByText("Số 2 là số chẵn.", { exact: true })).toBeVisible();
  await expect(page.getByText("Số 3 là số chẵn.", { exact: true })).toBeVisible();
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
  const darkVirtualKeyboardColors = await page.locator(".ML__keyboard").evaluate(
    (element) => {
      const styles = getComputedStyle(element);

      return {
        background: styles.getPropertyValue("--_background").trim(),
        keycapBackground: styles.getPropertyValue("--_keycap-background").trim(),
        keycapText: styles.getPropertyValue("--_keycap-text").trim(),
      };
    },
  );
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
