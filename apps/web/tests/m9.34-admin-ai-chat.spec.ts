import { expect, test, type Page, type Route } from "@playwright/test";

const now = "2026-09-13T07:30:00.000Z";
const sessionId = "11111111-1111-4111-8111-111111111111";
const pathId = "22222222-2222-4222-8222-222222222222";
const lessonId = "33333333-3333-4333-8333-333333333333";
const assistantMessageId = "44444444-4444-4444-8444-444444444444";
const quizQuestionId = "55555555-5555-4555-8555-555555555555";
const flashcardId = "66666666-6666-4666-8666-666666666666";
const testQuestionId = "77777777-7777-4777-8777-777777777777";
const imageFileId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test.describe("M9.34 Admin Chat AI simulation", () => {
  test("renders session previews without raw Markdown formatting symbols", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupApi(page, {
      historyPreview: "## **Đáp án:** Phép quay tâm $O$ giữ nguyên khoảng cách",
    });
    await page.goto("/admin/ai-chat");

    const historyItem = page.getByRole("button", { name: /Phiên có Markdown/u });
    await expect(historyItem).toContainText(
      "Đáp án: Phép quay tâm O giữ nguyên khoảng cách",
    );
    await expect(historyItem).not.toContainText("##");
    await expect(historyItem).not.toContainText("**");
    await expect(historyItem).not.toContainText("$O$");
    await expect(historyItem).not.toContainText("\\");
  });

  test("streams through the shared chat UI and exposes the redacted turn trace", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupApi(page);
    await page.goto("/admin/ai-chat");

    await expect(
      page.getByRole("heading", { name: "Chat với AI", level: 1 }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Toán 9/ }).click();
    await page.getByLabel("Buổi học").click();
    await page
      .getByRole("option", { name: "Tam giác vuông · Định lý Pythagoras" })
      .click();
    await page
      .getByPlaceholder("Nhập câu hỏi như một học sinh...")
      .fill("Giải thích định lý Pythagoras");
    await expect(
      page.getByRole("button", { name: "Xem toàn bộ input lượt gần nhất" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Gửi lượt mô phỏng" }).click();

    await expect(
      page.getByRole("heading", { name: "Giải thích định lý Pythagoras" }),
    ).toBeVisible({ timeout: 200 });

    const assistantMessage = page.locator('[data-message-role="assistant"]');
    await expect(assistantMessage).toContainText("Bình phương cạnh huyền");
    await expect(page.getByLabel("Tổng chi phí phiên")).toContainText("2.475 VNĐ");
    const turnMetrics = assistantMessage.getByLabel("Số liệu lượt phản hồi");
    await expect(turnMetrics).toContainText("Chi phí1.250 VNĐ");
    await expect(turnMetrics).toContainText("TTFT180 ms");
    await expect(turnMetrics).toContainText("Tổng thời gian950 ms");
    await expect(
      page.getByText("FULL_ANSWER · AI được phép nêu đáp án và giải thích đầy đủ"),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Định lý Pythagoras" })).toBeVisible();
    await page.getByRole("button", { name: "Xem input & chi phí" }).click();
    const traceDialog = page.getByRole("dialog", {
      name: "Chi tiết input và chi phí lượt chat",
    });
    await expect(traceDialog).toBeVisible();
    await expect(traceDialog.getByText("1.250 VNĐ").first()).toBeVisible();
    await expect(
      traceDialog.getByRole("group", { name: "Độ trễ phản hồi" }),
    ).toContainText("950 ms");
    await expect(traceDialog.getByRole("group", { name: "Token đầu vào" })).toContainText(
      "300",
    );
    await expect(traceDialog.getByRole("group", { name: "Token đầu ra" })).toContainText(
      "50",
    );
    await expect(traceDialog.getByRole("group", { name: "Tổng token" })).toContainText(
      "350",
    );
    await expect(traceDialog.getByText("CHAT_RESPONSE_GENERATION")).toBeVisible();
    const providerInputPreview = traceDialog.getByRole("region", {
      name: "Nội dung prompt và context gửi OpenAI",
    });
    await expect(
      providerInputPreview.getByRole("tab", { name: "System prompt" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      providerInputPreview.getByText(/Bạn là trợ giảng AI của ClassHero/),
    ).toBeVisible();
    const markdownPreview = providerInputPreview
      .getByTestId("admin-ai-prompt-markdown-preview")
      .locator(".mmd-content");
    await expect(markdownPreview).toHaveCSS("white-space", "normal");
    await expect(markdownPreview.locator("p").first()).toHaveCSS(
      "white-space",
      "pre-wrap",
    );
    await providerInputPreview.getByRole("tab", { name: "User prompt" }).click();
    await expect(
      providerInputPreview.getByText("Câu hỏi mới: Giải thích định lý Pythagoras"),
    ).toBeVisible();
    await providerInputPreview.getByRole("tab", { name: "Context chunks (1)" }).click();
    await expect(
      providerInputPreview.getByText(/Trong tam giác vuông, bình phương cạnh huyền/),
    ).toBeVisible();
    const contextChunkContent = providerInputPreview.locator(".mmd-content");
    await expect(contextChunkContent.locator("li")).toHaveCount(2);
    await expect(contextChunkContent.getByText("9.18.", { exact: true })).toBeVisible();
    await expect(contextChunkContent).not.toContainText("\\begin{itemize}");
    await expect(contextChunkContent).not.toContainText("\\item[9.18.]");
    await expect(providerInputPreview.getByText("Liên quan 0,94")).toBeVisible();
    await providerInputPreview.getByRole("button", { name: "Thu gọn Chunk 1" }).click();
    await expect(
      providerInputPreview.getByText(/Trong tam giác vuông, bình phương cạnh huyền/),
    ).toBeHidden();
    await expect(
      providerInputPreview.getByRole("button", { name: "Mở rộng Chunk 1" }),
    ).toHaveAttribute("aria-expanded", "false");
    await providerInputPreview.getByRole("button", { name: "Mở rộng Chunk 1" }).click();
    await expect(
      providerInputPreview.getByText(/Trong tam giác vuông, bình phương cạnh huyền/),
    ).toBeVisible();
    await traceDialog.getByRole("button", { name: "Đóng" }).last().click();
    await expect(traceDialog).toBeHidden();

    await page.getByRole("button", { name: "Thiết lập mặc định", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Chat với AI", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tạo câu trả lời" })).toBeVisible();
    await expect(page.getByLabel("Mức sáng tạo (Temperature)")).toBeVisible();

    const responseModel = page.getByRole("combobox", { name: "Mô hình chính" });
    await responseModel.click();
    await expect(
      page.getByRole("option", { name: "Text Embedding 3 Small" }),
    ).toHaveCount(0);
    await page.getByRole("option", { name: "GPT 5.6 Sol" }).click();
    await expect(page.getByLabel("Reasoning Effort")).toBeVisible();
    await expect(page.getByLabel("Mức sáng tạo (Temperature)")).toHaveCount(0);

    const embeddingModel = page.getByRole("combobox", {
      name: "Mô hình embedding",
    });
    await embeddingModel.click();
    await expect(
      page.getByRole("option", { name: "Text Embedding 3 Small" }),
    ).toBeVisible();
    await expect(page.getByRole("option", { name: "GPT 5.6 Luna" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await expect(page.getByLabel("Số câu hỏi AI tối đa mỗi học sinh/ngày")).toHaveValue(
      "20",
    );
    await expect(page.getByLabel("Số ảnh tối đa mỗi học sinh/ngày")).toHaveValue("20");
    await expect(page.getByLabel("Số ảnh tối đa mỗi lượt")).toHaveValue("5");
    await expect(page.getByLabel("Dung lượng tối đa mỗi ảnh")).toHaveValue("10");
  });

  test("separates primary and fallback controls by each model capability", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupApi(page);
    await page.goto("/admin/ai-chat");

    const conversationLocator = page.locator(
      '[data-admin-ai-chat-column="conversation"]',
    );
    const configurationLocator = page.locator(
      '[data-admin-ai-chat-column="configuration"]',
    );
    const conversationColumn = await conversationLocator.boundingBox();
    expect(conversationColumn).not.toBeNull();
    if ((page.viewportSize()?.width ?? 0) >= 1_280) {
      const configurationColumn = await configurationLocator.boundingBox();
      expect(configurationColumn).not.toBeNull();
      expect(configurationColumn!.width).toBeLessThan(conversationColumn!.width);
      expect(
        conversationColumn!.width - configurationColumn!.width,
      ).toBeGreaterThanOrEqual(80);
    } else {
      await expect(configurationLocator).toBeHidden();
      await page.getByRole("button", { name: "Cấu hình" }).click();
      await expect(configurationLocator).toBeVisible();
    }

    await expect(page.locator("select")).toHaveCount(0);
    await expect(page.getByText("Kế thừa mặc định", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Model chính", { exact: true })).toHaveText(
      "GPT 5.6 Luna (gpt-5.6-luna)",
    );
    await expect(page.getByLabel("Temperature model chính")).toHaveValue("0.2");
    await expect(page.getByLabel("Max input model chính")).toHaveValue("20000");
    await expect(page.getByLabel("Max output model chính")).toHaveValue("1200");
    await expect(page.getByLabel("Model dự phòng", { exact: true })).toHaveText(
      "Không dùng dự phòng",
    );
    await expect(page.getByLabel("Temperature model chính")).toBeVisible();
    await expect(page.getByLabel("Reasoning Effort model chính")).toHaveCount(0);
    await expect(page.getByLabel("Temperature model dự phòng")).toHaveCount(0);

    await page.getByLabel("Model dự phòng", { exact: true }).click();
    await page.getByRole("option", { name: "GPT 5.6 Sol (gpt-5.6-sol)" }).click();
    await expect(page.getByLabel("Reasoning Effort model dự phòng")).toBeVisible();
    await expect(page.getByLabel("Temperature model chính")).toBeVisible();

    await page.getByLabel("Model chính", { exact: true }).click();
    await page.getByRole("option", { name: "GPT 5.6 Sol (gpt-5.6-sol)" }).click();
    await expect(page.getByLabel("Reasoning Effort model chính")).toBeVisible();
    await page.getByLabel("Reasoning Effort model chính").click();
    await page.getByRole("option", { name: "high" }).click();
    await expect(page.getByLabel("Reasoning Effort model chính")).toHaveText("high");
    await expect(page.getByLabel("Temperature model chính")).toHaveCount(0);
    await expect(page.getByLabel("Reasoning Effort model dự phòng")).toHaveCount(0);

    await page.getByLabel("Model dự phòng", { exact: true }).click();
    await page.getByRole("option", { name: "GPT 5.6 Luna (gpt-5.6-luna)" }).click();
    await expect(page.getByLabel("Temperature model dự phòng")).toBeVisible();
    await expect(page.getByLabel("Reasoning Effort model chính")).toBeVisible();

    await page.getByRole("button", { name: "Khôi phục thiết lập mặc định" }).click();
    await expect(page.getByLabel("Model chính", { exact: true })).toHaveText(
      "GPT 5.6 Luna (gpt-5.6-luna)",
    );
    await expect(page.getByLabel("Temperature model chính")).toHaveValue("0.2");
    await expect(page.getByLabel("Model dự phòng", { exact: true })).toHaveText(
      "Không dùng dự phòng",
    );
  });

  test("sends the current playback timestamp for Video simulation", async ({ page }) => {
    await seedAdminSession(page);
    await setupApi(page);
    await page.goto("/admin/ai-chat");

    await page.getByRole("button", { name: /Toán 9/ }).click();
    await page.getByLabel("Buổi học").click();
    await page
      .getByRole("option", { name: "Tam giác vuông · Định lý Pythagoras" })
      .click();
    await page.getByRole("button", { name: "Tóm tắt video", exact: true }).click();
    await page.getByTestId("admin-ai-chat-video-playback-seconds").fill("95");
    await page
      .getByPlaceholder("Nhập câu hỏi như một học sinh...")
      .fill("Giải thích đoạn đang phát");

    const requestPromise = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().endsWith("/admin/ai-chat/sessions/messages/stream"),
    );
    await page.getByRole("button", { name: "Gửi lượt mô phỏng" }).click();
    const request = await requestPromise;

    expect(request.postDataJSON()).toMatchObject({
      scopeType: "LESSON",
      lessonId,
      surfaceLessonId: lessonId,
      simulationSurface: "VIDEO_SUMMARY",
      videoPlaybackSeconds: 95,
      message: "Giải thích đoạn đang phát",
    });
  });

  test("simulates the same Quiz hint and Test blocking states as Student Chat", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupApi(page);
    await page.goto("/admin/ai-chat");

    await page.getByRole("button", { name: "Một khóa học" }).click();
    await page.getByRole("button", { name: /Toán 9/ }).click();
    await page.getByLabel("Buổi học hiện tại (không bắt buộc)").click();
    await page
      .getByRole("option", { name: "Tam giác vuông · Định lý Pythagoras" })
      .click();

    for (const tab of ["Tóm tắt video", "Sinh kiến thức", "Quiz", "Flashcard", "Test"]) {
      await expect(page.getByRole("button", { name: tab, exact: true })).toBeVisible();
    }
    await expect(
      page.getByText(
        "Không bắt buộc. Dù chọn hay không chọn tab, phạm vi chat vẫn là toàn khóa; buổi học hiện tại chỉ được ưu tiên.",
      ),
    ).toBeVisible();

    await page.getByRole("button", { name: "Quiz", exact: true }).click();
    await expect(page.getByLabel("Bộ câu hỏi")).toHaveText("Bộ Quiz Pythagoras");
    await expect(page.getByLabel("Nội dung Câu 1").locator(".katex")).toBeVisible();
    await page.getByText("Cạnh huyền là cạnh nào?", { exact: true }).click();
    await expect(page.getByText("Chính sách và phạm vi trả lời")).toBeVisible();
    await expect(page.getByRole("radio", { name: /HINT_ONLY/ })).toBeChecked();
    await expect(
      page.getByRole("radio", { name: /FULL_ANSWER · MỤC HIỆN TẠI/ }),
    ).not.toBeChecked();
    await expect(
      page.getByText(
        "AI chỉ đưa gợi ý cho câu đang chọn, không nêu hoặc xác nhận đáp án.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "AI được nêu đáp án và giải thích câu đang chọn; câu khác vẫn chỉ được gợi ý.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("AI được nêu đáp án và giải thích mọi câu trong bộ đã hoàn thành."),
    ).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "quiz-context.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zr6sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await expect(page.getByAltText("quiz-context.png")).toBeVisible();

    await page
      .getByPlaceholder("Nhập câu hỏi như một học sinh...")
      .fill("Cho tôi một gợi ý");
    await page.getByRole("button", { name: "Gửi lượt mô phỏng" }).click();
    await expect(page.locator('[data-message-role="assistant"]')).toContainText(
      "Hãy bắt đầu từ công thức",
    );
    await expect(
      page.getByText("HINT_ONLY · AI chỉ gợi ý, không nêu hoặc xác nhận đáp án"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Flashcard", exact: true }).click();
    await expect(page.getByLabel("Nội dung Thẻ 1").locator(".katex")).toBeVisible();
    await page.getByText("Phát biểu định lý.", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /HINT_ONLY/ })).toBeChecked();
    await page.getByRole("radio", { name: /FULL_ANSWER · MỤC HIỆN TẠI/ }).check();
    await expect(
      page.getByRole("radio", { name: /FULL_ANSWER · MỤC HIỆN TẠI/ }),
    ).toBeChecked();
    await page.getByRole("radio", { name: /FULL_ANSWER · TOÀN PHẠM VI/ }).check();
    await expect(
      page.getByRole("radio", { name: /FULL_ANSWER · TOÀN PHẠM VI/ }),
    ).toBeChecked();

    await page.getByRole("button", { name: "Test", exact: true }).click();
    await expect(page.getByLabel("Nội dung Câu 1").locator(".katex")).toBeVisible();
    await page.getByText("Tính độ dài cạnh huyền.", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /BLOCKED/ })).toBeChecked();
    await expect(
      page.getByText(
        "AI không nhận câu hỏi và không trả lời khi học sinh đang làm bài thi.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("AI được nêu đáp án và giải thích mọi câu trong bài thi đã nộp."),
    ).toBeVisible();
    await expect(
      page.getByText(/Chat AI tạm khóa trong khi học sinh đang làm bài thi/),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Chat bị khóa trong khi đang làm bài thi"),
    ).toBeDisabled();

    await page.getByRole("radio", { name: /FULL_ANSWER · TOÀN PHẠM VI/ }).check();
    await expect(page.getByPlaceholder("Nhập câu hỏi như một học sinh...")).toBeEnabled();
    await page.getByRole("button", { name: "Bỏ ngữ cảnh" }).click();
    await expect(
      page.getByRole("radio", { name: /FULL_ANSWER · TOÀN PHẠM VI/ }),
    ).toHaveCount(0);
  });

  test("restores the current lesson when reopening a course simulation", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupApi(page, { restoredCourseSession: true });
    await page.goto("/admin/ai-chat");

    await page.getByRole("button", { name: /Phiên toàn khóa/u }).click();

    const currentLesson = page.getByLabel("Buổi học hiện tại (không bắt buộc)");
    await expect(currentLesson).toHaveText(/Tam giác vuông · Định lý Pythagoras/u);
    await expect(
      page.getByText(
        "Không bắt buộc. Dù chọn hay không chọn tab, phạm vi chat vẫn là toàn khóa; buổi học hiện tại chỉ được ưu tiên.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Ngữ cảnh màn học sinh cho lượt tiếp theo",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^2\. Ngữ cảnh màn học sinh$/u }),
    ).toHaveCount(0);

    const courseContextPanel = page.getByTestId("admin-ai-chat-course-turn-context");
    const simulationContextPanel = page.getByTestId("admin-ai-chat-simulation-context");
    await expect(courseContextPanel).toBeVisible();
    await expect(simulationContextPanel).toBeVisible();
    const [courseContextWidth, simulationContextWidth] = await Promise.all([
      courseContextPanel.evaluate((element) => element.getBoundingClientRect().width),
      simulationContextPanel.evaluate((element) => element.getBoundingClientRect().width),
    ]);
    expect(Math.abs(courseContextWidth - simulationContextWidth)).toBeLessThan(1);

    await page.getByRole("button", { name: "Sinh kiến thức", exact: true }).click();
    await expect(
      page.getByText(
        /Chat dùng `FULL_ANSWER` trong toàn khóa học; buổi hiện tại chỉ được ưu tiên\./u,
      ),
    ).toBeVisible();

    await currentLesson.click();
    await page.getByRole("option", { name: "Không chọn buổi hiện tại" }).click();
    await expect(
      page.getByRole("heading", { name: "Ngữ cảnh màn học sinh" }),
    ).toHaveCount(0);
  });
});

async function setupApi(
  page: Page,
  options?: { historyPreview?: string; restoredCourseSession?: boolean },
) {
  let completedMessage = {
    id: assistantMessageId,
    role: "ASSISTANT",
    status: "COMPLETED",
    responsePolicy: "FULL_ANSWER",
    text: "Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.",
    errorCode: null,
    turnTraceId: "55555555-5555-4555-8555-555555555555",
    turnMetrics: {
      totalCostVnd: 1_250,
      timeToFirstTokenMs: 180,
      responseLatencyMs: 950,
    },
    sources: [],
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^\/api\/v1/u, "");

    if (request.method() === "GET" && pathname === "/me") {
      return json(route, {
        user: {
          id: "admin-m9-34",
          role: "ADMIN",
          fullName: "Admin M9.34",
          email: "admin-m9-34@classhero.test",
          username: "admin-m9-34",
          phone: null,
        },
      });
    }
    if (
      request.method() === "GET" &&
      pathname === "/admin/provider-operations/ai-configurations"
    ) {
      return json(route, {
        configurations: [
          {
            feature: "CHAT",
            purpose: "TEXT",
            primaryCatalogItemId: "66666666-6666-4666-8666-666666666666",
            fallbackCatalogItemId: null,
            temperature: 0.2,
            reasoningEffort: null,
            maxInputTokens: 20000,
            maxOutputTokens: 1200,
            fallbackTemperature: null,
            fallbackReasoningEffort: null,
            fallbackMaxOutputTokens: null,
            version: 3,
            updatedAt: now,
          },
        ],
        models: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            provider: "OPENAI",
            externalKey: "gpt-5.6-luna",
            displayName: "GPT 5.6 Luna",
            capabilities: {
              features: ["CHAT"],
              aiConfiguration: "TEMPERATURE",
            },
            status: "ACTIVE",
            credentialConfigured: true,
          },
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            provider: "OPENAI",
            externalKey: "gpt-5.6-sol",
            displayName: "GPT 5.6 Sol",
            capabilities: {
              features: ["CHAT"],
              aiConfiguration: "REASONING_EFFORT",
              reasoningEffortLevels: ["low", "medium", "high"],
            },
            status: "ACTIVE",
            credentialConfigured: true,
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            provider: "OPENAI",
            externalKey: "text-embedding-3-small",
            displayName: "Text Embedding 3 Small",
            capabilities: {
              features: ["EMBEDDING"],
              dimensions: [1536],
            },
            status: "ACTIVE",
            credentialConfigured: true,
          },
        ],
        chatSettings: {
          embeddingCatalogItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          embeddingProvider: "OPENAI",
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 1536,
          maxImagesPerMessage: 5,
          maxImageBytes: 10485760,
          allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
          studentDailyMessageLimit: 20,
          studentDailyImageLimit: 20,
          version: 1,
        },
      });
    }
    if (request.method() === "GET" && pathname === "/admin/ai-chat/sessions") {
      return json(route, {
        items: options?.restoredCourseSession
          ? [
              {
                id: sessionId,
                scopeType: "COURSE",
                title: "Phiên toàn khóa",
                scopeLabel: "Toán 9",
                scopeItems: [
                  {
                    learningPathId: pathId,
                    learningPathTitle: "Toán 9",
                    lessonId: null,
                    lessonTitle: null,
                  },
                ],
                lastSurfaceLessonId: lessonId,
                configurationVersion: 1,
                preview: "Giải thích định lý Pythagoras",
                lastMessageStatus: "COMPLETED",
                lastMessageAt: now,
                createdAt: now,
                updatedAt: now,
              },
            ]
          : options?.historyPreview
            ? [
                {
                  id: sessionId,
                  scopeType: "LESSON",
                  title: "Phiên có Markdown",
                  scopeLabel: "Toán 9 / Định lý Pythagoras",
                  scopeItems: [
                    {
                      learningPathId: pathId,
                      learningPathTitle: "Toán 9",
                      lessonId,
                      lessonTitle: "Định lý Pythagoras",
                    },
                  ],
                  lastSurfaceLessonId: lessonId,
                  configurationVersion: 1,
                  preview: options.historyPreview,
                  lastMessageStatus: "COMPLETED",
                  lastMessageAt: now,
                  createdAt: now,
                  updatedAt: now,
                },
              ]
            : [],
        nextCursor: null,
      });
    }
    if (request.method() === "GET" && pathname === "/admin/ai-chat/scope-options") {
      return json(route, {
        learningPaths: [
          {
            id: pathId,
            title: "Toán 9",
            status: "PUBLISHED",
            domain: { name: "Toán học" },
            _count: { lessons: 1 },
          },
        ],
        lessons: url.searchParams.get("learningPathId")
          ? [
              {
                id: lessonId,
                learningPathId: pathId,
                title: "Định lý Pythagoras",
                status: "PUBLISHED",
                orderIndex: 1,
                chapter: { title: "Tam giác vuông", orderIndex: 1 },
              },
            ]
          : [],
      });
    }
    if (
      request.method() === "GET" &&
      pathname === `/admin/ai-chat/lessons/${lessonId}/context-options`
    ) {
      return json(route, {
        lessonId,
        surfaces: {
          videoSummary: { available: true },
          knowledge: { available: true },
        },
        quizSets: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            title: "Bộ Quiz Pythagoras",
            questions: [
              {
                id: quizQuestionId,
                questionType: "SINGLE_CHOICE",
                questionJson: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Cạnh huyền là cạnh nào?" },
                        { type: "inlineMath", attrs: { latex: "c^2=a^2+b^2" } },
                      ],
                    },
                  ],
                },
                difficulty: "EASY",
                sortOrder: 0,
              },
            ],
          },
        ],
        flashcardSets: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            title: "Bộ Flashcard Pythagoras",
            flashcards: [
              {
                id: flashcardId,
                frontJson: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Phát biểu định lý." },
                        { type: "inlineMath", attrs: { latex: "a^2+b^2=c^2" } },
                      ],
                    },
                  ],
                },
                difficulty: "EASY",
                sortOrder: 0,
              },
            ],
          },
        ],
        testSets: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            title: "Bài Test Pythagoras",
            durationSeconds: 900,
            questions: [
              {
                id: testQuestionId,
                questionType: "SHORT_ANSWER",
                questionJson: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Tính độ dài cạnh huyền." }],
                    },
                    { type: "blockMath", attrs: { latex: "c=\\sqrt{a^2+b^2}" } },
                  ],
                },
                difficulty: "MEDIUM",
                sortOrder: 0,
              },
            ],
          },
        ],
      });
    }
    if (request.method() === "POST" && pathname === "/files/upload") {
      return json(route, { id: imageFileId });
    }
    if (
      request.method() === "POST" &&
      pathname === "/admin/ai-chat/sessions/messages/stream"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const body = request.postDataJSON() as Record<string, unknown>;
      const isQuizHint = body.message === "Cho tôi một gợi ý";
      const isVideoContext = body.message === "Giải thích đoạn đang phát";
      expect(body).toMatchObject(
        isQuizHint
          ? {
              scopeType: "COURSE",
              learningPathIds: [pathId],
              surfaceLessonId: lessonId,
              message: "Cho tôi một gợi ý",
              simulationSurface: "QUIZ",
              activityState: "UNANSWERED",
              targetType: "QUIZ_QUESTION",
              targetId: quizQuestionId,
              attachmentFileIds: [imageFileId],
            }
          : isVideoContext
            ? {
                scopeType: "LESSON",
                learningPathIds: [pathId],
                lessonId,
                surfaceLessonId: lessonId,
                message: "Giải thích đoạn đang phát",
                simulationSurface: "VIDEO_SUMMARY",
                videoPlaybackSeconds: 95,
              }
            : {
                scopeType: "LESSON",
                learningPathIds: [pathId],
                lessonId,
                surfaceLessonId: lessonId,
                message: "Giải thích định lý Pythagoras",
              },
      );
      if (!isQuizHint && !isVideoContext) {
        expect(body.simulationSurface).toBeUndefined();
        expect(body.activityState).toBeUndefined();
        expect(body.targetType).toBeUndefined();
        expect(body.targetId).toBeUndefined();
      }
      completedMessage = {
        ...completedMessage,
        responsePolicy: isQuizHint ? "HINT_ONLY" : "FULL_ANSWER",
        text: isQuizHint
          ? "Hãy bắt đầu từ công thức a² + b² = c²."
          : isVideoContext
            ? "Đoạn đang phát giải thích hệ thức cạnh trong tam giác vuông."
            : "Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.",
      };
      const frames = [
        {
          type: "started",
          conversationId: sessionId,
          userMessageId: "77777777-7777-4777-8777-777777777777",
          assistantMessageId,
          policy: isQuizHint ? "HINT_ONLY" : "FULL_ANSWER",
          title: isQuizHint
            ? "Gợi ý câu Quiz"
            : isVideoContext
              ? "Giải thích đoạn video"
              : "Giải thích định lý Pythagoras",
        },
        {
          type: "delta",
          assistantMessageId,
          delta: isQuizHint
            ? "Hãy bắt đầu từ công thức "
            : isVideoContext
              ? "Đoạn đang phát giải thích "
              : "Bình phương cạnh huyền ",
        },
        {
          type: "title_updated",
          conversationId: sessionId,
          title: isQuizHint
            ? "Gợi ý câu Quiz"
            : isVideoContext
              ? "Giải thích đoạn video"
              : "Định lý Pythagoras",
        },
        { type: "completed", conversationId: sessionId, message: completedMessage },
      ];
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream; charset=utf-8",
        body: frames
          .map((frame) => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`)
          .join(""),
      });
    }
    if (
      request.method() === "GET" &&
      pathname === `/admin/ai-chat/sessions/${sessionId}`
    ) {
      return json(route, {
        id: sessionId,
        scopeType: options?.restoredCourseSession ? "COURSE" : "LESSON",
        title: options?.restoredCourseSession
          ? "Phiên toàn khóa"
          : "Giải thích định lý Pythagoras",
        scopeLabel: options?.restoredCourseSession
          ? "Toán 9"
          : "Toán 9 / Định lý Pythagoras",
        scopeItems: [
          {
            learningPathId: pathId,
            learningPathTitle: "Toán 9",
            lessonId: options?.restoredCourseSession ? null : lessonId,
            lessonTitle: options?.restoredCourseSession ? null : "Định lý Pythagoras",
          },
        ],
        lastSurfaceLessonId: lessonId,
        configurationVersion: 1,
        configurationOverride: null,
        totalCostVnd: 2_475,
        preview: completedMessage.text,
        lastMessageStatus: "COMPLETED",
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (
      request.method() === "GET" &&
      pathname === `/admin/ai-chat/sessions/${sessionId}/messages`
    ) {
      return json(route, {
        items: [
          {
            ...completedMessage,
            id: "77777777-7777-4777-8777-777777777777",
            role: "USER",
            text: "Giải thích định lý Pythagoras",
            turnTraceId: null,
          },
          completedMessage,
        ],
        nextCursor: null,
      });
    }
    if (request.method() === "GET" && pathname.endsWith("/trace")) {
      return json(route, {
        id: "55555555-5555-4555-8555-555555555555",
        sessionId,
        userMessageId: "77777777-7777-4777-8777-777777777777",
        assistantMessageId,
        aiGenerationId: "88888888-8888-4888-8888-888888888888",
        scopeSnapshot: {
          scopeType: "LESSON",
          learningPathIds: [pathId],
          lessonIds: [lessonId],
        },
        defaultConfigurationVersion: 3,
        sessionConfigurationVersion: 1,
        configurationOverrideSnapshot: null,
        effectiveConfiguration: { model: "gpt-5.6-luna", maxOutputTokens: 1200 },
        providerRequest: {
          systemPrompt: "Bạn là trợ giảng AI của ClassHero",
          userPrompt: "Câu hỏi mới: Giải thích định lý Pythagoras",
          ragContext: [
            {
              order: 0,
              chunkId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              sourceType: "LESSON_DOCUMENT",
              learningPathId: pathId,
              learningPathTitle: "Toán 9",
              lessonId,
              lessonTitle: "Định lý Pythagoras",
              score: 0.94,
              content: String.raw`Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.
\begin{itemize}
\item[9.18.] Tính cạnh huyền.
\item[9.19.] Chứng minh hai góc bằng nhau.
\end{itemize}`,
              startSeconds: null,
              endSeconds: null,
            },
          ],
          imageReferences: [],
        },
        generation: {
          status: "SUCCEEDED",
          provider: "OPENAI",
          model: "gpt-5.6-luna",
          providerRequestId: "resp_m934",
          promptTokens: 300,
          completionTokens: 50,
          totalTokens: 350,
          estimatedCostVnd: 1250,
          latencyMs: 950,
          retryCount: 0,
          errorMessage: null,
          startedAt: now,
          finishedAt: now,
        },
        aggregate: {
          callCount: 1,
          totalCostVnd: 1250,
          totalTokens: 350,
          totalLatencyMs: 1750,
          timeToFirstTokenMs: 180,
        },
        usageEvents: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            operation: "CHAT_RESPONSE_GENERATION",
            provider: "OPENAI",
            model: "gpt-5.6-luna",
            modelLabel: "GPT 5.6 Luna",
            providerRequestId: "resp_m934",
            status: "SUCCEEDED",
            attempt: 1,
            cacheStatus: null,
            reasoningEffort: null,
            promptTokens: 300,
            cachedInputTokens: 0,
            cacheWriteInputTokens: 0,
            completionTokens: 50,
            totalTokens: 350,
            costVnd: 1250,
            estimatedCostUsd: 0.05,
            latencyMs: 950,
            timeToFirstTokenMs: 180,
            rawUsage: {},
            errorCode: null,
            startedAt: now,
            finishedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      });
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

async function seedAdminSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    role: "ADMIN",
    sub: "admin-m9-34",
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
        email: "admin-m9-34@classhero.test",
        fullName: "Admin M9.34",
        id: "admin-m9-34",
        phone: null,
        role: "ADMIN",
        username: "admin-m9-34",
      },
    },
  );
}

function createUnsignedToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}
