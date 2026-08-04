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
Status: Accepted | Superseded | Proposed

## Context

Vấn đề cần quyết định.

## Decision

Quyết định đã chốt.

## Consequences

Hệ quả tốt/xấu/cần lưu ý.
```

## Danh sách quyết định

| ADR                                              | Status     | Tóm tắt                                                                                                      |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `ADR-0001-codex-context-docs.md`                 | Accepted   | Thêm bộ context/coverage/decision docs nhẹ để Codex làm việc nhanh hơn                                       |
| `ADR-0002-source-code-structure-contract.md`     | Accepted   | Chốt contract tổ chức source code front-end/back-end để tránh gom file, duplicate UI pattern và module phẳng |
| `ADR-0003-local-dev-file-storage.md`             | Accepted   | Chọn MinIO local/dev làm object storage S3-compatible, giữ Cloudflare R2 cho staging/production              |
| `ADR-0004-learning-path-chapters.md`             | Superseded | Từng bắt buộc lộ trình đi qua chapter; đã được ADR-0012 thay thế                                              |
| `ADR-0005-source-document-page-mapping.md`       | Accepted   | Chốt flow upload tài liệu nguồn dài, gán page range theo lesson và tách tài liệu gốc/bổ sung                 |
| `ADR-0006-free-pdf-ocr-pipeline.md`              | Superseded | Từng chọn `pdf-parse` + OCRmyPDF/Tesseract làm pipeline OCR miễn phí; đã bị ADR-0007 thay thế                |
| `ADR-0007-paid-ocr-first-document-ingestion.md`  | Accepted   | Chọn paid OCR-first bằng Mathpix cho tài liệu học chính, cache artifact theo content hash để tránh gọi lại   |
| `ADR-0008-future-features-from-ocr-artifacts.md` | Accepted   | Chốt các feature tương lai được phép tận dụng OCR artifact nhưng không mở rộng scope MVP hiện tại            |
| `ADR-0009-lesson-document-kind-taxonomy.md`      | Accepted   | Chốt duy nhất ba lesson document kind và coi thay thế tài liệu nền tảng là action, không phải kind           |
| `ADR-0010-personalized-learning-path-fork.md`    | Accepted   | Chốt bản lộ trình cá nhân là private fork của khóa đã mua, thuộc đúng một enrollment                         |
| `ADR-0011-client-side-quiz-feedback.md`          | Accepted   | Quiz trả grading data khi mở, chấm local tức thì và batch submit để ưu tiên tốc độ trải nghiệm               |
| `ADR-0012-optional-learning-path-chapters.md`    | Accepted   | Cho phép lesson thuộc trực tiếp learning path; chapter trở thành lớp nhóm tùy chọn                            |
| `ADR-0013-provider-operations-accounting.md`    | Accepted   | Version hóa bảng giá, snapshot usage AI/OCR, routing fallback và retry Mathpix không double-charge           |
| `ADR-0014-atomic-provider-budget-reservation.md` | Accepted   | Giữ chỗ ngân sách nguyên tử trước paid call để hard-stop không vượt giới hạn                                 |
