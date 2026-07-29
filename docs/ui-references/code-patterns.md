# UI Code Patterns

File này là index điều hướng nhanh cho các pattern code UI chuẩn. Pattern chi tiết nằm trong thư mục `docs/ui-references/code-patterns/`.

Khác với `approved-patterns.md` lưu gu visual/UX đã được owner chốt, nhóm file này mô tả cách code nên được viết để tránh lặp lại lỗi implementation.

Codex phải cập nhật index này và file con phù hợp khi owner nói UI đã "ưng", "ok", "đúng ý", "chốt UI này" hoặc tương đương và UI đó tạo ra hoặc chuẩn hóa một cách code có thể dùng lại. Visual/UX được ghi ở `approved-patterns.md`; implementation pattern, snippet, checklist và anti-pattern được ghi ở file con tương ứng.

Khi có nhiều pattern phù hợp, ưu tiên theo thứ tự:

1. Shared primitive trong `apps/web/components`.
2. Form/component tương tự trong cùng feature đang chạy ổn.
3. Pattern đã được owner chốt trong `docs/ui-references/approved-patterns.md`.
4. Pattern trong các file con của thư mục này.

Nếu không tìm thấy pattern phù hợp, Codex phải ghi rõ assumption trong plan/final trước khi tự tạo biến thể mới.

## 0. Cách Đọc Nhanh

Codex không đọc toàn bộ thư mục pattern cho mọi task. Quy trình bắt buộc:

1. Đọc phần mở đầu và bảng routing trong file index này.
2. Xác định task đang chạm loại UI/code flow nào.
3. Mở đúng file con và section pattern tương ứng.
4. Nếu task chạm nhiều loại UI, đọc từng file/section liên quan; không đọc file không liên quan.
5. Khi thêm pattern mới, phải cập nhật bảng routing này để lần sau định tuyến nhanh được.

| Tín hiệu trong task/code                         | File/section phải đọc                                                                                                    | Đọc thêm khi nào                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Modal/drawer tạo hoặc sửa entity                 | `docs/ui-references/code-patterns/forms.md#1-react-hook-form-modal-form`                                                  | Section `2`, `3`, `4` trong cùng file nếu có field liên quan |
| Text input bắt buộc                              | `docs/ui-references/code-patterns/forms.md#2-required-text-validation`                                                    | Section `1` nếu field nằm trong modal/form RHF          |
| Số thứ tự, tiền, phần trăm, số lượng             | `docs/ui-references/code-patterns/forms.md#3-numeric-text-field`                                                         | Section `1` nếu field nằm trong React Hook Form         |
| Select/dropdown trong form                       | `docs/ui-references/code-patterns/forms.md#4-option-field`                                                               | Section `1` nếu select thuộc form validation            |
| Select/dropdown filter hoặc trigger mobile bị đóng rồi mở lại | `docs/ui-references/code-patterns/forms.md#5-mobile-safe-select-trigger`                                                  | Section `4` nếu select thuộc form validation            |
| Field có panel công cụ phụ mở/đóng và icon action đứng cạnh panel | `docs/ui-references/code-patterns/forms.md#6-helper-panel-action-ownership`                                                | Action button section nếu icon có semantic riêng        |
| Màn detail nhiều field metadata                  | `docs/ui-references/code-patterns/detail-layouts.md#1-detail-field-grid`                                                  | Section `2` và action/status file nếu có ảnh/status     |
| Summary/detail có ảnh trái, thông tin phải       | `docs/ui-references/code-patterns/detail-layouts.md#2-media-left-details-right-description-full-width`                    | Section `1` nếu metadata nằm trong grid                 |
| Badge trạng thái publish/draft/archived          | `docs/ui-references/code-patterns/actions-and-badges.md#1-status-badge`                                                   | Mapping status chung trong code nếu label/màu thay đổi  |
| Button icon sửa/xóa/tải lại/thêm                 | `docs/ui-references/code-patterns/actions-and-badges.md#2-icon-action-button`                                             | Shared button/action component nếu màn đã có            |
| Modal xác nhận xóa/destructive                   | `docs/ui-references/code-patterns/actions-and-badges.md#3-destructive-confirm-dialog`                                     | Form file nếu modal có form nhập xác nhận               |
| Admin CRUD master-detail phân cấp                | `docs/ui-references/code-patterns/admin-crud.md#1-admin-master-detail-crud`                                               | Detail/layout/action/state files nếu có panel con       |
| Admin panel cha-con có reorder/action            | `docs/ui-references/code-patterns/admin-crud.md#2-parent-child-structure-manager`                                         | Action/status file nếu có reorder, delete, selected     |
| Admin thùng rác/lưu trữ hoặc bulk action         | `docs/ui-references/code-patterns/admin-crud.md#3-archive-bulk-action-dialog`                                             | Destructive confirm file nếu có xóa vĩnh viễn           |
| Upload ảnh/file hoặc preview                     | `docs/ui-references/code-patterns/uploads.md#1-upload-preview`                                                           | Forms file nếu upload nằm trong form/modal              |
| Upload source document và gán page range cho entity con | `docs/ui-references/code-patterns/uploads.md#2-source-document-page-mapping-upload`                                      | Admin CRUD section `2`, action/status/state files       |
| Loading, empty, error, disabled/pending hoặc animated connection state | `docs/ui-references/code-patterns/states.md`                                                       | Query/mutation hook hiện có nếu state đến từ API        |
| Student learning shell, course browsing, filter/search, card/progress/CTA | `docs/ui-references/code-patterns/student-learning-surfaces.md#1-student-learning-shell-and-navigation`                  | Section `2`, `3`, `4` trong cùng file nếu có list/card/filter |
| Student course/detail summary, progress CTA, curriculum accordion/timeline | `docs/ui-references/code-patterns/student-learning-surfaces.md#5-student-course-detail-summary-and-progress`             | Section `6`, `7`, `8` trong cùng file nếu có lesson timeline/trial/locked states |
| Lesson practice panel, Quiz/Flashcard runner hoặc result toàn màn hình | `docs/ui-references/code-patterns/student-learning-surfaces.md#9-lesson-practice-entry-and-fullscreen-runner` | Đọc state/performance docs nếu có resume, submit hoặc API mutation |
