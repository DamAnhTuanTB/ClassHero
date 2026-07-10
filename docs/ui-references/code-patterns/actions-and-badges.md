# Action And Badge Code Patterns

Dùng file này cho status badge và icon action button.

## 1. Status Badge

Dùng cho trạng thái publish/hidden/draft/archived.

### Pattern chuẩn

```tsx
<StatusBadge status={entity.status} />
```

### Không làm

- Không viết lại badge status cục bộ với màu/label khác.
- Không đổi label status ở một màn mà không cập nhật mapping chung.

## 2. Icon Action Button

Dùng cho action sửa/xóa/tải lại/thêm trong admin.

### Pattern chuẩn

```tsx
<button
  type="button"
  aria-label="Sửa lộ trình"
  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-100 text-sky-700 transition hover:bg-sky-50"
  onClick={onEdit}
>
  <Pencil className="h-4 w-4" aria-hidden="true" />
</button>
```

### Không làm

- Không dùng icon button thiếu `aria-label`.
- Không dùng màu hành động trái nghĩa: xóa phải đỏ, sửa/xem chi tiết dùng xanh/trung tính.
