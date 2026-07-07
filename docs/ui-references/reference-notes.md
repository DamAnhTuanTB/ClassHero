# UI References

Thư mục này dùng để lưu ảnh hoặc ghi chú reference UI cho Codex. Khi thêm ảnh, đặt tên rõ theo màn hình hoặc kiểu UI.

Pattern UI đã được owner xác nhận là đúng ý phải ghi vào `docs/ui-references/approved-patterns.md`.

Ví dụ:

```txt
docs/ui-references/
├── reference-01-student-dashboard.png
├── reference-02-lesson-page.png
├── reference-03-admin-table.png
└── reference-notes.md
```

## Cách ghi chú reference

Với mỗi ảnh, ghi rõ:

- Thích gì.
- Không thích gì.
- Áp dụng cho màn hình/role nào.
- Không áp dụng cho màn hình/role nào nếu cần.

## Template

```md
## reference-01-student-dashboard.png

Áp dụng cho: student dashboard, course progress card.

Thích:
- Card spacing thoáng.
- CTA rõ.
- Progress dễ nhìn.

Không thích:
- Gradient quá mạnh.
- Icon quá nhiều.
- Text phụ quá nhỏ trên mobile.
```

## Reference mặc định khi chưa có ảnh

- Ưu tiên layout sáng, sạch, có hierarchy rõ.
- Mobile-first, nhưng tablet/iPad và laptop/desktop vẫn phải được kiểm tra.
- Admin/parent gọn và tin cậy; student/public có thể sinh động hơn.
