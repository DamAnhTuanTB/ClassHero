# Detail Layout Code Patterns

Dùng file này cho màn detail/admin summary có nhiều field metadata, ảnh đại diện và mô tả.

## 1. Detail Field Grid

Dùng cho màn detail admin hiển thị nhiều field thông tin.

### Pattern chuẩn

```tsx
<div className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-border)]">
  <div className="grid gap-px sm:grid-cols-2 xl:grid-cols-3">
    <div className="bg-[var(--theme-surface)] p-3">
      <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[var(--theme-text-muted)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
        Nhãn field
      </div>
      <p className="mt-1.5 text-sm font-extrabold text-[var(--theme-text-strong)]">
        Giá trị
      </p>
    </div>
  </div>
</div>
```

### Không làm

- Không tách một field thành card hero riêng nếu owner yêu cầu field bình thường.
- Không dùng card lồng card cho detail field grid.
- Không kéo font hero vào field nhỏ.

## 2. Media Left, Details Right, Description Full Width

Dùng cho summary/detail có ảnh đại diện và nhiều field metadata.

### Pattern chuẩn

```tsx
<section className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 sm:p-5">
  <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
    <MediaPreview />
    <DetailFieldGrid />
  </div>

  <div className="mt-4 border-t border-[var(--theme-border)] pt-4">
    <SectionLabel icon={FileText}>Mô tả</SectionLabel>
    <p className="mt-1.5 text-sm leading-6 text-[var(--theme-text)]">
      {description}
    </p>
  </div>
</section>
```

### Không làm

- Không để description chen vào grid metadata nếu owner yêu cầu full width.
- Không để price/card/media làm layout bị phình hoặc lệch hàng metadata.
- Không dùng màu `slate-*` trực tiếp cho admin detail đã có light/dark theme token; dùng `theme-*` class hoặc `var(--theme-*)`.
