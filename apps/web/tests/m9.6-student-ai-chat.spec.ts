import { expect, test, type Page, type Route } from "@playwright/test";
import { formatAiChatPreview } from "../features/ai-chat/utils/ai-chat-preview";
import { uploadChatImagesWithConcurrency } from "../features/student/ai-chat/utils/upload-chat-images";
import {
  buildAiChatHref,
  readAiChatPreferredLessonIds,
} from "../features/student/ai-chat/utils/ai-chat-link";
import { getVisibleCourseLessonCtaIds } from "../features/student/shared/utils/student-courses-utils";

const now = "2026-09-12T12:00:00.000Z";

test.describe("M9.6 student AI chat hub", () => {
  test("keeps preferred lessons in course and library entry links without duplicates", () => {
    const firstLessonId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const secondLessonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    expect(
      buildAiChatHref({
        scopeType: "COURSE",
        learningPathId: "33333333-3333-4333-8333-333333333333",
        preferredLessonIds: [firstLessonId],
      }),
    ).toBe(
      `/student/ai-chat?scope=COURSE&learningPathId=33333333-3333-4333-8333-333333333333&preferredLessonId=${firstLessonId}`,
    );
    const libraryHref = buildAiChatHref({
      scopeType: "LIBRARY",
      preferredLessonIds: [firstLessonId, secondLessonId, firstLessonId],
    });
    expect(libraryHref).toBe(
      `/student/ai-chat?scope=LIBRARY&preferredLessonId=${firstLessonId}&preferredLessonId=${secondLessonId}`,
    );
    expect(
      readAiChatPreferredLessonIds(new URL(libraryHref, "http://localhost").searchParams),
    ).toEqual([firstLessonId, secondLessonId]);
  });

  test("prioritizes only lessons whose course cards actually show a learning CTA", () => {
    expect(
      getVisibleCourseLessonCtaIds([
        {
          access: "enrolled",
          nextLesson: { id: "lesson-open", title: "Bài đang mở" },
        },
        {
          access: "completed",
          nextLesson: { id: "lesson-review", title: "Bài xem lại" },
        },
        {
          access: "enrolled",
          isUnderMaintenance: true,
          nextLesson: { id: "lesson-maintenance", title: "Bài bảo trì" },
        },
        { access: "enrolled" },
      ]),
    ).toEqual(["lesson-open"]);
  });

  test("formats Markdown message excerpts as readable one-line history previews", () => {
    expect(
      formatAiChatPreview(
        "## Gợi ý\n- **Đáp án:** B. 5 — xem [lời giải](https://example.com)",
      ),
    ).toBe("Gợi ý Đáp án: B. 5 — xem lời giải");
    expect(formatAiChatPreview("**Đáp án đang bị cắt giữa chừng")).toBe(
      "Đáp án đang bị cắt giữa chừng",
    );
    expect(formatAiChatPreview("Tính 2*3 và x_1")).toBe("Tính 2*3 và x_1");
    expect(
      formatAiChatPreview(
        String.raw`Phép quay tâm $O$ giữ nguyên khoảng cách; \(A\) và \[B\]`,
      ),
    ).toBe("Phép quay tâm O giữ nguyên khoảng cách; A và B");
    expect(formatAiChatPreview("Giá $5")).toBe("Giá $5");
    expect(
      formatAiChatPreview(
        String.raw`Tính góc: $$ \begin{aligned} \dfrac{360^\circ}{n} \end{aligned}`,
      ),
    ).toBe("Tính góc: 360°/n");
    expect(formatAiChatPreview(String.raw`Điều kiện $b\ne0$`)).toBe("Điều kiện b≠0");
    expect(formatAiChatPreview(String.raw`Công thức bị cắt ở \frac`)).toBe(
      "Công thức bị cắt ở",
    );
  });

  test("renders conversation previews without raw Markdown formatting symbols", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto("/student/ai-chat?scope=LIBRARY");

    const historyList = page.getByTestId("ai-chat-history-list");
    await expect(historyList).toContainText("Mình muốn nối kiến thức Toán và Lý");
    await expect(historyList).toContainText("Phép quay tâm O giữ nguyên khoảng cách");
    await expect(historyList).not.toContainText("##");
    await expect(historyList).not.toContainText("**");
    await expect(historyList).not.toContainText("$O$");
    await expect(historyList).not.toContainText("\\");
  });

  test("uploads at most three images concurrently while preserving attachment order", async () => {
    let active = 0;
    let maxActive = 0;
    const completed: number[] = [];

    const result = await uploadChatImagesWithConcurrency(
      [0, 1, 2, 3, 4],
      async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, (5 - value) * 5));
        completed.push(value);
        active -= 1;
        return `file-${value}`;
      },
    );

    expect(maxActive).toBe(3);
    expect(completed).not.toEqual([0, 1, 2, 3, 4]);
    expect(result).toEqual(["file-0", "file-1", "file-2", "file-3", "file-4"]);
  });

  test("keeps one history for LIBRARY and COURSE and renders streamed deltas", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto("/student/ai-chat?scope=LIBRARY");

    await expect(page.getByTestId("student-ai-chat-screen")).toBeVisible();
    await expect(page.getByTestId("ai-chat-history-list")).toContainText(
      "Hỏi chung các khóa đã mua",
    );
    await expect(page.getByTestId("ai-chat-history-list")).toContainText("Ôn tập Toán 9");

    await page.getByTestId("new-ai-chat-button").click();
    await page.getByTestId("ai-chat-composer").fill("Định lý Pythagoras dùng thế nào?");
    await page.getByTestId("send-ai-chat-message").click();

    await expect(
      page.getByRole("heading", { name: "Định lý Pythagoras dùng thế nào?" }),
    ).toBeVisible({ timeout: 200 });

    await expect(page.locator('[data-message-role="user"]')).toContainText(
      "Định lý Pythagoras dùng thế nào?",
    );
    await expect(page.locator('[data-message-role="assistant"]')).toContainText(
      "Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông",
    );
    const assistantBubble = page.locator('[data-message-role="assistant"]');
    const assistantFormula = assistantBubble.locator(".math-block");
    await expect(assistantFormula).toBeVisible();
    const renderedFormula = assistantFormula.locator(".katex-display");
    await expect(renderedFormula).toBeVisible();
    await expect
      .poll(() =>
        renderedFormula.evaluate((element) => getComputedStyle(element).textAlign),
      )
      .toBe("center");
    await expect(assistantBubble.locator(".mmd-content--left-aligned")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Ứng dụng định lý Pythagoras" }),
    ).toBeVisible();
    await expect(
      page.getByText("Tối đa 3 ảnh · 2 MB/ảnh", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Đính kèm ảnh" })).toHaveCount(0);
  });

  test("hides upload only after selecting every image still available today", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await setupApi(page, {
      studentDailyImageLimit: 7,
      studentDailyImageUsed: 5,
      studentDailyImageRemaining: 2,
    });
    await page.goto("/student/ai-chat?scope=LIBRARY");
    await page.getByTestId("new-ai-chat-button").click();

    await expect(page.getByRole("button", { name: "Đính kèm ảnh" })).toBeVisible();
    await page.getByTestId("ai-chat-image-input").setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: Buffer.from("one") },
      { name: "two.png", mimeType: "image/png", buffer: Buffer.from("two") },
    ]);

    await expect(page.getByRole("button", { name: /^Bỏ ảnh/u })).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Đính kèm ảnh" })).toHaveCount(0);

    await page.getByRole("button", { name: "Bỏ ảnh one.png" }).click();
    await expect(page.getByRole("button", { name: "Đính kèm ảnh" })).toBeVisible();
  });

  test("keeps active runner context when an old conversation is opened", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto(
      "/student/ai-chat?scope=COURSE&learningPathId=33333333-3333-4333-8333-333333333333&surfaceLessonId=77777777-7777-4777-8777-777777777777&activityType=QUIZ_ATTEMPT&activityId=88888888-8888-4888-8888-888888888888&targetType=QUIZ_QUESTION&targetId=99999999-9999-4999-8999-999999999999",
    );

    await page.getByRole("button", { name: /Hỏi chung các khóa đã mua/u }).click();

    await expect(page).toHaveURL(/conversation=11111111-1111-4111-8111-111111111111/u);
    await expect(page).toHaveURL(/activityType=QUIZ_ATTEMPT/u);
    await expect(page).toHaveURL(/activityId=88888888-8888-4888-8888-888888888888/u);
    await expect(page).toHaveURL(/targetType=QUIZ_QUESTION/u);
    await expect(page).toHaveURL(/targetId=99999999-9999-4999-8999-999999999999/u);
  });

  test("sends the verified runner identifiers for a new Quiz chat", async ({ page }) => {
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto(
      "/student/ai-chat?scope=COURSE&learningPathId=33333333-3333-4333-8333-333333333333&surfaceLessonId=77777777-7777-4777-8777-777777777777&activityType=QUIZ_ATTEMPT&activityId=88888888-8888-4888-8888-888888888888&targetType=QUIZ_QUESTION&targetId=99999999-9999-4999-8999-999999999999",
    );
    await page.getByTestId("new-ai-chat-button").click();
    await page.getByTestId("ai-chat-composer").fill("Gợi ý cho em câu này");

    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/student/ai-chat/conversations/messages/stream"),
    );
    await page.getByTestId("send-ai-chat-message").click();
    const request = await requestPromise;

    expect(request.postDataJSON()).toMatchObject({
      activityType: "QUIZ_ATTEMPT",
      activityId: "88888888-8888-4888-8888-888888888888",
      targetType: "QUIZ_QUESTION",
      targetId: "99999999-9999-4999-8999-999999999999",
    });
  });

  test("sends a review target without pretending it is an active runner", async ({
    page,
  }) => {
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto(
      "/student/ai-chat?scope=COURSE&learningPathId=33333333-3333-4333-8333-333333333333&surfaceLessonId=77777777-7777-4777-8777-777777777777&targetType=TEST_QUESTION&targetId=99999999-9999-4999-8999-999999999999",
    );
    await page.getByTestId("new-ai-chat-button").click();
    await page.getByTestId("ai-chat-composer").fill("Giải thích câu này cho em");

    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/student/ai-chat/conversations/messages/stream"),
    );
    await page.getByTestId("send-ai-chat-message").click();
    const body = (await requestPromise).postDataJSON();

    expect(body).toMatchObject({
      targetType: "TEST_QUESTION",
      targetId: "99999999-9999-4999-8999-999999999999",
    });
    expect(body).not.toHaveProperty("activityType");
    expect(body).not.toHaveProperty("activityId");
  });

  test("forwards the frozen Video playback timestamp to Chat AI", async ({ page }) => {
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto(
      "/student/ai-chat?scope=COURSE&learningPathId=33333333-3333-4333-8333-333333333333&surfaceLessonId=77777777-7777-4777-8777-777777777777&videoPlaybackSeconds=125",
    );
    await page.getByTestId("new-ai-chat-button").click();
    await page.getByTestId("ai-chat-composer").fill("Em chưa hiểu đoạn đang phát");

    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/student/ai-chat/conversations/messages/stream"),
    );
    await page.getByTestId("send-ai-chat-message").click();
    const body = (await requestPromise).postDataJSON();

    expect(body).toMatchObject({
      scopeType: "COURSE",
      surfaceLessonId: "77777777-7777-4777-8777-777777777777",
      videoPlaybackSeconds: 125,
      message: "Em chưa hiểu đoạn đang phát",
    });
  });

  test("forwards every preferred lesson from a library entry to the stream request", async ({
    page,
  }) => {
    const firstLessonId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const secondLessonId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await seedStudentSession(page);
    await setupApi(page);
    await page.goto(
      `/student/ai-chat?scope=LIBRARY&preferredLessonId=${firstLessonId}&preferredLessonId=${secondLessonId}&preferredLessonId=${firstLessonId}`,
    );
    await page.getByTestId("new-ai-chat-button").click();
    await page.getByTestId("ai-chat-composer").fill("Em nên học tiếp bài nào?");

    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/student/ai-chat/conversations/messages/stream"),
    );
    await page.getByTestId("send-ai-chat-message").click();
    const body = (await requestPromise).postDataJSON();

    expect(body).toMatchObject({
      scopeType: "LIBRARY",
      preferredLessonIds: [firstLessonId, secondLessonId],
      message: "Em nên học tiếp bài nào?",
    });
    expect(body).not.toHaveProperty("surfaceLessonId");
  });
});

async function setupApi(
  page: Page,
  imageQuota: {
    studentDailyImageLimit: number;
    studentDailyImageUsed: number;
    studentDailyImageRemaining: number;
  } = {
    studentDailyImageLimit: 7,
    studentDailyImageUsed: 7,
    studentDailyImageRemaining: 0,
  },
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/u, "");

    if (request.method() === "GET" && pathname === "/me") {
      return json(route, {
        user: {
          id: "student-m9-6",
          role: "STUDENT",
          fullName: "Học sinh M9.6",
          email: "student-m9-6@classhero.test",
          username: "student-m9-6",
          phone: null,
        },
        studentProfile: { grade: 9 },
      });
    }
    if (request.method() === "GET" && pathname === "/student/ai-chat/settings") {
      return json(route, {
        embeddingCatalogItemId: "99999999-9999-4999-8999-999999999999",
        embeddingProvider: "OPENAI",
        embeddingModel: "text-embedding-3-small",
        embeddingDimensions: 1536,
        maxImagesPerMessage: 3,
        maxImageBytes: 2 * 1024 * 1024,
        allowedImageMimeTypes: ["image/jpeg", "image/png"],
        studentDailyMessageLimit: 9,
        studentDailyImageLimit: imageQuota.studentDailyImageLimit,
        studentDailyMessageUsed: 3,
        studentDailyMessageRemaining: 6,
        studentDailyImageUsed: imageQuota.studentDailyImageUsed,
        studentDailyImageRemaining: imageQuota.studentDailyImageRemaining,
        version: 4,
      });
    }
    if (request.method() === "GET" && pathname === "/student/ai-chat/conversations") {
      return json(route, {
        items: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            scopeType: "LIBRARY",
            learningPathId: null,
            title: "Hỏi chung các khóa đã mua",
            scopeLabel: "Các khóa học đã mua",
            preview:
              "## **Mình muốn nối kiến thức Toán và Lý** — Phép quay tâm $O$ giữ nguyên khoảng cách",
            lastMessageAt: now,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            scopeType: "COURSE",
            learningPathId: "33333333-3333-4333-8333-333333333333",
            title: "Ôn tập Toán 9",
            scopeLabel: "Toán 9 Tập 2",
            preview: "Giải thích hệ thức lượng",
            lastMessageAt: "2026-09-11T12:00:00.000Z",
            createdAt: now,
            updatedAt: now,
          },
        ],
        nextCursor: null,
      });
    }
    if (
      request.method() === "POST" &&
      pathname === "/student/ai-chat/conversations/messages/stream"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const assistantText = String.raw`Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông:

$$\begin{aligned}
c^2&=a^2+b^2\\
&=25.
\end{aligned}$$`;
      const assistant = {
        id: "55555555-5555-4555-8555-555555555555",
        role: "ASSISTANT",
        status: "COMPLETED",
        responsePolicy: "FULL_ANSWER",
        text: assistantText,
        errorCode: null,
        sources: ["66666666-6666-4666-8666-666666666666"],
        attachments: [],
        createdAt: now,
        updatedAt: now,
      };
      const frames = [
        {
          type: "started",
          conversationId: "44444444-4444-4444-8444-444444444444",
          userMessageId: "77777777-7777-4777-8777-777777777777",
          assistantMessageId: assistant.id,
          policy: "FULL_ANSWER",
          title: "Định lý Pythagoras dùng thế nào?",
        },
        {
          type: "delta",
          assistantMessageId: assistant.id,
          delta: "Bình phương cạnh huyền ",
        },
        {
          type: "delta",
          assistantMessageId: assistant.id,
          delta: "bằng tổng bình phương hai cạnh góc vuông.",
        },
        {
          type: "title_updated",
          conversationId: "44444444-4444-4444-8444-444444444444",
          title: "Ứng dụng định lý Pythagoras",
        },
        {
          type: "completed",
          conversationId: "44444444-4444-4444-8444-444444444444",
          message: assistant,
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: frames
          .map((frame) => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`)
          .join(""),
      });
    }
    if (request.method() === "GET" && pathname.includes("/messages")) {
      return json(route, { items: [], nextCursor: null });
    }
    return json(route, {});
  });
}

async function json(route: Route, data: unknown) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data }),
  });
}

async function seedStudentSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    role: "STUDENT",
    sub: "student-m9-6",
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
        email: "student-m9-6@classhero.test",
        fullName: "Học sinh M9.6",
        id: "student-m9-6",
        phone: null,
        role: "STUDENT",
        username: "student-m9-6",
      },
    },
  );
}

function createUnsignedToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}
