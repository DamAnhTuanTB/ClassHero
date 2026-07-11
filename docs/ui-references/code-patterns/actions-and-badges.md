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
  aria-label={`Sửa ${itemName}`}
  className="theme-button-primary-subtle inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold transition lg:h-10 lg:w-10 lg:px-0"
  onClick={onEdit}
>
  <Pencil className="h-4 w-4" aria-hidden="true" />
  <span className="lg:sr-only">Sửa</span>
</button>
```

### Không làm

- Không dùng icon button thiếu `aria-label`.
- Không dùng màu hành động trái nghĩa: xóa phải đỏ, sửa/xem chi tiết dùng xanh/trung tính.
- Không dùng hard-code màu light-only nếu màn đã có theme token như `theme-button-primary-subtle`, `theme-button-danger-subtle`, `theme-button-success`.

## 3. Destructive Confirm Dialog

Dùng cho xác nhận xóa/xóa vĩnh viễn trong admin.

### Pattern chuẩn

```tsx
<DeleteConfirmDialog
  title="Xóa mục này"
  confirmLabel="Xóa"
  description={`Bạn có thực sự muốn xóa ${itemName} không?`}
  isOpen={isDeleting}
  itemName={itemName}
  onCancel={closeDeleteConfirm}
  onConfirm={confirmDelete}
/>
```

Trong implementation:

- Overlay/shell căn giữa dọc-ngang, `max-h` theo viewport.
- Header có icon cảnh báo, title ngắn và nút `X` căn giữa dọc theo header.
- Body chỉ chứa câu xác nhận ngắn, không nhồi giải thích dài.
- Footer có `Hủy` trung tính và action destructive màu đỏ; text button giữ `whitespace-nowrap`.

### Không làm

- Không xóa trực tiếp từ row/list mà thiếu confirm dialog.
- Không dùng màu primary/xanh cho action destructive.
- Không để confirm dialog thiếu `Hủy` hoặc thiếu nút `X`.
