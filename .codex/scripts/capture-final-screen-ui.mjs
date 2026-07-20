#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const requireFromWeb = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = requireFromWeb("@playwright/test");

const baseUrl = (process.env.FINAL_UI_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const apiBaseUrl = (process.env.FINAL_UI_API_BASE_URL ?? "http://localhost:4000/api/v1").replace(
  /\/$/,
  "",
);
const outputDir = process.env.FINAL_UI_OUTPUT_DIR ?? "docs/final-screen-ui";
const storageKey = "classhero.auth.session";

const viewports = [
  { name: "laptop", width: 1440, height: 1000 },
  { name: "ipad", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

const routes = [
  { role: "public", path: "/", segments: ["home"] },
  { role: "public", path: "/login", segments: ["login"] },
  { role: "public", path: "/register/student", segments: ["register", "student"] },
  { role: "public", path: "/register/parent", segments: ["register", "parent"] },
  { role: "public", path: "/forgot-password", segments: ["forgot-password"] },
  { role: "public", path: "/reset-password", segments: ["reset-password"] },
  { role: "student", path: "/student/courses", segments: ["courses"], authRole: "student" },
  { role: "student", path: "/student/explore", segments: ["explore"], authRole: "student" },
  {
    role: "student",
    path: "/student/courses/toan-7",
    segments: ["courses", "toan-7"],
    authRole: "student",
  },
  { role: "admin", path: "/admin/courses", segments: ["courses"], authRole: "admin" },
  {
    role: "admin",
    path: "/admin/courses/00000000-0000-4000-8000-000000000010",
    segments: ["courses", "00000000-0000-4000-8000-000000000010"],
    authRole: "admin",
  },
];

const credentials = {
  admin: {
    identifier: process.env.FINAL_UI_ADMIN_IDENTIFIER ?? "admin",
    password: process.env.FINAL_UI_ADMIN_PASSWORD ?? "123456",
  },
  student: {
    identifier: process.env.FINAL_UI_STUDENT_IDENTIFIER ?? "student1",
    password: process.env.FINAL_UI_STUDENT_PASSWORD ?? "Student123!",
  },
};

async function waitForUrl(url, timeoutMs = 90_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });

      if (response.status < 500) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "no response"}`);
}

async function login(role) {
  const credential = credentials[role];

  if (!credential) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credential),
    });
    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      return {
        error: `${response.status} ${payload?.error?.message ?? response.statusText}`,
      };
    }

    const data = payload?.data ?? payload;

    if (!data?.accessToken || !data?.refreshToken || !data?.user?.id) {
      return { error: "Login response did not include a complete auth session." };
    }

    return {
      session: {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        remember: true,
      },
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function ensureBaseRoleFolders() {
  for (const viewport of viewports) {
    for (const role of ["public", "student", "admin", "parent"]) {
      await mkdir(path.join(outputDir, viewport.name, role), { recursive: true });
    }
  }
}

function screenshotPath(viewportName, route) {
  return path.join(outputDir, viewportName, route.role, ...route.segments, "screen.png");
}

async function captureRoute(browser, viewport, route, sessions) {
  const context = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    viewport: { width: viewport.width, height: viewport.height },
  });
  const auth = route.authRole ? sessions[route.authRole]?.session : null;
  const targetUrl = `${baseUrl}${route.path}`;
  const filePath = screenshotPath(viewport.name, route);
  let status = "captured";
  let error = null;
  let finalUrl = targetUrl;

  if (auth) {
    await context.addInitScript(
      ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
      { key: storageKey, session: auth },
    );
  }

  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(750);
    finalUrl = page.url();
    await mkdir(path.dirname(filePath), { recursive: true });
    await page.screenshot({ path: filePath, fullPage: true });

    if (finalUrl !== targetUrl) {
      status = "captured-after-redirect";
    }
  } catch (captureError) {
    status = "failed";
    error = captureError instanceof Error ? captureError.message : String(captureError);
    finalUrl = page.url();
  } finally {
    await context.close();
  }

  return {
    viewport: viewport.name,
    viewportSize: { width: viewport.width, height: viewport.height },
    role: route.role,
    path: route.path,
    finalUrl,
    screenshot: filePath,
    status,
    error,
    auth: route.authRole ? (auth ? "seed-session" : "missing-session") : "guest",
  };
}

async function main() {
  await ensureBaseRoleFolders();
  await waitForUrl(baseUrl);

  const sessions = {
    admin: await login("admin"),
    student: await login("student"),
  };
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const viewport of viewports) {
      for (const route of routes) {
        results.push(await captureRoute(browser, viewport, route, sessions));
      }
    }
  } finally {
    await browser.close();
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    apiBaseUrl,
    viewports,
    auth: {
      admin: sessions.admin?.error ? { status: "failed", error: sessions.admin.error } : { status: "ok" },
      student: sessions.student?.error
        ? { status: "failed", error: sessions.student.error }
        : { status: "ok" },
    },
    results,
  };

  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const failed = results.filter((result) => result.status === "failed");

  if (failed.length > 0) {
    console.error(`Captured with ${failed.length} failed route(s). See ${outputDir}/manifest.json.`);
    process.exitCode = 1;
    return;
  }

  console.log(`Captured ${results.length} screenshots into ${outputDir}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
