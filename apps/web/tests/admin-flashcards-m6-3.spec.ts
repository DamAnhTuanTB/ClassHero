import { expect, test, type Page, type Route } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-flashcards-m6-3";

test("admin creates a flashcard set and card from lesson detail", async ({ page }) => {
  await seedAdminSession(page);
  await setupFlashcardApiMock(page);

  await page.goto(`/admin/lessons/${lessonId}`);
  await page.getByRole("button", { name: "Flashcard" }).click();

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
  await page.getByRole("button", { name: "Quiz" }).click();

  await expect(page.getByRole("tab", { name: /Bộ câu hỏi 1/ })).toBeVisible();
  await page.getByRole("button", { name: "Sửa Bộ câu hỏi 1" }).click();

  const dialog = page.getByRole("dialog", { name: "Chỉnh sửa bộ câu hỏi" });
  await expect(dialog.getByLabel("Tên bộ câu hỏi")).toHaveValue("Bộ câu hỏi 1");
  await dialog.getByLabel("Tên bộ câu hỏi").fill("Bộ câu hỏi ôn tập");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();

  await expect(page.getByRole("tab", { name: /Bộ câu hỏi ôn tập/ })).toBeVisible();
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
