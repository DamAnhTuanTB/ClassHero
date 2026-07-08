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
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(
      page.getByText("Nhập email, số điện thoại hoặc tên đăng nhập."),
    ).toBeVisible();
    await expect(page.getByText("Nhập mật khẩu.")).toBeVisible();

    await page.getByLabel("Tài khoản").fill("student1");
    await page.getByLabel("Mật khẩu").fill("Password123!");
    await page.getByRole("button", { name: "Đăng nhập" }).click();

    await expect(page.getByRole("button", { name: "Đang xử lý..." })).toBeVisible();
    await expect(page.getByText("Đăng nhập thành công")).toBeVisible();
  });
});
