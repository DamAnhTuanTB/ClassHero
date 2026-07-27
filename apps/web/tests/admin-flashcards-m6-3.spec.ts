import { expect, test, type Page, type Route } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-flashcards-m6-3";
const mathTemplateCounts = [
  { category: "Chữ cái Hy Lạp", count: 14 },
  { category: "Phép toán", count: 14 },
  { category: "Quan hệ", count: 14 },
  { category: "Cấu trúc", count: 15 },
  { category: "Mũi tên", count: 10 },
] as const;

test("admin creates a flashcard set and card from lesson detail", async ({ page }) => {
  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Flashcard" }).click();

  await expect(page.getByRole("heading", { name: "Quản lý Flashcard" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Công thức nền tảng/ })).toBeVisible();
  await expect(page.getByText("Định lý Pythagore")).toBeVisible();

  await page.getByRole("button", { name: "Thêm bộ flashcard" }).click();
  const setDialog = page.getByRole("dialog", { name: "Tạo bộ flashcard" });
  await expect(setDialog.getByLabel("Tên bộ flashcard")).toHaveValue("Bộ flashcard 1");
  await setDialog.getByLabel("Tên bộ flashcard").fill("Khái niệm trọng tâm");
  await setDialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByRole("tab", { name: /Khái niệm trọng tâm/ })).toBeVisible();

  await page.getByRole("button", { name: "Thêm flashcard" }).first().click();
  const cardDialog = page.getByRole("dialog", { name: "Thêm flashcard" });
  await expect(cardDialog.getByText("Gợi ý", { exact: true })).toHaveCount(0);
  await cardDialog
    .getByRole("textbox", { name: "Nội dung mặt trước" })
    .fill("Định nghĩa vận tốc");
  await cardDialog
    .getByRole("textbox", { name: "Nội dung mặt sau" })
    .fill("Quãng đường đi được trong một đơn vị thời gian");
  await cardDialog
    .getByRole("textbox", { name: "Lời giải chi tiết" })
    .fill("Lấy quãng đường chia cho thời gian chuyển động");
  await cardDialog.getByRole("button", { name: "Lưu", exact: true }).click();

  await expect(cardDialog).toBeHidden();
  const activeSetPanel = page.getByRole("tabpanel");
  await expect(activeSetPanel.getByText("Định nghĩa vận tốc")).toBeVisible();
  await expect(
    activeSetPanel.getByText("Quãng đường đi được trong một đơn vị thời gian"),
  ).toBeVisible();
  await expect(
    activeSetPanel.getByText("Lấy quãng đường chia cho thời gian chuyển động"),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("admin edits the selected quiz set from its panel", async ({ page }) => {
  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Quiz" }).click();

  await expect(page.getByRole("tab", { name: /Bộ câu hỏi 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Sửa Bộ câu hỏi 1" }).click();

  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ câu hỏi" });
  await expect(dialog.getByLabel("Tên bộ câu hỏi")).toHaveValue("Bộ câu hỏi 1");
  await dialog.getByLabel("Tên bộ câu hỏi").fill("Bộ câu hỏi ôn tập");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page.getByRole("tab", { name: /Bộ câu hỏi ôn tập/ })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("admin composes a fraction without a framework runtime error", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();

  const dialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  const formulaTrigger = dialog.getByLabel("Chèn công thức Toán, Lý, Hóa").first();
  await formulaTrigger.click();

  const mathfield = dialog.locator("math-field");
  await expect(mathfield).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole("button", { name: "Chèn phân số" }).click();
  await expect
    .poll(() =>
      mathfield.evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toContain("\\frac");

  await page.keyboard.type("1");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2");
  const latex = await mathfield.evaluate(
    (element) => (element as HTMLElement & { value: string }).value,
  );
  expect(latex).toContain("1");
  expect(latex).toContain("2");

  await dialog.getByRole("button", { name: "Đóng trình nhập công thức" }).click();
  await expect(mathfield).toHaveCount(0);

  await formulaTrigger.click();
  await expect(dialog.locator("math-field")).toBeVisible();
  await dialog.getByRole("button", { name: "Đóng trình nhập công thức" }).click();
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();

  await expectNoFrameworkOverlay(page);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("admin can type into vector and chemistry structures", async ({ page }) => {
  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();

  const dialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  await dialog.getByLabel("Chèn công thức Toán, Lý, Hóa").first().click();

  const mathfield = dialog.locator("math-field");
  await expect(mathfield).toBeVisible({ timeout: 15_000 });

  await dialog.getByRole("button", { name: "Chèn vector" }).click();
  await expect
    .poll(() =>
      mathfield.evaluate((element) => element.shadowRoot?.textContent ?? ""),
    )
    .toContain("▢");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.tagName))
    .toBe("MATH-FIELD");
  const clickVectorPlaceholder = async () => {
    const placeholderCandidates = await mathfield.evaluate((element) =>
      Array.from(element.shadowRoot?.querySelectorAll(".ML__selected") ?? [])
        .map((candidate) => {
          const box = candidate.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
          };
        }),
    );
    const placeholderBox = placeholderCandidates.at(-1) ?? null;
    expect(placeholderBox).not.toBeNull();
    if (placeholderBox) {
      await page.mouse.click(
        placeholderBox.x + placeholderBox.width / 2,
        placeholderBox.y + placeholderBox.height / 2,
      );
    }
  };
  await clickVectorPlaceholder();
  await expect
    .poll(() =>
      mathfield.evaluate((element) => element.shadowRoot?.textContent ?? ""),
    )
    .toContain("▢");
  await page.keyboard.type("AB");
  await expect
    .poll(() =>
      mathfield.evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toContain("\\vec{AB}");

  await mathfield.evaluate((element) => {
    const field = element as HTMLElement & { value: string };
    field.value = "";
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });

  await dialog.getByRole("button", { name: "Chèn vector" }).click();
  await clickVectorPlaceholder();
  await page.keyboard.insertText("C");
  await expect
    .poll(() =>
      mathfield.evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toContain("\\vec{C}");

  await mathfield.evaluate((element) => {
    const field = element as HTMLElement & { value: string };
    field.value = "";
    field.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });

  await dialog.getByRole("button", { name: "Chèn hóa học" }).click();
  await page.keyboard.type("H");
  await page.keyboard.press("Tab");
  await page.keyboard.type("2");
  await page.keyboard.press("Tab");
  await page.keyboard.type("O");
  await expect
    .poll(() =>
      mathfield.evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toMatch(/H_\{?2\}?O/);
  const italicMathfieldGlyphs = await mathfield.evaluate((element) => {
    const shadowRoot = element.shadowRoot;
    if (!shadowRoot) {
      return -1;
    }

    return Array.from(shadowRoot.querySelectorAll(".ML__mathit")).filter(
      (glyph) =>
        glyph.textContent?.trim() &&
        ["italic", "oblique"].includes(getComputedStyle(glyph).fontStyle),
    ).length;
  });
  expect(italicMathfieldGlyphs).toBe(0);

  await dialog.getByRole("button", { name: "Chèn công thức", exact: true }).click();
  const insertedFormula = dialog
    .locator('.tiptap-mathematics-render[data-type="inline-math"]')
    .first();
  await expect(insertedFormula).toBeVisible();
  const italicFormulaGlyphs = await insertedFormula
    .locator(".mathnormal, .mathit")
    .evaluateAll((glyphs) =>
      glyphs.filter((glyph) =>
        ["italic", "oblique"].includes(getComputedStyle(glyph).fontStyle),
      ).length,
    );
  expect(italicFormulaGlyphs).toBe(0);

  await expectNoFrameworkOverlay(page);
});

test("math structure previews stay inside their buttons", async ({ page }) => {
  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();

  const dialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  await dialog.getByLabel("Chèn công thức Toán, Lý, Hóa").first().click();

  const templateButtons = dialog.locator(".visual-math-input__template-button");
  await expect(templateButtons).toHaveCount(15);

  const overflowedTemplates = await templateButtons.evaluateAll((buttons) =>
    buttons.flatMap((button) => {
      const preview = button.querySelector(".visual-math-input__math-preview");
      if (!preview) {
        return [];
      }

      const buttonRect = button.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      const fits =
        previewRect.left >= buttonRect.left - 1 &&
        previewRect.right <= buttonRect.right + 1 &&
        previewRect.top >= buttonRect.top - 1 &&
        previewRect.bottom <= buttonRect.bottom + 1;

      return fits ? [] : [button.getAttribute("aria-label") ?? "unknown"];
    }),
  );

  expect(overflowedTemplates).toEqual([]);
  const hiddenPaletteContent = await dialog
    .locator(".visual-math-input__palette")
    .evaluate((palette) => palette.scrollHeight - palette.clientHeight);
  expect(hiddenPaletteContent).toBeLessThanOrEqual(1);
  const viewportOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(viewportOverflow).toBeLessThanOrEqual(1);
  const mathfieldHeight = await dialog
    .locator("math-field")
    .evaluate((field) => field.getBoundingClientRect().height);
  expect(mathfieldHeight).toBeLessThanOrEqual(96);

  const categoryBar = dialog.locator(".visual-math-input__category-bar");
  const arrowsCategory = dialog.getByRole("button", {
    name: "Mũi tên",
    exact: true,
  });
  const categoryBarBeforeSelection = await categoryBar.evaluate((bar) => ({
    hasHorizontalOverflow: bar.scrollWidth > bar.clientWidth,
    scrollLeft: bar.scrollLeft,
    top: bar.getBoundingClientRect().top,
  }));
  await arrowsCategory.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(arrowsCategory).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      categoryBar.evaluate((bar) => {
        const activeButton = bar.querySelector('[aria-pressed="true"]');
        if (!activeButton) {
          return false;
        }

        const barRect = bar.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        return (
          buttonRect.left >= barRect.left - 1 &&
          buttonRect.right <= barRect.right + 1
        );
      }),
    )
    .toBe(true);
  const categoryBarAfterSelection = await categoryBar.evaluate((bar) => ({
    scrollLeft: bar.scrollLeft,
    top: bar.getBoundingClientRect().top,
  }));
  expect(
    Math.abs(categoryBarAfterSelection.top - categoryBarBeforeSelection.top),
  ).toBeLessThanOrEqual(1);
  if (categoryBarBeforeSelection.hasHorizontalOverflow) {
    expect(categoryBarAfterSelection.scrollLeft).toBeGreaterThan(
      categoryBarBeforeSelection.scrollLeft,
    );
  }
  await expectNoFrameworkOverlay(page);
});

test("math tooltips appear immediately without creating horizontal overflow", async ({
  page,
}, testInfo) => {
  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();

  const dialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  await dialog.getByLabel("Chèn công thức Toán, Lý, Hóa").first().click();

  const mathfield = dialog.locator("math-field");
  await expect(mathfield).toBeVisible({ timeout: 15_000 });
  const keyboardToggle = mathfield.locator(
    '[part="virtual-keyboard-toggle"]',
  );
  await expect(keyboardToggle).toBeVisible();

  const overflowBeforeHover = await mathfield.evaluate((field) => ({
    clientWidth: field.clientWidth,
    scrollWidth: field.scrollWidth,
  }));
  const supportsHover = await page.evaluate(() =>
    window.matchMedia("(hover: hover)").matches,
  );
  if (supportsHover) {
    await keyboardToggle.hover();
  } else {
    await keyboardToggle.evaluate((toggle) => {
      toggle.dispatchEvent(new PointerEvent("pointerenter"));
    });
  }

  const keyboardTooltip = page
    .locator("[data-immediate-tooltip]")
    .filter({ hasText: "Mở hoặc đóng bàn phím ảo" });
  await expect(keyboardTooltip).toBeVisible({ timeout: 300 });
  await expect(keyboardToggle).not.toHaveAttribute("data-tooltip", /.+/);
  await expect(keyboardToggle).not.toHaveAttribute("data-l10n-tooltip", /.+/);

  const overflowAfterHover = await mathfield.evaluate((field) => ({
    clientWidth: field.clientWidth,
    scrollWidth: field.scrollWidth,
  }));
  expect(overflowAfterHover).toEqual(overflowBeforeHover);

  const tooltipBounds = await keyboardTooltip.boundingBox();
  expect(tooltipBounds).not.toBeNull();
  if (tooltipBounds) {
    expect(tooltipBounds.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBounds.y).toBeGreaterThanOrEqual(0);
    expect(tooltipBounds.x + tooltipBounds.width).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  }
  if (!supportsHover) {
    await keyboardToggle.evaluate((toggle) => {
      toggle.dispatchEvent(new PointerEvent("pointerleave"));
    });
  }

  const fractionButton = dialog.getByRole("button", {
    name: "Chèn phân số",
  });
  await expect(fractionButton).not.toHaveAttribute("title", /.+/);
  if (supportsHover) {
    await fractionButton.hover();
  } else {
    await fractionButton.focus();
  }
  await expect(
    page
      .locator("[data-immediate-tooltip]")
      .filter({ hasText: "Phân số" }),
  ).toBeVisible({ timeout: 300 });

  const boldButton = dialog.getByRole("button", { name: "In đậm" }).first();
  if (supportsHover) {
    await boldButton.hover();
  } else {
    await boldButton.focus();
  }
  await expect(
    page.locator("[data-immediate-tooltip]").filter({ hasText: "In đậm" }),
  ).toBeVisible({ timeout: 300 });

  await expectNoFrameworkOverlay(page);
  testInfo.annotations.push({
    description: supportsHover
      ? "Verified with a real hover-capable pointer."
      : "Verified with the equivalent pointer/focus events on a touch viewport.",
    type: "tooltip-input-mode",
  });
});

test("every math palette template inserts visual content", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Thêm câu hỏi" }).click();

  const dialog = page.getByRole("dialog", { name: "Thêm câu hỏi" });
  await dialog.getByLabel("Chèn công thức Toán, Lý, Hóa").first().click();

  const mathfield = dialog.locator("math-field");
  await expect(mathfield).toBeVisible({ timeout: 15_000 });

  for (const { category, count } of mathTemplateCounts) {
    await dialog.getByRole("button", { name: category, exact: true }).click();
    const palette = dialog.getByRole("group", { name: category });
    const templateButtons = palette.locator(".visual-math-input__template-button");
    await expect(templateButtons).toHaveCount(count);
    const italicPreviewGlyphs = await palette
      .locator(".mathnormal, .mathit")
      .evaluateAll((glyphs) =>
        glyphs.filter((glyph) =>
          ["italic", "oblique"].includes(getComputedStyle(glyph).fontStyle),
        ).length,
      );
    expect(italicPreviewGlyphs).toBe(0);

    for (let index = 0; index < count; index += 1) {
      await mathfield.evaluate((element) => {
        const field = element as HTMLElement & {
          blur: () => void;
          setValue: (value: string) => void;
        };
        field.setValue("");
        field.blur();
        field.dispatchEvent(new InputEvent("input", { bubbles: true }));
      });

      const templateButton = templateButtons.nth(index);
      const templateName = await templateButton.getAttribute("aria-label");
      await templateButton.click();
      await expect
        .poll(() =>
          mathfield.evaluate(
            (element) => (element as HTMLElement & { value: string }).value.trim(),
          ),
        )
        .not.toBe("");
      expect(templateName).toMatch(/^Chèn /);
    }
  }

  await dialog.getByRole("button", { name: "Đóng trình nhập công thức" }).click();
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await expect(dialog).toBeHidden();
  await expectNoFrameworkOverlay(page);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
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

async function setupFlashcardApiMock(page: Page) {
  const quizSets = [
    {
      id: "quiz-set-1",
      lessonId,
      title: "Bộ câu hỏi 1",
      difficulty: "MIXED",
      source: "ADMIN",
      reviewStatus: "APPROVED",
      questionCount: 0,
      _count: { questions: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const sets = [
    {
      id: "set-foundation",
      lessonId,
      title: "Công thức nền tảng",
      difficulty: "MIXED",
      source: "ADMIN",
      reviewStatus: "APPROVED",
      isReserve: false,
      cardCount: 1,
      sortOrder: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  const cardsBySet = new Map<string, Array<Record<string, unknown>>>([
    [
      "set-foundation",
      [
        {
          id: "card-pythagore",
          flashcardSetId: "set-foundation",
          lessonId,
          frontJson: tiptapDocument("Định lý Pythagore"),
          backJson: tiptapDocument("a² + b² = c²"),
          explanation: {
            id: "explanation-pythagore",
            contentJson: tiptapDocument("Áp dụng định lý cho ba cạnh của tam giác vuông"),
          },
          difficulty: "MEDIUM",
          reviewStatus: "APPROVED",
          sortOrder: 0,
          explanationId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    ],
  ]);

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

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/quiz-sets`) {
      return fulfillJson(route, 200, { data: quizSets });
    }

    if (method === "GET" && pathname === "/admin/quiz-sets/quiz-set-1/questions") {
      return fulfillJson(route, 200, { data: [] });
    }

    if (method === "PATCH" && pathname === "/admin/quiz-sets/quiz-set-1") {
      const body = request.postDataJSON() as {
        difficulty: string;
        title: string;
      };
      const currentQuizSet = quizSets[0];
      if (!currentQuizSet) {
        return fulfillJson(route, 404, {
          error: { code: "NOT_FOUND", message: "Không tìm thấy bộ câu hỏi" },
        });
      }
      quizSets[0] = {
        ...currentQuizSet,
        ...body,
        updatedAt: new Date().toISOString(),
      };
      return fulfillJson(route, 200, { data: quizSets[0] });
    }

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/flashcard-sets`) {
      return fulfillJson(route, 200, { data: sets });
    }

    if (method === "POST" && pathname === `/admin/lessons/${lessonId}/flashcard-sets`) {
      const body = request.postDataJSON() as {
        difficulty: string;
        title: string;
      };
      const set = {
        id: `set-${sets.length + 1}`,
        lessonId,
        title: body.title,
        difficulty: body.difficulty,
        source: "ADMIN",
        reviewStatus: "APPROVED",
        isReserve: false,
        cardCount: 0,
        sortOrder: sets.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sets.push(set);
      cardsBySet.set(set.id, []);
      return fulfillJson(route, 201, { data: set });
    }

    const cardsMatch = pathname.match(/^\/admin\/flashcard-sets\/([^/]+)\/cards$/);
    if (cardsMatch && method === "GET") {
      return fulfillJson(route, 200, {
        data: cardsBySet.get(cardsMatch[1] ?? "") ?? [],
      });
    }
    if (cardsMatch && method === "POST") {
      const setId = cardsMatch[1] ?? "";
      const body = request.postDataJSON() as {
        backJson: Record<string, unknown>;
        difficulty: string;
        frontJson: Record<string, unknown>;
        explanationJson: Record<string, unknown> | null;
      };
      const cards = cardsBySet.get(setId) ?? [];
      const { explanationJson, ...cardContent } = body;
      const card = {
        id: `card-${setId}-${cards.length + 1}`,
        flashcardSetId: setId,
        lessonId,
        ...cardContent,
        explanation:
          explanationJson === null
            ? null
            : {
                id: `explanation-${setId}-${cards.length + 1}`,
                contentJson: explanationJson,
              },
        explanationId:
          explanationJson === null ? null : `explanation-${setId}-${cards.length + 1}`,
        reviewStatus: "APPROVED",
        sortOrder: cards.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cards.push(card);
      cardsBySet.set(setId, cards);
      const set = sets.find((item) => item.id === setId);
      if (set) set.cardCount = cards.length;
      return fulfillJson(route, 201, { data: card });
    }

    return fulfillJson(route, 404, {
      error: { code: "NOT_FOUND", message: `${method} ${pathname}` },
    });
  });
}

function tiptapDocument(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
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
  const hasOverlay = await page.locator("[data-nextjs-dialog]").count();
  expect(hasOverlay).toBe(0);
  await expect(page.locator("body")).not.toHaveText(
    /Application error|Unhandled Runtime Error/,
  );
}
