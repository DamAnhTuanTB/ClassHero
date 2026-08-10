import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-ai-m9-8";
const documentId = "11111111-1111-4111-8111-111111111111";
const processingDocumentId = "22222222-2222-4222-8222-222222222222";
const supplementalDocumentId = "33333333-3333-4333-8333-333333333333";
const questionTypes = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "MULTI_STATEMENT_TRUE_FALSE",
  "TEXT_INPUT",
];

test.describe("M9.8 admin AI generation panel", () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
  });

  test("uses custom controls and validates summary/quiz fields in realtime", async ({
    page,
  }) => {
    const mock = await setupAiGenerationMock(page);
    await page.goto(`/admin/lessons/${lessonId}`);

    await expect(
      page.getByRole("heading", { name: "Tạo nội dung bằng AI" }),
    ).toBeVisible();
    for (const name of ["Kiến thức", "Quiz", "Flashcard", "Test"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }

    await generationCard(page, "Kiến thức")
      .getByRole("button", { name: "Cấu hình" })
      .click();
    const summaryDialog = page.getByRole("dialog", { name: "Tạo Kiến thức bằng AI" });
    await expect(summaryDialog.locator("select")).toHaveCount(0);
    await expect(summaryDialog.getByLabel("Cách trình bày")).toBeVisible();
    const documentSelect = summaryDialog.getByLabel("Tài liệu dùng để tạo", {
      exact: true,
    });
    await expect(documentSelect).toContainText("Giáo trình Toán 7 (trang 5–9)");
    await documentSelect.click();
    const documentList = summaryDialog.getByRole("listbox", {
      name: "Tài liệu dùng để tạo",
    });
    await expect(
      documentList.getByRole("option", { name: "Giáo trình Toán 7" }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      documentList.getByRole("option", {
        name: /Giáo trình Toán 7.*Trích xuất trang 5–9/,
      }),
    ).toBeVisible();
    await expect(
      documentList.getByRole("option", { name: /Phiếu bài tập.*Đang xử lý/ }),
    ).toBeDisabled();
    await expect(
      documentList.getByRole("option", { name: "Tài liệu tham khảo" }),
    ).toHaveAttribute("aria-selected", "false");
    await documentList.getByRole("option", { name: "Giáo trình Toán 7" }).click();
    await expect(summaryDialog.getByText("Chọn ít nhất một tài liệu")).toBeVisible();
    await expect(
      summaryDialog.getByRole("button", { name: "Bắt đầu tạo" }),
    ).toBeEnabled();
    await summaryDialog.getByRole("button", { name: "Hủy" }).click();

    await generationCard(page, "Quiz").getByRole("button", { name: "Cấu hình" }).click();
    const quizDialog = page.getByRole("dialog", { name: "Tạo Quiz bằng AI" });
    await quizDialog.getByLabel("Số câu hỏi").fill("2");
    await expect(
      quizDialog.getByText("Số câu phải lớn hơn hoặc bằng số loại câu hỏi đã chọn"),
    ).toBeVisible();
    await quizDialog.getByLabel("Nhiều mệnh đề Đúng / Sai").uncheck();
    await quizDialog.getByLabel("Nhập đáp án").uncheck();
    await expect(
      quizDialog.getByText("Số câu phải lớn hơn hoặc bằng số loại câu hỏi đã chọn"),
    ).toHaveCount(0);
    await quizDialog.getByLabel("Mức độ").click();
    await quizDialog.getByRole("option", { name: "Khó" }).click();
    await expect(quizDialog.getByLabel("Mức độ")).toContainText("Khó");
    await quizDialog.getByRole("button", { name: "Bắt đầu tạo" }).click();

    await expect
      .poll(() => mock.payloads.QUIZ)
      .toEqual({
        questionCount: 2,
        difficulty: "HARD",
        questionTypes: ["MULTIPLE_CHOICE", "TRUE_FALSE"],
      });
    await expect(page.getByRole("tab", { name: /Quiz AI/ })).toBeVisible();
    await expect(page.getByText("Cần duyệt", { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);
  });

  test("validates flashcard/test configuration and sends normalized payloads", async ({
    page,
  }) => {
    const mock = await setupAiGenerationMock(page);
    await page.goto(`/admin/lessons/${lessonId}`);

    await generationCard(page, "Flashcard")
      .getByRole("button", { name: "Cấu hình" })
      .click();
    const flashcardDialog = page.getByRole("dialog", {
      name: "Tạo Flashcard bằng AI",
    });
    await flashcardDialog.getByLabel("Số thẻ").fill("6abc");
    await expect(flashcardDialog.getByLabel("Số thẻ")).toHaveValue("6");
    await flashcardDialog.getByLabel("Mức độ").click();
    await flashcardDialog.getByRole("option", { name: "Khó" }).click();
    await flashcardDialog.getByRole("button", { name: "Bắt đầu tạo" }).click();
    await expect
      .poll(() => mock.payloads.FLASHCARD)
      .toEqual({
        cardCount: 6,
        difficulty: "HARD",
      });

    await generationCard(page, "Test").getByRole("button", { name: "Cấu hình" }).click();
    const testDialog = page.getByRole("dialog", { name: "Tạo bài Test bằng AI" });
    await testDialog.getByLabel("Khó (%)").fill("10");
    await expect(
      testDialog.getByText("Tổng ba tỷ lệ phải bằng 100% (hiện là 90%)"),
    ).toBeVisible();
    await expect(testDialog.getByRole("button", { name: "Bắt đầu tạo" })).toBeEnabled();
    await testDialog.getByLabel("Dễ (%)").fill("40");
    await expect(testDialog.getByText(/Tổng ba tỷ lệ phải bằng 100%/)).toHaveCount(0);
    await testDialog.getByLabel("Số câu hỏi").fill("3");
    await expect(
      testDialog.getByText("Số câu phải lớn hơn hoặc bằng số loại câu hỏi đã chọn"),
    ).toBeVisible();
    await testDialog.getByLabel("Số câu hỏi").fill("4");
    await testDialog.getByLabel("Thời gian làm bài (phút)").fill("20");
    await expect(testDialog.locator("select")).toHaveCount(0);
    await testDialog.getByRole("button", { name: "Bắt đầu tạo" }).click();
    await expect
      .poll(() => mock.payloads.TEST)
      .toEqual({
        questionCount: 4,
        durationSeconds: 1_200,
        difficultyRatio: { easy: 0.4, medium: 0.5, hard: 0.1 },
        questionTypes,
      });
    await expect(page.getByRole("tab", { name: /Test AI/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);
  });

  test("configures a summary and shows the exact system, user and full input prompts", async ({
    page,
  }) => {
    const mock = await setupAiGenerationMock(page);
    await page.goto(`/admin/lessons/${lessonId}`);

    await generationCard(page, "Kiến thức")
      .getByRole("button", { name: "Cấu hình" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Tạo Kiến thức bằng AI" });
    await expect(
      dialog.getByLabel("Tài liệu dùng để tạo", { exact: true }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Học thuật, chặt chẽ" }).click();
    await expect(dialog.getByLabel("Cách trình bày")).toHaveValue(
      "Học thuật, chặt chẽ, có cấu trúc rõ ràng và dùng thuật ngữ chính xác.",
    );
    await dialog.getByLabel("Độ dài Kiến thức").click();
    await dialog.getByRole("option", { name: "Chi tiết" }).click();
    await expect(dialog.getByLabel("Số lượng từ")).toHaveValue("");
    await dialog.getByLabel("Số lượng từ").fill("350");

    await expect(dialog.getByLabel("Yêu cầu bổ sung")).toHaveAttribute(
      "placeholder",
      "Ví dụ: Dùng câu ngắn, nhấn mạnh các bước giải và hạn chế thuật ngữ khó",
    );
    await dialog.getByLabel("Yêu cầu bổ sung").fill("Dùng tiêu đề ngắn");

    await expect(dialog.getByText("Cấu hình nâng cao và dữ liệu gửi AI")).toHaveCount(0);
    await expect(
      dialog.getByText("Xem lại dữ liệu theo các lựa chọn hiện tại."),
    ).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "System instructions" })).toBeVisible();
    await expect(dialog.getByLabel("System instructions")).toHaveValue(
      "SYSTEM PROMPT THỰC TẾ",
    );
    await dialog.getByLabel("System instructions").fill("SYSTEM CUSTOM");

    await dialog.getByRole("tab", { name: "User prompt" }).click();
    await dialog.getByLabel("User prompt").fill("USER CUSTOM");
    await dialog.getByRole("tab", { name: "Input đầy đủ" }).click();
    const fullInputPanel = dialog.getByRole("tabpanel");
    await fullInputPanel.getByRole("button", { name: "Xổ toàn bộ" }).click();
    await expect(fullInputPanel).toContainText('"instructions":"SYSTEM CUSTOM"');
    await expect(fullInputPanel).toContainText('"type":"json_schema"');
    await expect(fullInputPanel).toContainText(
      '"name":"lesson_summary_provider_contract"',
    );
    await expect(fullInputPanel).toContainText("NỘI DUNG CHUNK THỰC TẾ");

    await dialog.getByRole("button", { name: "Model", exact: true }).click();
    await dialog.getByRole("option", { name: "OpenAI · gpt-5.6-luna" }).click();
    await dialog.getByLabel("Reasoning Effort").click();
    await expect(dialog.getByRole("option", { name: "Thấp (Low)" })).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: "Rất cao (Extra High)" }),
    ).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Tối đa (Max)" })).toHaveCount(0);
    await dialog.getByRole("option", { name: "Rất cao (Extra High)" }).click();

    await dialog.getByRole("button", { name: "Model", exact: true }).click();
    await dialog.getByRole("option", { name: "OpenAI · gpt-4.1-mini" }).click();
    await expect(dialog.getByLabel("Reasoning Effort")).toHaveCount(0);
    await dialog.getByLabel("Temperature").fill("1.5");
    await expect(dialog.getByText("Temperature phải từ 0 đến 1")).toBeVisible();
    await dialog.getByLabel("Temperature").fill("0.1");
    await dialog.getByLabel("Giới hạn token đầu ra").fill("5999");
    await expect(
      dialog.getByText("Số token đầu ra phải từ 8000 đến 32000"),
    ).toBeVisible();
    await dialog.getByLabel("Giới hạn token đầu ra").fill("8000");
    await dialog.getByRole("button", { name: "Cập nhật dữ liệu gửi AI" }).click();
    await expect.poll(() => mock.promptPreviewPayloads.length).toBeGreaterThan(1);
    await dialog.getByRole("tab", { name: "User prompt" }).click();
    await expect(dialog.getByLabel("User prompt")).toHaveValue(/"targetWordCount":350/);
    expect(mock.promptPreviewPayloads.at(-1)).not.toHaveProperty("userPrompt");

    const resolvedSystemPrompt = `SYSTEM PROMPT THỰC TẾ\n${"S".repeat(15_501)}`;
    await dialog.getByRole("tab", { name: "System instructions" }).click();
    await dialog.getByLabel("System instructions").fill(resolvedSystemPrompt);
    await expect(dialog.getByText(/System instructions tối đa/u)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Bắt đầu tạo" }).click();
    await expect
      .poll(() => mock.payloads.SUMMARY)
      .toEqual({
        documentIds: [documentId],
        style: "academic",
        styleInstructions:
          "Học thuật, chặt chẽ, có cấu trúc rõ ràng và dùng thuật ngữ chính xác.",
        length: "detailed",
        targetWordCount: 350,
        extraInstructions: "Dùng tiêu đề ngắn",
        systemInstructions: resolvedSystemPrompt,
        userPrompt: expect.stringContaining('"targetWordCount":350'),
        model: "gpt-4.1-mini",
        temperature: 0.1,
        maxOutputTokens: 8_000,
      });
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);
  });

  test("submits xhigh for the configured model and deduplicates rapid preview clicks", async ({
    page,
  }) => {
    const mock = await setupAiGenerationMock(page);
    await page.goto(`/admin/lessons/${lessonId}`);

    await generationCard(page, "Kiến thức")
      .getByRole("button", { name: "Cấu hình" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Tạo Kiến thức bằng AI" });
    await expect(dialog.getByLabel("System instructions")).toHaveValue(
      "SYSTEM PROMPT THỰC TẾ",
    );
    await dialog.getByRole("button", { name: "Model", exact: true }).click();
    await dialog.getByRole("option", { name: "OpenAI · gpt-5.6-luna" }).click();
    await dialog.getByLabel("Reasoning Effort").click();
    await dialog.getByRole("option", { name: "Rất cao (Extra High)" }).click();
    await dialog.getByLabel("Giới hạn token đầu ra").fill("20000");

    const refreshButton = dialog.getByRole("button", {
      name: "Cập nhật dữ liệu gửi AI",
    });
    await refreshButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await expect.poll(() => mock.promptPreviewPayloads.length).toBe(2);
    await dialog.getByRole("tab", { name: "Input đầy đủ" }).click();
    await expect(dialog.getByRole("tabpanel")).toContainText(
      '"reasoning_effort":"xhigh"',
    );
    await expect(dialog.getByRole("tabpanel")).not.toContainText('"temperature"');

    await dialog.getByRole("button", { name: "Bắt đầu tạo" }).click();
    await expect
      .poll(() => mock.payloads.SUMMARY)
      .toEqual({
        documentIds: [documentId],
        style: "student_friendly",
        styleInstructions: "Dễ hiểu cho học sinh khối 7.",
        length: "standard",
        systemInstructions: "SYSTEM PROMPT THỰC TẾ",
        userPrompt: expect.stringContaining("USER PROMPT"),
        model: "gpt-5.6-luna",
        reasoningEffort: "xhigh",
        maxOutputTokens: 20_000,
      });
  });

  test("saves a draft, publishes, withdraws, republishes and regenerates a summary", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      window.localStorage.setItem("classhero-theme", "dark"),
    );
    const mock = await setupAiGenerationMock(page, { runningPolls: 1 });
    await page.goto(`/admin/lessons/${lessonId}`);

    await generationCard(page, "Kiến thức")
      .getByRole("button", { name: "Cấu hình" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Tạo Kiến thức bằng AI" });
    await dialog.getByRole("button", { name: "Model", exact: true }).click();
    await dialog.getByRole("option", { name: "OpenAI · gpt-4.1-mini" }).click();
    await dialog.getByLabel("Yêu cầu bổ sung").fill("Chỉ dùng cho lần tạo này");
    await dialog.getByLabel("Temperature").fill("0.2");
    await dialog.getByLabel("Giới hạn token đầu ra").fill("8000");
    await dialog.getByRole("button", { name: "Cập nhật dữ liệu gửi AI" }).click();
    await dialog.getByRole("button", { name: "Bắt đầu tạo" }).click();
    await expect
      .poll(() => mock.payloads.SUMMARY)
      .toEqual({
        documentIds: [documentId],
        style: "student_friendly",
        styleInstructions: "Dễ hiểu cho học sinh khối 7.",
        length: "standard",
        extraInstructions: "Chỉ dùng cho lần tạo này",
        systemInstructions: "SYSTEM PROMPT THỰC TẾ",
        userPrompt: expect.stringContaining("USER PROMPT"),
        model: "gpt-4.1-mini",
        temperature: 0.2,
        maxOutputTokens: 8_000,
      });

    await expect(page.getByRole("tab", { name: "Kiến thức" })).toHaveAttribute(
      "aria-selected",
      "true",
      { timeout: 10_000 },
    );
    await expect(
      page.getByText("Số hữu tỉ là số viết được dưới dạng phân số."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Có 1 điểm cần admin kiểm tra" }),
    ).toHaveCount(0);
    await expect(page.getByText("Khối lý thuyết đầu tiên cần ngắt dòng.")).toHaveCount(0);
    await expect(page.getByText("ClassHero biên soạn")).toHaveCount(0);
    await expect(
      page.getByText("Tam giác ABC vuông tại A, dựng đúng tỉ lệ theo tọa độ."),
    ).toBeVisible();
    const diagram = page.getByRole("img", {
      name: "Tam giác ABC vuông tại A, dựng đúng tỉ lệ theo tọa độ.",
    });
    await expect(diagram).toBeVisible();
    const renderedViewBox = (await diagram.getAttribute("viewBox"))
      ?.split(/\s+/u)
      .map(Number);
    expect(renderedViewBox).toHaveLength(4);
    expect((renderedViewBox?.[0] ?? 0) + (renderedViewBox?.[2] ?? 0)).toBeGreaterThan(8);
    await expect(diagram.locator("line").first()).toHaveAttribute("stroke-width", "1.75");
    await expect(diagram.locator("circle")).toHaveCount(0);
    await expect(diagram.locator("polyline").first()).toHaveAttribute(
      "stroke-width",
      "2",
    );
    await expect(diagram).toContainText("∠B");
    await expect(diagram).not.toContainText("$\\angle B$");
    const segmentLabel = diagram.getByText("AC = 7 cm");
    await expect(segmentLabel).toHaveAttribute("text-anchor", "middle");
    expect(Number(await segmentLabel.getAttribute("x"))).toBeCloseTo(4.5);
    await expect(page.getByText("Heading OCR gốc: 1 CỌNG HAI SỐ")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: "Duyệt tóm tắt" })).toHaveCount(0);
    await page.getByRole("button", { name: "Lưu nội dung" }).click();
    await expect.poll(() => mock.summary?.reviewStatus).toBe("NEEDS_REVIEW");
    await expect(page.getByText("Bản nháp", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Thu hồi phát hành" })).toHaveCount(0);

    await page.getByRole("button", { name: "Phát hành", exact: true }).click();
    await expect.poll(() => mock.summary?.reviewStatus).toBe("APPROVED");
    await expect(page.getByText("Đã phát hành", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Phát hành", exact: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Thu hồi phát hành" }).click();
    await expect.poll(() => mock.summary?.reviewStatus).toBe("HIDDEN");
    await expect(page.getByText("Đã thu hồi", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Hiện lại tóm tắt" })).toHaveCount(0);
    await page.getByRole("button", { name: "Phát hành", exact: true }).click();
    await expect.poll(() => mock.summary?.reviewStatus).toBe("APPROVED");
    await expect(
      page.getByRole("button", { name: "Phát hành", exact: true }),
    ).toHaveCount(0);

    await generationCard(page, "Kiến thức")
      .getByRole("button", { name: "Sinh lại" })
      .click();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Model", exact: true }),
    ).toContainText("Chọn");
    await expect(dialog.getByLabel("Temperature")).toHaveCount(0);
    await expect(dialog.getByLabel("Giới hạn token đầu ra")).toHaveCount(0);
    await expect(dialog.getByLabel("Cách trình bày")).toHaveValue(
      "Dễ hiểu cho học sinh khối 7.",
    );
    await expect(dialog.getByLabel("Yêu cầu bổ sung")).toHaveValue("");
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);
  });

  test("keeps recoverable blocks visible with actionable review guidance", async ({
    page,
  }, testInfo) => {
    await setupAiGenerationMock(page, {
      initialSummaryContent: partialReviewSummaryContent(),
    });
    await page.goto(`/admin/lessons/${lessonId}`);
    await page.getByRole("tab", { name: "Kiến thức" }).click();

    await expect(page.getByText("2 mục cần kiểm tra")).toBeVisible();
    await expect(
      page.locator("h3").filter({ hasText: "Cạnh huyền và một cạnh góc vuông" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Vấn đề:").first()).toBeVisible();
    await expect(page.getByText("Gợi ý sửa:").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Phát hành" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Chấp nhận hình này" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Chấp nhận khối này" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);

    await page.screenshot({
      path: `../../tmp/m9-2-partial-review-captures/${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page.getByTestId("admin-lesson-summary-tab").screenshot({
      path: `../../tmp/m9-2-partial-review-captures/${testInfo.project.name}-summary.png`,
    });

    await page.getByRole("button", { name: "Chấp nhận hình này" }).click();
    await page.getByRole("button", { name: "Chấp nhận khối này" }).click();
    await expect(page.getByText("2 mục cần kiểm tra")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Phát hành" })).toBeEnabled();
  });

  test("shows one diagram placeholder without hiding sibling blocks", async ({
    page,
  }, testInfo) => {
    if (testInfo.project.name === "webkit-mobile") {
      await page.addInitScript(() =>
        window.localStorage.setItem("classhero-theme", "dark"),
      );
    }
    const content = partialReviewSummaryContent();
    const theorem = content.data.sections[0]!.blocks[0] as unknown as {
      visual?: unknown;
      reviewIssues: Array<{
        code: string;
        message: string;
        suggestion: string;
        technicalDetails: string;
        accepted: boolean;
      }>;
    };
    delete theorem.visual;
    theorem.reviewIssues[0] = {
      ...theorem.reviewIssues[0]!,
      code: "DIAGRAM_CANNOT_RENDER",
      message: "Hình vẽ thiếu dữ liệu cần thiết nên chưa thể hiển thị an toàn.",
      suggestion: "Bổ sung các điểm, cạnh hoặc nhãn còn thiếu rồi lưu lại.",
      technicalDetails: "RIGHT_TRIANGLE_CONGRUENCE requires at least 6 point labels.",
      accepted: true,
    };
    const mock = await setupAiGenerationMock(page, { initialSummaryContent: content });
    await page.goto(`/admin/lessons/${lessonId}`);
    await page.getByRole("tab", { name: "Kiến thức" }).click();
    if (testInfo.project.name === "webkit-mobile") {
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }

    const summaryTab = page.getByTestId("admin-lesson-summary-tab");
    await expect(
      summaryTab.getByText("Hình lỗi — chưa đủ dữ liệu an toàn để hiển thị"),
    ).toBeVisible();
    await expect(summaryTab.getByText("1 vấn đề cần sửa", { exact: true })).toHaveCount(
      0,
    );
    await expect(
      summaryTab.getByRole("button", { name: "Chấp nhận hình này" }),
    ).toHaveCount(0);
    await expect(summaryTab.getByRole("button", { name: "Xóa hình lỗi" })).toBeVisible();
    await expect(
      summaryTab.getByText("Chứng minh hai tam giác vuông bằng nhau."),
    ).toBeVisible();
    await expect(
      summaryTab.getByText("Nêu tên trường hợp bằng nhau vừa dùng."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Phát hành" })).toBeDisabled();
    await summaryTab.screenshot({
      path: `../../tmp/m9-2-unrenderable-block-captures/${testInfo.project.name}-placeholder.png`,
    });
    await summaryTab.getByRole("button", { name: "Xóa hình lỗi" }).click();
    await expect(
      summaryTab.getByText("Hình lỗi — chưa đủ dữ liệu an toàn để hiển thị"),
    ).toHaveCount(0);
    expect(mock.summaryPutPayloads).toHaveLength(0);

    await page.reload();
    await page.getByRole("tab", { name: "Kiến thức" }).click();
    await expect(
      summaryTab.getByText("Hình lỗi — chưa đủ dữ liệu an toàn để hiển thị"),
    ).toBeVisible();

    await summaryTab.getByRole("button", { name: "Xóa hình lỗi" }).click();
    await page.getByRole("button", { name: "Lưu nội dung" }).click();
    await expect.poll(() => mock.summaryPutPayloads.length).toBe(1);
    await page.reload();
    await page.getByRole("tab", { name: "Kiến thức" }).click();
    await expect(
      summaryTab.getByText("Hình lỗi — chưa đủ dữ liệu an toàn để hiển thị"),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);
    await summaryTab.screenshot({
      path: `../../tmp/m9-2-unrenderable-block-captures/${testInfo.project.name}.png`,
    });
  });

  test("renders the saved gpt-5.4 Bài 15 live artifact", async ({ page }, testInfo) => {
    test.skip(process.env.RUN_M9_2_PARTIAL_RECOVERY_LIVE_VISUAL !== "1");
    if (testInfo.project.name === "webkit-mobile") {
      await page.addInitScript(() =>
        window.localStorage.setItem("classhero-theme", "dark"),
      );
    }
    const artifact = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "../../tmp/m9-2-partial-review-live/live-bai-15.json"),
        "utf8",
      ),
    ) as { summary: { title: string; objectives?: string[] } };
    await setupAiGenerationMock(page, {
      initialSummaryContent: {
        type: "lesson_summary_blocks",
        version: 2,
        data: artifact.summary,
      },
      lessonTitle: "Bài 15: Ba trường hợp bằng nhau của tam giác vuông",
    });
    await page.goto(`/admin/lessons/${lessonId}`);
    await page.getByRole("tab", { name: "Kiến thức" }).click();
    if (testInfo.project.name === "webkit-mobile") {
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }

    const summaryTab = page.getByTestId("admin-lesson-summary-tab");
    await expect(summaryTab).toContainText("Ba trường hợp bằng nhau của tam giác vuông");
    expect(artifact.summary.objectives?.length).toBeGreaterThan(0);
    await expect(summaryTab).toContainText(artifact.summary.objectives![0]!);
    await expect(
      summaryTab
        .locator(".mmd-content:visible")
        .filter({ hasText: "Cho tam giác" })
        .first(),
    ).toBeVisible();
    await expect(summaryTab.locator("figure > svg[role='img']")).toHaveCount(6);
    await expect
      .poll(async () => {
        return summaryTab.locator(".mmd-content:visible").evaluateAll((nodes) => {
          return (
            nodes.length > 0 &&
            nodes.every((node) => (node.textContent ?? "").trim().length > 0)
          );
        });
      })
      .toBe(true);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await expectNoHorizontalOverflow(page);
    await expectNoFrameworkOverlay(page);
    await summaryTab.screenshot({
      path: `../../tmp/m9-2-partial-review-live-captures/${testInfo.project.name}.png`,
      style:
        ".sticky { position: static !important; } .fixed, nextjs-portal { visibility: hidden !important; }",
    });
  });
});

function generationCard(page: Page, heading: string) {
  return page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

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

async function setupAiGenerationMock(
  page: Page,
  options: {
    runningPolls?: number;
    initialSummaryContent?: unknown;
    lessonTitle?: string;
  } = {},
) {
  const payloads: Partial<Record<"SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST", unknown>> =
    {};
  const promptPreviewPayloads: unknown[] = [];
  const summaryPutPayloads: unknown[] = [];
  const jobs = new Map<
    string,
    {
      inputMetaJson: Record<string, unknown>;
      polls: number;
      resourceId: string;
      type: "SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST";
    }
  >();
  const sets: Record<"QUIZ" | "FLASHCARD" | "TEST", Array<Record<string, unknown>>> = {
    QUIZ: [],
    FLASHCARD: [],
    TEST: [],
  };
  const state: {
    summary: {
      contentJson: unknown;
      id: string;
      lessonId: string;
      source: string;
      reviewStatus: string;
      aiGenerationId: string;
      createdAt: string;
      updatedAt: string;
    } | null;
  } = {
    summary: options.initialSummaryContent
      ? {
          id: "summary-review",
          lessonId,
          contentJson: options.initialSummaryContent,
          source: "AI",
          reviewStatus: "NEEDS_REVIEW",
          aiGenerationId: "generation-review",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      : null,
  };

  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}`) {
      return fulfillJson(route, 200, {
        data: {
          ...lesson(),
          ...(options.lessonTitle ? { title: options.lessonTitle } : {}),
        },
      });
    }
    if (
      method === "GET" &&
      pathname === `/admin/lessons/${lessonId}/ai-generation-panel`
    ) {
      const panel = panelData(jobs);
      return fulfillJson(route, 200, {
        data: {
          ...panel,
          lesson: {
            ...panel.lesson,
            ...(options.lessonTitle ? { title: options.lessonTitle } : {}),
          },
        },
      });
    }
    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/summary`) {
      return fulfillJson(route, 200, { data: state.summary });
    }
    if (method === "PUT" && pathname === `/admin/lessons/${lessonId}/summary`) {
      const body = request.postDataJSON() as Record<string, unknown>;
      summaryPutPayloads.push(body);
      state.summary = {
        id: "summary-ai",
        lessonId,
        contentJson: body.contentJson,
        source: String(body.source),
        reviewStatus: String(body.reviewStatus),
        aiGenerationId: "generation-summary",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return fulfillJson(route, 200, { data: state.summary });
    }
    if (
      method === "POST" &&
      pathname === `/admin/lessons/${lessonId}/summary/prompt-preview`
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      promptPreviewPayloads.push(body);
      const systemPrompt =
        body.systemInstructions && body.systemInstructions !== "SYSTEM PROMPT THỰC TẾ"
          ? `SYSTEM PROMPT THỰC TẾ\n${String(body.systemInstructions)}`
          : "SYSTEM PROMPT THỰC TẾ";
      return fulfillJson(route, 200, {
        data: {
          promptVersion: "lesson-summary-prompt-v40",
          schemaVersion: "lesson-summary-schema-v32",
          systemPrompt,
          userPrompt: `USER PROMPT ${JSON.stringify(body)}`,
          inputPrompt: `USER PROMPT ${JSON.stringify(
            body,
          )}\n<context_chunks>\nNỘI DUNG CHUNK THỰC TẾ\n</context_chunks>`,
          openAiRequest: {
            model: body.model ?? "gpt-4.1-mini",
            instructions: systemPrompt,
            input: `USER PROMPT ${JSON.stringify(
              body,
            )}\n<context_chunks>\nNỘI DUNG CHUNK THỰC TẾ\n</context_chunks>`,
            text: {
              format: {
                type: "json_schema",
                name: "lesson_summary_provider_contract",
                strict: true,
                schema: {
                  type: "object",
                  additionalProperties: false,
                  properties: {},
                },
              },
            },
            temperature: body.temperature ?? 0.2,
            max_output_tokens: body.maxOutputTokens ?? 8_000,
          },
          context: {
            documentCount: 1,
            chunkCount: 12,
            estimatedTokens: 1_250,
            contextTokens: 1_000,
            maxContextTokens: 12_000,
          },
          configuration: {
            selectedModel: body.model ?? null,
            resolvedProvider: "OPENAI",
            resolvedModel: body.model ?? "gpt-4.1-mini",
            temperature: body.temperature ?? 0.2,
            maxOutputTokens: body.maxOutputTokens ?? 8_000,
            modelOptions: [
              { provider: "OPENAI", model: "gpt-4.1-mini", available: true },
              {
                provider: "OPENAI",
                model: "gpt-5.6-luna",
                available: true,
                capabilities: {
                  aiConfiguration: "REASONING_EFFORT",
                  reasoningEffortLevels: ["low", "xhigh"],
                },
              },
              { provider: "GEMINI", model: "gemini-2.5-flash", available: true },
            ],
          },
          estimatedCost: {
            available: true,
            upperBoundUsd: 0.0012,
            upperBoundVnd: 30,
            fxRateVndPerUsd: 25_000,
          },
        },
      });
    }

    const generationMatch = pathname.match(
      /^\/admin\/lessons\/lesson-ai-m9-8\/(summary|quiz-sets|flashcard-sets|test-sets)\/generate-ai$/,
    );
    if (method === "POST" && generationMatch) {
      const type = (
        {
          summary: "SUMMARY",
          "quiz-sets": "QUIZ",
          "flashcard-sets": "FLASHCARD",
          "test-sets": "TEST",
        } as const
      )[generationMatch[1] as "summary" | "quiz-sets" | "flashcard-sets" | "test-sets"];
      payloads[type] = request.postDataJSON();
      const inputMetaJson = request.postDataJSON() as Record<string, unknown>;
      const jobId = `job-${type.toLowerCase()}`;
      jobs.set(jobId, {
        inputMetaJson,
        polls: 0,
        resourceId: `${type.toLowerCase()}-ai`,
        type,
      });
      return fulfillJson(route, 202, {
        data: { mode: "QUEUED", jobId, status: "QUEUED" },
      });
    }

    const jobMatch = pathname.match(/^\/jobs\/(job-[a-z]+)$/);
    if (method === "GET" && jobMatch) {
      const job = jobs.get(jobMatch[1] ?? "")!;
      job.polls += 1;
      const isRunning = job.polls <= (options.runningPolls ?? 0);
      if (!isRunning) {
        materialize(job.type, job.resourceId, sets, state);
      }
      return fulfillJson(route, 200, {
        data: {
          jobId: jobMatch[1],
          status: isRunning ? "RUNNING" : "SUCCEEDED",
          resourceType: job.type === "SUMMARY" ? "LESSON_SUMMARY" : `${job.type}_SET`,
          resourceId: isRunning ? null : job.resourceId,
          error: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: isRunning ? null : new Date().toISOString(),
        },
      });
    }

    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/quiz-sets`) {
      return fulfillJson(route, 200, { data: sets.QUIZ });
    }
    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/flashcard-sets`) {
      return fulfillJson(route, 200, { data: sets.FLASHCARD });
    }
    if (method === "GET" && pathname === `/admin/lessons/${lessonId}/test-sets`) {
      return fulfillJson(route, 200, { data: sets.TEST });
    }
    if (
      method === "GET" &&
      /^\/admin\/(quiz-sets|test-sets)\/[^/]+\/questions$/.test(pathname)
    ) {
      return fulfillJson(route, 200, { data: [] });
    }
    if (method === "GET" && /^\/admin\/flashcard-sets\/[^/]+\/cards$/.test(pathname)) {
      return fulfillJson(route, 200, { data: [] });
    }
    if (
      method === "POST" &&
      /^\/admin\/(quiz-sets|flashcard-sets|test-sets)\/[^/]+\/review$/.test(pathname)
    ) {
      return fulfillJson(route, 201, {
        data: { reviewStatus: request.postDataJSON().reviewStatus },
      });
    }

    return fulfillJson(route, 404, {
      error: { code: "MOCK_NOT_FOUND", message: `${method} ${pathname}` },
    });
  });

  return {
    payloads,
    promptPreviewPayloads,
    summaryPutPayloads,
    get summary() {
      return state.summary;
    },
  };
}

function partialReviewSummaryContent() {
  const fingerprint = "a".repeat(64);
  return {
    type: "lesson_summary_blocks",
    version: 2,
    data: {
      lessonId,
      title: "Ba trường hợp bằng nhau của tam giác vuông",
      objectives: ["Nhận biết trường hợp cạnh huyền và cạnh góc vuông."],
      sections: [
        {
          order: 1,
          sourceHeading: "Cạnh huyền và một cạnh góc vuông",
          displayHeading: "Cạnh huyền và một cạnh góc vuông",
          sourceChunkIds: [documentId],
          blocks: [
            {
              type: "theorem",
              title: "Cạnh huyền và một cạnh góc vuông",
              content:
                "Nếu cạnh huyền và một cạnh góc vuông tương ứng bằng nhau thì hai tam giác vuông bằng nhau.",
              sourceChunkIds: [documentId],
              visual: {
                kind: "DIAGRAM_SPEC",
                spec: {
                  version: 1,
                  coordinateSystem: "CARTESIAN",
                  viewBox: { minX: -1, minY: -1, width: 8, height: 6 },
                  toScale: true,
                  points: [
                    {
                      id: "A",
                      x: 0,
                      y: 4,
                      label: "A",
                      pointStyle: "NONE",
                      labelPosition: "TOP_LEFT",
                    },
                    {
                      id: "B",
                      x: 0,
                      y: 0,
                      label: "B",
                      pointStyle: "NONE",
                      labelPosition: "BOTTOM_LEFT",
                    },
                    {
                      id: "C",
                      x: 6,
                      y: 0,
                      label: "C",
                      pointStyle: "NONE",
                      labelPosition: "BOTTOM_RIGHT",
                    },
                  ],
                  primitives: [
                    { id: "AB", type: "SEGMENT", from: "A", to: "B", style: "SOLID" },
                    { id: "BC", type: "SEGMENT", from: "B", to: "C", style: "SOLID" },
                    { id: "AC", type: "SEGMENT", from: "A", to: "C", style: "SOLID" },
                  ],
                  markers: [],
                  labels: [],
                  caption: "Phần hình an toàn vẫn được hiển thị để admin đánh giá.",
                },
              },
              reviewIssues: [
                {
                  id: "diagram-review",
                  code: "DIAGRAM_NEEDS_REVIEW",
                  path: "theorySections.0.units.0.theory.diagramSpec",
                  message:
                    "Ký hiệu hai đoạn bằng nhau chưa khớp với độ dài theo tọa độ; ký hiệu sai đã được lược bỏ.",
                  suggestion:
                    "Kiểm tra lại hai cạnh AB, AD trong diagramSpec hoặc chọn Chấp nhận hình này nếu hình hiện tại dùng được.",
                  technicalDetails:
                    "markers.equalLengths.0.segmentIds: EQUAL_LENGTH segments must have coordinate lengths within 2%: AB, AD.",
                  fingerprint,
                  accepted: false,
                },
              ],
            },
            {
              type: "example",
              problem: "Chứng minh hai tam giác vuông bằng nhau.",
              solution: "Đối chiếu cạnh huyền và cạnh góc vuông tương ứng.",
              answer: "[Cần bổ sung đáp án]",
              reviewIssues: [
                {
                  id: "answer-review",
                  code: "CONTENT_NEEDS_REVIEW",
                  path: "applicationExercises.standardExercise.answer",
                  message: "Đáp án tạm thời cần được đối chiếu với tài liệu nguồn.",
                  suggestion: "Kiểm tra đáp án, sau đó sửa hoặc chấp nhận khối này.",
                  technicalDetails: "Review fixture for a recoverable answer.",
                  fingerprint,
                  accepted: false,
                },
              ],
            },
          ],
        },
        {
          order: 2,
          sourceHeading: "Bài tập vận dụng",
          displayHeading: "Bài tập vận dụng",
          sourceChunkIds: [documentId],
          blocks: [
            {
              type: "example",
              problem: "Nêu tên trường hợp bằng nhau vừa dùng.",
              solution: "Đối chiếu giả thiết.",
              answer: "Cạnh huyền - cạnh góc vuông.",
            },
          ],
        },
      ],
    },
  };
}

function panelData(
  jobs: Map<
    string,
    {
      inputMetaJson: Record<string, unknown>;
      polls: number;
      resourceId: string;
      type: "SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST";
    }
  >,
) {
  const latest: Record<string, unknown> = {
    SUMMARY: null,
    QUIZ: null,
    FLASHCARD: null,
    TEST: null,
  };
  for (const [jobId, job] of jobs) {
    const succeeded = job.polls > 0;
    latest[job.type] = {
      type: job.type,
      jobId,
      status: succeeded ? "SUCCEEDED" : "QUEUED",
      resourceType: succeeded ? `${job.type}_SET` : null,
      resourceId: succeeded ? job.resourceId : null,
      reviewStatus: succeeded ? "NEEDS_REVIEW" : null,
      error: null,
      inputMetaJson: job.inputMetaJson,
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: succeeded ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    lesson: { id: lessonId, title: "Số hữu tỉ", targetGrade: 7 },
    readiness: {
      summaryReady: true,
      generationReady: true,
      readyDocumentCount: 1,
      embeddedDocumentCount: 1,
      reason: null,
    },
    documents: [
      {
        id: documentId,
        title: "Giáo trình Toán 7",
        kind: "PRIMARY_FROM_SOURCE",
        status: "READY",
        chunkCount: 12,
        pageRange: { pageStart: 5, pageEnd: 9 },
        embeddingReady: true,
        canUseForSummary: true,
        unavailableReason: null,
      },
      {
        id: processingDocumentId,
        title: "Phiếu bài tập",
        kind: "SUPPLEMENT",
        status: "PROCESSING",
        chunkCount: 0,
        pageRange: null,
        embeddingReady: false,
        canUseForSummary: false,
        unavailableReason: "Đang xử lý",
      },
      {
        id: supplementalDocumentId,
        title: "Tài liệu tham khảo",
        kind: "SUPPLEMENT",
        status: "READY",
        chunkCount: 4,
        pageRange: null,
        embeddingReady: true,
        canUseForSummary: true,
        unavailableReason: null,
      },
    ],
    jobs: latest,
  };
}

function materialize(
  type: "SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST",
  resourceId: string,
  sets: Record<"QUIZ" | "FLASHCARD" | "TEST", Array<Record<string, unknown>>>,
  state: { summary: Record<string, unknown> | null },
) {
  if (type === "SUMMARY") {
    state.summary = {
      id: resourceId,
      lessonId,
      contentJson: {
        type: "lesson_summary_blocks",
        version: 2,
        data: {
          lessonId,
          title: "Số hữu tỉ",
          objectives: ["Nhận biết số hữu tỉ"],
          sections: [
            {
              order: 1,
              sourceHeading: "1 CỌNG HAI SỐ",
              displayHeading: "CỘNG HAI SỐ",
              sourceChunkIds: [documentId],
              blocks: [
                {
                  type: "knowledge",
                  title: "Khái niệm số hữu tỉ",
                  content: "Số hữu tỉ là số viết được dưới dạng phân số.",
                  sourceChunkIds: [documentId],
                  visual: {
                    kind: "DIAGRAM_SPEC",
                    spec: {
                      version: 1,
                      coordinateSystem: "CARTESIAN",
                      viewBox: { minX: 0, minY: 0, width: 6, height: 8 },
                      toScale: true,
                      points: [
                        { id: "A", x: 1, y: 1, label: "A", labelPosition: "BOTTOM_LEFT" },
                        { id: "B", x: 1, y: 6, label: "B", labelPosition: "TOP_LEFT" },
                        {
                          id: "C",
                          x: 8,
                          y: 1,
                          label: "C",
                          labelPosition: "BOTTOM_RIGHT",
                        },
                      ],
                      primitives: [
                        { id: "AB", type: "SEGMENT", from: "A", to: "B", style: "SOLID" },
                        { id: "AC", type: "SEGMENT", from: "A", to: "C", style: "SOLID" },
                        { id: "BC", type: "SEGMENT", from: "B", to: "C", style: "SOLID" },
                      ],
                      markers: [
                        { type: "RIGHT_ANGLE", vertex: "A", armPointIds: ["B", "C"] },
                        {
                          type: "ANGLE",
                          vertex: "B",
                          armPointIds: ["A", "C"],
                          label: "$\\angle B$",
                        },
                      ],
                      labels: [
                        {
                          text: "AC = 7 cm",
                          anchorPointId: "A",
                          position: "TOP",
                        },
                      ],
                      caption: "Tam giác ABC vuông tại A, dựng đúng tỉ lệ theo tọa độ.",
                    },
                  },
                },
                {
                  type: "example",
                  problem: "Cho tam giác ABC vuông tại A. Xác định góc vuông.",
                  solution: "Theo giả thiết, góc A là góc vuông.",
                  answer: "$\\widehat{A}=90^\\circ$.",
                },
              ],
            },
            {
              order: 2,
              sourceHeading: "Bài tập",
              displayHeading: "Bài tập vận dụng",
              sourceChunkIds: [documentId],
              blocks: [
                {
                  type: "example",
                  problem: "Viết 0,25 dưới dạng phân số.",
                  solution: "$0,25 = 1/4$.",
                  answer: "$1/4$.",
                },
                {
                  type: "example",
                  problem: "Một món đồ 100 000 đồng giảm 20%. Tính giá mới.",
                  solution: "$100\\,000 \\times 80\\% = 80\\,000$ đồng.",
                  answer: "$80\\,000$ đồng.",
                },
              ],
            },
          ],
        },
      },
      source: "AI",
      reviewStatus: "NEEDS_REVIEW",
      aiGenerationId: "generation-summary",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return;
  }
  if (sets[type].some((set) => set.id === resourceId)) return;
  sets[type].push({
    id: resourceId,
    lessonId,
    title: `${type === "FLASHCARD" ? "Flashcard" : type === "QUIZ" ? "Quiz" : "Test"} AI`,
    difficulty: "MIXED",
    durationSeconds: 1_200,
    difficultyRatioJson: { easy: 0.4, medium: 0.5, hard: 0.1 },
    source: "AI",
    reviewStatus: "NEEDS_REVIEW",
    questionCount: type === "FLASHCARD" ? undefined : 4,
    cardCount: type === "FLASHCARD" ? 6 : undefined,
    totalScore: "10",
    sortOrder: 0,
    _count: type === "FLASHCARD" ? undefined : { questions: 4 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function lesson() {
  return {
    id: lessonId,
    learningPathId: "path-math-7",
    chapterId: "chapter-1",
    courseTitle: "Toán 7",
    chapterTitle: "Số hữu tỉ",
    orderIndex: 1,
    title: "Buổi 1: Số hữu tỉ",
    shortDescription: "Ôn tập số hữu tỉ.",
    lessonType: "BASIC",
    liveUrl: null,
    scheduledAt: null,
    examOpenAt: null,
    videoUrl: null,
    completionMinScore: 7,
    trialEnabled: false,
    status: "PUBLISHED",
    customVideoSettings: null,
  };
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

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth + 1);
}

async function expectNoFrameworkOverlay(page: Page) {
  expect(await page.locator("[data-nextjs-dialog]").count()).toBe(0);
  await expect(page.locator("body")).not.toHaveText(
    /Application error|Unhandled Runtime Error/,
  );
}
