# Changelog 2026-07-20

## feat(M4.5): admin lesson document upload UI/status — `ddd6909`

### UI (apps/web)

- **Source document panel** tại course detail: upload/thay PDF nguồn, xem tổng trang, trang đã đọc, buổi đã gán, chất lượng OCR trung bình.
- **Source document page preview**: hiển thị 6 trang đầu với printed page mapping, text preview, extract error.
- **Modal nhập khoảng trang** (bulk): danh sách lesson, `fromPage`/`toPage` mỗi dòng, autofill, validation overlap/gap, warning trùng/bỏ sót, action upload thay/bổ sung từng lesson.
- **Modal tạo/sửa lesson**: section khoảng trang tùy chọn khi course có source document, disabled khi source chưa READY/còn warning; section tài liệu tham khảo storage-only với dòng thêm động.
- **Per-lesson actions**: thay tài liệu chính, upload tài liệu bổ sung, xóa tài liệu bổ sung.
- **Document status badge**, processing job status, empty/loading/error states.
- Hook `useAdminCourseDocumentsManager` quản lý toàn bộ state tài liệu: source documents, pages, lesson documents, range draft, validation, mutations.
- API client `admin-course-documents-api.ts` và types `admin-course-document-types.ts`.
- Utils `admin-course-documents-utils.ts`: range validation, warnings, stats, readiness check.

### API (apps/api)

- **Source document retry**: `POST /admin/source-documents/:id/process` cho phép xử lý lại.
- **Aggregate lesson documents**: `GET /admin/learning-paths/:id/lesson-documents` trả tất cả lesson documents của lộ trình, tránh N+1.
- **Lesson create/update** nhận `sourceDocumentPageRange` tùy chọn; backend reject nếu source chưa READY hoặc page có warning.
- **Supplemental storage-only**: `processingMode = STORAGE_ONLY` cho tài liệu tham khảo không OCR/chunk.
- Document helpers: `isSourceDocumentReadyForRangeMapping`, `validatePageRangeForSource`.

### Tests

- Mở rộng `m4.2-document-api.int.test.ts`: test retry, aggregate, storage-only, page range readiness validation.
- Playwright E2E `admin-documents-m4-5.spec.ts` cho document flows.

### Docs

- Cập nhật `docs/02-user-flows.md`, `docs/06-ai-rag-spec.md`, `docs/08-ui-pages-and-components.md`, `docs/api/learning-paths-lessons.md`, `docs/database/files-documents.md`.
- Cập nhật implementation: M3, M4, M6, M9, feature-coverage-matrix.
- Cập nhật `approved-patterns.md`, `code-patterns/uploads.md`.

### Tooling

- `.codex/skills/design/` skill cho thiết kế UI mockups.
- `.codex/scripts/capture-final-screen-ui.mjs` script chụp screenshot responsive.
- `.gitignore`: thêm `apps/api/test/*.pdf` (PDF test lớn không commit).

## fix(M4.3): OCR mathpix extraction and local image replacement

- Sửa lỗi tách trang OCR (Mathpix không tự sinh `\newpage` trong file `.mmd`) bằng cách dùng `text_display` từ `lines.json` để gom từng trang chuẩn xác, đảm bảo ảnh và công thức không bị dồn hết về trang 1.
- Cấu hình MinIO bucket `learning-path-dev` cho phép Public Read để render ảnh mà không cần token tạm thời.
- Bổ sung logic `replaceMathpixImageUrls` vào `document-processing.processor.ts` để tự động thay thế toàn bộ URL CDN của Mathpix (`cdn.mathpix.com`) sang URL của MinIO (`http://localhost:9000/...`) nội bộ trước khi lưu vào database, loại bỏ rủi ro hết hạn CDN link.
- Cập nhật biến môi trường `.env` (`FILE_PUBLIC_BASE_URL`).

## fix(M4.3): OCR preview formatting and inline math rendering

- Sửa lỗi hiển thị đứt gãy câu chữ, công thức toán bị ép xuống dòng vô cớ:
  - Backend: Cập nhật `ocr-artifact-normalizer.ts` để lọc bỏ các block phụ trợ (`conversionOutput === false`) tránh lặp nội dung bảng biểu. Đồng thời nối các dòng bằng `.join("")` (thay vì `\n`) để tôn trọng khoảng trắng và cấu trúc dòng gốc do Mathpix sinh ra.
  - Frontend: Ghi đè CSS `.mmd-content svg { display: inline; }` để loại bỏ ảnh hưởng từ bộ reset của TailwindCSS (vốn ép tất cả SVG thành `display: block`), giúp các công thức toán nội tuyến (inline math) hiển thị hoàn hảo trên cùng một dòng.
