# Decision Log

Thư mục này lưu các quyết định quan trọng để Codex và owner hiểu vì sao dự án đi theo hướng hiện tại.

Decision log dùng cho quyết định có ảnh hưởng lâu dài như:

- Kiến trúc hoặc stack.
- Cách chia task/workflow.
- Quy tắc UI áp dụng rộng.
- Thay đổi lớn về scope MVP.
- Tích hợp bên thứ ba có ràng buộc kỹ thuật/nghiệp vụ.

Không cần tạo decision record cho chỉnh sửa nhỏ, bug fix nhỏ hoặc wording docs.

## Format

Mỗi quyết định dùng file:

```txt
ADR-0001-ten-ngan-gon.md
ADR-0002-ten-ngan-gon.md
```

Template:

```md
# ADR-000X - Tên quyết định

Date: YYYY-MM-DD
Status: Accepted | Superseded | Superseded in part | Proposed

## Context

Vấn đề cần quyết định.

## Decision

Quyết định đã chốt.

## Consequences

Hệ quả tốt/xấu/cần lưu ý.
```

## Danh sách quyết định

| ADR                                               | Status             | Tóm tắt                                                                                                      |
| ------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `ADR-0001-codex-context-docs.md`                  | Accepted           | Thêm bộ context/coverage/decision docs nhẹ để Codex làm việc nhanh hơn                                       |
| `ADR-0002-source-code-structure-contract.md`      | Accepted           | Chốt contract tổ chức source code front-end/back-end để tránh gom file, duplicate UI pattern và module phẳng |
| `ADR-0003-local-dev-file-storage.md`              | Accepted           | Chọn MinIO local/dev làm object storage S3-compatible, giữ Cloudflare R2 cho staging/production              |
| `ADR-0004-learning-path-chapters.md`              | Superseded         | Từng bắt buộc lộ trình đi qua chapter; đã được ADR-0012 thay thế                                             |
| `ADR-0005-source-document-page-mapping.md`        | Accepted           | Chốt flow upload tài liệu nguồn dài, gán page range theo lesson và tách tài liệu gốc/bổ sung                 |
| `ADR-0006-free-pdf-ocr-pipeline.md`               | Superseded         | Từng chọn `pdf-parse` + OCRmyPDF/Tesseract làm pipeline OCR miễn phí; đã bị ADR-0007 thay thế                |
| `ADR-0007-paid-ocr-first-document-ingestion.md`   | Accepted           | Chọn paid OCR-first bằng Mathpix cho tài liệu học chính, cache artifact theo content hash để tránh gọi lại   |
| `ADR-0008-future-features-from-ocr-artifacts.md`  | Accepted           | Chốt các feature tương lai được phép tận dụng OCR artifact nhưng không mở rộng scope MVP hiện tại            |
| `ADR-0009-lesson-document-kind-taxonomy.md`       | Accepted           | Chốt duy nhất ba lesson document kind và coi thay thế tài liệu nền tảng là action, không phải kind           |
| `ADR-0010-personalized-learning-path-fork.md`     | Accepted           | Chốt bản lộ trình cá nhân là private fork của khóa đã mua, thuộc đúng một enrollment                         |
| `ADR-0011-client-side-quiz-feedback.md`           | Accepted           | Quiz trả grading data khi mở, chấm local tức thì và batch submit để ưu tiên tốc độ trải nghiệm               |
| `ADR-0012-optional-learning-path-chapters.md`     | Accepted           | Cho phép lesson thuộc trực tiếp learning path; chapter trở thành lớp nhóm tùy chọn                           |
| `ADR-0013-provider-operations-accounting.md`      | Accepted           | Version hóa bảng giá, snapshot usage AI/OCR, routing fallback và retry Mathpix không double-charge           |
| `ADR-0014-atomic-provider-budget-reservation.md`  | Accepted           | Giữ chỗ ngân sách nguyên tử trước paid call để hard-stop không vượt giới hạn                                 |
| `ADR-0015-stem-figure-fragment-only-source.md`    | Accepted           | AI sinh figure snippet có local header allowlist; backend sở hữu TeX compiler envelope/package/toolbox scope |
| `ADR-0016-searchable-pdf-multimodal-summary.md`   | Accepted           | Summary dùng searchable PDF packet bất biến; Stage 2 nhận ảnh tham chiếu và chỉ auto-repair compiler failure |
| `ADR-0017-source-neutral-figure-intent.md`        | Superseded         | Từng tách semantic intent khỏi source target; đã được ADR-0018 thay thế                                      |
| `ADR-0018-remove-visual-intent-hard-cutover.md`   | Accepted           | Xóa visual intent; Stage 2 dùng ảnh + block projection và runtime chỉ nhận figure plan v3                    |
| `ADR-0019-local-stem-figure-raster-cleanup.md`    | Accepted           | Chỉnh nhẹ raster SGK bằng Canvas + Sharp, revision lossless; không AI inpainting                             |
| `ADR-0020-quiz-owned-generation-core.md`          | Accepted           | Tách hard-cutover Quiz khỏi toàn bộ core Sinh kiến thức; chỉ dùng chung hạ tầng AI trung lập                 |
| `ADR-0021-quiz-solution-figure-redraw-mode.md`    | Superseded         | Contract mode hình lời giải cũ; đã được ADR-0024 thay thế                                                    |
| `ADR-0022-subject-isolated-ai-system-prompts.md`  | Superseded in part | Prompt vẫn tách theo môn; phần hình lời giải dùng chung theo ADR-0027                                        |
| `ADR-0023-phase-specific-ai-model-routing.md`     | Accepted           | Tách route model TEXT/IMAGE theo từng Summary/Quiz/Flashcard/Test và snapshot độc lập theo phase             |
| `ADR-0024-independent-quiz-solution-figure.md`    | Accepted           | Phase 1 chỉ có hai boolean; hình đề và hình lời giải độc lập, SOLUTION dựng mới từ solution > problem        |
| `ADR-0025-independent-summary-solution-figure.md` | Superseded in part | Summary giữ resource/runtime riêng; prompt/schema/builder SOLUTION chuyển sang core chung                    |
| `ADR-0026-flashcard-solution-figure-only.md`      | Superseded in part | Flashcard chỉ tạo SOLUTION; prompt/schema/builder chuyển sang core chung                                     |
| `ADR-0027-shared-solution-figure-core.md`         | Accepted           | Summary, Quiz và Flashcard dùng chung prompt/schema/builder tạo hình lời giải theo môn                       |
| `ADR-0028-shared-question-figure-core.md`         | Accepted           | Summary và Quiz dùng chung prompt/schema/builder problem-only cho hình đề không có ảnh nguồn                 |
