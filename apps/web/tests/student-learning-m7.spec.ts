import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

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
    await page
      .getByRole("main")
      .evaluate((element) => getComputedStyle(element).background),
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Câu 1" })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-test-runner-dark.png"),
  });
  await page.getByRole("button", { name: /A.*5/ }).click();
  await page.getByRole("button", { name: "Nộp bài thi" }).click();
  await expect(page.getByText("Bạn cần phải làm lại bài thi mới.")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("student-test-result-dark.png"),
  });
  await expectNoFrameworkOverlay(page);
});

test("quiz tab keeps the current panel stable until its preloaded status is ready", async ({
  page,
}) => {
  let statusRequestCount = 0;
  let releaseQuizStatus: () => void = () => undefined;
  const quizStatusGate = new Promise<void>((resolve) => {
    releaseQuizStatus = resolve;
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/student/quiz-sets/quiz-set-m7/attempts/status")) {
      statusRequestCount += 1;
    }
  });
  await setupStudentLearningApiMock(page, {
    quizStatusGate,
    testReady: false,
    testPasses: false,
  });
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

  const quizTab = page.getByRole("button", { name: "Quiz", exact: true });
  await quizTab.click();
  await expect(quizTab).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  releaseQuizStatus();
  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Bài học", exact: true }).click();
  await quizTab.click();
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

test("stale Quiz runner history never flashes or reopens over the plain Quiz tab", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);

  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/learningSurface=quiz-runner/);

  await page.evaluate(() => {
    const lessonTab = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "Bài học",
    );
    lessonTab?.click();
  });
  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  await expect(page).not.toHaveURL(/learningSurface=/);

  await page.evaluate(() => {
    const probe = {
      observedResumeLoading: false,
      observedRunner: false,
    };
    const sample = () => {
      probe.observedResumeLoading ||= Boolean(
        document.querySelector('[aria-label="Đang mở lại lượt Quiz"]'),
      );
      probe.observedRunner ||= Boolean(
        document.querySelector('[data-testid="quiz-runner-screen"]'),
      );
    };
    const observer = new MutationObserver(sample);
    observer.observe(document.body, { childList: true, subtree: true });
    (
      window as typeof window & {
        __staleQuizSurfaceProbe?: {
          observer: MutationObserver;
          probe: typeof probe;
        };
      }
    ).__staleQuizSurfaceProbe = { observer, probe };
  });

  await page.getByRole("button", { name: "Quiz" }).click();
  await expect(
    page.getByRole("button", { name: "Tiếp tục làm", exact: true }),
  ).toBeVisible();

  const staleSurfaceProbe = await page.evaluate(() => {
    const value = (
      window as typeof window & {
        __staleQuizSurfaceProbe?: {
          observer: MutationObserver;
          probe: {
            observedResumeLoading: boolean;
            observedRunner: boolean;
          };
        };
      }
    ).__staleQuizSurfaceProbe;
    value?.observer.disconnect();
    return value?.probe;
  });
  expect(staleSurfaceProbe).toEqual({
    observedResumeLoading: false,
    observedRunner: false,
  });
  expect(
    await page.evaluate(() => ({
      bodyOverflow: document.body.style.overflow,
      htmlOverflow: document.documentElement.style.overflow,
    })),
  ).toEqual({ bodyOverflow: "", htmlOverflow: "" });
  await expect(page).not.toHaveURL(/learningSurface=/);
  await expectNoFrameworkOverlay(page);
});

test("lesson navigation stays visible and unlocks the next lesson after a passing test", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    includeNextLesson: true,
    testReady: true,
    testPasses: true,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  const backToCourseLink = page.getByRole("link", {
    name: "Trở về",
    exact: true,
  });
  const nextLessonButton = page.getByRole("button", {
    name: "Bài học kế tiếp Buổi 2: Giá trị tuyệt đối",
  });
  await expect(backToCourseLink).toBeVisible();
  await expect(backToCourseLink).toHaveAttribute("href", "/student/courses/toan-7");
  await expect(nextLessonButton).toBeVisible();
  await expect(nextLessonButton).toBeDisabled();

  await page.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  await page.getByRole("button", { name: /B.*6/ }).click();
  await page.getByRole("button", { name: "Nộp bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dùng điểm bài này" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quay lại màn Bài thi" }).click();

  await expect(nextLessonButton).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: "Bài học kế tiếp Buổi 2: Giá trị tuyệt đối",
    }),
  ).toBeVisible();
});

test("completed test offers review and a new test attempt", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    testCompleted: true,
    testPasses: true,
    testReady: true,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xem lại bài thi" })).toBeVisible();
  const newTestButton = page.getByRole("button", {
    name: "Làm bài thi mới",
    exact: true,
  });
  await expect(newTestButton).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Bài học kế tiếp Đây là bài học cuối cùng",
    }),
  ).toBeDisabled();
  await expect(newTestButton).toHaveClass(/border-emerald-500/);
  await expect(newTestButton).toHaveClass(/bg-white/);

  await page.getByRole("button", { name: "Xem lại bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();
  await page.getByRole("button", { name: "Xem lại tất cả" }).click();
  const reviewScreen = page.getByTestId("test-review-screen");
  await expect(reviewScreen.getByText("Xem lại tất cả câu trả lời")).toBeVisible();
  await expect(
    reviewScreen.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await reviewScreen.getByRole("button", { name: "Quay lại kết quả Bài thi" }).click();

  const retryTestButton = page.getByRole("button", { name: "Làm lại bài thi mới" });
  await expect(retryTestButton).toBeVisible();
  await retryTestButton.click();
  await expect(page.getByTestId("test-runner-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Câu 1" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("empty Quiz, Flashcard, and Test disable start actions", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    flashcardCardCount: 0,
    omitFlashcardSet: true,
    omitQuizSet: true,
    omitTestSet: true,
    quizQuestionCount: 0,
    testQuestionCount: 0,
    testFlashcardCompleted: false,
    testPasses: false,
    testQuizCompleted: false,
    testReady: false,
  });

  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await expect(page.getByText("0 câu", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeDisabled();

  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);
  await expect(page.getByText("0 thẻ", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu", exact: true })).toBeDisabled();

  await page.goto(`/student/lessons/${lessonId}?tab=test`);
  await expect(page.getByText("0 câu", { exact: true })).toBeVisible();
  await expect(page.getByTestId("test-duration-badge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Làm Quiz" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Làm Flashcard" })).toBeDisabled();
});

test("test history shows the current unfinished test and starts it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupStudentLearningApiMock(page, {
    testPasses: false,
    testReady: true,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  const settingsButton = page.getByRole("button", { name: "Mở cài đặt Bài thi" });
  const [durationBox, settingsBox] = await Promise.all([
    page.getByTestId("test-duration-badge").boundingBox(),
    settingsButton.boundingBox(),
  ]);
  expect(durationBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(settingsBox!.x).toBeGreaterThan(durationBox!.x + durationBox!.width);

  await settingsButton.click();
  await page.getByRole("menuitem", { name: "Lịch sử Bài thi" }).click();
  const historyDialog = page.getByRole("dialog", { name: "Lịch sử Bài thi" });
  const currentTestBadge = historyDialog
    .locator("article")
    .first()
    .getByText("Bài thi hiện tại");
  await expect(currentTestBadge).toHaveClass(/bg-emerald-200/);
  await expect(currentTestBadge).toHaveClass(/border-emerald-400/);
  await expect(historyDialog.getByText("Bài thi hiện tại")).toHaveCount(1);
  await expect(historyDialog.getByText("Chưa làm")).toBeVisible();
  await expect(historyDialog.getByText("10:00", { exact: true })).toHaveCount(0);
  await expect(
    historyDialog.getByRole("button", { name: "Bắt đầu bài thi" }),
  ).toBeVisible();
  await expect(
    historyDialog.getByRole("button", { name: "Xem lại bài thi" }),
  ).toHaveCount(0);

  await historyDialog.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  await expect(page.getByTestId("test-runner-screen")).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("completed test history only offers review and marks the current test", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupStudentLearningApiMock(page, {
    testCompleted: true,
    testPasses: true,
    testReady: true,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await page.getByRole("button", { name: "Mở cài đặt Bài thi" }).click();
  await page.getByRole("menuitem", { name: "Lịch sử Bài thi" }).click();
  const historyDialog = page.getByRole("dialog", { name: "Lịch sử Bài thi" });
  const currentTestBadge = historyDialog
    .locator("article")
    .first()
    .getByText("Bài thi hiện tại");
  await expect(currentTestBadge).toHaveClass(/bg-emerald-200/);
  await expect(currentTestBadge).toHaveClass(/border-emerald-400/);
  await expect(historyDialog.getByText("Bài thi hiện tại")).toHaveCount(1);
  await expect(historyDialog.getByRole("heading", { name: "Bộ đề 2" })).toBeVisible();
  await expect(historyDialog.getByRole("heading", { name: "Bộ đề 1" })).toBeVisible();
  await expect(historyDialog.getByText("Đã hoàn thành")).toHaveCount(2);
  await expect(historyDialog.getByText("00:45", { exact: true })).toHaveCount(0);
  await expect(
    historyDialog.getByRole("button", { name: "Xem lại bài thi" }),
  ).toHaveCount(2);
  await expect(historyDialog.getByRole("button", { name: /Làm lại/ })).toHaveCount(0);

  await historyDialog.getByRole("button", { name: "Xem lại bài thi" }).first().click();
  await expect(page.getByTestId("test-history-review-screen")).toBeVisible();
  await expect(page.getByTestId("learning-history-overlay")).toHaveAttribute(
    "data-covered-by-child-surface",
    "true",
  );
  await expectNoFrameworkOverlay(page);
});

test("Quiz and Flashcard history label active sessions with activity-specific copy", async ({
  page,
}) => {
  let quizHistoryRequestCount = 0;
  let flashcardHistoryRequestCount = 0;
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(`/student/lessons/${lessonId}/quiz-history`)) {
      quizHistoryRequestCount += 1;
    }
    if (pathname.endsWith(`/student/lessons/${lessonId}/flashcard-history`)) {
      flashcardHistoryRequestCount += 1;
    }
  });
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await expect(page.getByRole("heading", { name: "Quiz" })).toHaveClass(/text-lg/);

  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  const quizAnswerAutosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: /A.*3/ }).click();
  await quizAnswerAutosave;
  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await page
    .getByRole("dialog", { name: "Thoát bài Quiz?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();
  const quizSettingsButton = page.getByRole("button", {
    name: "Mở cài đặt Quiz",
  });
  const quizCountPill = quizSettingsButton.locator("xpath=preceding-sibling::span[1]");
  await expectLearningHistoryControlsToBeVisuallyDistinct(
    quizCountPill,
    quizSettingsButton,
  );
  expect(quizHistoryRequestCount).toBe(0);
  await quizSettingsButton.click();
  expect(quizHistoryRequestCount).toBe(0);
  const quizHistoryMenu = page.getByRole("menu");
  await expectLearningHistoryMenuToBeDistinct(quizHistoryMenu);
  const quizHistoryMenuItem = page.getByRole("menuitem", {
    name: "Các bộ Quiz đã làm",
  });
  const menuItemColorsBeforeHover = await quizHistoryMenuItem.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      text: style.color,
    };
  });
  await quizHistoryMenuItem.hover();
  const menuItemColorsAfterHover = await quizHistoryMenuItem.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      text: style.color,
    };
  });
  expect(menuItemColorsAfterHover.background).toBe(menuItemColorsBeforeHover.background);
  if (await page.evaluate(() => window.matchMedia("(hover: hover)").matches)) {
    expect(menuItemColorsAfterHover.text).not.toBe(menuItemColorsBeforeHover.text);
  }
  await expect(page.getByRole("button", { name: "Đóng menu" })).toHaveCount(0);
  await quizHistoryMenuItem.click();
  expect(quizHistoryRequestCount).toBe(1);
  const quizHistory = page.getByRole("dialog", { name: "Các bộ Quiz đã làm" });
  await expect(quizHistory.getByText("Mỗi lượt được lưu thành một bộ riêng")).toHaveCount(
    0,
  );
  await expect(quizHistory.getByText("Đang làm")).toHaveClass(/bg-sky-100/);
  await expect(quizHistory.getByText("1/1 câu đã làm")).toBeVisible();
  await expect(quizHistory.getByText(/^\d{2}:\d{2} \d{2}-\d{2}-\d{4}$/)).toBeVisible();
  await expect(quizHistory.getByRole("button", { name: "Tiếp tục làm" })).toBeVisible();
  await quizHistory.getByRole("button", { name: "Đóng" }).click();
  await quizSettingsButton.click();
  await page.getByRole("menuitem", { name: "Các bộ Quiz đã làm" }).click();
  expect(quizHistoryRequestCount).toBe(1);
  await expect(page.getByText("Đang tải lịch sử")).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "Các bộ Quiz đã làm" })
    .getByRole("button", { name: "Tiếp tục làm" })
    .click();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Quiz" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Các bộ Quiz đã làm" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Quiz" })).toHaveCount(0);

  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);
  await expect(page.getByRole("heading", { name: "Flashcard" })).toHaveClass(/text-lg/);
  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await page
    .getByRole("dialog", { name: "Thoát lượt học Flashcard?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();
  const flashcardSettingsButton = page.getByRole("button", {
    name: "Mở cài đặt Flashcard",
  });
  const flashcardCountPill = flashcardSettingsButton.locator(
    "xpath=preceding-sibling::span[1]",
  );
  await expectLearningHistoryControlsToBeVisuallyDistinct(
    flashcardCountPill,
    flashcardSettingsButton,
  );
  expect(flashcardHistoryRequestCount).toBe(0);
  await flashcardSettingsButton.click();
  expect(flashcardHistoryRequestCount).toBe(0);
  await expectLearningHistoryMenuToBeDistinct(page.getByRole("menu"));
  await expect(page.getByRole("button", { name: "Đóng menu" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Các bộ Flashcard đã học" }).click();
  expect(flashcardHistoryRequestCount).toBe(1);
  const flashcardHistory = page.getByRole("dialog", {
    name: "Các bộ Flashcard đã học",
  });
  await expect(flashcardHistory.getByText("Đang học")).toHaveClass(/bg-violet-100/);
  await expect(
    flashcardHistory.getByRole("button", { name: "Tiếp tục học" }),
  ).toBeVisible();
  await flashcardHistory.getByRole("button", { name: "Tiếp tục học" }).click();
  await expect(
    page.getByRole("status", { name: "Đang chuẩn bị Flashcard" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Các bộ Flashcard đã học" }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Flashcard" })).toHaveCount(
    0,
  );
});

test("quiz history keeps the same scrolled modal mounted behind review", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    quizHistoryCompletedItemCount: 12,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);

  await page.getByRole("button", { name: "Mở cài đặt Quiz" }).click();
  await page.getByRole("menuitem", { name: "Các bộ Quiz đã làm" }).click();
  const historyDialog = page.getByRole("dialog", {
    name: "Các bộ Quiz đã làm",
  });
  const historyOverlay = page.getByTestId("learning-history-overlay");
  const historyDialogElement = historyOverlay.locator('[role="dialog"]');
  const historyScrollRegion = historyDialog.getByTestId("learning-history-scroll-region");
  const reviewButton = historyDialog.getByRole("button", { name: "Xem lại" }).nth(7);
  await reviewButton.scrollIntoViewIfNeeded();
  const scrollTopBeforeReview = await historyScrollRegion.evaluate(
    (element) => element.scrollTop,
  );
  expect(scrollTopBeforeReview).toBeGreaterThan(0);
  await historyScrollRegion.evaluate((element) => {
    (
      window as typeof window & {
        __quizHistoryScrollRegion?: HTMLElement;
      }
    ).__quizHistoryScrollRegion = element as HTMLElement;
  });

  await reviewButton.click();
  await expect(
    page.getByTestId("quiz-review-screen").getByText("Bộ 5", { exact: true }),
  ).toBeVisible();
  await expect(historyDialogElement).toHaveAttribute("aria-hidden", "true");
  await expect(historyOverlay).toHaveCSS("z-index", "110");
  await expect(page.getByTestId("quiz-review-screen")).toHaveCSS("z-index", "115");
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __quizHistoryScrollRegion?: HTMLElement;
          }
        ).__quizHistoryScrollRegion?.isConnected ?? false,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Trở về", exact: true }).click();
  await expect(historyDialogElement).not.toHaveAttribute("aria-hidden", "true");

  const restoredHistoryDialog = page.getByRole("dialog", {
    name: "Các bộ Quiz đã làm",
  });
  const restoredScrollRegion = restoredHistoryDialog.getByTestId(
    "learning-history-scroll-region",
  );
  const restoredState = await restoredScrollRegion.evaluate((element) => ({
    isSameElement:
      (
        window as typeof window & {
          __quizHistoryScrollRegion?: HTMLElement;
        }
      ).__quizHistoryScrollRegion === (element as HTMLElement),
    scrollTop: element.scrollTop,
  }));
  expect(restoredState.isSameElement).toBe(true);
  expect(restoredState.scrollTop).toBeCloseTo(scrollTopBeforeReview, 0);
});

test("quiz history modal survives review of a non-active set during status loading", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    alternateQuizStatusDelayMs: 2_000,
    includeAlternateQuizSet: true,
    quizHistoryCompletedItemCount: 1,
    quizHistorySetId: "quiz-set-m7-history",
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);

  await page.getByRole("button", { name: "Mở cài đặt Quiz" }).click();
  await page.getByRole("menuitem", { name: "Các bộ Quiz đã làm" }).click();
  const historyOverlay = page.getByTestId("learning-history-overlay");
  const historyDialog = page.getByRole("dialog", {
    name: "Các bộ Quiz đã làm",
  });
  await historyOverlay.evaluate((element) => {
    (
      window as typeof window & {
        __quizHistoryOverlayBeforeCrossSetReview?: HTMLElement;
      }
    ).__quizHistoryOverlayBeforeCrossSetReview = element as HTMLElement;
  });

  await historyDialog.getByRole("button", { name: "Xem lại" }).click();
  await expect(page.getByTestId("quiz-review-screen")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __quizHistoryOverlayBeforeCrossSetReview?: HTMLElement;
          }
        ).__quizHistoryOverlayBeforeCrossSetReview?.isConnected ?? false,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Trở về", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Các bộ Quiz đã làm" })).toBeVisible();
});

test("quiz review uses history title and boundary exit actions", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    quizHistoryCompletedItemCount: 1,
    quizReviewQuestionCount: 3,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);

  await page.getByRole("button", { name: "Mở cài đặt Quiz" }).click();
  await page.getByRole("menuitem", { name: "Các bộ Quiz đã làm" }).click();
  const historyDialog = page.getByRole("dialog", {
    name: "Các bộ Quiz đã làm",
  });
  const reviewButton = historyDialog.getByRole("button", {
    name: "Xem lại",
  });
  await reviewButton.click();

  const reviewScreen = page.getByTestId("quiz-review-screen");
  await expect(reviewScreen.getByText("Bộ 1", { exact: true })).toBeVisible();
  await expect(
    reviewScreen.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Trở về" })).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Câu tiếp" })).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Câu trước" })).toHaveCount(0);
  await reviewScreen.getByRole("button", { name: "Trở về" }).click();
  await expect(historyDialog).toBeVisible();

  await reviewButton.click();
  await reviewScreen.getByRole("button", { name: "Câu tiếp" }).click();
  await expect(
    reviewScreen.getByRole("heading", { name: "Câu hỏi 2", exact: true }),
  ).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Câu trước" })).toBeVisible();
  await reviewScreen.getByRole("button", { name: "Câu tiếp" }).click();
  await expect(
    reviewScreen.getByRole("heading", { name: "Câu hỏi 3", exact: true }),
  ).toBeVisible();
  await expect(
    reviewScreen.getByRole("button", { name: "Kết thúc xem lại" }),
  ).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Câu tiếp" })).toHaveCount(0);
  await reviewScreen.getByRole("button", { name: "Kết thúc xem lại" }).click();
  await expect(historyDialog).toBeVisible();
});

test("flashcard review keeps history mounted and uses boundary exit actions", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    flashcardCardCount: 3,
    flashcardCompleted: true,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Mở cài đặt Flashcard" }).click();
  await page.getByRole("menuitem", { name: "Các bộ Flashcard đã học" }).click();
  const historyDialog = page.getByRole("dialog", {
    name: "Các bộ Flashcard đã học",
  });
  const historyOverlay = page.getByTestId("learning-history-overlay");
  const historyDialogElement = historyOverlay.locator('[role="dialog"]');
  const historyScrollRegion = historyDialog.getByTestId("learning-history-scroll-region");
  await historyScrollRegion.evaluate((element) => {
    (
      window as typeof window & {
        __flashcardHistoryScrollRegion?: HTMLElement;
      }
    ).__flashcardHistoryScrollRegion = element as HTMLElement;
  });
  const reviewButton = historyDialog.getByRole("button", {
    name: "Xem lại",
  });
  await reviewButton.click();

  const reviewScreen = page.getByTestId("flashcard-runner-screen");
  await expect(historyDialogElement).toHaveAttribute("aria-hidden", "true");
  await expect(historyOverlay).toHaveAttribute("data-covered-by-child-surface", "true");
  await expect(reviewScreen).toHaveCSS("z-index", "115");
  await expect(reviewScreen.getByText("Bộ 1", { exact: true })).toBeVisible();
  await expect(reviewScreen.getByRole("heading", { name: "Thẻ 1/3" })).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Trở về" })).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Thẻ sau" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __flashcardHistoryScrollRegion?: HTMLElement;
          }
        ).__flashcardHistoryScrollRegion?.isConnected ?? false,
    ),
  ).toBe(true);
  await reviewScreen.getByRole("button", { name: "Trở về" }).click();
  await expect(historyDialogElement).not.toHaveAttribute("aria-hidden", "true");
  await expect(historyOverlay).not.toHaveAttribute(
    "data-covered-by-child-surface",
    "true",
  );
  await expect(historyDialog).toBeVisible();
  expect(
    await historyDialog.getByTestId("learning-history-scroll-region").evaluate(
      (element) =>
        (
          window as typeof window & {
            __flashcardHistoryScrollRegion?: HTMLElement;
          }
        ).__flashcardHistoryScrollRegion === (element as HTMLElement),
    ),
  ).toBe(true);

  await reviewButton.click();
  await reviewScreen.getByRole("button", { name: "Thẻ sau" }).click();
  await expect(reviewScreen.getByRole("heading", { name: "Thẻ 2/3" })).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Thẻ trước" })).toBeVisible();
  await reviewScreen.getByRole("button", { name: "Thẻ sau" }).click();
  await expect(reviewScreen.getByRole("heading", { name: "Thẻ 3/3" })).toBeVisible();
  await expect(
    reviewScreen.getByRole("button", { name: "Kết thúc xem lại" }),
  ).toBeVisible();
  await expect(reviewScreen.getByRole("button", { name: "Hoàn thành" })).toHaveCount(0);
  await reviewScreen.getByRole("button", { name: "Kết thúc xem lại" }).click();
  await expect(historyDialog).toBeVisible();
});

test("mobile tap keeps the Quiz history sheet mounted behind review", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("-mobile"));

  await setupStudentLearningApiMock(page, {
    quizHistoryCompletedItemCount: 12,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);

  await page.getByRole("button", { name: "Mở cài đặt Quiz" }).tap();
  await page.getByRole("menuitem", { name: "Các bộ Quiz đã làm" }).tap();

  const historyOverlay = page.getByTestId("learning-history-overlay");
  const historyDialog = page.getByRole("dialog", {
    name: "Các bộ Quiz đã làm",
  });
  const historyScrollRegion = historyDialog.getByTestId("learning-history-scroll-region");
  const reviewButton = historyDialog.getByRole("button", { name: "Xem lại" }).nth(7);
  await reviewButton.scrollIntoViewIfNeeded();
  const scrollTopBeforeReview = await historyScrollRegion.evaluate(
    (element) => element.scrollTop,
  );
  await historyOverlay.evaluate((element) => {
    (
      window as typeof window & {
        __mobileQuizHistoryOverlay?: HTMLElement;
      }
    ).__mobileQuizHistoryOverlay = element as HTMLElement;
  });

  await reviewButton.tap();
  const reviewScreen = page.getByTestId("quiz-review-screen");
  await expect(reviewScreen.getByText("Bộ 5", { exact: true })).toBeVisible();
  await expect(historyOverlay).toHaveAttribute("data-covered-by-child-surface", "true");
  await expect(historyOverlay).not.toHaveAttribute("inert", "");
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __mobileQuizHistoryOverlay?: HTMLElement;
          }
        ).__mobileQuizHistoryOverlay?.isConnected ?? false,
    ),
  ).toBe(true);

  await reviewScreen.getByRole("button", { name: "Trở về" }).tap();
  await expect(historyDialog).toBeVisible();
  await expect(historyOverlay).not.toHaveAttribute(
    "data-covered-by-child-surface",
    "true",
  );
  const restoredState = await historyScrollRegion.evaluate((element) => ({
    isSameElement:
      (
        window as typeof window & {
          __mobileQuizHistoryOverlay?: HTMLElement;
        }
      ).__mobileQuizHistoryOverlay ===
      element.closest('[data-testid="learning-history-overlay"]'),
    scrollTop: element.scrollTop,
  }));
  expect(restoredState.isSameElement).toBe(true);
  expect(restoredState.scrollTop).toBeCloseTo(scrollTopBeforeReview, 0);
});

async function expectLearningHistoryControlsToBeVisuallyDistinct(
  countPill: Locator,
  settingsButton: Locator,
) {
  const [countBox, settingsBox] = await Promise.all([
    countPill.boundingBox(),
    settingsButton.boundingBox(),
  ]);
  expect(countBox).not.toBeNull();
  expect(settingsBox).not.toBeNull();
  expect(
    Math.abs((countBox?.height ?? 0) - (settingsBox?.height ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(countBox?.height).toBeCloseTo(32, 0);
  await expect(countPill).toHaveCSS("padding-left", "11px");
  expect(
    (settingsBox?.x ?? 0) - ((countBox?.x ?? 0) + (countBox?.width ?? 0)),
  ).toBeCloseTo(6, 0);
  await expect(settingsButton.locator("svg")).toHaveCSS("width", "21px");
  await expect(countPill).toHaveCSS("font-size", "13px");

  const [countBackground, settingsBackground] = await Promise.all([
    countPill.evaluate((element) => getComputedStyle(element).backgroundColor),
    settingsButton.evaluate((element) => getComputedStyle(element).backgroundColor),
  ]);
  expect(settingsBackground).not.toBe(countBackground);
}

async function expectLearningHistoryMenuToBeDistinct(menu: Locator) {
  await expect(menu).toHaveCSS("outline-width", "1px");
  const menuBox = await menu.boundingBox();
  expect(menuBox?.width ?? 0).toBeLessThan(288);
  expect(menuBox?.height).toBeCloseTo(56, 0);
  const menuItem = menu.getByRole("menuitem");
  await expect(menuItem.locator(".lucide-history")).toHaveCSS("width", "18px");
  expect(
    await menuItem.evaluate((element) => {
      return element.scrollWidth <= element.clientWidth;
    }),
  ).toBe(true);
  expect(
    await menu.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
}

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
  await expect(incompleteAlert).toHaveClass(/items-center/);
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
  const correctOptionColors = await secondOption.evaluate((button) => {
    const content = button.querySelector<HTMLElement>(".tiptap-content-view");
    return {
      button: getComputedStyle(button).color,
      content: content ? getComputedStyle(content).color : null,
    };
  });
  expect(correctOptionColors.content).not.toBeNull();
  expect(correctOptionColors.content).not.toBe(correctOptionColors.button);
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
  await expect(page.getByRole("button", { name: "Làm bộ Quiz mới" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm bộ Quiz mới" })).toBeVisible();
  await page.getByRole("button", { name: "Mở cài đặt Quiz" }).click();
  await page.getByRole("menuitem", { name: "Các bộ Quiz đã làm" }).click();
  const quizHistoryDialog = page.getByRole("dialog", {
    name: "Các bộ Quiz đã làm",
  });
  await expect(quizHistoryDialog.locator("header")).toHaveCSS(
    "border-bottom-width",
    "2px",
  );
  await expect(quizHistoryDialog.locator("header")).toHaveClass(/bg-sky-100/);
  await expect(
    quizHistoryDialog.getByRole("heading", { name: "Các bộ Quiz đã làm" }),
  ).toHaveClass(/text-sky-800/);
  await expect(quizHistoryDialog.getByRole("heading", { name: "Bộ 1" })).toBeVisible();
  await expect(quizHistoryDialog.getByText("Đã hoàn thành")).toBeVisible();
  await expect(quizHistoryDialog.getByText("Bộ hiện tại")).toHaveClass(/bg-sky-100/);
  await expect(quizHistoryDialog.getByText("1/1 câu đúng")).toBeVisible();
  await expect(quizHistoryDialog.getByText("10 điểm")).toBeVisible();
  await expect(
    quizHistoryDialog.getByText(/^\d{2}:\d{2} \d{2}-\d{2}-\d{4}$/),
  ).toBeVisible();
  await expect(quizHistoryDialog.getByRole("button", { name: "Xem lại" })).toHaveCSS(
    "border-top-width",
    "2px",
  );
  await expect(quizHistoryDialog.getByRole("button", { name: "Làm lại" })).toBeVisible();
  await quizHistoryDialog.getByRole("button", { name: "Xem lại" }).click();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Quiz" })).toBeVisible();
  await expect(quizHistoryDialog).toBeVisible();
  await expect(
    page.getByTestId("quiz-review-screen").getByText("Bộ 1", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Quiz" })).toHaveCount(0);
  await page.getByRole("button", { name: "Trở về", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Các bộ Quiz đã làm" })).toBeVisible();
  await expect(
    page
      .getByRole("dialog", { name: "Các bộ Quiz đã làm" })
      .getByRole("heading", { name: "Bộ 1" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "Các bộ Quiz đã làm" })
    .getByRole("button", { name: "Đóng" })
    .click();
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kết thúc xem lại" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await page.getByRole("button", { name: "Làm bộ Quiz mới" }).click();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("Quiz skip locks the question, reveals the answer and persists after reload", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: false, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const skipProgressRequest = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      isSkippedQuizAnswer(request.postDataJSON()?.answer?.answerJson),
  );
  await page.getByRole("button", { name: "Bỏ qua" }).click();
  await skipProgressRequest;

  await expect(page.getByText("Đã bỏ qua", { exact: true })).toBeVisible();
  await expect(page.getByText("Cộng hai với hai được bốn.")).toBeVisible();
  await expect(page.getByRole("button", { name: /A.*3/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /B.*4/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Bỏ qua", exact: true })).toHaveCount(0);
  await expect(page.getByText("Đã làm 0", { exact: true })).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Đã bỏ qua", { exact: true })).toBeVisible();
  await expect(page.getByText("Cộng hai với hai được bốn.")).toBeVisible();
  await expect(page.getByRole("button", { name: /A.*3/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /B.*4/ })).toBeDisabled();

  await page.getByRole("button", { name: "Hoàn thành Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();
  await expect(page.getByText("0/1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại câu sai" })).toBeEnabled();
  await expectNoFrameworkOverlay(page);
});

test("skipped text Quiz keeps a neutral input border and a bright amber status", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "TEXT_INPUT",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Bỏ qua", exact: true }).click();

  const answerInput = page.getByPlaceholder("Nhập đáp án");
  const skippedStatus = page.getByText("Đã bỏ qua", { exact: true });
  await expect(answerInput).toBeDisabled();
  await expect(answerInput).toHaveClass(/border-slate-200/);
  await expect(answerInput).not.toHaveClass(/border-rose-/);
  await expect(skippedStatus).toHaveClass(/text-amber-600/);
  await expect(page.getByText("Cộng hai với hai được bốn.")).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("skipped multi-statement Quiz keeps statement cards neutral", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionType: "MULTI_STATEMENT_TRUE_FALSE",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Bỏ qua", exact: true }).click();

  const statementCards = page.locator("div.student-mobile-border.rounded-2xl.border.p-3");
  await expect(statementCards).toHaveCount(2);
  for (const statementCard of await statementCards.all()) {
    await expect(statementCard).toHaveClass(/border-slate-200/);
    await expect(statementCard).toHaveClass(/bg-white/);
    await expect(statementCard).not.toHaveClass(/bg-amber-/);
  }
  await expect(page.getByText("Đã bỏ qua", { exact: true })).toHaveClass(
    /text-amber-600/,
  );
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
  await expect(
    page.getByLabel("Thống kê Flashcard: 0 chưa thuộc, 0 đã thuộc"),
  ).toBeVisible();

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
  await expect(page.getByRole("button", { name: "Học bộ Flashcard mới" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ôn lại thẻ chưa thuộc" }),
  ).toBeDisabled();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toHaveCount(0);

  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Học bộ Flashcard mới" })).toBeVisible();
  await page.getByRole("button", { name: "Mở cài đặt Flashcard" }).click();
  await page.getByRole("menuitem", { name: "Các bộ Flashcard đã học" }).click();
  const flashcardHistoryDialog = page.getByRole("dialog", {
    name: "Các bộ Flashcard đã học",
  });
  await expect(
    flashcardHistoryDialog.getByRole("heading", { name: "Bộ 1" }),
  ).toBeVisible();
  await expect(flashcardHistoryDialog.getByText("Đã hoàn thành")).toBeVisible();
  await expect(flashcardHistoryDialog.getByText("Bộ hiện tại")).toHaveClass(
    /bg-violet-100/,
  );
  await expect(flashcardHistoryDialog.getByRole("button", { name: "Xem lại" })).toHaveCSS(
    "border-top-width",
    "2px",
  );
  await expect(
    flashcardHistoryDialog.getByRole("button", { name: "Học lại" }),
  ).toBeVisible();
  await flashcardHistoryDialog.getByRole("button", { name: "Đóng" }).click();
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

  await expect(
    page.getByRole("button", { name: "Tiếp tục học", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Flashcard" }).click();

  await expect(
    page.getByRole("button", { name: "Tiếp tục học", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Học bộ Flashcard mới" })).toHaveCount(0);
});

test("flashcard finishes when the last unreviewed card is not at the final position", async ({
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
  await page.getByRole("button", { name: "Hoàn thành" }).click();
  const incompleteAlert = page.getByRole("alert").filter({ hasText: "Cần đánh dấu" });
  await expect(incompleteAlert).toBeVisible();
  await expect(incompleteAlert).toHaveClass(/items-center/);
  await page.getByRole("button", { name: "Chưa thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();

  await page.getByRole("button", { name: "Thẻ trước" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/2" })).toBeVisible();
  await page.getByRole("button", { name: "Đã thuộc" }).click();

  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();
  await expect(page.getByText("Chưa lưu được tiến độ thẻ")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Hoàn thành" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();

  await page.getByRole("button", { name: "Ôn lại thẻ chưa thuộc" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Thẻ 1", exact: true })).toBeVisible();
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

test("browser back from a reopened flashcard result returns to the lesson detail", async ({
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
  await expect(page).toHaveURL(/learningSurface=flashcard-result/);

  await page.goBack();

  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=flashcard`);
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toHaveCount(0);
});

test("browser back from a newly completed flashcard result returns to the lesson detail", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await page.getByRole("button", { name: "Đã thuộc" }).click();
  await page.getByRole("button", { name: "Hoàn thành" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Flashcard" })).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=flashcard`);
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toBeVisible();
});

test("flashcard continues at the last card even before any progress is saved", async ({
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

  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toBeVisible();
  await page.evaluate(() => window.sessionStorage.clear());
  await page.reload();
  const continueButton = page.getByRole("button", { name: "Tiếp tục học" });
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
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

  const continueButton = page.getByRole("button", { name: "Tiếp tục học" });
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
  await expect(page).toHaveURL(/learningSurface=flashcard-runner/);
  await expect(page).toHaveURL(/learningSetId=flashcard-set-m7/);

  await page.addInitScript(() => {
    const probe = { sawUncoveredLessonDetail: false };
    (
      window as typeof window & {
        __flashcardReloadSurfaceProbe?: typeof probe;
      }
    ).__flashcardReloadSurfaceProbe = probe;
    const sample = () => {
      const hasLessonDetail = Boolean(
        document.querySelector("[data-student-lesson-detail]"),
      );
      const hasFlashcardSurface = Boolean(
        document.querySelector(
          '[aria-label="Đang mở lại lượt Flashcard"], [data-testid="flashcard-runner-screen"]',
        ),
      );
      if (hasLessonDetail && !hasFlashcardSurface) {
        probe.sawUncoveredLessonDetail = true;
      }
    };
    new MutationObserver(sample).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    document.addEventListener("DOMContentLoaded", sample);
  });
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
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __flashcardReloadSurfaceProbe?: {
              sawUncoveredLessonDetail: boolean;
            };
          }
        ).__flashcardReloadSurfaceProbe?.sawUncoveredLessonDetail,
    ),
  ).toBe(false);
  await expectNoFrameworkOverlay(page);

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
  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toHaveCount(0);

  await page.getByRole("button", { name: "Tiếp tục học" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 2/2" })).toBeVisible();
  await expect(page.getByText("Mặt sau", { exact: true })).toBeVisible();
});

test("inactive Flashcard state never locks lesson scrolling after navigation or reload", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    flashcardCardCount: 2,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Bắt đầu" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/2" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.sessionStorage.getItem("student-flashcard-surface:runner"),
      ),
    )
    .toBe("flashcard-set-m7");

  await page.goto(`/student/lessons/${lessonId}`);
  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  await expectLessonDocumentToScroll(page);
  await expect(page).not.toHaveURL(/learningSurface=/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kiến thức trọng tâm" })).toBeVisible();
  await expectLessonDocumentToScroll(page);
  await expect(page).not.toHaveURL(/learningSurface=/);
  await expectNoFrameworkOverlay(page);
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

async function expectLessonDocumentToScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyOverflow: document.body.style.overflow,
        hasHiddenFlashcardRunner: Boolean(
          document.querySelector('[hidden] [data-testid="flashcard-runner-screen"]'),
        ),
        htmlOverflow: document.documentElement.style.overflow,
        isScrollable:
          document.documentElement.scrollHeight > document.documentElement.clientHeight,
      })),
    )
    .toEqual({
      bodyOverflow: "",
      hasHiddenFlashcardRunner: false,
      htmlOverflow: "",
      isScrollable: true,
    });

  await page.evaluate(() => window.scrollTo({ behavior: "auto", top: 0 }));
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 3", exact: true }),
  ).toBeVisible();
  await expect(thirdQuestionDot).toHaveAttribute("aria-current", "step");

  await firstQuestionDot.click();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expect(firstQuestionDot).toHaveAttribute("aria-current", "step");
  await expectNoFrameworkOverlay(page);
});

test("quiz keyboard shortcuts check answers and navigate between questions", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 3,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const selectedOption = page.getByRole("button", { name: /B.*4/ });
  await selectedOption.click();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 2", exact: true }),
  ).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("quiz arrow shortcuts preserve caret navigation while editing a text answer", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
    quizQuestionCount: 2,
    quizQuestionType: "TEXT_INPUT",
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const answerInput = page.getByPlaceholder("Nhập đáp án");
  await answerInput.fill("-2.5");
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();

  await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toBeEnabled();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("quiz continues at the last question with its unchecked answer after back", async ({
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 3", exact: true }),
  ).toBeVisible();
  const autosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: /A.*3/ }).click();
  await autosave;

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  const exitDialog = page.getByRole("dialog", { name: "Thoát bài Quiz?" });
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();

  await expect(page.getByRole("button", { name: "Tiếp tục làm" })).toBeVisible();
  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("student-quiz-")) {
        window.localStorage.removeItem(key);
      }
    }
    window.sessionStorage.clear();
  });
  await page.reload();
  const continueButton = page.getByRole("button", { name: "Tiếp tục làm" });
  await expect(continueButton).toBeVisible();
  await continueButton.click();

  await expect(
    page.getByRole("heading", { name: "Câu hỏi 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /A.*3/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();

  const checkedOption = page.getByRole("button", { name: /B.*4/ });
  await checkedOption.click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();

  await expect(exitDialog).toHaveCount(0);
  const enterQuizButton = page.getByRole("button", { name: "Tiếp tục làm" });
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();

  await page.goBack();

  const exitDialog = page.getByRole("dialog", { name: "Thoát bài Quiz?" });
  await expect(exitDialog).toBeVisible();
  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=quiz`);

  await exitDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(exitDialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();

  await page.goBack();
  await expect(exitDialog).toBeVisible();
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();

  await expect(exitDialog).toHaveCount(0);
  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=quiz`);
  await expect(page.getByRole("button", { name: "Tiếp tục làm" })).toBeVisible();
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

  const enterQuizButton = page.getByRole("button", { name: "Tiếp tục làm" });
  await expect(enterQuizButton).toBeVisible();

  await page.reload();

  await expect(enterQuizButton).toBeVisible();
  await expect(page.getByRole("heading", { name: "Câu hỏi 1", exact: true })).toHaveCount(
    0,
  );

  await enterQuizButton.click();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("answer autosave and checking keep the active Quiz runner mounted", async ({
  page,
}) => {
  let currentAttemptReadCount = 0;
  page.on("request", (request) => {
    if (
      request.method() === "GET" &&
      request.url().endsWith("/student/quiz-sets/quiz-set-m7/attempts/current")
    ) {
      currentAttemptReadCount += 1;
    }
  });
  await setupStudentLearningApiMock(page, {
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);
  await page.getByRole("button", { name: "Bắt đầu" }).click();

  const runner = page.getByRole("heading", { name: "Câu hỏi 1", exact: true });
  const resumeLoadingScreen = page.getByLabel("Đang mở lại lượt Quiz");
  await expect(runner).toBeVisible();
  await expect
    .poll(() => currentAttemptReadCount, { timeout: 1_000 })
    .toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(100);
  const readsBeforeAnswer = currentAttemptReadCount;

  const answerAutosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: /B.*4/ }).click();
  await answerAutosave;
  await expect(runner).toBeVisible();
  await expect(resumeLoadingScreen).toHaveCount(0);
  expect(currentAttemptReadCount).toBe(readsBeforeAnswer);

  const checkAutosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH" &&
      response.request().postData()?.includes('"isChecked":true') === true,
  );
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await checkAutosave;
  await expect(page.getByText("Chính xác!")).toBeVisible();
  await expect(runner).toBeVisible();
  await expect(resumeLoadingScreen).toHaveCount(0);
  expect(currentAttemptReadCount).toBe(readsBeforeAnswer);
});

test("reload restores unchecked answers and checked quiz results from the API", async ({
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 2", exact: true }),
  ).toBeVisible();

  const firstOption = page.getByRole("button", { name: /A.*3/ });
  const secondOption = page.getByRole("button", { name: /B.*4/ });
  const firstAutosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH",
  );
  await firstOption.click();
  await firstAutosave;
  await expect(firstOption).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/learningSurface=quiz-runner/);
  await expect(page).toHaveURL(/learningAttemptId=quiz-attempt-m7/);

  await page.evaluate(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("student-quiz-progress:")) {
        window.localStorage.removeItem(key);
      }
    }
    window.sessionStorage.clear();
  });
  await page.addInitScript(() => {
    const probe = { sawUncoveredLessonDetail: false };
    (
      window as typeof window & {
        __quizReloadSurfaceProbe?: typeof probe;
      }
    ).__quizReloadSurfaceProbe = probe;
    const sample = () => {
      const hasLessonDetail = Boolean(
        document.querySelector("[data-student-lesson-detail]"),
      );
      const hasQuizSurface = Boolean(
        document.querySelector(
          '[aria-label="Đang mở lại lượt Quiz"], [data-testid="quiz-runner-screen"]',
        ),
      );
      if (hasLessonDetail && !hasQuizSurface) {
        probe.sawUncoveredLessonDetail = true;
      }
    };
    new MutationObserver(sample).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    document.addEventListener("DOMContentLoaded", sample);
  });
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Câu hỏi 2", exact: true }),
  ).toBeVisible();
  await expect(firstOption).toHaveAttribute("aria-pressed", "true");
  await expect(secondOption).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Kiểm tra đáp án" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __quizReloadSurfaceProbe?: {
              sawUncoveredLessonDetail: boolean;
            };
          }
        ).__quizReloadSurfaceProbe?.sawUncoveredLessonDetail,
    ),
  ).toBe(false);
  await expectNoFrameworkOverlay(page);

  const checkedAutosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH" &&
      response.request().postData()?.includes('"isChecked":true') === true,
  );
  await secondOption.click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await checkedAutosave;
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await page.reload();

  await expect(secondOption).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Chính xác!")).toBeVisible();

  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await page
    .getByRole("dialog", { name: "Thoát bài Quiz?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();
  await expect(
    page.getByRole("button", { name: "Tiếp tục làm", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("quiz-runner-screen")).toHaveCount(0);
  await expect(page).not.toHaveURL(/learningSurface=/);
});

test("reload restores an unchecked text answer from the API", async ({ page }) => {
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
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 3", exact: true }),
  ).toBeVisible();

  const answerInput = page.getByPlaceholder("Nhập đáp án");
  const autosave = page.waitForResponse(
    (response) =>
      response.url().endsWith("/student/quiz-attempts/quiz-attempt-m7/progress") &&
      response.request().method() === "PATCH" &&
      response.request().postData()?.includes("-2.5") === true,
  );
  await answerInput.fill("-2.5");
  await autosave;
  await expect(answerInput).toHaveValue("-2.5");

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Câu hỏi 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Nhập đáp án")).toHaveValue("-2.5");
});

test("multi-statement math keeps native KaTeX fraction typography", async ({ page }) => {
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

  expect(mathTypography.color).toBe(textTypography.color);
  expect(mathTypography.fontFamily).toContain("KaTeX");
  expect(mathTypography.fontFamily).not.toBe(textTypography.fontFamily);
  expect(mathTypography.fontWeight).toBe("400");

  const fractionLineWidth = await fractionLine.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).borderBottomWidth),
  );
  expect(fractionLineWidth).toBeGreaterThan(0);
  expect(fractionLineWidth).toBeLessThan(2);
});

test("all supported question math preserves native KaTeX glyph styles", async ({
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
  const mathOpticalScale = await questionContent.evaluate((element) =>
    Number.parseFloat(
      getComputedStyle(element).getPropertyValue("--learning-content-math-optical-size"),
    ),
  );
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

  for (const typography of mathTypography) {
    expect(typography.color).toBe(textTypography.color);
    expect(typography.fontFamily).toContain("KaTeX");
    expect(Number.parseFloat(typography.fontSize)).toBeCloseTo(
      Number.parseFloat(textTypography.fontSize) * mathOpticalScale,
      1,
    );
    expect(typography.fontWeight).toBe("400");
  }

  expect(fractionTypography.color).toBe(textTypography.color);
  expect(fractionTypography.fontFamily).toContain("KaTeX");
  expect(fractionTypography.fontWeight).toBe("400");
  expect(Number.parseFloat(fractionTypography.fontSize)).toBeLessThan(
    Number.parseFloat(mathTypography[0]?.fontSize ?? "0"),
  );

  for (const typography of mathTextTypography) {
    expect(typography.color).toBe(textTypography.color);
    expect(typography.fontFamily).toContain("KaTeX");
    expect(["italic", "normal"]).toContain(typography.fontStyle);
    expect(typography.fontWeight).toBe("400");
  }
});

test("math fraction placeholder caret stays optically centered without input scrollbars", async ({
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
  const nativePlaceholderLeft = await nativeAnswerInput.evaluate((element) => {
    const field = element as HTMLElement;
    const style = getComputedStyle(field);
    return (
      field.getBoundingClientRect().left +
      Number.parseFloat(style.borderLeftWidth) +
      Number.parseFloat(style.paddingLeft)
    );
  });
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
  const readEmptyMathFieldCaret = () =>
    mathField.evaluate((element) => {
      const caret = element.shadowRoot?.querySelector<HTMLElement>(".ML__caret");
      const caretAfterStyle = caret ? getComputedStyle(caret, "::after") : null;

      return caretAfterStyle
        ? {
            left: caretAfterStyle.left,
            visibility: caretAfterStyle.visibility,
          }
        : null;
    });
  const focusedEmptyMathFieldCaret = await readEmptyMathFieldCaret();
  expect(focusedEmptyMathFieldCaret).toMatchObject({
    left: "0px",
    visibility: "visible",
  });
  const focusedFormulaPlaceholderBox = await formulaPlaceholder.boundingBox();
  expect(focusedFormulaPlaceholderBox).not.toBeNull();
  expect(
    Math.abs(
      (focusedFormulaPlaceholderBox?.x ?? Number.POSITIVE_INFINITY) -
        nativePlaceholderLeft,
    ),
  ).toBeLessThanOrEqual(0.5);
  await page.getByRole("heading", { name: "Nhập câu trả lời" }).click();
  await expect
    .poll(() => mathField.evaluate((element) => document.activeElement === element))
    .toBe(false);
  await mathField.click();
  await expect
    .poll(() => mathField.evaluate((element) => document.activeElement === element))
    .toBe(true);
  const refocusedFormulaPlaceholderBox = await formulaPlaceholder.boundingBox();
  const refocusedEmptyMathFieldCaret = await readEmptyMathFieldCaret();
  expect(refocusedEmptyMathFieldCaret).toMatchObject({
    left: "0px",
    visibility: "visible",
  });
  expect(refocusedFormulaPlaceholderBox).not.toBeNull();
  expect(
    Math.abs(
      (refocusedFormulaPlaceholderBox?.x ?? Number.POSITIVE_INFINITY) -
        (focusedFormulaPlaceholderBox?.x ?? Number.NEGATIVE_INFINITY),
    ),
  ).toBeLessThanOrEqual(0.01);
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
  await mathField.evaluate((element) => {
    (element as HTMLElement & { value: string }).value = "";
  });
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
        placeholderCaretOpticalShift: selectedPlaceholder
          ? getComputedStyle(selectedPlaceholder, "::after")
              .getPropertyValue("--student-math-placeholder-caret-optical-shift-y")
              .trim()
          : null,
        placeholderCaretSelfCenterDelta: selectedPlaceholder
          ? (() => {
              const style = getComputedStyle(selectedPlaceholder, "::after");
              const translateY =
                style.transform === "none"
                  ? 0
                  : new DOMMatrixReadOnly(style.transform).m42;
              return Math.abs(translateY + Number.parseFloat(style.height) / 2);
            })()
          : null,
        placeholderCaretHorizontalCenterDelta: selectedPlaceholder
          ? (() => {
              const style = getComputedStyle(selectedPlaceholder, "::after");
              const translateX =
                style.transform === "none"
                  ? 0
                  : new DOMMatrixReadOnly(style.transform).m41;
              return Math.abs(translateX + Number.parseFloat(style.width) / 2);
            })()
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
  expect(metrics.placeholderCaretOpticalShift).toBe("-0.083333em");
  expect(metrics.placeholderCaretSelfCenterDelta).toBeCloseTo(0, 2);
  expect(metrics.placeholderCaretHorizontalCenterDelta).toBeCloseTo(0, 2);
  expect(metrics.selectedNodeCount).toBeGreaterThan(0);
  expect(metrics.slotBoxCount).toBeGreaterThanOrEqual(2);
  expect(metrics.placeholdersInsideField).toBe(true);

  const numeratorBox = await mathField.locator(".ML__cmr.ML__selected").boundingBox();
  expect(numeratorBox).not.toBeNull();
  await mathField.evaluate((element) => {
    (
      element as HTMLElement & {
        executeCommand: (command: string) => boolean;
      }
    ).executeCommand("moveToNextPlaceholder");
  });
  await expect
    .poll(async () => {
      const selectedBox = await mathField.locator(".ML__cmr.ML__selected").boundingBox();
      return selectedBox && numeratorBox ? selectedBox.y > numeratorBox.y : false;
    })
    .toBe(true);
  const denominatorMetrics = await readMathFieldMetrics();
  expect(denominatorMetrics.placeholderCaretOpticalShift).toBe("-0.083333em");
  expect(denominatorMetrics.placeholderCaretSelfCenterDelta).toBeCloseTo(0, 2);
  expect(denominatorMetrics.placeholderCaretHorizontalCenterDelta).toBeCloseTo(0, 2);
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

  await expect(page.getByRole("heading", { name: "Bài thi" })).toBeVisible();
  await expect(
    page.getByText("Cần hoàn thành Quiz và Flashcard để mở khóa bài thi."),
  ).toBeVisible();
  await expect(page.getByText("Đang khóa", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm Quiz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm Flashcard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toBeDisabled();
  await page.getByRole("button", { name: "Làm Quiz" }).click();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Quiz" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("test prerequisite actions reflect partial Quiz completion", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    testFlashcardCompleted: false,
    testPasses: false,
    testQuizCompleted: true,
    testReady: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await expect(
    page.getByText("Cần hoàn thành Flashcard để mở khóa bài thi."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm Quiz" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Làm Flashcard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toBeDisabled();
  await page.getByRole("button", { name: "Làm Flashcard" }).click();
  await expect(
    page.getByRole("status", { name: "Đang chuẩn bị Flashcard" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("tab")).toBe("test");
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("test prerequisite actions reflect partial Flashcard completion", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, {
    testFlashcardCompleted: true,
    testPasses: false,
    testQuizCompleted: false,
    testReady: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await expect(page.getByText("Cần hoàn thành Quiz để mở khóa bài thi.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm Quiz" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm Flashcard" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toBeDisabled();
  await page.getByRole("button", { name: "Làm Quiz" }).click();
  await expect(page.getByRole("status", { name: "Đang chuẩn bị Quiz" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("failed test shows retry warning and cannot use the score", async ({ page }) => {
  await setupStudentLearningApiMock(page, { testReady: true, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await expect(
    page.getByText(
      "Bài thi đã được mở khóa. Ôn tập lại Quiz và Flashcard để sẵn sàng thi nhé!",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm Quiz" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Làm Flashcard" })).toHaveCount(0);
  await page.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  const testTransition = page.getByRole("status", {
    name: "Đang mở bài thi",
  });
  await expect(testTransition).toBeVisible();
  await expect(testTransition.getByText("Chúc bạn làm bài thi thật tốt!")).toBeVisible();
  const countdown = testTransition.getByTestId("learning-transition-countdown");
  await expect(countdown.getByText("3", { exact: true })).toBeVisible();
  await expect(countdown.getByText("2", { exact: true })).toBeVisible({
    timeout: 1_200,
  });
  await expect(countdown.getByText("1", { exact: true })).toBeVisible({
    timeout: 1_200,
  });
  await expect(page.getByRole("heading", { name: "Câu 1" })).toBeVisible();
  await expect(testTransition).toHaveCount(0);
  const testRunner = page.getByTestId("test-runner-screen");
  await page.goBack();
  const exitDialog = page.getByRole("dialog", { name: "Thoát bài thi?" });
  await expect(exitDialog).toBeVisible();
  await expect(
    exitDialog.getByText(
      "Nếu quay lại, bài thi hiện tại sẽ bị hủy và bạn phải làm một bài thi mới.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(`/student/lessons/${lessonId}?tab=test`);
  await exitDialog.getByRole("button", { name: "Ở lại" }).click();
  await expect(exitDialog).toHaveCount(0);
  await expect(testRunner.getByRole("heading", { name: "Câu 1" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        return {
          defaultPrevented: !window.dispatchEvent(event),
          returnValue: event.returnValue,
        };
      }),
    )
    .toEqual({ defaultPrevented: true, returnValue: false });
  await expect(testRunner.getByText("Bài thi · 1 câu")).toHaveClass(/text-emerald-600/);
  await expect(testRunner.getByRole("timer")).toHaveClass(/bg-emerald-200/);
  await expect(testRunner.getByRole("button", { name: "Câu 1: chưa làm" })).toHaveClass(
    /bg-emerald-500/,
  );
  await expect(testRunner.getByRole("button", { name: "Câu tiếp" })).toHaveClass(
    /disabled:bg-emerald-200/,
  );
  await testRunner.getByRole("button", { name: "Nộp bài thi" }).click();
  const incompleteAlert = testRunner.getByRole("alert");
  await expect(incompleteAlert).toContainText("Cần hoàn thành câu hỏi 1");
  await expect(incompleteAlert).toHaveClass(/bg-emerald-200\/80/);
  await expect(incompleteAlert).toHaveClass(/items-center/);
  const selectedAnswer = testRunner.getByRole("button", { name: /A.*5/ });
  await selectedAnswer.click();
  await expect(selectedAnswer).toHaveClass(/border-emerald-400/);
  await page.getByRole("button", { name: "Nộp bài thi" }).click();

  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();
  await expect(page.getByTestId("test-result-screen")).toHaveClass(/fixed/);
  await expect(page.getByText("Bạn cần phải làm lại bài thi mới.")).toBeVisible();
  await expect(page.getByTestId("test-result-screen").getByRole("alert")).toHaveClass(
    /bg-emerald-200\/80/,
  );
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();
  await expect(page.getByText("Không sao đâu! Xem lại rồi thử lại nhé!")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Làm lại bài thi mới" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dùng điểm bài này" })).toHaveCount(0);

  await page.getByRole("button", { name: "Xem lại câu sai" }).click();
  const reviewScreen = page.getByTestId("test-review-screen");
  await expect(reviewScreen).toHaveClass(/#def8e9/);
  await expect(reviewScreen.getByText("Xem lại các câu trả lời sai")).toHaveClass(
    /text-emerald-700/,
  );
  await expect(
    reviewScreen.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expect(
    reviewScreen.getByRole("button", { name: "Kết thúc xem lại" }),
  ).toHaveClass(/bg-emerald-600/);
  await reviewScreen.getByRole("button", { name: "Quay lại kết quả Bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();

  await page.getByRole("button", { name: "Xem lại tất cả" }).click();
  await expect(reviewScreen.getByText("Xem lại tất cả câu trả lời")).toBeVisible();
  await expect(
    reviewScreen.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await reviewScreen.getByRole("button", { name: "Kết thúc xem lại" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();

  await page.getByRole("button", { name: "Quay lại màn Bài thi" }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toHaveCount(0);
  await page.getByRole("button", { name: "Xem lại bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();
  await expect(page.getByTestId("test-review-screen")).toHaveCount(0);
  await page.getByRole("button", { name: "Quay lại màn Bài thi" }).click();
  await expect(page.getByRole("button", { name: "Làm bài thi mới" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Xem lại bài thi" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Làm bài thi mới" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("reloading an active test shows the browser warning and cancels the local runner", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: true, testPasses: false });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);
  await page.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Câu 1" })).toBeVisible();

  await page.goBack();
  const exitDialog = page.getByRole("dialog", { name: "Thoát bài thi?" });
  await expect(
    exitDialog.getByText(
      "Nếu quay lại, bài thi hiện tại sẽ bị hủy và bạn phải làm một bài thi mới.",
    ),
  ).toBeVisible();
  await exitDialog.getByRole("button", { name: "Vẫn thoát" }).click();
  await expect(page.getByTestId("test-runner-screen")).toHaveCount(0);
  await page.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  await expect(page.getByRole("heading", { name: "Câu 1" })).toBeVisible();

  const beforeUnloadDialog = page.waitForEvent("dialog");
  const reload = page.reload();
  const dialog = await beforeUnloadDialog;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.accept();
  await reload;

  await expect(page.getByTestId("test-runner-screen")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bắt đầu bài thi" })).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("passing test result shows confetti without manual score selection", async ({
  page,
}) => {
  await setupStudentLearningApiMock(page, { testReady: true, testPasses: true });
  await page.goto(`/student/lessons/${lessonId}?tab=test`);

  await page.getByRole("button", { name: "Bắt đầu bài thi" }).click();
  await page.getByRole("button", { name: /B.*6/ }).click();
  await page.getByRole("button", { name: "Nộp bài thi" }).click();

  await expect(page.getByRole("heading", { name: "Kết quả Bài thi" })).toBeVisible();
  await expect(page.getByTestId("assessment-result-confetti")).toBeAttached();
  await expect(page.getByRole("button", { name: "Dùng điểm bài này" })).toHaveCount(0);
  await expect(page.getByText("Đã hoàn thành")).toHaveClass(/bg-emerald-500/);
  await expect(page.getByRole("button", { name: "Làm lại bài thi mới" })).toHaveClass(
    /bg-emerald-500/,
  );
  await expectNoFrameworkOverlay(page);
});

test("Quiz keeps the new active set after back and reload", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    includeAlternateQuizSet: true,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=quiz`);

  await page.getByRole("button", { name: "Bắt đầu", exact: true }).click();
  await page.getByRole("button", { name: /B.*4/ }).click();
  await page.getByRole("button", { name: "Kiểm tra đáp án" }).click();
  await page.getByRole("button", { name: "Hoàn thành Quiz" }).click();
  await expect(page.getByRole("heading", { name: "Kết quả Quiz" })).toBeVisible();

  await page.getByRole("button", { name: "Làm bộ Quiz mới" }).click();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Quiz" }).click();
  await page
    .getByRole("dialog", { name: "Thoát bài Quiz?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  await expect(page.getByRole("button", { name: "Tiếp tục làm" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("student-quiz-active-set:student-m7:lesson-m7"),
      ),
    )
    .toBe("quiz-set-m7-history");

  await page.reload();

  const continueButton = page.getByRole("button", { name: "Tiếp tục làm" });
  await expect(continueButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toHaveCount(0);
  await continueButton.click();
  await expect(
    page.getByRole("heading", { name: "Câu hỏi 1", exact: true }),
  ).toBeVisible();
  await expectNoFrameworkOverlay(page);
});

test("Flashcard keeps the new active set after back and reload", async ({ page }) => {
  await setupStudentLearningApiMock(page, {
    flashcardCompleted: true,
    includeAlternateFlashcardSet: true,
    testReady: false,
    testPasses: false,
  });
  await page.goto(`/student/lessons/${lessonId}?tab=flashcard`);

  await page.getByRole("button", { name: "Học bộ Flashcard mới" }).click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
  await page.getByRole("button", { name: "Quay lại màn Flashcard" }).click();
  await page
    .getByRole("dialog", { name: "Thoát lượt học Flashcard?" })
    .getByRole("button", { name: "Vẫn thoát" })
    .click();

  await expect(page.getByRole("button", { name: "Tiếp tục học" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage.getItem("student-flashcard-active-set:student-m7:lesson-m7"),
      ),
    )
    .toBe("flashcard-set-m7-new");

  await page.reload();

  const continueButton = page.getByRole("button", { name: "Tiếp tục học" });
  await expect(continueButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem lại", exact: true })).toHaveCount(0);
  await continueButton.click();
  await expect(page.getByRole("heading", { name: "Thẻ 1/1" })).toBeVisible();
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
    alternateQuizStatusDelayMs?: number;
    flashcardCardCount?: number;
    flashcardCompleted?: boolean;
    includeAlternateFlashcardSet?: boolean;
    includeAlternateQuizSet?: boolean;
    includeNextLesson?: boolean;
    omitFlashcardSet?: boolean;
    omitQuizSet?: boolean;
    omitTestSet?: boolean;
    quizQuestionCount?: number;
    quizStatusGate?: Promise<void>;
    quizHistoryCompletedItemCount?: number;
    quizHistorySetId?: string;
    quizReviewQuestionCount?: number;
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
    testCompleted?: boolean;
    testFlashcardCompleted?: boolean;
    testQuizCompleted?: boolean;
    testQuestionCount?: number;
    quizQuestionType?:
      "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_STATEMENT_TRUE_FALSE" | "TEXT_INPUT";
  },
) {
  type CurrentQuizAttempt = ReturnType<typeof quizAttemptPayload> & {
    currentQuestionIndex: number;
    savedAnswers: Array<{
      answerJson: unknown;
      questionId: string;
    }>;
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
  let alternateQuizAttempt: CurrentQuizAttempt | null = null;
  let latestQuizAttempt: QuizAttemptSummaryPayload | null = null;
  let testCompleted = options.testCompleted ?? false;
  let testSubmitted = testCompleted;
  let flashcardSessionCount = 0;
  const flashcardSessions: Array<{
    id: string;
    flashcardSetId: string;
    state: "IN_PROGRESS" | "COMPLETED";
    startedAt: string;
    completedAt: string | null;
    reviewedCount: number;
    knownCount: number;
    unknownCount: number;
    totalCount: number;
    items: Array<{
      flashcardId: string;
      isKnown: boolean | null;
      reviewedAt: string | null;
    }>;
  }> = [];

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
      return fulfillJson(route, 200, {
        data: lessonPayload(
          options.includeAlternateQuizSet,
          options.includeAlternateFlashcardSet,
          options.includeNextLesson,
          options.quizQuestionCount,
          options.flashcardCardCount,
          options.omitFlashcardSet,
          options.omitQuizSet,
        ),
      });
    }
    if (method === "GET" && pathname === "/student/lessons/lesson-m7-next") {
      return fulfillJson(route, 200, {
        data: {
          ...lessonPayload(),
          id: "lesson-m7-next",
          title: "Buổi 2: Giá trị tuyệt đối",
          navigation: {
            previous: { id: lessonId, title: "Buổi 1: Số hữu tỉ" },
            next: null,
          },
        },
      });
    }
    if (method === "GET" && pathname === `/student/lessons/${lessonId}/flashcard-sets`) {
      return fulfillJson(route, 200, {
        data: options.omitFlashcardSet
          ? []
          : flashcardPayload(
              options.flashcardCardCount,
              flashcardProgressById,
              favoriteFlashcardIds,
              options.includeAlternateFlashcardSet,
            ),
      });
    }
    if (
      method === "GET" &&
      pathname === `/student/lessons/${lessonId}/flashcard-history`
    ) {
      const visibleSessions = [...flashcardSessions].reverse();
      return fulfillJson(route, 200, {
        data: {
          total: visibleSessions.length,
          items: visibleSessions.map((session, index) => ({
            ...session,
            setId: session.flashcardSetId,
            displayName: `Bộ ${visibleSessions.length - index}`,
          })),
        },
      });
    }
    if (
      method === "POST" &&
      /^\/student\/flashcard-sets\/flashcard-set-m7(?:-new)?\/sessions$/.test(pathname)
    ) {
      const body = request.postDataJSON() as {
        resumeExistingProgress?: boolean;
      };
      for (let index = flashcardSessions.length - 1; index >= 0; index -= 1) {
        if (flashcardSessions[index]?.state === "IN_PROGRESS") {
          flashcardSessions.splice(index, 1);
        }
      }
      const flashcardSetId = pathname.split("/")[3] ?? "flashcard-set-m7";
      const isAlternateSet = flashcardSetId === "flashcard-set-m7-new";
      const totalCount = isAlternateSet ? 1 : (options.flashcardCardCount ?? 1);
      const startedAt = new Date().toISOString();
      const items = Array.from({ length: totalCount }, (_, index) => {
        const flashcardId = isAlternateSet
          ? "flashcard-m7-new"
          : index === 0
            ? "flashcard-m7"
            : `flashcard-m7-${index + 1}`;
        const savedValue = body.resumeExistingProgress
          ? flashcardProgressById.get(flashcardId)
          : undefined;
        return {
          flashcardId,
          isKnown: savedValue ?? null,
          reviewedAt: savedValue === undefined ? null : startedAt,
        };
      });
      const reviewedItems = items.filter((item) => item.isKnown !== null);
      const session = {
        id: `flashcard-session-m7-${++flashcardSessionCount}`,
        flashcardSetId,
        state: "IN_PROGRESS" as const,
        startedAt,
        completedAt: null,
        reviewedCount: reviewedItems.length,
        knownCount: reviewedItems.filter((item) => item.isKnown === true).length,
        unknownCount: reviewedItems.filter((item) => item.isKnown === false).length,
        totalCount,
        items,
      };
      flashcardSessions.push(session);
      return fulfillJson(route, 200, { data: session });
    }
    if (
      method === "GET" &&
      /^\/student\/flashcard-sessions\/flashcard-session-m7-\d+$/.test(pathname)
    ) {
      const sessionId = pathname.split("/").at(-1);
      const session = flashcardSessions.find((candidate) => candidate.id === sessionId);
      return fulfillJson(route, session ? 200 : 404, {
        data: session ?? null,
      });
    }
    if (
      method === "PATCH" &&
      /^\/student\/flashcards\/flashcard-m7(?:-\d+)?\/progress$/.test(pathname)
    ) {
      const body = request.postDataJSON() as {
        isKnown: boolean;
        sessionId?: string;
      };
      const flashcardId = pathname.split("/")[3] ?? "flashcard-m7";
      flashcardProgressById.set(flashcardId, body.isKnown);
      const reviewedCount = flashcardProgressById.size;
      const knownCount = Array.from(flashcardProgressById.values()).filter(
        Boolean,
      ).length;
      const totalCount = options.flashcardCardCount ?? 1;
      const studySession = body.sessionId
        ? flashcardSessions.find((session) => session.id === body.sessionId)
        : undefined;
      if (studySession) {
        const item = studySession.items.find(
          (candidate) => candidate.flashcardId === flashcardId,
        );
        if (item) {
          item.isKnown = body.isKnown;
          item.reviewedAt = new Date().toISOString();
        }
        const reviewedItems = studySession.items.filter(
          (candidate) => candidate.isKnown !== null,
        );
        studySession.reviewedCount = reviewedItems.length;
        studySession.knownCount = reviewedItems.filter(
          (candidate) => candidate.isKnown === true,
        ).length;
        studySession.unknownCount = studySession.reviewedCount - studySession.knownCount;
        if (studySession.reviewedCount === studySession.totalCount) {
          studySession.state = "COMPLETED";
          studySession.completedAt = new Date().toISOString();
        }
      }
      return fulfillJson(route, 200, {
        data: {
          flashcardId,
          isKnown: body.isKnown,
          studySession: studySession ?? null,
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
        data: testStatusPayload(
          options.testReady,
          testSubmitted,
          testCompleted,
          options.testPasses ?? testCompleted,
          options.testQuizCompleted,
          options.testFlashcardCompleted,
          options.testQuestionCount,
          options.omitTestSet,
        ),
      });
    }
    if (
      method === "GET" &&
      pathname === "/student/quiz-sets/quiz-set-m7/attempts/status"
    ) {
      if (options.quizStatusGate) {
        await options.quizStatusGate;
      }
      const answeredCount =
        currentQuizAttempt?.savedAnswers.filter(
          (answer) => !isSkippedQuizAnswer(answer.answerJson),
        ).length ?? 0;
      const checkedCount = currentQuizAttempt?.checkedAnswers.length ?? 0;
      return fulfillJson(route, 200, {
        data: currentQuizAttempt
          ? {
              state: "IN_PROGRESS",
              currentAttemptId: currentQuizAttempt.id,
              answeredCount,
              checkedCount,
              latestSubmittedAttempt: latestQuizAttempt,
            }
          : latestQuizAttempt
            ? {
                state: "COMPLETED",
                currentAttemptId: null,
                answeredCount: latestQuizAttempt.totalCount,
                checkedCount: latestQuizAttempt.totalCount,
                latestSubmittedAttempt: latestQuizAttempt,
              }
            : {
                state: "NOT_STARTED",
                currentAttemptId: null,
                answeredCount: 0,
                checkedCount: 0,
                latestSubmittedAttempt: null,
              },
      });
    }
    if (
      method === "GET" &&
      pathname === "/student/quiz-sets/quiz-set-m7-history/attempts/status"
    ) {
      if (options.alternateQuizStatusDelayMs) {
        await new Promise((resolve) => {
          setTimeout(resolve, options.alternateQuizStatusDelayMs);
        });
      }
      return fulfillJson(route, 200, {
        data: alternateQuizAttempt
          ? {
              state: "IN_PROGRESS",
              currentAttemptId: alternateQuizAttempt.id,
              answeredCount: alternateQuizAttempt.savedAnswers.length,
              checkedCount: alternateQuizAttempt.checkedAnswers.length,
              latestSubmittedAttempt: null,
            }
          : {
              state: "NOT_STARTED",
              currentAttemptId: null,
              answeredCount: 0,
              checkedCount: 0,
              latestSubmittedAttempt: null,
            },
      });
    }
    if (method === "GET" && pathname === `/student/lessons/${lessonId}/quiz-history`) {
      const historyCompletedItemCount = options.quizHistoryCompletedItemCount ?? 0;
      const seededCompletedItems = Array.from(
        { length: historyCompletedItemCount },
        (_, index) => ({
          id: `quiz-history-attempt-${historyCompletedItemCount - index}`,
          setId: options.quizHistorySetId ?? "quiz-set-m7",
          displayName: `Bộ ${historyCompletedItemCount - index}`,
          state: "COMPLETED",
          startedAt: new Date(Date.now() - (index + 2) * 60_000).toISOString(),
          completedAt: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
          correctCount: 1,
          wrongCount: 0,
          totalCount: 1,
          answeredCount: 1,
          accuracyPercent: 100,
        }),
      );
      const items = [
        ...(currentQuizAttempt
          ? [
              {
                id: currentQuizAttempt.id,
                setId: "quiz-set-m7",
                displayName: latestQuizAttempt ? "Bộ 2" : "Bộ 1",
                state: "IN_PROGRESS",
                startedAt: new Date().toISOString(),
                completedAt: null,
                answeredCount: currentQuizAttempt.savedAnswers.filter(
                  (answer) => !isSkippedQuizAnswer(answer.answerJson),
                ).length,
                correctCount: 0,
                wrongCount: 0,
                totalCount: currentQuizAttempt.totalCount,
                accuracyPercent: 0,
              },
            ]
          : []),
        ...(latestQuizAttempt
          ? [
              {
                ...latestQuizAttempt,
                setId: "quiz-set-m7",
                displayName: "Bộ 1",
                state: "COMPLETED",
                startedAt: new Date(Date.now() - 60_000).toISOString(),
                completedAt: new Date().toISOString(),
                answeredCount: latestQuizAttempt.totalCount,
              },
            ]
          : []),
        ...seededCompletedItems,
      ];
      return fulfillJson(route, 200, {
        data: { total: items.length, items },
      });
    }
    if (
      method === "GET" &&
      pathname === "/student/quiz-sets/quiz-set-m7/attempts/current"
    ) {
      return fulfillJson(route, 200, { data: currentQuizAttempt });
    }
    if (
      method === "GET" &&
      pathname === "/student/quiz-sets/quiz-set-m7-history/attempts/current"
    ) {
      return fulfillJson(route, 200, { data: alternateQuizAttempt });
    }
    if (method === "POST" && pathname === "/student/quiz-sets/quiz-set-m7/attempts") {
      const nextAttempt = quizAttemptPayload(
        options.quizQuestionType,
        options.quizQuestionCount,
        options.quizQuestionIncludesMathExamples,
      );
      currentQuizAttempt = {
        ...nextAttempt,
        currentQuestionIndex: 0,
        savedAnswers: [],
        checkedAnswers: [],
      };
      return fulfillJson(route, 200, {
        data: nextAttempt,
      });
    }
    const quizProgressMatch = pathname.match(
      /^\/student\/quiz-attempts\/([^/]+)\/progress$/,
    );
    if (method === "PATCH" && quizProgressMatch) {
      const attemptId = quizProgressMatch[1];
      const targetAttempt =
        currentQuizAttempt?.id === attemptId
          ? currentQuizAttempt
          : alternateQuizAttempt?.id === attemptId
            ? alternateQuizAttempt
            : null;
      if (!targetAttempt) {
        return fulfillJson(route, 404, {
          error: { code: "QUIZ_ATTEMPT_NOT_FOUND", message: "Không tìm thấy lượt Quiz" },
        });
      }
      const body = request.postDataJSON() as {
        currentQuestionIndex: number;
        answer?: {
          answerJson: unknown;
          isChecked?: boolean;
          questionId: string;
        };
      };
      targetAttempt.currentQuestionIndex = body.currentQuestionIndex;
      if (body.answer) {
        targetAttempt.savedAnswers = [
          ...targetAttempt.savedAnswers.filter(
            (answer) => answer.questionId !== body.answer?.questionId,
          ),
          {
            answerJson: body.answer.answerJson,
            questionId: body.answer.questionId,
          },
        ];
        if (body.answer.isChecked) {
          const feedback = isSkippedQuizAnswer(body.answer.answerJson)
            ? skippedQuizFeedbackPayload()
            : quizFeedbackPayload();
          targetAttempt.checkedAnswers = [
            ...targetAttempt.checkedAnswers.filter(
              (answer) => answer.questionId !== body.answer?.questionId,
            ),
            {
              answerJson: body.answer.answerJson,
              feedback,
              questionId: body.answer.questionId,
            },
          ];
        }
      }
      return fulfillJson(route, 200, {
        data: {
          attemptId: targetAttempt.id,
          currentQuestionIndex: targetAttempt.currentQuestionIndex,
          answeredCount: targetAttempt.savedAnswers.filter(
            (answer) => !isSkippedQuizAnswer(answer.answerJson),
          ).length,
          checkedCount: targetAttempt.checkedAnswers.length,
        },
      });
    }
    if (
      method === "POST" &&
      pathname === "/student/quiz-sets/quiz-set-m7-history/attempts"
    ) {
      const baseAttempt = quizAttemptPayload(
        options.quizQuestionType,
        1,
        options.quizQuestionIncludesMathExamples,
      );
      const nextAttempt = {
        ...baseAttempt,
        id: "quiz-attempt-m7-history",
        quizSet: {
          id: "quiz-set-m7-history",
          title: "Quiz lịch sử",
        },
      };
      alternateQuizAttempt = {
        ...nextAttempt,
        currentQuestionIndex: 0,
        savedAnswers: [],
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
      const body = request.postDataJSON() as {
        answers: Array<{ answerJson: unknown; questionId: string }>;
      };
      const isSkipped = body.answers.some((answer) =>
        isSkippedQuizAnswer(answer.answerJson),
      );
      const submittedAttempt = {
        id: "quiz-attempt-m7",
        correctCount: isSkipped ? 0 : 1,
        wrongCount: isSkipped ? 1 : 0,
        totalCount: 1,
        accuracyPercent: isSkipped ? 0 : 100,
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
    if (method === "GET" && /^\/student\/quiz-attempts\/[^/]+\/review$/.test(pathname)) {
      return fulfillJson(route, 200, {
        data: quizReviewPayload(options.quizReviewQuestionCount),
      });
    }
    if (
      method === "POST" &&
      pathname === `/student/lessons/${lessonId}/test-attempts/start`
    ) {
      return fulfillJson(route, 200, { data: testAttemptPayload() });
    }
    if (method === "GET" && pathname === `/student/lessons/${lessonId}/test-history`) {
      const historyItems = testSubmitted
        ? [
            {
              id: "test-attempt-m7",
              attemptId: "test-attempt-m7",
              setId: "test-set-m7",
              displayName: "Bộ đề 2",
              state: "COMPLETED",
              startedAt: new Date(Date.now() - 60_000).toISOString(),
              completedAt: new Date().toISOString(),
              durationSeconds: 45,
              score: options.testPasses ? 10 : 0,
              correctCount: options.testPasses ? 1 : 0,
              totalCount: 1,
            },
            {
              id: "test-attempt-history-m7",
              attemptId: "test-attempt-history-m7",
              setId: "test-set-m7",
              displayName: "Bộ đề 1",
              state: "COMPLETED",
              startedAt: new Date(Date.now() - 180_000).toISOString(),
              completedAt: new Date(Date.now() - 120_000).toISOString(),
              durationSeconds: 55,
              score: options.testPasses ? 10 : 0,
              correctCount: options.testPasses ? 1 : 0,
              totalCount: 1,
            },
          ]
        : [
            {
              id: "not-started:test-set-m7",
              attemptId: null,
              setId: "test-set-m7",
              displayName: "Bộ đề 1",
              state: "NOT_STARTED",
              startedAt: null,
              completedAt: null,
              durationSeconds: 600,
              score: null,
              correctCount: 0,
              totalCount: 1,
            },
          ];
      return fulfillJson(route, 200, {
        data: {
          total: historyItems.length,
          currentItemId: historyItems[0]!.id,
          items: historyItems,
        },
      });
    }
    if (
      method === "POST" &&
      pathname === "/student/test-attempts/test-attempt-m7/submit"
    ) {
      testSubmitted = true;
      testCompleted ||= Boolean(options.testPasses);
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
      method === "GET" &&
      pathname.startsWith(`/student/test-attempts/test-attempt-m7/review`)
    ) {
      const reviewScope =
        new URL(request.url()).searchParams.get("scope") === "INCORRECT"
          ? "INCORRECT"
          : "ALL";
      return fulfillJson(route, 200, {
        data: testReviewPayload(options.testPasses, reviewScope),
      });
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

function skippedQuizFeedbackPayload() {
  return {
    ...quizFeedbackPayload(),
    isCorrect: false,
    isSkipped: true,
  };
}

function isSkippedQuizAnswer(value: unknown) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "__unanswered" in value &&
    value.__unanswered === true
  );
}

function quizReviewPayload(questionCount = 1) {
  const questions = quizAttemptPayload("MULTIPLE_CHOICE", questionCount).questions.map(
    (question) => ({
      ...question,
      answerJson: ["quiz-option-b"],
      ...quizFeedbackPayload(),
    }),
  );

  return {
    id: "quiz-attempt-m7",
    scope: "ALL",
    correctCount: questionCount,
    wrongCount: 0,
    totalCount: questionCount,
    accuracyPercent: 100,
    questions,
  };
}

function lessonPayload(
  includeAlternateQuizSet = false,
  includeAlternateFlashcardSet = false,
  includeNextLesson = false,
  quizQuestionCount = 1,
  flashcardCardCount = 1,
  omitFlashcardSet = false,
  omitQuizSet = false,
) {
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
    quizSets: omitQuizSet
      ? []
      : [
          {
            id: "quiz-set-m7",
            title: "Quiz số hữu tỉ",
            questionCount: quizQuestionCount,
          },
          ...(includeAlternateQuizSet
            ? [
                {
                  id: "quiz-set-m7-history",
                  title: "Quiz lịch sử",
                  questionCount: 1,
                },
              ]
            : []),
        ],
    flashcardSets: omitFlashcardSet
      ? []
      : [
          {
            id: "flashcard-set-m7",
            title: "Flashcard số hữu tỉ",
            cardCount: flashcardCardCount,
          },
          ...(includeAlternateFlashcardSet
            ? [
                {
                  id: "flashcard-set-m7-new",
                  title: "Flashcard bộ mới",
                  cardCount: 1,
                },
              ]
            : []),
        ],
    testSets: [
      {
        id: "test-set-m7",
        title: "Bài kiểm tra số hữu tỉ",
        questionCount: 1,
        durationSeconds: 600,
      },
    ],
    navigation: {
      previous: null,
      next: includeNextLesson
        ? { id: "lesson-m7-next", title: "Buổi 2: Giá trị tuyệt đối" }
        : null,
    },
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
  includeAlternateSet = false,
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

  const sets = [
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

  if (includeAlternateSet) {
    sets.push({
      id: "flashcard-set-m7-new",
      lessonId,
      title: "Flashcard bộ mới",
      cardCount: 1,
      flashcards: [
        {
          id: "flashcard-m7-new",
          frontJson: documentWithText("3 + 3"),
          backJson: documentWithText("6"),
          explanation: null,
          isFavorite: favoriteIds.has("flashcard-m7-new"),
          progress: null,
        },
      ],
      progress: {
        totalCount: 1,
        reviewedCount: 0,
        knownCount: 0,
        unknownCount: 0,
        unreviewedCount: 1,
        isCompleted: false,
      },
    });
  }

  return sets;
}

function testStatusPayload(
  ready: boolean,
  submitted = false,
  completed = false,
  passed = completed,
  quizCompleted = ready,
  flashcardCompleted = ready,
  questionCount = 1,
  omitTestSet = false,
) {
  return {
    canStart: ready,
    examOpenAt: new Date(Date.now() - 60_000).toISOString(),
    evaluatedAt: new Date().toISOString(),
    lockReason: ready ? null : "PREREQUISITES_INCOMPLETE",
    quiz: { isRequired: true, isCompleted: quizCompleted },
    flashcard: { isRequired: true, isCompleted: flashcardCompleted },
    bestAttempt: completed
      ? {
          id: "test-attempt-m7",
          score: 10,
          durationSeconds: 45,
        }
      : null,
    latestSubmittedAttempt: submitted
      ? {
          id: "test-attempt-m7",
          score: passed ? 10 : 0,
          durationSeconds: 45,
          submittedAt: new Date().toISOString(),
        }
      : null,
    sets: omitTestSet
      ? []
      : [
          {
            id: "test-set-m7",
            title: "Bài kiểm tra số hữu tỉ",
            durationSeconds: 600,
            totalScore: 10,
            questionCount,
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

function testReviewPayload(passed: boolean, scope: "ALL" | "INCORRECT") {
  const question = testAttemptPayload().questions[0];

  return {
    id: "test-attempt-m7",
    scope,
    durationSeconds: 45,
    score: passed ? 10 : 0,
    completionMinScore: 7,
    passed,
    correctCount: passed ? 1 : 0,
    wrongCount: passed ? 0 : 1,
    totalCount: 1,
    questions:
      question && (scope === "ALL" || !passed)
        ? [
            {
              ...question,
              answerJson: [passed ? "B" : "A"],
              correctAnswerJson: ["B"],
              explanationJson: null,
              isCorrect: passed,
              pointsAwarded: passed ? 10 : 0,
              questionNumber: 1,
              statementResults: null,
            },
          ]
        : [],
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
