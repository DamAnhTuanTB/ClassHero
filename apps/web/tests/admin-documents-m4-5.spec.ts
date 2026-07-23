import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const apiBaseUrl = "http://localhost:4000/api/v1";
const learningPathId = "path-math-7";
const lessonOneId = "lesson-math-7-1";
const lessonTwoId = "lesson-math-7-2";
const shouldCaptureScreenshots = process.env.M45_SCREENSHOTS === "1";
const screenshotRoot = path.resolve(process.cwd(), "../../docs/final-screen-ui");

type MockState = {
  fileCounter: number;
  learningPath: ReturnType<typeof buildLearningPath>;
  lessonCreatePayloads: LessonMutationPayload[];
  lessonDocuments: Array<ReturnType<typeof buildLessonDocument>>;
  lessonUpdatePayloads: LessonMutationPayload[];
  sourceDocuments: unknown[];
  sourcePages: unknown[];
};

type LessonMutationPayload = {
  completionMinScore?: number;
  examOpenAt?: string | null;
  orderIndex?: number;
  scheduledAt?: string | null;
  shortDescription?: string | null;
  sourceDocumentExtractions?: Array<{
    id?: string;
    pageEnd: number;
    pageStart: number;
    sortOrder?: number;
    sourceDocumentId: string;
  }>;
  status?: string;
  title?: string;
  trialEnabled?: boolean;
  videoUrl?: string | null;
};

test.describe("M4.5 admin lesson documents", () => {
  test("uploads and switches between multiple source PDFs", async ({
    page,
  }, testInfo) => {
    await seedAdminSession(page);
    await setupM45ApiMock(page);

    await page.goto(`/admin/courses/${learningPathId}`);

    const panel = page.getByTestId("admin-course-document-panel");
    await expect(panel.getByText("Chưa có tài liệu nguồn")).toBeVisible();
    await captureM45Screenshot(page, testInfo.project.name, "01-empty-source");

    await panel
      .getByRole("button", { name: "Thêm tài liệu nguồn" })
      .first()
      .click();
    await page.getByLabel("File PDF").setInputFiles(buildPdfFixture("toan-7-tap-1.pdf"));
    await page.getByLabel("Tên tài liệu").fill("Toán 7 Tập 1");
    await page.getByRole("button", { name: "Xử lý OCR" }).click();

    await expect(panel.getByRole("heading", { name: "Toán 7 Tập 1" })).toBeVisible();
    await expect(panel.getByTestId("document-stat-total-pages")).toContainText("8");
    await captureM45Screenshot(page, testInfo.project.name, "02-source-ready");

    await panel.getByRole("button", { name: "Thêm tài liệu nguồn" }).first().click();
    await page.getByLabel("File PDF").setInputFiles(buildPdfFixture("toan-7-tap-2.pdf"));
    await page.getByLabel("Tên tài liệu").fill("Toán 7 Tập 2");
    await page.getByRole("button", { name: "Xử lý OCR" }).click();

    const sourceList = panel.getByRole("listbox", {
      name: "Chọn tài liệu nguồn đang quản lý",
    });
    await expect(sourceList.getByRole("option")).toHaveCount(2);
    await expect(sourceList.getByRole("option").nth(0)).toContainText(
      "Toán 7 Tập 1",
    );
    await expect(sourceList.getByRole("option").nth(1)).toContainText(
      "Toán 7 Tập 2",
    );
    await expect(panel.getByRole("heading", { name: "Toán 7 Tập 2" })).toBeVisible();

    await page.getByRole("button", { name: "Thêm bài học" }).first().click();
    const createDialog = page.getByRole("dialog", { name: "Thêm bài học" });
    await expect(createDialog.getByLabel("Tài liệu trích xuất")).toContainText(
      "Toán 7 Tập 1",
    );
    const foundationSection = createDialog.getByTestId(
      "lesson-foundation-documents-section",
    );
    await foundationSection.getByTestId("add-foundation-extraction").click();
    const extractions = foundationSection.getByTestId("foundation-extraction-item");
    await expectVerticallyCentered(
      extractions.nth(0).getByLabel("Đến trang"),
      extractions
        .nth(0)
        .getByRole("button", { name: "Xóa khối trích xuất 1" }),
    );
    await extractions.nth(1).getByLabel("Tài liệu trích xuất").click();
    await extractions.nth(1).getByRole("option", { name: "Toán 7 Tập 2" }).click();
    await expect(
      extractions.nth(1).getByText("Nhập trang bắt đầu"),
    ).toHaveCount(0);
    await expect(
      extractions.nth(1).getByText("Nhập trang kết thúc"),
    ).toHaveCount(0);
    await extractions.nth(0).getByLabel("Từ trang").fill("1");
    await extractions.nth(0).getByLabel("Đến trang").fill("5");
    await extractions.nth(1).getByLabel("Từ trang").fill("1");
    await extractions.nth(1).getByLabel("Đến trang").fill("5");
    await expect(
      foundationSection.getByText(/Khoảng trang xung đột/),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await sourceList.getByRole("option", { name: /Toán 7 Tập 1/ }).click();
    await expect(panel.getByRole("heading", { name: "Toán 7 Tập 1" })).toBeVisible();

    await panel.getByRole("button", { name: "Xem trang" }).click();
    await expect(page.getByRole("heading", { name: "Xem trang" })).toBeVisible();
    await expect(page.getByText("Trang PDF 1")).toBeVisible();
    await page.keyboard.press("Escape");
    await expectNoHorizontalOverflow(page);
  });

  test("validates overlapping extractions and shows source delete conflict", async ({
    page,
  }, testInfo) => {
    await seedAdminSession(page);
    await setupM45ApiMock(page, { withMappedSource: true });

    await page.goto(`/admin/courses/${learningPathId}`);

    const panel = page.getByTestId("admin-course-document-panel");
    await expect(panel.getByRole("heading", { name: "Toán 7 Tập 1" })).toBeVisible();

    const lessonOneArticle = page
      .getByRole("heading", { name: "Bài học 1: Số hữu tỉ" })
      .locator("xpath=ancestor::article[1]");
    await lessonOneArticle.getByRole("button", { name: "Sửa" }).click();
    const editDialog = page.getByRole("dialog", { name: "Sửa bài học" });
    const foundationSection = editDialog.getByTestId(
      "lesson-foundation-documents-section",
    );
    await foundationSection.getByTestId("add-foundation-extraction").click();
    const extractions = foundationSection.getByTestId("foundation-extraction-item");
    await extractions.nth(1).getByLabel("Từ trang").fill("4");
    await extractions.nth(1).getByLabel("Đến trang").fill("6");
    await expect(
      extractions
        .nth(1)
        .getByText("Khoảng trang xung đột với khối trích xuất 1"),
    ).toBeVisible();
    await captureM45Screenshot(page, testInfo.project.name, "05-range-error");
    await page.keyboard.press("Escape");

    await panel.getByRole("button", { name: "Xóa" }).click();
    await page.getByRole("button", { name: "Xóa tài liệu" }).click();
    await expect(page.getByText("Chưa xóa được tài liệu nguồn")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureM45Screenshot(page, testInfo.project.name, "06-delete-conflict");
  });

  test("adds exactly one extraction when editing a lesson without documents", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupM45ApiMock(page, { sourceStatus: "READY" });

    await page.goto(`/admin/courses/${learningPathId}`);
    await expect(
      page
        .getByTestId("admin-course-document-panel")
        .getByRole("heading", { name: "Toán 7 Tập 1" }),
    ).toBeVisible();

    const lessonOneArticle = page
      .getByRole("heading", { name: "Bài học 1: Số hữu tỉ" })
      .locator("xpath=ancestor::article[1]");
    await lessonOneArticle.getByRole("button", { name: "Sửa" }).click();

    const editDialog = page.getByRole("dialog", { name: "Sửa bài học" });
    const foundationSection = editDialog.getByTestId(
      "lesson-foundation-documents-section",
    );
    const extractions = foundationSection.getByTestId("foundation-extraction-item");

    await expect(extractions).toHaveCount(0);
    await foundationSection.getByTestId("add-foundation-extraction").click();
    await expect(extractions).toHaveCount(1);
    await expect(foundationSection.getByTestId("foundation-document-count")).toHaveText(
      "1",
    );

    await editDialog.getByLabel("Tên bài học").fill("Toán 7");
    await extractions.getByRole("button", { name: "Trang 1 - 8" }).click();

    await expect(extractions).toHaveCount(1);
    await expect(extractions.getByLabel("Từ trang in")).toHaveValue("1");
    await expect(extractions.getByLabel("Đến trang in")).toHaveValue("8");
    await expect(editDialog.getByText(/Invalid input:/)).toHaveCount(0);
  });

  test("creates lesson metadata first and saves a source range when provided", async ({
    page,
  }) => {
    await seedAdminSession(page);
    const mock = await setupM45ApiMock(page, { withMappedSource: true });

    await page.goto(`/admin/courses/${learningPathId}`);

    await page.getByRole("button", { name: "Thêm bài học" }).first().click();
    const createDialog = page.getByRole("dialog", { name: "Thêm bài học" });
    await expect(createDialog.getByLabel("Tên bài học")).toBeVisible();
    await expect(createDialog.getByLabel("Từ trang")).toBeEnabled();
    const referenceSection = createDialog.getByTestId(
      "lesson-supplement-documents-section",
    );
    await expectElementAboveDialogFooter(
      createDialog,
      referenceSection.getByRole("button", { name: "Thêm tài liệu" }),
    );
    await createDialog.getByRole("button", { name: "Xóa khối trích xuất 1" }).click();
    await createDialog.getByLabel("Thứ tự").fill("3");
    await createDialog.getByLabel("Tên bài học").fill("Bài học 3: Ôn tập");
    await referenceSection.getByRole("button", { name: "Thêm tài liệu" }).click();
    await expectElementAboveDialogFooter(
      createDialog,
      createDialog.getByTestId("lesson-reference-file-control-1"),
    );
    await referenceSection.getByLabel("Tên tài liệu").fill("Phiếu đọc thêm");
    await referenceSection
      .getByLabel("File tài liệu")
      .setInputFiles(buildPdfFixture("phieu-doc-them.pdf"));
    await createDialog.getByRole("button", { name: "Lưu bài học" }).click();
    await expect(page.getByText("Đã thêm bài học")).toBeVisible();
    expect(mock.lessonCreatePayloads.at(-1)?.sourceDocumentExtractions).toEqual([]);
    expect(mock.lessonDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          chunkCount: 3,
          kind: "SUPPLEMENT",
          lessonId: "lesson-created-1",
          metadataJson: expect.objectContaining({
            processingMode: "processing",
            source: "uploaded_supplement_document",
          }),
          processingJob: expect.objectContaining({ status: "SUCCEEDED" }),
          processingJobId: "reference-1-job",
          status: "READY",
          title: "Phiếu đọc thêm",
        }),
      ]),
    );

    const lessonOneArticle = page
      .getByRole("heading", { name: "Bài học 1: Số hữu tỉ" })
      .locator("xpath=ancestor::article[1]");
    await lessonOneArticle.getByRole("button", { name: "Sửa" }).click();
    const editDialog = page.getByRole("dialog", { name: "Sửa bài học" });
    await editDialog.getByLabel("Từ trang").fill("2");
    await editDialog.getByLabel("Đến trang").fill("3");
    await editDialog.getByRole("button", { name: "Lưu bài học" }).click();
    await expect(page.getByText("Đã lưu bài học")).toBeVisible();
    expect(mock.lessonUpdatePayloads.at(-1)?.sourceDocumentExtractions).toEqual([
      expect.objectContaining({
        pageEnd: 3,
        pageStart: 2,
        sourceDocumentId: "source-doc-1",
      }),
    ]);
  });

  test("keeps the default foundation range and appends items in action order on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await seedAdminSession(page);
    await setupM45ApiMock(page, { withMappedSource: true });

    await page.goto(`/admin/courses/${learningPathId}`);
    await page.getByRole("button", { name: "Thêm bài học" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Thêm bài học" });
    const foundationSection = dialog.getByTestId(
      "lesson-foundation-documents-section",
    );
    const addExtractionButton = foundationSection.getByTestId(
      "add-foundation-extraction",
    );
    const addDocumentButton = foundationSection.getByTestId(
      "add-foundation-document",
    );

    await expect(foundationSection.getByTestId("foundation-extraction-item")).toHaveCount(1);
    await expect(addExtractionButton).toBeEnabled();
    await expect(addDocumentButton).toBeEnabled();

    const addRangeBox = await addExtractionButton.boundingBox();
    const addDocumentBox = await addDocumentButton.boundingBox();
    expect(addRangeBox).not.toBeNull();
    expect(addDocumentBox).not.toBeNull();
    expect(Math.abs(addRangeBox!.y - addDocumentBox!.y)).toBeLessThan(2);

    await addDocumentButton.click();
    await expect(foundationSection.getByTestId("foundation-upload-item")).toBeVisible();
    await expect(foundationSection.getByText("Nhập tên tài liệu")).toHaveCount(0);
    await expect(
      foundationSection.getByText("Phải chọn file cho tài liệu nền tảng"),
    ).toHaveCount(0);

    await addExtractionButton.click();
    await expect(
      foundationSection.getByText("Phải nhập khoảng trang cho tài liệu nền tảng"),
    ).toHaveCount(0);
    const firstExtractionBox = await foundationSection
      .getByTestId("foundation-extraction-item")
      .nth(0)
      .boundingBox();
    const uploadBox = await foundationSection
      .getByTestId("foundation-upload-item")
      .boundingBox();
    const secondExtractionBox = await foundationSection
      .getByTestId("foundation-extraction-item")
      .nth(1)
      .boundingBox();

    expect(firstExtractionBox).not.toBeNull();
    expect(uploadBox).not.toBeNull();
    expect(secondExtractionBox).not.toBeNull();
    expect(firstExtractionBox!.y).toBeLessThan(uploadBox!.y);
    expect(uploadBox!.y).toBeLessThan(secondExtractionBox!.y);
    await expect(addExtractionButton).toBeEnabled();

    const extractionItems = foundationSection.getByTestId("foundation-extraction-item");
    await extractionItems.nth(0).getByLabel("Từ trang").fill("1");
    await extractionItems.nth(0).getByLabel("Đến trang").fill("5");
    await extractionItems.nth(1).getByLabel("Từ trang").fill("5");
    await extractionItems.nth(1).getByLabel("Đến trang").fill("8");
    await expect(
      extractionItems
        .nth(1)
        .getByText("Khoảng trang xung đột với khối trích xuất 1"),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("excludes source documents that are not ready from lesson extraction", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupM45ApiMock(page, { sourceStatus: "PROCESSING" });

    await page.goto(`/admin/courses/${learningPathId}`);

    await page.getByRole("button", { name: "Thêm bài học" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Thêm bài học" });
    await expect(dialog.getByText("Chưa có tài liệu nguồn sẵn sàng.")).toBeVisible();
    await expect(dialog.getByLabel("Tài liệu trích xuất")).toBeDisabled();
    await expect(dialog.getByLabel("Từ trang")).toBeDisabled();
    await expect(dialog.getByLabel("Đến trang")).toBeDisabled();
    await expect(dialog.getByLabel("Tên bài học")).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });

  test("shows pristine extraction errors after the user submits the lesson", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupM45ApiMock(page, { withMappedSource: true });

    await page.goto(`/admin/courses/${learningPathId}`);
    await page.getByRole("button", { name: "Thêm bài học" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Thêm bài học" });
    await expect(dialog.getByText("Nhập trang bắt đầu")).toHaveCount(0);
    await expect(dialog.getByText("Nhập trang kết thúc")).toHaveCount(0);

    await dialog.getByRole("button", { name: "Lưu bài học" }).click();

    await expect(dialog.getByText("Nhập tên bài học")).toBeVisible();
    await expect(dialog.getByText("Nhập trang bắt đầu")).toBeVisible();
    await expect(dialog.getByText("Nhập trang kết thúc")).toBeVisible();
  });

  test("allows multiple homework files in the lesson editor", async ({ page }) => {
    await seedAdminSession(page);
    const mock = await setupM45ApiMock(page, { withMappedSource: true });

    await page.goto(`/admin/courses/${learningPathId}`);
    await page.getByRole("button", { name: "Thêm bài học" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Thêm bài học" });
    await dialog.getByRole("button", { name: "Xóa khối trích xuất 1" }).click();
    await dialog.getByLabel("Thứ tự").fill("3");
    await dialog.getByLabel("Tên bài học").fill("Bài học 3: Bài tập tổng hợp");

    const homeworkSection = dialog.getByTestId(
      "lesson-homework-documents-section",
    );
    const addHomeworkButton = homeworkSection.getByRole("button", {
      name: "Thêm tài liệu",
    });
    await addHomeworkButton.click();
    await expect(addHomeworkButton).toBeEnabled();
    await addHomeworkButton.click();

    await expect(homeworkSection.getByLabel("Tên tài liệu")).toHaveCount(2);
    await expect(homeworkSection.getByLabel("File tài liệu")).toHaveCount(2);
    await homeworkSection
      .getByLabel("Tên tài liệu")
      .nth(0)
      .fill("Bài tập đại số");
    await homeworkSection
      .getByLabel("Tên tài liệu")
      .nth(1)
      .fill("Bài tập hình học");
    await homeworkSection
      .getByLabel("File tài liệu")
      .nth(0)
      .setInputFiles(buildPdfFixture("bai-tap-dai-so.pdf"));
    await homeworkSection
      .getByLabel("File tài liệu")
      .nth(1)
      .setInputFiles(buildPdfFixture("bai-tap-hinh-hoc.pdf"));

    await dialog.getByRole("button", { name: "Lưu bài học" }).click();
    await expect(page.getByText("Đã thêm bài học")).toBeVisible();

    expect(
      mock.lessonDocuments.filter(
        (document) => document.kind === "HOMEWORK",
      ),
    ).toEqual([
      expect.objectContaining({ title: "Bài tập đại số" }),
      expect.objectContaining({ title: "Bài tập hình học" }),
    ]);
  });

  test("shows confirmation status and excludes sources with printed-page warnings", async ({
    page,
  }) => {
    await seedAdminSession(page);
    await setupM45ApiMock(page, { warningPageNumber: 2 });

    await page.goto(`/admin/courses/${learningPathId}`);

    const panel = page.getByTestId("admin-course-document-panel");
    const sourceOption = panel.getByRole("option", { name: /Toán 7 Tập 1/ });
    await expect(sourceOption).toContainText("Cần xác nhận");

    await page.getByRole("button", { name: "Thêm bài học" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Thêm bài học" });
    await expect(dialog.getByText("Chưa có tài liệu nguồn sẵn sàng.")).toBeVisible();
    await expect(dialog.getByLabel("Tài liệu trích xuất")).toBeDisabled();
    await expect(
      dialog.getByRole("option", { name: "Toán 7 Tập 1" }),
    ).toHaveCount(0);
  });

  for (const themeMode of ["light", "dark"] as const) {
    test(`keeps M4.5 document UI layout usable in ${themeMode} theme`, async ({
      page,
    }) => {
      await seedAdminSession(page);
      await seedAppTheme(page, themeMode);
      await setupM45ApiMock(page, { withMappedSource: true });

      await page.goto(`/admin/courses/${learningPathId}`);

      await expect(page.locator("html")).toHaveAttribute("data-theme", themeMode);
      await expectThemeTokensApplied(page, themeMode);
      await expectNoHorizontalOverflow(page);

      const panel = page.getByTestId("admin-course-document-panel");
      await expect(panel.getByRole("heading", { name: "Toán 7 Tập 1" })).toBeVisible();

      const lessonOneArticle = page
        .getByRole("heading", { name: "Bài học 1: Số hữu tỉ" })
        .locator("xpath=ancestor::article[1]");
      await lessonOneArticle.getByRole("button", { name: "Sửa" }).click();
      const createDialog = page.getByRole("dialog", { name: "Sửa bài học" });
      await expect(createDialog).toBeVisible();
      await expectDialogFitsViewport(page, createDialog);
      await expect(createDialog.getByLabel("Từ trang")).toHaveValue("1");
      await expect(createDialog.getByLabel("Đến trang")).toHaveValue("4");

      const referenceSection = createDialog.getByTestId(
        "lesson-supplement-documents-section",
      );
      const referenceButton = referenceSection.getByRole("button", {
        name: "Thêm tài liệu",
      });
      await expectElementAboveDialogFooter(createDialog, referenceButton);
      await referenceButton.click();
      await expectElementAboveDialogFooter(
        createDialog,
        createDialog.getByTestId("lesson-reference-file-control-1"),
      );
      await expectNoHorizontalOverflow(page);
    });
  }
});

async function seedAdminSession(page: Page) {
  const accessToken = createUnsignedToken({
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    role: "ADMIN",
    sub: "admin-user",
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

async function seedAppTheme(page: Page, themeMode: "dark" | "light") {
  await page.addInitScript((mode) => {
    window.localStorage.setItem("classhero-theme", mode);
    document.cookie = `classhero-theme=${mode}; path=/; max-age=31536000; SameSite=Lax`;
  }, themeMode);
}

async function setupM45ApiMock(
  page: Page,
  options: {
    sourceStatus?: string;
    warningPageNumber?: number;
    withMappedSource?: boolean;
  } = {},
) {
  const hasInitialSource = Boolean(
    options.withMappedSource || options.sourceStatus || options.warningPageNumber,
  );
  const state: MockState = {
    fileCounter: 0,
    learningPath: buildLearningPath(),
    lessonCreatePayloads: [],
    lessonDocuments: [],
    lessonUpdatePayloads: [],
    sourceDocuments: hasInitialSource
      ? [
          buildSourceDocument("source-file-1", "Toán 7 Tập 1", {
            status: options.sourceStatus ?? "READY",
            warningPageCount: options.warningPageNumber ? 1 : 0,
          }),
        ]
      : [],
    sourcePages: buildSourcePages({
      warningPageNumber: options.warningPageNumber,
    }),
  };

  if (options.withMappedSource) {
    state.lessonDocuments = buildMappedLessonDocuments();
  }

  await page.route(`${apiBaseUrl}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace("/api/v1", "");
    const method = request.method();

    if (method === "GET" && pathname === `/admin/learning-paths/${learningPathId}`) {
      return fulfillJson(route, 200, { data: state.learningPath });
    }

    if (
      method === "GET" &&
      pathname === `/admin/learning-paths/${learningPathId}/source-documents`
    ) {
      return fulfillJson(route, 200, { data: state.sourceDocuments });
    }

    if (
      method === "POST" &&
      pathname === `/admin/learning-paths/${learningPathId}/source-documents`
    ) {
      const body = request.postDataJSON() as { fileId: string; title?: string };
      const sourceDocument = buildSourceDocument(body.fileId, body.title, {
        id: `source-doc-${state.sourceDocuments.length + 1}`,
      });
      state.sourceDocuments = [...state.sourceDocuments, sourceDocument];
      state.sourcePages = buildSourcePages();
      return fulfillJson(route, 201, { data: sourceDocument });
    }

    if (method === "POST" && pathname === "/files/upload") {
      state.fileCounter += 1;
      const originalName =
        request.postData()?.match(/filename="([^"]+)"/)?.[1] ??
        `document-${state.fileCounter}.pdf`;

      return fulfillJson(route, 201, {
        data: {
          id: `uploaded-file-${state.fileCounter}`,
          originalName,
          publicUrl: null,
        },
      });
    }

    if (
      method === "GET" &&
      /^\/admin\/source-documents\/[^/]+\/pages$/.test(pathname)
    ) {
      return fulfillJson(route, 200, { data: state.sourcePages });
    }

    if (
      method === "PUT" &&
      pathname === "/admin/source-documents/source-doc-1/lesson-page-ranges"
    ) {
      const body = request.postDataJSON() as {
        ranges: Array<{ lessonId: string; pageEnd: number; pageStart: number }>;
      };
      state.lessonDocuments = body.ranges.map((range, index) =>
        buildLessonDocument({
          id: `primary-from-source-${index + 1}`,
          kind: "PRIMARY_FROM_SOURCE",
          lessonId: range.lessonId,
          metadataJson: {
            pageEnd: range.pageEnd,
            pageStart: range.pageStart,
            source: "source_document_page_range",
          },
          sourceDocumentId: "source-doc-1",
          title: "Toán 7 Tập 1",
        }),
      );

      return fulfillJson(route, 200, {
        data: {
          lessonDocuments: state.lessonDocuments,
          ranges: body.ranges.map((range, index) => ({
            createdAt: nowIso(),
            createdById: "admin-user",
            id: `range-${index + 1}`,
            lessonId: range.lessonId,
            metadataJson: {},
            pageEnd: range.pageEnd,
            pageStart: range.pageStart,
            sourceDocumentId: "source-doc-1",
            updatedAt: nowIso(),
          })),
          sourceDocument: state.sourceDocuments[0],
          warnings: [],
        },
      });
    }

    if (
      method === "GET" &&
      pathname === `/admin/learning-paths/${learningPathId}/lesson-documents`
    ) {
      return fulfillJson(route, 200, { data: state.lessonDocuments });
    }

    if (method === "POST" && pathname === "/admin/chapters/chapter-math-7-1/lessons") {
      const body = request.postDataJSON() as LessonMutationPayload;
      state.lessonCreatePayloads.push(body);
      const lesson = buildLessonFromPayload(
        `lesson-created-${state.lessonCreatePayloads.length}`,
        body,
      );
      state.learningPath = addLessonToLearningPath(state.learningPath, lesson);

      if (body.sourceDocumentExtractions) {
        state.lessonDocuments = syncSourceLessonDocuments(
          state.lessonDocuments,
          lesson.id,
          body.sourceDocumentExtractions,
        );
      }

      return fulfillJson(route, 201, { data: lesson });
    }

    if (method === "PATCH" && pathname.startsWith("/admin/lessons/")) {
      const lessonId = pathname.split("/").at(-1) ?? "";
      const body = request.postDataJSON() as LessonMutationPayload;
      state.lessonUpdatePayloads.push(body);
      state.learningPath = updateLessonInLearningPath(state.learningPath, lessonId, body);

      if (body.sourceDocumentExtractions) {
        state.lessonDocuments = syncSourceLessonDocuments(
          state.lessonDocuments,
          lessonId,
          body.sourceDocumentExtractions,
        );
      }

      const lesson = state.learningPath.chapters
        .flatMap((chapter) => chapter.lessons)
        .find((item) => item.id === lessonId);

      return fulfillJson(route, 200, {
        data: lesson ?? buildLesson(lessonId, 1, "Bài học"),
      });
    }

    if (
      method === "POST" &&
      pathname === `/admin/lessons/${lessonOneId}/primary-document/replace`
    ) {
      const body = request.postDataJSON() as { fileId: string; title?: string };
      state.lessonDocuments = [
        ...state.lessonDocuments,
        buildLessonDocument({
          id: "primary-upload-1",
          kind: "PRIMARY_FROM_SOURCE",
          lessonId: lessonOneId,
          sourceDocumentId: null,
          title: body.title ?? "PDF chính buổi 1",
        }),
      ];

      return fulfillJson(route, 201, {
        data: state.lessonDocuments.at(-1),
      });
    }

    if (method === "POST" && /^\/admin\/lessons\/[^/]+\/documents$/.test(pathname)) {
      const lessonId = pathname.split("/")[3] ?? lessonOneId;
      const body = request.postDataJSON() as {
        fileId: string;
        kind?: "PRIMARY_FROM_SOURCE" | "SUPPLEMENT" | "HOMEWORK";
        processingMode?: string;
        title?: string;
      };
      const kind = body.kind ?? "SUPPLEMENT";
      const source =
        kind === "PRIMARY_FROM_SOURCE"
          ? "uploaded_primary_document"
          : kind === "HOMEWORK"
            ? "uploaded_homework_document"
            : "uploaded_supplement_document";
      const document = buildLessonDocument({
        fileId: body.fileId,
        id: `reference-${state.fileCounter}`,
        kind,
        lessonId,
        metadataJson: {
          processingMode: "processing",
          source,
        },
        sourceDocumentId: null,
        storageOnly: false,
        title: body.title ?? "Phiếu luyện thêm",
      });
      state.lessonDocuments = [...state.lessonDocuments, document];

      return fulfillJson(route, 201, { data: document });
    }

    if (
      method === "DELETE" &&
      pathname === `/admin/lessons/${lessonOneId}/documents/supplement-1`
    ) {
      state.lessonDocuments = state.lessonDocuments.filter(
        (document) => !isRecord(document) || document.id !== "supplement-1",
      );
      return fulfillJson(route, 200, { data: { success: true } });
    }

    if (method === "DELETE" && pathname === "/admin/source-documents/source-doc-1") {
      if (state.lessonDocuments.length > 0) {
        return fulfillJson(route, 409, {
          error: {
            code: "CONFLICT",
            message: "Không thể xóa tài liệu chính đang được gán vào buổi học",
          },
        });
      }

      state.sourceDocuments = [];
      return fulfillJson(route, 200, { data: { success: true } });
    }

    if (
      method === "POST" &&
      pathname === "/admin/source-documents/source-doc-1/process"
    ) {
      const sourceDocument = buildSourceDocument();
      state.sourceDocuments = [
        {
          ...sourceDocument,
          processingJob: buildJob("QUEUED"),
          processingJobId: "job-retry",
          status: "PROCESSING",
        },
      ];
      return fulfillJson(route, 201, { data: state.sourceDocuments[0] });
    }

    if (method === "GET" && pathname.startsWith("/files/")) {
      return fulfillJson(route, 200, {
        data: {
          expiresAt: nowIso(),
          url: "https://storage.local/document.pdf",
        },
      });
    }

    return fulfillJson(route, 404, {
      error: {
        code: "NOT_FOUND",
        message: `Unhandled mock route ${method} ${pathname}`,
      },
    });
  });
  return state;
}

function buildPdfFixture(name: string) {
  return {
    buffer: Buffer.from("%PDF-1.4\n% M4.5 fixture\n"),
    mimeType: "application/pdf",
    name,
  };
}

function buildLearningPath() {
  return {
    chapters: [
      {
        id: "chapter-math-7-1",
        learningPathId,
        lessons: [
          buildLesson(lessonOneId, 1, "Bài học 1: Số hữu tỉ"),
          buildLesson(lessonTwoId, 2, "Bài học 2: Lũy thừa"),
        ],
        objectivesJson: { text: "Nắm chắc kiến thức trọng tâm" },
        orderIndex: 1,
        overview: "Số hữu tỉ và lũy thừa",
        status: "PUBLISHED",
        title: "Chương 1: Số hữu tỉ",
      },
    ],
    descriptionJson: { text: "Khóa học Toán 7" },
    enrolledStudentCount: 36,
    grade: 7,
    id: learningPathId,
    originalPriceVnd: 1_200_000,
    salePriceVnd: 900_000,
    slug: "toan-7",
    sortOrder: 1,
    status: "PUBLISHED",
    subject: "MATH",
    thumbnailFile: null,
    thumbnailFileId: null,
    title: "Toán 7",
    totalChapterCount: 1,
    totalLessonCount: 2,
    updatedAt: nowIso(),
  };
}

function buildLesson(id: string, orderIndex: number, title: string) {
  return {
    chapterId: "chapter-math-7-1",
    completionMinScore: 7,
    examOpenAt: null as string | null,
    id,
    orderIndex,
    scheduledAt: null as string | null,
    shortDescription: null as string | null,
    status: "PUBLISHED",
    title,
    trialEnabled: false,
    videoUrl: null as string | null,
  };
}

function buildSourceDocument(
  fileId = "source-file-1",
  title = "Toán 7 Tập 1",
  options: { id?: string; status?: string; warningPageCount?: number } = {},
) {
  const status = options.status ?? "READY";
  const id = options.id ?? "source-doc-1";
  const warningPageCount = options.warningPageCount ?? 0;
  const readinessStatus =
    status === "FAILED"
      ? "FAILED"
      : status !== "READY"
        ? "PROCESSING"
        : warningPageCount > 0
          ? "NEEDS_CONFIRMATION"
          : "READY";

  return {
    contentHash: "hash-source",
    createdAt: nowIso(),
    deletedAt: null,
    file: buildDocumentFile(fileId, "toan-7-tap-1.pdf"),
    fileId,
    id,
    learningPathId,
    metadataJson: {
      qualitySummary: {
        averageScore: 0.96,
      },
    },
    pageCount: 8,
    processedAt: status === "READY" ? nowIso() : null,
    processingJob: buildJob(status === "READY" ? "SUCCEEDED" : "RUNNING"),
    processingJobId: "job-source-1",
    readiness: {
      isEligibleForExtraction: readinessStatus === "READY",
      readyPageCount: status === "READY" ? 8 : 0,
      status: readinessStatus,
      totalPageRecords: status === "READY" ? 8 : 0,
      warningPageCount,
    },
    status,
    title,
    updatedAt: nowIso(),
  };
}

function buildSourcePages(options: { warningPageNumber?: number } = {}) {
  return Array.from({ length: 8 }, (_, index) => {
    const pageNumber = index + 1;

    return {
      createdAt: nowIso(),
      extractError: null,
      id: `source-page-${pageNumber}`,
      metadataJson: {
        hasVisualAssets: pageNumber === 3,
        printedPage: {
          confidence: 0.92,
          pdfPageNumber: pageNumber,
          printedPageLabel: String(pageNumber),
          printedPageNumber: pageNumber,
          source: "admin_verified",
          warning: options.warningPageNumber === pageNumber ? "ambiguous" : null,
        },
        visualAssetCount: pageNumber === 3 ? 1 : 0,
      },
      pageNumber,
      qualityScore: 0.96,
      sourceDocumentId: "source-doc-1",
      status: "READY",
      textPreview: `Nội dung trang ${pageNumber} của sách Toán 7.`,
      textSource: "paid_ocr",
      thumbnailFile: null,
      thumbnailFileId: null,
      updatedAt: nowIso(),
    };
  });
}

function buildLessonFromPayload(id: string, body: LessonMutationPayload) {
  return {
    chapterId: "chapter-math-7-1",
    completionMinScore: body.completionMinScore ?? 7,
    examOpenAt: body.examOpenAt ?? null,
    id,
    orderIndex: body.orderIndex ?? 1,
    scheduledAt: body.scheduledAt ?? null,
    shortDescription: body.shortDescription ?? null,
    status: body.status ?? "DRAFT",
    title: body.title ?? "Bài học",
    trialEnabled: body.trialEnabled ?? false,
    videoUrl: body.videoUrl ?? null,
  };
}

function addLessonToLearningPath(
  learningPath: ReturnType<typeof buildLearningPath>,
  lesson: ReturnType<typeof buildLesson>,
) {
  return {
    ...learningPath,
    chapters: learningPath.chapters.map((chapter) =>
      chapter.id === lesson.chapterId
        ? {
            ...chapter,
            lessons: [...chapter.lessons, lesson].sort(
              (left, right) => left.orderIndex - right.orderIndex,
            ),
          }
        : chapter,
    ),
    totalLessonCount: learningPath.totalLessonCount + 1,
  };
}

function updateLessonInLearningPath(
  learningPath: ReturnType<typeof buildLearningPath>,
  lessonId: string,
  body: LessonMutationPayload,
) {
  return {
    ...learningPath,
    chapters: learningPath.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((lesson) =>
        lesson.id === lessonId
          ? {
              ...lesson,
              completionMinScore: body.completionMinScore ?? lesson.completionMinScore,
              examOpenAt:
                body.examOpenAt === undefined ? lesson.examOpenAt : body.examOpenAt,
              orderIndex: body.orderIndex ?? lesson.orderIndex,
              scheduledAt:
                body.scheduledAt === undefined ? lesson.scheduledAt : body.scheduledAt,
              shortDescription:
                body.shortDescription === undefined
                  ? lesson.shortDescription
                  : body.shortDescription,
              status: body.status ?? lesson.status,
              title: body.title ?? lesson.title,
              trialEnabled: body.trialEnabled ?? lesson.trialEnabled,
              videoUrl: body.videoUrl === undefined ? lesson.videoUrl : body.videoUrl,
            }
          : lesson,
      ),
    })),
  };
}

function syncSourceLessonDocuments(
  documents: Array<ReturnType<typeof buildLessonDocument>>,
  lessonId: string,
  ranges: NonNullable<LessonMutationPayload["sourceDocumentExtractions"]>,
) {
  return [
    ...documents.filter(
      (document) =>
        document.lessonId !== lessonId ||
        document.sourceDocumentId === null ||
        document.kind !== "PRIMARY_FROM_SOURCE",
    ),
    ...ranges.map((range, index) =>
      buildLessonDocument({
        id: `primary-from-editor-${lessonId}-${index + 1}`,
        kind: "PRIMARY_FROM_SOURCE",
        lessonId,
        metadataJson: {
          pageEnd: range.pageEnd,
          pageStart: range.pageStart,
          source: "source_document_page_range",
        },
        sortOrder: range.sortOrder ?? index,
        sourceDocumentId: range.sourceDocumentId,
        title: "Toán 7 Tập 1",
      }),
    ),
  ];
}

function buildMappedLessonDocuments() {
  return [
    buildLessonDocument({
      id: "primary-from-source-1",
      kind: "PRIMARY_FROM_SOURCE",
      lessonId: lessonOneId,
      metadataJson: {
        pageEnd: 4,
        pageStart: 1,
        source: "source_document_page_range",
      },
      sourceDocumentId: "source-doc-1",
      title: "Toán 7 Tập 1",
    }),
    buildLessonDocument({
      id: "primary-from-source-2",
      kind: "PRIMARY_FROM_SOURCE",
      lessonId: lessonTwoId,
      metadataJson: {
        pageEnd: 8,
        pageStart: 5,
        source: "source_document_page_range",
      },
      sourceDocumentId: "source-doc-1",
      title: "Toán 7 Tập 1",
    }),
  ];
}

function buildLessonDocument({
  fileId,
  id,
  kind,
  lessonId,
  metadataJson = {},
  sortOrder = 0,
  sourceDocumentId,
  storageOnly = false,
  title,
}: {
  fileId?: string;
  id: string;
  kind: string;
  lessonId: string;
  metadataJson?: Record<string, unknown>;
  sortOrder?: number;
  sourceDocumentId: string | null;
  storageOnly?: boolean;
  title: string;
}) {
  const resolvedFileId = fileId ?? `${id}-file`;
  const isExtraction =
    sourceDocumentId !== null &&
    metadataJson.source === "source_document_page_range";
  const pageRangeId = isExtraction ? `${id}-range` : null;
  const pageStart =
    typeof metadataJson.pageStart === "number" ? metadataJson.pageStart : 1;
  const pageEnd =
    typeof metadataJson.pageEnd === "number" ? metadataJson.pageEnd : pageStart;

  return {
    chunkCount: storageOnly ? 0 : kind === "SUPPLEMENT" ? 3 : 12,
    contentHash: `hash-${id}`,
    createdAt: nowIso(),
    embeddingDimensions: null,
    embeddingModel: null,
    embeddingProvider: null,
    extractError: null,
    file: buildDocumentFile(resolvedFileId, `${id}.pdf`),
    fileId: resolvedFileId,
    id,
    kind,
    lessonId,
    metadataJson,
    pageRange: pageRangeId
      ? {
          createdAt: nowIso(),
          createdById: "admin-user",
          id: pageRangeId,
          lessonId,
          metadataJson: {},
          pageEnd,
          pageStart,
          sourceDocumentId,
          updatedAt: nowIso(),
        }
      : null,
    pageRangeId,
    processedAt: nowIso(),
    processingJob: storageOnly ? null : buildJob("SUCCEEDED"),
    processingJobId: storageOnly ? null : `${id}-job`,
    replacedAt: null,
    sourceDocument: sourceDocumentId
      ? {
          id: sourceDocumentId,
          learningPathId,
          pageCount: 8,
          status: "READY",
          title: "Toán 7 Tập 1",
        }
      : null,
    sourceDocumentId,
    sortOrder,
    status: "READY",
    title,
    updatedAt: nowIso(),
  };
}

function buildDocumentFile(id: string, originalName: string) {
  return {
    checksum: `checksum-${id}`,
    createdAt: nowIso(),
    id,
    mimeType: "application/pdf",
    originalName,
    provider: "MINIO_LOCAL",
    publicUrl: null,
    purpose: "LESSON_DOCUMENT",
    sizeBytes: 1_048_576,
    status: "UPLOADED",
    updatedAt: nowIso(),
    uploadedById: "admin-user",
    visibility: "PRIVATE",
  };
}

function buildJob(status: string) {
  return {
    createdAt: nowIso(),
    error: null,
    finishedAt: status === "SUCCEEDED" ? nowIso() : null,
    jobId: `job-${status.toLowerCase()}`,
    queue: "DOCUMENT_PROCESSING",
    resourceId: "resource-id",
    resourceType: "LESSON_DOCUMENT",
    status,
    updatedAt: nowIso(),
  };
}

function fulfillJson(route: Route, status: number, body: unknown) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status,
  });
}

function createUnsignedToken(payload: Record<string, unknown>) {
  return [
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

function nowIso() {
  return "2026-07-19T03:16:00.000Z";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function expectNoHorizontalOverflow(page: Page) {
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

async function expectDialogFitsViewport(page: Page, dialog: Locator) {
  const [dialogBox, viewport] = await Promise.all([
    dialog.boundingBox(),
    page.viewportSize(),
  ]);

  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox?.x ?? -1).toBeGreaterThanOrEqual(0);
  expect(dialogBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(
    (viewport?.width ?? 0) + 1,
  );
  expect((dialogBox?.y ?? 0) + (dialogBox?.height ?? 0)).toBeLessThanOrEqual(
    (viewport?.height ?? 0) + 1,
  );
}

async function expectThemeTokensApplied(page: Page, themeMode: "dark" | "light") {
  const tokens = await page.evaluate(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      background: rootStyle.getPropertyValue("--theme-bg").trim(),
      surface: rootStyle.getPropertyValue("--theme-surface").trim(),
      text: rootStyle.getPropertyValue("--theme-text-strong").trim(),
    };
  });

  if (themeMode === "dark") {
    expect(tokens.background).toBe("#020617");
    expect(tokens.surface).toBe("#0f172a");
    expect(tokens.text).toBe("#f8fafc");
    return;
  }

  expect(tokens.background).toBe("#f8fafc");
  expect(["#fff", "#ffffff"]).toContain(tokens.surface);
  expect(tokens.text).toBe("#020617");
}

async function expectElementAboveDialogFooter(dialog: Locator, target: Locator) {
  await target.evaluate((element) => {
    element.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await expect(target).toBeVisible();

  const [targetBox, footerBox] = await Promise.all([
    target.boundingBox(),
    dialog.locator(".theme-dialog-footer").boundingBox(),
  ]);

  expect(targetBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect((targetBox?.y ?? 0) + (targetBox?.height ?? 0)).toBeLessThanOrEqual(
    (footerBox?.y ?? 0) - 1,
  );
}

async function expectVerticallyCentered(
  referenceControl: Locator,
  actionButton: Locator,
) {
  const [referenceBox, actionBox] = await Promise.all([
    referenceControl.boundingBox(),
    actionButton.boundingBox(),
  ]);

  expect(referenceBox).not.toBeNull();
  expect(actionBox).not.toBeNull();

  const referenceCenter = (referenceBox?.y ?? 0) + (referenceBox?.height ?? 0) / 2;
  const actionCenter = (actionBox?.y ?? 0) + (actionBox?.height ?? 0) / 2;
  expect(Math.abs(referenceCenter - actionCenter)).toBeLessThanOrEqual(1);
}

async function captureM45Screenshot(page: Page, projectName: string, stateName: string) {
  if (!shouldCaptureScreenshots) {
    return;
  }

  const device = projectName.includes("mobile")
    ? "mobile"
    : projectName.includes("tablet")
      ? "ipad"
      : "laptop";
  const outputDir = path.join(screenshotRoot, device, "admin", "courses", "[id]", "m4-5");

  await mkdir(outputDir, { recursive: true });
  await page.addStyleTag({
    content: `
      nextjs-portal,
      [data-nextjs-dev-overlay],
      [data-nextjs-devtools],
      [data-nextjs-toast] {
        display: none !important;
        visibility: hidden !important;
      }
    `,
  });
  await page.evaluate(() => window.scrollTo({ left: 0, top: 0 }));
  await page.waitForTimeout(100);
  await page.screenshot({
    fullPage: true,
    path: path.join(outputDir, `${stateName}.png`),
  });
}
