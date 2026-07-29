import { expect, test } from "@playwright/test";
import path from "node:path";

const screenshotRoot = path.resolve(process.cwd(), "../../.codex/screenshots");
const shouldCaptureScreenshots = process.env.AUTH_UI_SCREENSHOTS === "1";

const authPages = [
  {
    path: "/login",
    heading: "Đăng nhập",
    screenshotName: "m2-4-login",
  },
  {
    path: "/register/student",
    heading: "Đăng ký",
    screenshotName: "m2-4-register-student",
  },
  {
    path: "/register/parent",
    heading: "Đăng ký",
    screenshotName: "m2-4-register-parent",
  },
  {
    path: "/forgot-password",
    heading: "Quên mật khẩu",
    screenshotName: "m2-4-forgot-password",
  },
  {
    path: "/reset-password",
    heading: "Đặt lại mật khẩu",
    screenshotName: "m2-4-reset-password",
  },
] as const;

test.describe("M2.4 auth UI", () => {
  for (const authPage of authPages) {
    test(`${authPage.path} renders`, async ({ page }, testInfo) => {
      await page.goto(authPage.path, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: authPage.heading })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex, nofollow",
      );

      if (shouldCaptureScreenshots) {
        await page.screenshot({
          path: path.join(
            screenshotRoot,
            `${authPage.screenshotName}-${testInfo.project.name}.png`,
          ),
          fullPage: true,
        });
      }
    });
  }

  test("login form shows validation and success state", async ({ page }) => {
    const accessToken = [
      Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
      Buffer.from(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 3_600,
          role: "STUDENT",
          sub: "student-user",
        }),
      ).toString("base64url"),
      "signature",
    ].join(".");

    await page.route("http://localhost:4000/api/v1/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        body: JSON.stringify({
          data: {
            accessToken,
            refreshToken: "refresh-token",
            user: {
              email: null,
              id: "student-user",
              phone: null,
              role: "STUDENT",
              username: "student1",
            },
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByText("Nhập tên đăng nhập/SĐT")).toBeVisible();
    await expect(page.getByText("Nhập mật khẩu.")).toBeVisible();

    await page
      .getByRole("textbox", { name: "Tên đăng nhập/Số điện thoại" })
      .fill("student1");
    await page
      .getByRole("textbox", { name: "Mật khẩu", exact: true })
      .fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("button", { name: "Đang xử lý..." })).toBeVisible();
    await expect(page.getByText("Đăng nhập học sinh thành công")).toBeVisible();
  });
});
