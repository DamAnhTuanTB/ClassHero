import { expect, test, type Page } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";

test("course detail 404 dùng màn lỗi chung và không tự retry", async ({ page }) => {
  let detailRequestCount = 0;

  await seedStudentSession(page);
  await page.route(`${apiBaseUrl}/learning-paths/abd`, async (route) => {
    detailRequestCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lộ trình học",
        },
      }),
    });
  });

  await page.goto("/student/courses/abd");

  const loadingSkeleton = page.getByRole("region", {
    name: "Đang tải khóa học",
  });
  await expect(loadingSkeleton).toBeVisible();
  const skeletonBox = await loadingSkeleton.boundingBox();
  const viewportWidth = page.viewportSize()?.width ?? 375;
  expect(skeletonBox?.width).toBeGreaterThan(Math.min(600, viewportWidth * 0.8));

  await expect(
    page.getByRole("heading", { name: "Chưa mở được khóa học" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Thử lại" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Về danh sách khóa học" }),
  ).toBeVisible();
  expect(detailRequestCount).toBe(1);
});

async function seedStudentSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    role: "STUDENT",
    sub: "student-course-error",
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
        email: "student-course-error@classhero.test",
        fullName: "Học sinh kiểm thử",
        id: "student-course-error",
        phone: null,
        role: "STUDENT",
        username: "student-course-error",
      },
    },
  );
}

function createUnsignedToken(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}
