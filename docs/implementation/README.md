# Implementation Milestone Details

Thư mục này chứa chi tiết phạm vi, `Không làm` và `Done khi` cho từng milestone.

Mỗi subtask có dòng `Mode` để Codex biết bề mặt triển khai chính:

```txt
Mode: UI only
Mode: API only
Mode: UI + API
Mode: DB only
Mode: Worker/Integration
Mode: Docs only
```

Quy tắc đọc:

- Xác định mã task trong `docs/09-implementation-plan.md`.
- Mở đúng file milestone ở đây. Ví dụ `M8.3` thì đọc `docs/implementation/M8.md`.
- Đọc dòng `Mode` của subtask trước khi chọn `/task-ui`, `/task-connect` hoặc `/task-full`.
- Không cần đọc toàn bộ thư mục nếu task chỉ thuộc một milestone.
- Nếu task chạm nhiều domain, đọc thêm docs liên quan theo `Task Routing Map` trong `AGENTS.md`.

Mapping nhanh:

| Task | File cần đọc |
| --- | --- |
| `M0.P`, `M0.x` | `docs/implementation/M0.md` |
| `M1.x` | `docs/implementation/M1.md` |
| `M2.x` | `docs/implementation/M2.md` |
| `M3.x` | `docs/implementation/M3.md` |
| `M4.x` | `docs/implementation/M4.md` |
| `M5.x` | `docs/implementation/M5.md` |
| `M6.x` | `docs/implementation/M6.md` |
| `M7.x` | `docs/implementation/M7.md` |
| `M8.x` | `docs/implementation/M8.md` |
| `M9.x` | `docs/implementation/M9.md` |
| `M10.x` | `docs/implementation/M10.md` |
| `M11.x` | `docs/implementation/M11.md` |
| `M12.x` | `docs/implementation/M12.md` |
| `M13.x` | `docs/implementation/M13.md` |
| `M14.x` | `docs/implementation/M14.md` |
