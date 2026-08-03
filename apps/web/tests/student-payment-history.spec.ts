import { expect, test, type Page, type Route } from "@playwright/test";

const apiBaseUrl = "http://localhost:4000/api/v1";
const paymentId = "payment-history-test";

test.beforeEach(async ({ page }) => {
  await seedStudentSession(page);
  await page.route(
    `${apiBaseUrl}/student/payments/${paymentId}`,
    async (route) => fulfillJson(route, 200, { data: createPaidPayment() }),
  );
});

test("Back từ kết quả thành công bỏ qua lịch sử trang thanh toán payOS", async ({
  page,
}) => {
  const originPath = "/student/explore?checkout-origin=1";

  await page.goto(originPath);
  await page.evaluate((currentPaymentId) => {
    window.sessionStorage.setItem(
      `classhero.payment-checkout-history:${currentPaymentId}`,
      JSON.stringify({
        paymentId: currentPaymentId,
        originHref: window.location.href,
        historyLength: window.history.length,
        createdAt: Date.now(),
      }),
    );

    // A same-origin placeholder represents the cross-origin payOS history entry.
    window.history.pushState({}, "", "/payos.vn/checkout/success");
  }, paymentId);

  await page.goto(`/student/payments/${paymentId}/result`);
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công!" }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${originPath.replace("?", "\\?")}$`));
  await expect(page).not.toHaveURL(/payos\.vn/);
});

test("Back về course detail refetch quyền học sau thanh toán", async ({ page }) => {
  const courseSlug = "payment-back-refresh-test";
  let courseRequestCount = 0;

  await page.route(`${apiBaseUrl}/learning-paths/${courseSlug}`, async (route) => {
    courseRequestCount += 1;
    await fulfillJson(route, 200, {
      data: createCourseDetail(courseSlug, courseRequestCount > 1),
    });
  });

  await page.goto(`/student/courses/${courseSlug}`);
  await expect(page.getByRole("button", { name: "Mua ngay" })).toBeVisible();

  await page.evaluate((currentPaymentId) => {
    window.sessionStorage.setItem(
      `classhero.payment-checkout-history:${currentPaymentId}`,
      JSON.stringify({
        paymentId: currentPaymentId,
        originHref: window.location.href,
        historyLength: window.history.length,
        createdAt: Date.now(),
      }),
    );
    window.history.pushState({}, "", "/payos.vn/checkout/success");
  }, paymentId);

  await page.goto(`/student/payments/${paymentId}/result`);
  await expect(
    page.getByRole("heading", { name: "Thanh toán thành công!" }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/student/courses/${courseSlug}$`));
  await expect(page.getByRole("button", { name: "Mua ngay" })).toHaveCount(0);
  await expect(page.getByText("Đang học", { exact: true })).toBeVisible();
  expect(courseRequestCount).toBe(2);
});

function createPaidPayment() {
  return {
    id: paymentId,
    provider: "PAYOS",
    status: "PAID",
    learningPathId: "learning-path-history-test",
    learningPath: {
      id: "learning-path-history-test",
      title: "Toán 7",
      slug: "payment-back-refresh-test",
    },
    checkoutUrl: "https://pay.payos.vn/web/payment-history-test",
    qrCode: null,
    amountVnd: 2_000,
    originalAmountVnd: 2_000,
    discountAmountVnd: 0,
    paidAt: "2026-08-01T10:43:06.000Z",
    expiredAt: null,
    createdAt: "2026-08-01T10:40:00.000Z",
    enrollment: {
      id: "enrollment-history-test",
      status: "ACTIVE",
      startsAt: "2026-08-01T10:43:06.000Z",
      expiresAt: "2027-08-01T10:43:06.000Z",
    },
  };
}

function createCourseDetail(slug: string, hasActiveEnrollment: boolean) {
  const lesson = {
    id: "lesson-payment-back-refresh",
    orderIndex: 1,
    title: "Bài học đầu tiên",
    shortDescription: null,
    lessonType: "BASIC",
    examOpenAt: null,
    status: "PUBLISHED",
    trialEnabled: false,
  };

  return {
    id: "learning-path-payment-back-refresh",
    subject: "MATH",
    grade: 7,
    title: "Toán 7",
    slug,
    status: "PUBLISHED",
    originalPriceVnd: 2_000,
    salePriceVnd: null,
    totalChapterCount: 1,
    totalLessonCount: 1,
    thumbnailFileId: null,
    thumbnailFile: null,
    descriptionJson: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Toán 7" }] }],
    },
    trialEnabled: false,
    publishedAt: "2026-08-01T10:00:00.000Z",
    summary: {
      chapterCount: 1,
      lessonCount: 1,
      firstLessonId: lesson.id,
      effectivePriceVnd: 2_000,
      hasDiscount: false,
    },
    access: {
      hasActiveEnrollment,
      enrollment: hasActiveEnrollment
        ? {
            id: "enrollment-payment-back-refresh",
            status: "ACTIVE",
            startsAt: "2026-08-01T10:43:06.000Z",
            expiresAt: "2027-08-01T10:43:06.000Z",
          }
        : null,
      trialAvailable: false,
      trialLessonId: null,
    },
    progress: hasActiveEnrollment
      ? {
          completedLessonCount: 0,
          progressPercent: 0,
          continueLessonId: lesson.id,
          continueLessonKind: "first",
          continueLessonTitle: lesson.title,
        }
      : null,
    lessons: [lesson],
    chapters: [
      {
        id: "chapter-payment-back-refresh",
        orderIndex: 1,
        title: "Chương 1",
        overview: null,
        status: "PUBLISHED",
        lessons: [lesson],
      },
    ],
  };
}

async function seedStudentSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    role: "STUDENT",
    sub: "student-payment-history",
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
        email: "student-payment-history@classhero.test",
        fullName: "Học sinh thanh toán",
        id: "student-payment-history",
        phone: null,
        role: "STUDENT",
        username: "student-payment-history",
      },
    },
  );
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
