import { expect, test, type Page, type Route } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";
const lessonId = "lesson-m7";

test.beforeEach(async ({ page }) => {
  await seedStudentSession(page);
});

test("student lesson dark theme covers lesson, Quiz, Flashcard, dialogs, and Test", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("classhero-theme", "dark");
  });
  await setupStudentLearningApiMock(page, { testReady: true, testPasses: false });

  await page.goto(`/student/lessons/${lessonId}`);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  expect(
    await page.getByRole("main").evaluate((element) => getComputedStyle(element).background),
  ).not.toContain("rgb(255, 255, 255)");
  await page.screenshot({
    path: testInfo.outputPath("student-lesson-dark.png"),
  });

  await page.getByRole("button", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  const quizTransition = page.locator("[data-quiz-transition-variant]");
  await expect(quizTransition).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-transition-dark.png"),
  });
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();
  await page.getByRole("button", { name: "Gợi ý" }).click();
  await expect(page.getByText("Hãy cộng hai số.")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-runner-dark.png"),
  });
  await page.getByRole("button", { name: /B.*4/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Xem lời giải chi tiết" }).click();
  await expect(page.getByText("Cộng hai với hai được bốn.")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-feedback-dark.png"),
  });
  await page.getByRole("button", { name: "Hoàn thành Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-result-dark.png"),
  });
  await page.getByRole("button", { name: "Xem lại tất cả" }).click();
  await expect(page.getByText("Xem lại tất cả câu trả lời")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-quiz-review-dark.png"),
  });

  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ xem mặt sau" }).click();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-flashcard-runner-dark.png"),
  });
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await expect(
    page.getByRole("dialog", { name: "Thoát lượt học Flashcard?" }),
  ).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: testInfo.outputPath("student-flashcard-exit-dialog-dark.png"),
  });
  await page.getByRole("button", { name: "Ở lại", exact: true }).click();
  await page.getByRole("button", { name: "Đã thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-flashcard-result-dark.png"),
  });

  await page.goto(`/student/lessons/${lessonId}?tab=test`);
  await page.getByRole("button", { name: "Bắt đầu bài kiểm tra" }).click();
  await expect(page.getByRole("heading", { name: "Câu 1" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-test-runner-dark.png"),
  });
  await page.getByRole("button", { name: /A.*5/ }).click();
  await page.getByRole("button", { name: "Nộp bài kiểm tra" }).click();
  await expect(page.getByText("Bạn cần phải làm lại bài kiểm tra mới.")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-test-result-dark.png"),
  });
  await expectNoFrameworkOverlay(page);
});

test("quiz status preloads before tab click and tab changes do not mount transient loading", async ({
  page,
}) => {
  let statusRequestCount = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/student/quiz-sets/quiz-set-m7/attempts/status")) {
      statusRequestCount += 1;
    }
  });
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}`);

  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  await expect.poll(() => statusRequestCount).toBe(1);
  await page.evaluate(() => {
    const probe = { observedQuizLoading: false };
    const observer = new MutationObserver(() => {
      if (document.querySelector('[aria-label="Đang tải nội dung Quiz"]')) {
        probe.observedQuizLoading = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    (
      window as typeof window & {
        __quizTabLoadingProbe?: {
          observer: MutationObserver;
          observedQuizLoading: boolean;
        };
      }
    ).__quizTabLoadingProbe = {
      observer,
      get observedQuizLoading() {
        return probe.observedQuizLoading;
      },
    };
  });

  await page.getByRole("button", { name: "Flashcard" }).click();
  await page.getByRole("button", { name: "Quiz" }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bài học" }).click();
  await page.getByRole("button", { name: "Quiz" }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeVisible();

  const observedQuizLoading = await page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __quizTabLoadingProbe?: {
          observer: MutationObserver;
          observedQuizLoading: boolean;
        };
      }
    ).__quizTabLoadingProbe;
    probe?.observer.disconnect();
    return probe?.observedQuizLoading ?? false;
  });
  expect(observedQuizLoading).toBe(false);
  expect(statusRequestCount).toBe(1);
});

test("lesson summary and quiz reveal feedback only after explicit actions", async ({
  page,
}) => {
  const perQuestionCheckRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/questions/") && request.url().endsWith("/check")) {
      perQuestionCheckRequests.push(request.url());
    }
  });
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}`);

  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Video bài giảng" })).toBeVisible();
  await expect(page.locator('iframe[src*="youtube.com/embed/video-m7"]')).toBeVisible();
  await expect(page.getByText("Kiến thức trọng tâm M7")).toBeVisible();
  await expect(page.getByText("Tài liệu không được hiển thị")).toHaveCount(0);

  await page.getByRole("button", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByText(/^(Dễ|Vừa|Khó)$/)).toHaveCount(0);
  await expect(page.getByText("Hãy cộng hai số.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toHaveCount(0);
  const finishButton = page.getByRole("button", { name: "Hoàn thành Quiz" });
  const incompleteAlert = page.getByRole("alert").filter({ hasText: "Cần hoàn thành" });
  await expect(finishButton).toBeEnabled();
  await expect(incompleteAlert).toHaveCount(0);
  await finishButton.click();
  await expect(incompleteAlert).toHaveText("Cần hoàn thành câu hỏi 1 để tiếp tục!");
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toHaveCount(0);

  const firstOption = page.getByRole("button", { name: /A.*3/ });
  const secondOption = page.getByRole("button", { name: /B.*4/ });
  await firstOption.click();
  await expect(firstOption).toHaveAttribute("aria-pressed", "true");
  await secondOption.click();
  await expect(firstOption).toHaveAttribute("aria-pressed", "false");
  await expect(secondOption).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toBeEnabled();
  await page.getByRole("button", { name: "Gợi ý" }).click();
  await expect(page.getByText("Hãy cộng hai số.")).toBeVisible();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();

  await expect(page.getByText("Chính xác!")).toBeVisible();
  expect(perQuestionCheckRequests).toHaveLength(0);
  await expect(incompleteAlert).toHaveCount(0);
  await expect(page.getByText("Cộng hai với hai được bốn.")).toHaveCount(0);
  await page.getByRole("button", { name: "Xem lời giải chi tiết" }).click();
  await expect(page.getByText("Cộng hai với hai được bốn.")).toBeVisible();
  await finishButton.click();

  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại tất cả" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại câu sai" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Làm lại tất cả" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm lại câu sai" })).toBeDisabled();
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm bộ Quiz mới" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm bộ Quiz mới" })).toBeVisible();
  await page.getByRole("button", { name: "Xem lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);
  await page.getByRole("button", { name: "Xem lại tất cả" }).click();
  await expect(page.getByText("Xem lại tất cả câu trả lời")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại kết quả Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await page.getByRole("button", { name: "Làm bộ Quiz mới" }).click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("flashcard uses the lesson entry panel, fullscreen runner, and fullscreen result", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await expect(page.getByRole("button", { name: "Bắt đầu" })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Quay lại màn Flashcard" }),
  ).toBeVisible();
  await expect(page.getByText("Đã thuộc 0")).toBeVisible();

  await page.getByRole("button", { name: "Yêu thích thẻ" }).click();
  await expect(page.getByRole("button", { name: "Bỏ yêu thích thẻ" })).toBeVisible();
  await expect(page.getByText("Mặt trước", { exact: true })).toBeVisible();
  await expect(page.getByText("Học tiếp", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Flashcard số hữu tỉ", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Lật thẻ xem mặt sau" }).click();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ xem mặt trước" }).click();
  await expect(page.getByText("Mặt trước", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lật thẻ xem mặt sau" }).click();
  await page.getByRole("button", { name: "Đã thuộc" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Đã thuộc" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();
  await expect(
    page.getByRole("progressbar", { name: "Tỷ lệ Flashcard đã thuộc" }),
  ).toHaveAttribute("aria-valuenow", "100");
  await expect(page.getByText("1/1", { exact: true })).toBeVisible();
  await expect(page.getByText("Điểm", { exact: true })).toBeVisible();
  await expect(page.getByText("Đã ôn", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Quá đỉnh! Bạn đúng hết rồi!")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn lại tất cả" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ôn lại thẻ chưa thuộc" }),
  ).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);

  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Học bộ Flashcard mới" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toHaveCount(0);
  await page.getByRole("button", { name: "Xem lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);
  const reviewFavoriteButton = page.getByRole("button", {
    name: "Xem lại thẻ yêu thích",
  });
  await expect(reviewFavoriteButton).toBeEnabled();
  await reviewFavoriteButton.click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await expect(page.getByLabel("Trạng thái thẻ: Đã thuộc")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await expect(page.getByLabel("Trạng thái thẻ: Đã thuộc")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bỏ yêu thích thẻ" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("flashcard restart session stays at start after switching tabs", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    flashcardCompleted: true,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Xem lại", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await page.getByRole("button", { name: "Ôn lại tất cả" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await page
    .getByRole("dialog", { name: "Thoát lượt học Flashcard?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Flashcard" }).click();

  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Học bộ Flashcard mới" })).toHaveCount(0);
});

test("flashcard unknown retry returns to its result after confirming back", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Chưa thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();

  await page.getByRole("button", { name: "Ôn lại thẻ chưa thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thẻ 1: chưa đánh dấu" }),
  ).toHaveAttribute("aria-current", "step");
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await page
    .getByRole("dialog", { name: "Thoát lượt học Flashcard?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn lại thẻ chưa thuộc" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toHaveCount(0);
});

test("flashcard entry stays at start and resets to the first card without saved progress", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    flashcardCardCount: 2,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Thẻ sau" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await page
    .getByRole("dialog", { name: "Thoát lượt học Flashcard?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  const startButton = page.getByRole("button", { name: "Bắt đầu" });
  await expect(startButton).toBeVisible();
  await startButton.click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/2" })).toBeVisible();
});

test("flashcard entry continues at the current card after progress is saved", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    flashcardCardCount: 2,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Đã thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await page
    .getByRole("dialog", { name: "Thoát lượt học Flashcard?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  const continueButton = page.getByRole("button", { name: "Tiếp tục vào học" });
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
});

test("reload restores the active Flashcard runner and exact session state", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    flashcardCardCount: 2,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Chưa thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await page.getByRole("button", { name: "Yêu thích thẻ" }).click();
  await page.getByRole("button", { name: "Lật thẻ xem mặt sau" }).click();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sessionStorage.getItem("student-flashcard-surface:runner"),
      ),
    )
    .toBe("flashcard-set-m7");

  await page.reload();

  expect(
    await page.evaluate(() =>
      window.sessionStorage.getItem("student-flashcard-surface:runner"),
    ),
  ).toBe("flashcard-set-m7");
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bỏ yêu thích thẻ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thẻ 1: chưa thuộc" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Thẻ 2: chưa đánh dấu" }),
  ).toHaveAttribute("aria-current", "step");

  await page.goBack();
  const exitDialog = page.getByRole("dialog", {
    name: "Thoát lượt học Flashcard?",
  });
  await expect(exitDialog).toBeVisible();
  await exitDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();
  await expect(page.getByRole("button", { name: "Tiếp tục vào học" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Tiếp tục vào học" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toHaveCount(0);

  await page.getByRole("button", { name: "Tiếp tục vào học" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();
});

test("quiz counts a completed answer before checking and auto-checks it on finish", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  await expect(page.getByText("Đã làm 0")).toBeVisible();
  await page.getByRole("button", { name: /B.*4/ }).click();
  await expect(page.getByText("Đã làm 1")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Câu 1: đã làm, chưa kiểm tra" }),
  ).toHaveClass(/bg-blue-400/);

  await page.getByRole("button", { name: "Hoàn thành Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
});

test("text Quiz checks locally without a per-question request", async ({ page }) => {
  const perQuestionCheckRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/questions/") && request.url().endsWith("/check")) {
      perQuestionCheckRequests.push(request.url());
    }
  });
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "TEXT_INPUT",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByPlaceholder("Nhập đáp án").fill("-2.5");
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();

  await expect(page.getByText("Chính xác!")).toBeVisible();
  expect(perQuestionCheckRequests).toHaveLength(0);
});

test("multi-statement Quiz checks locally without a per-question request", async ({
  page,
}) => {
  const perQuestionCheckRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/questions/") && request.url().endsWith("/check")) {
      perQuestionCheckRequests.push(request.url());
    }
  });
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "MULTI_STATEMENT_TRUE_FALSE",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Đúng" }).first().click();
  await page.getByRole("button", { name: "Sai" }).nth(1).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();

  await expect(page.getByText("Chính xác!")).toBeVisible();
  expect(perQuestionCheckRequests).toHaveLength(0);
});

test("quiz retry completion shows the cumulative original result", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizSubmitAggregateResult: {
      id: "quiz-root-attempt-m7",
      correctCount: 4,
      wrongCount: 3,
      totalCount: 7,
      accuracyPercent: 57,
    },
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: /B.*4/ }).click();
  await page.getByRole("button", { name: "Hoàn thành Quiz" }).click();

  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByText("4/7", { exact: true })).toBeVisible();
  await expect(page.getByText("1/1", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Làm lại câu sai" }).click();
  await page.getByRole("button", { name: /B.*4/ }).click();
  await page.getByRole("button", { name: "Hoàn thành Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByText("4/7", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByText("4/7", { exact: true })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);
});

test("quiz hides the incomplete warning immediately after an answer changes", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const finishButton = page.getByRole("button", { name: "Hoàn thành Quiz" });
  const incompleteAlert = page.getByRole("alert").filter({
    hasText: "Cần hoàn thành",
  });

  await finishButton.click();
  await expect(incompleteAlert).toBeVisible();
  await page.getByRole("button", { name: /A.*3/ }).click();
  await expect(incompleteAlert).toHaveCount(0);
});

test("finish warning lists every quiz question without a completed answer", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 3,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();

  const finishButton = page.getByRole("button", { name: "Hoàn thành Quiz" });
  await expect(finishButton).toBeEnabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "Cần hoàn thành các câu hỏi" }),
  ).toHaveCount(0);
  await finishButton.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Cần hoàn thành các câu hỏi" }),
  ).toHaveText("Cần hoàn thành các câu hỏi 1, 2, 3 để tiếp tục!");
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toHaveCount(0);

  await page.getByRole("button", { name: "Câu trước" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Cần hoàn thành các câu hỏi" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Câu trước" }).click();
  await page.getByRole("button", { name: /B.*4/ }).click();
  await expect(page.getByText("Đã làm 1")).toBeVisible();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Cần hoàn thành các câu hỏi" }),
  ).toHaveCount(0);
  await finishButton.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Cần hoàn thành các câu hỏi" }),
  ).toHaveText("Cần hoàn thành các câu hỏi 2, 3 để tiếp tục!");
  await expect(finishButton).toBeEnabled();
  await expectNoFrameworkOverlay(page);
});

test("quiz status dots navigate directly to the selected question", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 3,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const firstQuestionDot = page.getByRole("button", {
    name: "Câu 1: chưa làm",
  });
  const thirdQuestionDot = page.getByRole("button", {
    name: "Câu 3: chưa làm",
  });
  await expect(firstQuestionDot).toHaveAttribute("aria-current", "step");

  await thirdQuestionDot.click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 3/3" })).toBeVisible();
  await expect(thirdQuestionDot).toHaveAttribute("aria-current", "step");

  await firstQuestionDot.click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/3" })).toBeVisible();
  await expect(firstQuestionDot).toHaveAttribute("aria-current", "step");
  await expectNoFrameworkOverlay(page);
});

test("quiz start returns to question one when no question has been checked", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 3,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Câu 3: chưa làm" }).click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 3/3" })).toBeVisible();

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  const exitDialog = page.getByRole("dialog", { name: "Thoát bài Quiz?" });
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();

  const startButton = page.getByRole("button", { name: "Bắt đầu" });
  await expect(startButton).toBeVisible();
  await startButton.click();

  await expect(page.getByRole("heading", { name: "Câu hỏi 1/3" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("quiz primary navigation buttons show hover feedback in a narrow laptop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 650, height: 900 });
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 2,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const nextButton = page.getByRole("button", { name: "Câu tiếp" });
  const nextBackgroundBeforeHover = await nextButton.evaluate(
    (button) => getComputedStyle(button).backgroundColor,
  );
  await nextButton.hover();
  await expect
    .poll(() => nextButton.evaluate((button) => getComputedStyle(button).backgroundColor))
    .not.toBe(nextBackgroundBeforeHover);
  await expect(nextButton).toHaveCSS("translate", "none");
  await expect(nextButton).toHaveCSS("box-shadow", /0px 4px 0px/);
  await page.mouse.down();
  await expect(nextButton).toHaveCSS("translate", "0px 3px");
  await expect(nextButton).toHaveCSS("box-shadow", /0px 1px 0px/);
  await page.mouse.up();

  const finishButton = page.getByRole("button", { name: "Hoàn thành Quiz" });
  const finishBackgroundBeforeHover = await finishButton.evaluate(
    (button) => getComputedStyle(button).backgroundColor,
  );
  await finishButton.hover();
  await expect
    .poll(() =>
      finishButton.evaluate((button) => getComputedStyle(button).backgroundColor),
    )
    .not.toBe(finishBackgroundBeforeHover);
  await expect(finishButton).toHaveCSS("translate", "none");
  await expect(finishButton).toHaveCSS("box-shadow", /0px 4px 0px/);
  await page.mouse.down();
  await expect(finishButton).toHaveCSS("translate", "0px 3px");
  await expect(finishButton).toHaveCSS("box-shadow", /0px 1px 0px/);
  await page.mouse.up();
  await expectNoFrameworkOverlay(page);
});

test("unfinished quiz asks for confirmation before leaving the runner", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();

  const exitDialog = page.getByRole("dialog", { name: "Thoát bài Quiz?" });
  await expect(exitDialog).toBeVisible();
  await expect(
    exitDialog.getByText("Bạn chưa hoàn thành xong bài Quiz. Vẫn thoát chứ?"),
  ).toBeVisible();

  await exitDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(exitDialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();

  const checkedOption = page.getByRole("button", { name: /B.*4/ });
  await checkedOption.click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();

  await expect(exitDialog).toHaveCount(0);
  const enterQuizButton = page.getByRole("button", { name: "Tiếp tục vào làm" });
  await expect(enterQuizButton).toBeVisible();
  await enterQuizButton.click();

  await expect(checkedOption).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await expect(page.getByText("Đã làm 1")).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("browser back returns from the quiz runner to the lesson detail", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();

  await page.goBack();

  const exitDialog = page.getByRole("dialog", { name: "Thoát bài Quiz?" });
  await expect(exitDialog).toBeVisible();
  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=quiz`);

  await exitDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(exitDialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();

  await page.goBack();
  await expect(exitDialog).toBeVisible();
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();

  await expect(exitDialog).toHaveCount(0);
  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=quiz`);
  await expect(page.getByRole("button", { name: "Bắt đầu" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("reload keeps the quiz overview closed while an unfinished attempt remains", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await page
    .getByRole("dialog", { name: "Thoát bài Quiz?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  const enterQuizButton = page.getByRole("button", { name: "Bắt đầu" });
  await expect(enterQuizButton).toBeVisible();

  await page.reload();

  await expect(enterQuizButton).toBeVisible();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toHaveCount(0);

  await enterQuizButton.click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1/1" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("reload clears unchecked answers and restores only checked quiz results", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const firstOption = page.getByRole("button", { name: /A.*3/ });
  const secondOption = page.getByRole("button", { name: /B.*4/ });
  await firstOption.click();
  await expect(firstOption).toHaveAttribute("aria-pressed", "true");

  await page.reload();

  await expect(firstOption).toHaveAttribute("aria-pressed", "false");
  await expect(secondOption).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toHaveCount(0);

  await secondOption.click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await page.reload();

  await expect(secondOption).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Chính xác!")).toBeVisible();
});

test("reload clears an unchecked text answer", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 3,
    quizQuestionType: "TEXT_INPUT",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await expect(page.getByRole("heading", { name: "Câu hỏi 3/3" })).toBeVisible();

  const answerInput = page.getByPlaceholder("Nhập đáp án");
  await answerInput.fill("-2.5");
  await expect(answerInput).toHaveValue("-2.5");

  await page.reload();

  await expect(page.getByRole("heading", { name: "Câu hỏi 3/3" })).toBeVisible();
  await expect(page.getByPlaceholder("Nhập đáp án")).toHaveValue("");
});

test("multi-statement math matches the emphasized statement typography", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "MULTI_STATEMENT_TRUE_FALSE",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const statementText = page.getByText("1 + 1 = 2", { exact: true });
  const statementMath = page.locator(".tiptap-content-view .katex");
  const statementMathGlyph = statementMath.locator(".mfrac .mord.mtight").first();
  const fractionLine = statementMath.locator(".mfrac .frac-line");
  await expect(statementText).toBeVisible();
  await expect(statementMath).toBeVisible();
  await expect(statementMathGlyph).toBeVisible();
  await expect(fractionLine).toBeVisible();

  const textTypography = await statementText.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };
  });
  const mathTypography = await statementMathGlyph.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };
  });

  expect(mathTypography).toEqual(textTypography);
  expect(
    await fractionLine.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).borderBottomWidth),
    ),
  ).toBeGreaterThanOrEqual(2);
});

test("all supported question math inherits the surrounding typography", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    quizQuestionIncludesMathExamples: true,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const questionContent = page.locator(
    ".student-assessment-content > .tiptap-content-view",
  );
  const questionParagraph = questionContent.locator("p");
  const mathExpressions = questionContent.locator(".katex");
  const mathTextGlyphs = questionContent.locator(".katex :is(.mathnormal, .mathit)");
  const fractionGlyph = questionContent.locator(".mfrac .mord.mtight").first();

  await expect(questionParagraph).toBeVisible();
  await expect(mathExpressions).toHaveCount(9);
  await expect(mathTextGlyphs.first()).toBeVisible();
  await expect(fractionGlyph).toBeVisible();

  const textTypography = await questionParagraph.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };
  });
  const mathTypography = await mathExpressions.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    }),
  );
  const fractionTypography = await fractionGlyph.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    };
  });
  const mathTextTypography = await mathTextGlyphs.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        color: style.color,
        fontFamily: style.fontFamily,
        fontStyle: style.fontStyle,
        fontWeight: style.fontWeight,
      };
    }),
  );

  expect(mathTypography).toEqual(Array.from({ length: 9 }, () => textTypography));
  expect(fractionTypography).toEqual(textTypography);
  for (const typography of mathTextTypography) {
    expect(typography).toEqual({
      color: textTypography.color,
      fontFamily: textTypography.fontFamily,
      fontStyle: "normal",
      fontWeight: textTypography.fontWeight,
    });
  }
});

test("math fraction stays vertically centered without input scrollbars", async ({
  page,
}) => {
  const mathliveWarnings: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "warning" &&
      /MathLive|Invalid Options|constructor option/i.test(message.text())
    ) {
      mathliveWarnings.push(message.text());
    }
  });

  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "TEXT_INPUT",
  });
  await page.goto(`/student/lessons/${lessonId}`);

  await page.getByRole("button", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  const nativeAnswerInput = page.getByPlaceholder("Nhập đáp án");
  await expect(nativeAnswerInput).toBeVisible();
  const nativePlaceholderColor = await nativeAnswerInput.evaluate(
    (element) => getComputedStyle(element, "::placeholder").color,
  );
  await page.evaluate(() => {
    const samples: Array<{
      borderStyle: string;
      hasSpinner: boolean;
      position: string;
      visibleText: string;
    }> = [];
    const observer = new MutationObserver(() => {
      const loadingShell = document.querySelector<HTMLElement>(
        ".visual-math-input--student-answer .visual-math-input__loading",
      );
      if (!loadingShell) return;
      const style = getComputedStyle(loadingShell);
      samples.push({
        borderStyle: style.borderStyle,
        hasSpinner: Boolean(loadingShell.querySelector(".animate-spin")),
        position: style.position,
        visibleText: loadingShell.textContent?.trim() ?? "",
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    (
      window as typeof window & {
        __studentMathTransitionProbe?: {
          observer: MutationObserver;
          samples: typeof samples;
        };
      }
    ).__studentMathTransitionProbe = { observer, samples };
  });
  await page.getByRole("button", { name: "Mở bàn phím toán" }).click();

  const mathField = page.locator("math-field");
  await expect(mathField).toBeVisible();
  const transitionSamples = await page.evaluate(() => {
    const probe = (
      window as typeof window & {
        __studentMathTransitionProbe?: {
          observer: MutationObserver;
          samples: Array<{
            borderStyle: string;
            hasSpinner: boolean;
            position: string;
            visibleText: string;
          }>;
        };
      }
    ).__studentMathTransitionProbe;
    probe?.observer.disconnect();
    return probe?.samples ?? [];
  });
  expect(transitionSamples.length).toBeGreaterThan(0);
  expect(
    transitionSamples.some(
      (sample) =>
        sample.hasSpinner || sample.visibleText.includes("Đang mở vùng nhập công thức"),
    ),
  ).toBe(false);
  for (const sample of transitionSamples) {
    expect(sample.borderStyle).toBe("solid");
    expect(sample.position).toBe("absolute");
  }
  const formulaPlaceholder = page.getByText("Nhập đáp án", { exact: true });
  await expect(formulaPlaceholder).toHaveCount(1);
  const formulaPlaceholderColor = await formulaPlaceholder.evaluate(
    (element) => getComputedStyle(element).color,
  );
  const normalizedPlaceholderColors = await page.evaluate(
    ({ formulaColor, nativeColor }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }
      const toRgba = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };

      return {
        formula: toRgba(formulaColor),
        native: toRgba(nativeColor),
      };
    },
    {
      formulaColor: formulaPlaceholderColor,
      nativeColor: nativePlaceholderColor,
    },
  );
  expect(normalizedPlaceholderColors?.formula).toEqual(
    normalizedPlaceholderColors?.native,
  );
  await expect
    .poll(() =>
      mathField.evaluate((element) => {
        const caret = element.shadowRoot?.querySelector<HTMLElement>(".ML__caret");
        return {
          activeElementIsField: document.activeElement === element,
          caretVisibility: caret ? getComputedStyle(caret, "::after").visibility : null,
        };
      }),
    )
    .toEqual({
      activeElementIsField: true,
      caretVisibility: "visible",
    });
  await expect(formulaPlaceholder).toBeVisible();
  await page.getByRole("button", { name: "Chèn dấu trừ" }).click();
  await page.getByRole("button", { name: "Chèn số 2" }).click();
  await expect
    .poll(() =>
      mathField.evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toBe("-2");
  await expect(formulaPlaceholder).toBeHidden();
  await page.getByRole("button", { name: "Chèn phân số" }).click();

  const readMathFieldMetrics = () =>
    mathField.evaluate((element) => {
      const field = element as HTMLElement;
      const content = field.shadowRoot?.querySelector<HTMLElement>('[part="content"]');
      const caret = field.shadowRoot?.querySelector<HTMLElement>(".ML__caret");
      const selectedPlaceholder = field.shadowRoot?.querySelector<HTMLElement>(
        ".ML__cmr.ML__selected",
      );
      const slotBoxes = Array.from(
        field.shadowRoot?.querySelectorAll<HTMLElement>(".ML__cmr") ?? [],
      );
      const fieldRect = field.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();

      return {
        clientHeight: field.clientHeight,
        scrollHeight: field.scrollHeight,
        clientWidth: field.clientWidth,
        scrollWidth: field.scrollWidth,
        verticalCenterDelta:
          contentRect === undefined
            ? null
            : Math.abs(
                contentRect.top +
                  contentRect.height / 2 -
                  (fieldRect.top + fieldRect.height / 2),
              ),
        contentOverflow: content ? getComputedStyle(content).overflow : null,
        caretVisibility: caret ? getComputedStyle(caret, "::after").visibility : null,
        placeholderCaretAnimation: selectedPlaceholder
          ? getComputedStyle(selectedPlaceholder, "::after").animationName
          : null,
        placeholderCaretLeft: selectedPlaceholder
          ? getComputedStyle(selectedPlaceholder, "::after").left
          : null,
        activeElementIsField: document.activeElement === field,
        selectedNodeCount:
          field.shadowRoot?.querySelectorAll(".ML__selected").length ?? 0,
        slotBoxCount: slotBoxes.length,
        placeholdersInsideField: slotBoxes.every((slotBox) => {
          const rect = slotBox.getBoundingClientRect();
          return rect.top >= fieldRect.top && rect.bottom <= fieldRect.bottom;
        }),
      };
    });

  await expect
    .poll(() => readMathFieldMetrics())
    .toMatchObject({
      placeholderCaretAnimation: "visual-math-placeholder-caret-blink",
      activeElementIsField: true,
    });
  const metrics = await readMathFieldMetrics();

  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.verticalCenterDelta).not.toBeNull();
  expect(metrics.verticalCenterDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2);
  expect(metrics.contentOverflow).toBe("visible");
  expect(metrics.placeholderCaretAnimation).toBe("visual-math-placeholder-caret-blink");
  expect(metrics.placeholderCaretLeft).not.toBe("auto");
  expect(metrics.selectedNodeCount).toBeGreaterThan(0);
  expect(metrics.slotBoxCount).toBeGreaterThanOrEqual(2);
  expect(metrics.placeholdersInsideField).toBe(true);

  const numeratorBox = await mathField.locator(".ML__cmr.ML__selected").boundingBox();
  expect(numeratorBox).not.toBeNull();
  if (numeratorBox) {
    await page.mouse.click(
      numeratorBox.x + numeratorBox.width / 2,
      numeratorBox.y + numeratorBox.height / 2,
    );
  }
  await expect
    .poll(() => readMathFieldMetrics())
    .toMatchObject({
      placeholderCaretAnimation: "visual-math-placeholder-caret-blink",
      activeElementIsField: true,
    });
  expect(mathliveWarnings).toEqual([]);
  await expectNoFrameworkOverlay(page);
});

test("student square root keeps the answer color while the caret is inside", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "TEXT_INPUT",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Mở bàn phím toán" }).click();

  const mathField = page.locator('math-field[aria-label="Nhập đáp án"]');
  await expect(mathField).toBeVisible();
  await page.getByRole("button", { name: "Chèn căn bậc hai" }).click();
  await page.getByRole("button", { name: "Chèn số 5" }).click();
  await expect
    .poll(() =>
      mathField.evaluate((element) => (element as HTMLElement & { value: string }).value),
    )
    .toBe("\\sqrt5");

  const readRootColors = () =>
    mathField.evaluate((element) => {
      const shadowRoot = element.shadowRoot;
      const rootSign = shadowRoot?.querySelector<HTMLElement>(".ML__sqrt-sign");
      const rootLine = shadowRoot?.querySelector<HTMLElement>(".ML__sqrt-line");

      return {
        answer: getComputedStyle(element).color,
        hasCaretInsideRoot: Boolean(
          shadowRoot?.querySelector(".ML__contains-caret .ML__sqrt-sign"),
        ),
        rootLine: rootLine ? getComputedStyle(rootLine).color : "",
        rootSign: rootSign ? getComputedStyle(rootSign).color : "",
      };
    });

  const colors = await readRootColors();
  expect(colors.hasCaretInsideRoot).toBe(true);
  expect(colors.rootSign).toBe(colors.answer);
  expect(colors.rootLine).toBe(colors.answer);

  await page.evaluate(() => {
    window.localStorage.setItem("classhero-theme", "dark");
    document.documentElement.classList.add("dark");
    document.body.classList.add("dark");
  });
  const darkColors = await readRootColors();
  expect(darkColors.rootSign).toBe(darkColors.answer);
  expect(darkColors.rootLine).toBe(darkColors.answer);
  await expectNoFrameworkOverlay(page);
});

test("test remains locked after open time when quiz and flashcard are incomplete", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await expect(page.getByRole("heading", { name: "Kiểm tra" })).toBeVisible();
  await expect(page.getByText("Đang khóa", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Hoàn thành xong Quiz và Flashcard để mở khóa bài kiểm tra."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Quiz.*Chưa xong/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Flashcard.*Chưa xong/ })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("failed test shows retry warning and cannot use the score", async ({ page }) => {
  await setupStudentLearningApiMock(page, { testReady: true, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await expect(page.getByText("Ôn lại Quiz và Flashcard để sẵn sàng hơn.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn lại Quiz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ôn lại Flashcard" })).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu bài kiểm tra" }).click();
  await page.getByRole("button", { name: /A.*5/ }).click();
  await page.getByRole("button", { name: "Nộp bài kiểm tra" }).click();

  await expect(page.getByText("Bạn cần phải làm lại bài kiểm tra mới.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Làm lại bài kiểm tra mới" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Dùng điểm bài này" })).toBeDisabled();
  await expectNoFrameworkOverlay(page);
});

test("passing test can use the result and opens completion with top five", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: true, testPasses: true });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await page.getByRole("button", { name: "Bắt đầu bài kiểm tra" }).click();
  await page.getByRole("button", { name: /B.*6/ }).click();
  await page.getByRole("button", { name: "Nộp bài kiểm tra" }).click();
  await expect(page.getByRole("button", { name: "Dùng điểm bài này" })).toBeEnabled();
  await page.getByRole("button", { name: "Dùng điểm bài này" }).click();

  await expect(page.getByRole("heading", { name: "Chúc mừng bạn!" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top 5 buổi học" })).toBeVisible();
  await expect(page.getByRole("main").getByText("Học sinh M7")).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

async function seedStudentSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    role: "STUDENT",
    sub: "student-m7",
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
        email: "student@classhero.test",
        fullName: "Học sinh M7",
        id: "student-m7",
        phone: null,
        role: "STUDENT",
        username: "student-m7",
      },
    },
  );
}

async function setupStudentLearningApiMock(
  page: Page,
  options: {
    flashcardCardCount?: number;
    flashcardCompleted?: boolean;
    quizQuestionCount?: number;
    quizQuestionIncludesMathExamples?: boolean;
    quizSubmitAggregateResult?: {
      id: string;
      correctCount: number;
      wrongCount: number;
      totalCount: number;
      accuracyPercent: number;
    };
    testReady: boolean;
    testPasses: boolean;
    quizQuestionType?:
      "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_STATEMENT_TRUE_FALSE" | "TEXT_INPUT";
  },
) {
  type CurrentQuizAttempt = ReturnType<typeof quizAttemptPayload> & {
    checkedAnswers: Array<{
      answerJson: unknown;
      feedback: ReturnType<typeof quizFeedbackPayload>;
      questionId: string;
    }>;
  };
  type QuizAttemptSummaryPayload = {
    id: string;
    sourceAttemptId?: string | null;
    correctCount: number;
    wrongCount: number;
    totalCount: number;
    accuracyPercent: number;
  };
  const flashcardProgressById = new Map<string, boolean>();
  const favoriteFlashcardIds = new Set<string>();
  if (options.flashcardCompleted) {
    Array.from({ length: options.flashcardCardCount ?? 1 }, (_, index) =>
      index === 0 ? "flashcard-m7" : `flashcard-m7-${index + 1}`,
    ).forEach((flashcardId) => flashcardProgressById.set(flashcardId, true));
  }
  let currentQuizAttempt: CurrentQuizAttempt | null = null;
  let latestQuizAttempt: QuizAttemptSummaryPayload | null = null;

  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();

    if (method === "GET" && pathname === "/auth/me") {
      return fulfillJson(route, 200, {
        data: {
          id: "student-m7",
          role: "STUDENT",
          fullName: "Học sinh M7",
          studentProfile: { grade: 7 },
        },
      });
    }
    if (method === "GET" && pathname === `/student/lessons/${lessonId}`) {
      return fulfillJson(route, 200, { data: lessonPayload() });
    }
    if (method === "GET" && pathname === `/student/lessons/${lessonId}/flashcard-sets`) {
      return fulfillJson(route, 200, {
        data: flashcardPayload(
          options.flashcardCardCount,
          flashcardProgressById,
          favoriteFlashcardIds,
        ),
      });
    }
    if (
      method === "PATCH" &&
      /^\/student\/flashcards\/flashcard-m7(?:-\d+)?\/progress$/.test(pathname)
    ) {
      const body = request.postDataJSON() as { isKnown: boolean };
      const flashcardId = pathname.split("/")[3] ?? "flashcard-m7";
      flashcardProgressById.set(flashcardId, body.isKnown);
      const reviewedCount = flashcardProgressById.size;
      const knownCount = Array.from(flashcardProgressById.values()).filter(
        Boolean,
      ).length;
      const totalCount = options.flashcardCardCount ?? 1;
      return fulfillJson(route, 200, {
        data: {
          flashcardId,
          isKnown: body.isKnown,
          setProgress: {
            totalCount,
            reviewedCount,
            knownCount,
            unknownCount: reviewedCount - knownCount,
            unreviewedCount: Math.max(0, totalCount - reviewedCount),
            isCompleted: reviewedCount === totalCount,
          },
        },
      });
    }
    if (method === "POST" && pathname === "/student/favorites/toggle") {
      const body = request.postDataJSON() as { targetId: string };
      const isFavorite = !favoriteFlashcardIds.has(body.targetId);
      if (isFavorite) {
        favoriteFlashcardIds.add(body.targetId);
      } else {
        favoriteFlashcardIds.delete(body.targetId);
      }
      return fulfillJson(route, 200, { data: { isFavorite } });
    }
    if (
      method === "GET" &&
      pathname === `/student/lessons/${lessonId}/test-sets/status`
    ) {
      return fulfillJson(route, 200, {
        data: testStatusPayload(options.testReady),
      });
    }
    if (
      method === "GET" &&
      pathname === "/student/quiz-sets/quiz-set-m7/attempts/status"
    ) {
      const checkedCount = currentQuizAttempt?.checkedAnswers.length ?? 0;
      return fulfillJson(route, 200, {
        data: currentQuizAttempt
          ? {
              state: "IN_PROGRESS",
              currentAttemptId: currentQuizAttempt.id,
              checkedCount,
              latestSubmittedAttempt: latestQuizAttempt,
            }
          : latestQuizAttempt
            ? {
                state: "COMPLETED",
                currentAttemptId: null,
                checkedCount: latestQuizAttempt.totalCount,
                latestSubmittedAttempt: latestQuizAttempt,
              }
            : {
                state: "NOT_STARTED",
                currentAttemptId: null,
                checkedCount: 0,
                latestSubmittedAttempt: null,
              },
      });
    }
    if (
      method === "GET" &&
      pathname === "/student/quiz-sets/quiz-set-m7/attempts/current"
    ) {
      return fulfillJson(route, 200, { data: currentQuizAttempt });
    }
    if (method === "POST" && pathname === "/student/quiz-sets/quiz-set-m7/attempts") {
      const nextAttempt = quizAttemptPayload(
        options.quizQuestionType,
        options.quizQuestionCount,
        options.quizQuestionIncludesMathExamples,
      );
      currentQuizAttempt = {
        ...nextAttempt,
        checkedAnswers: [],
      };
      return fulfillJson(route, 200, {
        data: nextAttempt,
      });
    }
    if (
      method === "POST" &&
      pathname ===
        "/student/quiz-attempts/quiz-attempt-m7/questions/quiz-question-m7/check"
    ) {
      const feedback = quizFeedbackPayload();
      const body = request.postDataJSON() as { answerJson: unknown };
      if (currentQuizAttempt) {
        currentQuizAttempt.checkedAnswers = [
          {
            answerJson: body.answerJson,
            feedback,
            questionId: "quiz-question-m7",
          },
        ];
      }
      return fulfillJson(route, 200, {
        data: feedback,
      });
    }
    if (
      method === "POST" &&
      pathname === "/student/quiz-attempts/quiz-attempt-m7/submit"
    ) {
      const submittedAttempt = {
        id: "quiz-attempt-m7",
        correctCount: 1,
        wrongCount: 0,
        totalCount: 1,
        accuracyPercent: 100,
      };
      const aggregateResult = options.quizSubmitAggregateResult ?? submittedAttempt;
      latestQuizAttempt = aggregateResult;
      currentQuizAttempt = null;
      return fulfillJson(route, 200, {
        data: {
          ...submittedAttempt,
          sourceAttemptId:
            aggregateResult.id === submittedAttempt.id ? null : aggregateResult.id,
          aggregateResult,
        },
      });
    }
    if (
      method === "GET" &&
      pathname.startsWith("/student/quiz-attempts/quiz-attempt-m7/review")
    ) {
      return fulfillJson(route, 200, { data: quizReviewPayload() });
    }
    if (
      method === "POST" &&
      pathname === `/student/lessons/${lessonId}/test-attempts/start`
    ) {
      return fulfillJson(route, 200, { data: testAttemptPayload() });
    }
    if (
      method === "POST" &&
      pathname === "/student/test-attempts/test-attempt-m7/submit"
    ) {
      return fulfillJson(route, 200, {
        data: {
          id: "test-attempt-m7",
          durationSeconds: 45,
          score: options.testPasses ? 10 : 0,
          completionMinScore: 7,
          passed: options.testPasses,
          correctCount: options.testPasses ? 1 : 0,
          wrongCount: options.testPasses ? 0 : 1,
          totalCount: 1,
        },
      });
    }
    if (
      method === "POST" &&
      pathname === "/student/test-attempts/test-attempt-m7/use-result"
    ) {
      return fulfillJson(route, 200, {
        data: {
          lessonId,
          usedAttemptId: "test-attempt-m7",
          promotedToBest: true,
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
          bestAttempt: {
            id: "test-attempt-m7",
            score: 10,
            durationSeconds: 45,
          },
          leaderboard: [
            {
              rank: 1,
              attemptId: "test-attempt-m7",
              studentName: "Học sinh M7",
              score: 10,
              durationSeconds: 45,
              isCurrentStudent: true,
            },
          ],
        },
      });
    }
    if (
      method === "GET" &&
      pathname.startsWith(`/student/test-attempts/test-attempt-m7/review`)
    ) {
      return fulfillJson(route, 200, { data: testReviewPayload(options.testPasses) });
    }

    return fulfillJson(route, 404, {
      error: { code: "NOT_FOUND", message: `No mock for ${method} ${pathname}` },
    });
  });
}

function quizFeedbackPayload() {
  return {
    isCorrect: true,
    correctAnswerJson: ["quiz-option-b"],
    statementResults: null,
    explanationJson: documentWithText("Cộng hai với hai được bốn."),
  };
}

function quizReviewPayload() {
  const [question] = quizAttemptPayload().questions;

  return {
    id: "quiz-attempt-m7",
    scope: "ALL",
    correctCount: 1,
    wrongCount: 0,
    totalCount: 1,
    accuracyPercent: 100,
    questions: question
      ? [
          {
            ...question,
            answerJson: ["quiz-option-b"],
            ...quizFeedbackPayload(),
          },
        ]
      : [],
  };
}

function lessonPayload() {
  return {
    id: lessonId,
    title: "Buổi 1: Số hữu tỉ",
    shortDescription: "Nắm chắc phép tính cơ bản.",
    videoUrl: "https://youtu.be/video-m7",
    customVideoSettings: {
      isDisabled: true,
      startTimeInSeconds: 0,
      endTimeCutInSeconds: 0,
    },
    completionMinScore: 7,
    access: { mode: "ENROLLMENT" },
    chapter: { id: "chapter-m7", title: "Số hữu tỉ", orderIndex: 1 },
    learningPath: { id: "path-m7", slug: "toan-7", title: "Toán 7" },
    summary: {
      id: "summary-m7",
      contentJson: documentWithText("Kiến thức trọng tâm M7"),
      updatedAt: new Date().toISOString(),
    },
    materials: [{ id: "material-hidden", title: "Tài liệu không được hiển thị" }],
    quizSets: [{ id: "quiz-set-m7", title: "Quiz số hữu tỉ", questionCount: 1 }],
    flashcardSets: [
      { id: "flashcard-set-m7", title: "Flashcard số hữu tỉ", cardCount: 1 },
    ],
    testSets: [
      {
        id: "test-set-m7",
        title: "Bài kiểm tra số hữu tỉ",
        questionCount: 1,
        durationSeconds: 600,
      },
    ],
    navigation: { previous: null, next: null },
  };
}

function quizAttemptPayload(
  questionType:
    | "MULTIPLE_CHOICE"
    | "TRUE_FALSE"
    | "MULTI_STATEMENT_TRUE_FALSE"
    | "TEXT_INPUT" = "MULTIPLE_CHOICE",
  questionCount = 1,
  includesMathExamples = false,
) {
  return {
    id: "quiz-attempt-m7",
    totalCount: questionCount,
    scope: "ALL",
    quizSet: { id: "quiz-set-m7", title: "Quiz số hữu tỉ" },
    questions: Array.from({ length: questionCount }, (_, index) => {
      const questionNumber = index + 1;
      return {
        id:
          questionNumber === 1
            ? "quiz-question-m7"
            : `quiz-question-m7-${questionNumber}`,
        questionType,
        questionJson:
          includesMathExamples && questionNumber === 1
            ? documentWithMathExamples()
            : documentWithText(`Câu ${questionNumber}: 2 + 2 bằng bao nhiêu?`),
        optionsJson:
          questionType === "MULTIPLE_CHOICE"
            ? [
                { id: "quiz-option-a", richText: documentWithText("3") },
                { id: "quiz-option-b", richText: documentWithText("4") },
              ]
            : questionType === "MULTI_STATEMENT_TRUE_FALSE"
              ? [
                  {
                    id: "quiz-statement-a",
                    richText: documentWithText("1 + 1 = 2"),
                  },
                  {
                    id: "quiz-statement-b",
                    richText: documentWithInlineMath("\\frac{7}{8}"),
                  },
                ]
              : null,
        hintJson: documentWithText("Hãy cộng hai số."),
        correctAnswerJson:
          questionType === "TRUE_FALSE"
            ? true
            : questionType === "MULTI_STATEMENT_TRUE_FALSE"
              ? [
                  { statementId: "quiz-statement-a", value: true },
                  { statementId: "quiz-statement-b", value: false },
                ]
              : questionType === "TEXT_INPUT"
                ? ["-2.5"]
                : ["quiz-option-b"],
        gradingConfigJson: null,
        explanationJson: documentWithText("Cộng hai với hai được bốn."),
        difficulty: "EASY",
        sortOrder: index,
        hasExplanation: true,
      };
    }),
  };
}

function flashcardPayload(
  cardCount = 1,
  progressById: ReadonlyMap<string, boolean> = new Map(),
  favoriteIds: ReadonlySet<string> = new Set(),
) {
  const cards = Array.from({ length: cardCount }, (_, index) => {
    const id = index === 0 ? "flashcard-m7" : `flashcard-m7-${index + 1}`;
    const isKnown = progressById.get(id);

    return {
      id,
      frontJson: documentWithText(index === 0 ? "2 + 2" : `Câu hỏi thẻ ${index + 1}`),
      backJson: documentWithText(index === 0 ? "4" : `Đáp án thẻ ${index + 1}`),
      explanation: null,
      isFavorite: favoriteIds.has(id),
      progress:
        isKnown === undefined
          ? null
          : {
              isKnown,
              lastReviewedAt: new Date().toISOString(),
              reviewCount: 1,
            },
    };
  });
  const reviewedCount = cards.filter((card) => card.progress !== null).length;
  const knownCount = cards.filter((card) => card.progress?.isKnown === true).length;

  return [
    {
      id: "flashcard-set-m7",
      lessonId,
      title: "Flashcard số hữu tỉ",
      cardCount,
      flashcards: cards,
      progress: {
        totalCount: cardCount,
        reviewedCount,
        knownCount,
        unknownCount: reviewedCount - knownCount,
        unreviewedCount: cardCount - reviewedCount,
        isCompleted: reviewedCount === cardCount,
      },
    },
  ];
}

function testStatusPayload(ready: boolean) {
  return {
    canStart: ready,
    examOpenAt: new Date(Date.now() - 60_000).toISOString(),
    evaluatedAt: new Date().toISOString(),
    lockReason: ready ? null : "PREREQUISITES_INCOMPLETE",
    quiz: { isRequired: true, isCompleted: ready },
    flashcard: { isRequired: true, isCompleted: ready },
    bestAttempt: null,
    sets: [
      {
        id: "test-set-m7",
        title: "Bài kiểm tra số hữu tỉ",
        durationSeconds: 600,
        totalScore: 10,
        questionCount: 1,
      },
    ],
  };
}

function testAttemptPayload() {
  return {
    id: "test-attempt-m7",
    startedAt: new Date().toISOString(),
    totalCount: 1,
    testSet: {
      id: "test-set-m7",
      title: "Bài kiểm tra số hữu tỉ",
      durationSeconds: 600,
      totalScore: 10,
    },
    questions: [
      {
        id: "test-question-m7",
        questionType: "MULTIPLE_CHOICE",
        questionJson: documentWithText("3 + 3 bằng bao nhiêu?"),
        optionsJson: [
          { id: "A", richText: documentWithText("5") },
          { id: "B", richText: documentWithText("6") },
        ],
        difficulty: "EASY",
        sortOrder: 0,
      },
    ],
  };
}

function testReviewPayload(passed: boolean) {
  return {
    id: "test-attempt-m7",
    scope: "ALL",
    durationSeconds: 45,
    score: passed ? 10 : 0,
    completionMinScore: 7,
    passed,
    correctCount: passed ? 1 : 0,
    wrongCount: passed ? 0 : 1,
    totalCount: 1,
    questions: [],
  };
}

function documentWithText(text: string) {
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

function documentWithInlineMath(latex: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "inlineMath", attrs: { latex } }],
      },
    ],
  };
}

function documentWithMathExamples() {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Mẫu toán: " },
          { type: "inlineMath", attrs: { latex: "\\frac{2}{3}" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\sqrt{4}" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "2^3" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\lim_{x\\to0}" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\sum_{i=1}^{n}i" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\int_0^1x\\,dx" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\left(x+1\\right)" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\alpha\\leq\\beta" } },
          { type: "text", text: " " },
          { type: "inlineMath", attrs: { latex: "\\mathbb{R}" } },
        ],
      },
    ],
  };
}

function createUnsignedToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function expectNoFrameworkOverlay(page: Page) {
  await expect(
    page.getByText("Application error: a client-side exception has occurred"),
  ).toHaveCount(0);
  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
}
