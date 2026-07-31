import { expect, test, type Page } from "@playwright/test";

const shouldRunRealtime = process.env.AUTH_HARD_REFRESH_REALTIME === "1";
const emptyGuardMarkup =
  '<div aria-busy="true" class="min-h-screen bg-[var(--theme-bg)]"></div>';

type RealtimeAccount = {
  identifier: string;
  password: string;
};

const studentAccount: RealtimeAccount = {
  identifier: process.env.REALTIME_STUDENT_USERNAME ?? "student1",
  password: process.env.REALTIME_STUDENT_PASSWORD ?? "Student123!",
};

const adminAccount: RealtimeAccount = {
  identifier: process.env.REALTIME_ADMIN_USERNAME ?? "admin",
  password: process.env.REALTIME_ADMIN_PASSWORD ?? "123456",
};
const adminCourseTitle = process.env.REALTIME_ADMIN_COURSE_TITLE ?? "Toán 7";

async function login(page: Page, account: RealtimeAccount) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Tên đăng nhập/Số điện thoại" })
    .fill(account.identifier);
  await page
    .getByRole("textbox", { name: "Mật khẩu", exact: true })
    .fill(account.password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function expectServerRenderedShell(
  page: Page,
  shellSelector: string,
  shellMarkup: string,
) {
  const response = await page.reload({ waitUntil: "domcontentloaded" });
  const documentResponse = await page.context().request.get(page.url(), {
    headers: {
      accept: "text/html",
      "cache-control": "no-cache",
    },
  });
  const initialHtml = await documentResponse.text();

  expect(response?.ok()).toBe(true);
  expect(documentResponse.ok()).toBe(true);
  expect(initialHtml).toContain(shellMarkup);
  expect(initialHtml).not.toContain(emptyGuardMarkup);
  await expect(page.locator(shellSelector)).toBeVisible();

  return initialHtml ?? "";
}

test.describe("authenticated hard refresh against the local seeded stack", () => {
  test.skip(
    !shouldRunRealtime,
    "Set AUTH_HARD_REFRESH_REALTIME=1 when the real web and API servers are running.",
  );

  test("student profile, course detail, and lesson content are present in the first HTML response", async ({
    page,
  }) => {
    const scriptWarnings: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().includes("Encountered a script tag")
      ) {
        scriptWarnings.push(message.text());
      }
    });

    await login(page, studentAccount);
    await page.waitForURL("**/student/**");
    const coursesInitialHtml = await expectServerRenderedShell(
      page,
      '[data-student-shell="true"]',
      'data-student-shell="true"',
    );
    const gradeLabel = await page
      .locator("[data-student-profile-grade-label]")
      .getAttribute("data-student-profile-grade-label");

    expect(gradeLabel).toMatch(/^Học sinh lớp \d+$/);
    expect(coursesInitialHtml).toContain(gradeLabel);

    await page.goto("/student/explore");
    const courseHref = await page
      .locator('a[href^="/student/courses/"]')
      .first()
      .getAttribute("href");
    expect(courseHref).toBeTruthy();
    await page.goto(courseHref!);
    const courseTitle = await page
      .locator('[data-student-course-detail="true"] h1')
      .last()
      .textContent();
    const courseInitialHtml = await expectServerRenderedShell(
      page,
      '[data-student-course-detail="true"]',
      'data-student-course-detail="true"',
    );

    expect(courseTitle?.trim()).toBeTruthy();
    expect(courseInitialHtml).toContain(courseTitle!.trim());
    expect(courseInitialHtml).toContain(gradeLabel);

    const lessonLinks = page.locator('a[href^="/student/lessons/"]');
    if ((await lessonLinks.count()) === 0) {
      const purchaseButton = page.getByRole("button", { name: "Mua ngay" });
      await expect(purchaseButton).toBeVisible();
      await purchaseButton.click();
      await expect(lessonLinks.first()).toBeVisible();
    }
    const lessonHref = await lessonLinks.first().getAttribute("href");
    expect(lessonHref).toBeTruthy();
    await page.goto(lessonHref!);
    const lessonTitle = await page
      .locator('[data-student-lesson-detail="true"] h1')
      .last()
      .textContent();
    const lessonInitialHtml = await expectServerRenderedShell(
      page,
      '[data-student-lesson-detail="true"]',
      'data-student-lesson-detail="true"',
    );

    expect(lessonTitle?.trim()).toBeTruthy();
    expect(lessonInitialHtml).toContain(lessonTitle!.trim());
    expect(lessonInitialHtml).toContain(gradeLabel);

    expect(scriptWarnings).toEqual([]);
  });

  test("all admin route groups keep their shell on hard refresh", async ({ page }) => {
    const scriptWarnings: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().includes("Encountered a script tag")
      ) {
        scriptWarnings.push(message.text());
      }
    });

    await login(page, adminAccount);
    await page.waitForURL("**/admin/courses");
    const listInitialHtml = await expectServerRenderedShell(
      page,
      '[data-admin-theme="true"]',
      'data-admin-theme="true"',
    );
    expect(listInitialHtml).toContain("Danh sách khóa học");
    expect(listInitialHtml).not.toContain("Đang tải danh sách khóa học");

    await page.getByRole("textbox", { name: "Tìm khóa học" }).fill(adminCourseTitle);
    const courseHref = await page
      .locator('a[href^="/admin/courses/"]')
      .filter({ hasText: adminCourseTitle })
      .first()
      .getAttribute("href");
    expect(courseHref).toBeTruthy();
    await page.goto(courseHref!);
    const courseTitle = (
      await page.locator('[data-admin-theme="true"] h1').textContent()
    )?.trim();
    const courseInitialHtml = await expectServerRenderedShell(
      page,
      '[data-admin-theme="true"]',
      'data-admin-theme="true"',
    );
    expect(courseTitle).toBeTruthy();
    expect(courseInitialHtml).toContain(courseTitle!);
    expect(courseInitialHtml).not.toContain("Đang tải chi tiết khóa học");

    const lessonHref = await page
      .locator('a[href^="/admin/lessons/"]')
      .first()
      .getAttribute("href");
    expect(lessonHref).toBeTruthy();
    await page.goto(lessonHref!);
    const lessonTitle = (
      await page.locator('[data-admin-theme="true"] h1').textContent()
    )?.trim();
    const activeQuizSetTitle = (
      await page
        .locator('[id^="admin-lesson-tab-panel-"] [role="tabpanel"] h4')
        .first()
        .textContent()
    )?.trim();
    const lessonInitialHtml = await expectServerRenderedShell(
      page,
      '[data-admin-theme="true"]',
      'data-admin-theme="true"',
    );
    expect(lessonTitle).toBeTruthy();
    expect(activeQuizSetTitle).toBeTruthy();
    expect(lessonInitialHtml).toContain(lessonTitle!);
    expect(lessonInitialHtml).toContain(activeQuizSetTitle!);
    expect(lessonInitialHtml).not.toContain("Đang tải chi tiết buổi học");
    expect(lessonInitialHtml).not.toContain('aria-label="Đang tải bộ câu hỏi"');

    expect(scriptWarnings).toEqual([]);
  });
});
