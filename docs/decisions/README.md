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

| ADR                                          | Status   | Tóm tắt                                                                                                      |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `ADR-0001-codex-context-docs.md`             | Accepted | Thêm bộ context/coverage/decision docs nhẹ để Codex làm việc nhanh hơn                                       |
| `ADR-0002-source-code-structure-contract.md` | Accepted | Chốt contract tổ chức source code front-end/back-end để tránh gom file, duplicate UI pattern và module phẳng |
