# Form Code Patterns

Dùng file này cho form, modal/drawer form, text validation, numeric input và select/dropdown thuộc form.

## 1. React Hook Form Modal Form

Dùng cho modal/drawer tạo/sửa có React Hook Form + Zod.

### Pattern chuẩn

```tsx
<EditorDialogShell ariaLabel={title} isOpen={isOpen} onClose={onClose}>
  <form className="flex min-h-0 flex-1 flex-col">
    <header className="theme-dialog-header flex min-h-16 shrink-0 items-center px-4 py-3 pr-20 sm:px-5">
      <h2 className="text-lg font-extrabold text-[var(--theme-text-strong)]">
        {title}
      </h2>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">...</div>
    <footer className="grid shrink-0 grid-cols-2 gap-2 p-3 sm:flex sm:justify-end sm:p-4">
      <Button type="button" variant="outline" className="whitespace-nowrap sm:w-auto" onClick={onClose}>
        Hủy
      </Button>
      <Button type="submit" className="whitespace-nowrap sm:w-auto">
        Lưu
      </Button>
    </footer>
  </form>
</EditorDialogShell>

const form = useForm<FormValues>({
  mode: "onChange",
  reValidateMode: "onChange",
  resolver: zodResolver(schema),
  defaultValues,
});

function openCreateModal() {
  form.reset(defaultValues);
  setIsOpen(true);
}

<TextField
  id="entity-title"
  label="Tên"
  error={form.formState.errors.title}
  {...form.register("title")}
/>
```

### Không làm

- Không để toàn bộ modal/dialog scroll. Chỉ vùng nội dung giữa được `overflow-y-auto`; header/title và footer/action phải luôn visible.
- Không top-align modal trên mobile. Overlay/shell phải dùng căn giữa dọc-ngang (`items-center justify-center`) ở mọi breakpoint; modal dài thì dùng `max-height` và body scroll.
- Không đặt mô tả/subtitle dưới title trong header modal. Header chỉ giữ title ngắn và nút icon `X` để đóng, hoặc control phụ thật cần thiết.
- Không tạo modal thiếu đường thoát rõ ràng. Modal phải có nút action `Hủy` trong footer và nút icon `X` đóng ở header/shell.
- Không để footer modal quá dày. Footer chỉ giữ action, padding gọn; trên mobile một action thì full width, hai action mặc định cùng một hàng hai cột; trên laptop/desktop button co theo nội dung (`max-content`/`w-auto`) và không kéo full width.
- Không bao giờ cho text trong button xuống dòng. Nếu label không vừa, chỉnh grid/flex layout, width, padding, font size hoặc copy ngắn hơn; button vẫn phải giữ `whitespace-nowrap`.
- Không để primary/action button trong modal cùng flow tự lệch màu. Action chính/lưu dùng màu `primary` thống nhất, mặc định `bg-sky-600 hover:bg-sky-700 text-white`; hủy/đóng dùng trung tính và destructive dùng đỏ.
- Không disable nút submit/action trong modal chỉ vì form đang invalid, pristine hoặc field bắt buộc còn trống. Cho nút bấm được để `handleSubmit`/validation hiển thị lỗi inline; chỉ disable khi pending/saving hoặc thiếu prerequisite cứng khiến action không thể chạy.
- Không gọi `form.trigger()` ngay sau `form.reset()` khi mở modal, vì sẽ hiện lỗi ở trạng thái pristine.
- Không tự bọc error bằng `dirtyFields`/`touchedFields` trong từng form nếu chưa có test/logic rõ; nhập rồi xóa về default có thể làm `dirty` quay về false và mất realtime validation.
- Không tự dựng input/select/submit mới nếu `apps/web/components/forms` đã có primitive phù hợp.

### Checklist

- `mode: "onChange"` và `reValidateMode: "onChange"`.
- Error truyền trực tiếp từ `form.formState.errors.<field>` vào primitive field.
- Submit dùng `handleSubmit`, hoặc helper intent đã có nếu form dùng button `type="button"`.
- Submit/action trong modal không phụ thuộc `formState.isValid`, `dirtyFields`, required-empty check thủ công hoặc `errors` để khóa nút; validation chặn payload invalid, còn button vẫn cho bấm để người dùng thấy lỗi.
- Modal shell căn giữa dọc-ngang ở mọi viewport. Modal form có header/body/footer tách biệt; header và footer dùng `shrink-0`, body dùng `min-h-0 flex-1 overflow-y-auto`; header dùng padding gọn như `px-4 py-3`, footer dùng padding gọn như `p-3 sm:p-4`.
- Với admin modal title-only header, shell đặt nút `X` trong action rail cao bằng header (`absolute right-4 top-0 flex h-16 items-center`) và header dùng `min-h-16 items-center`, để nút đóng luôn căn giữa dọc với title.
- Modal có nút `Hủy` trong footer và nút icon `X` đóng ở header/shell, cả hai gọi đúng close/cancel handler và có disabled/pending state phù hợp khi đang lưu.
- Footer button mobile giữ layout `grid-cols-2` khi có hai action hoặc full width khi chỉ có một action; từ laptop/desktop dùng `sm:flex sm:justify-end` và button `sm:w-auto`/`max-w-max`. Button label luôn một dòng bằng `whitespace-nowrap`.
- Primary/action button trong footer modal dùng màu thống nhất với modal cùng hệ, ưu tiên `bg-sky-600 hover:bg-sky-700 text-white` cho action lưu thường; không đổi sang đen/tối nếu không phải semantic riêng đã được chốt.
- Modal mở mới không hiện lỗi required khi người dùng chưa tương tác.
- Sau khi người dùng nhập/xóa/sửa field, lỗi cập nhật realtime.

## 2. Required Text Validation

Dùng cho text input bắt buộc.

### Pattern chuẩn

```ts
import { requiredTrimmedText } from "@/lib/form-validation";

const schema = z.object({
  title: requiredTrimmedText({
    requiredMessage: "Nhập tên",
    maxLength: 180,
  }),
});
```

### Không làm

- Không dùng message `Nhập ...` cho rule `min(2+)`, format, range hoặc uniqueness.
- Không viết lặp chuỗi `.string().trim().min(...)` nếu helper chung đã đủ dùng.

## 3. Numeric Text Field

Dùng cho thứ tự, tiền, phần trăm, số lượng khi UI đã có styled input riêng.

### Pattern chuẩn

```tsx
const orderField = form.register("orderIndex");

function handleOrderChange(event: ChangeEvent<HTMLInputElement>) {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
  orderField.onChange(event);
}

<TextField
  id="entity-order"
  label="Thứ tự"
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  error={form.formState.errors.orderIndex}
  {...orderField}
  onChange={handleOrderChange}
/>
```

### Không làm

- Không dùng `type="number"` nếu làm lộ spinner/default browser UI.
- Không normalize số bằng ad hoc string parsing trong JSX lớn; nếu lặp lại ở nhiều nơi, nâng thành helper/primitive.

## 4. Option Field

Dùng cho select/dropdown trong form.

### Pattern chuẩn

```tsx
<OptionField
  id="entity-status"
  label="Trạng thái"
  value={form.watch("status")}
  options={statusOptions}
  error={form.formState.errors.status}
  onChange={(value) =>
    form.setValue("status", value as FormValues["status"], {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }
/>
```

### Không làm

- Không set value mà thiếu `shouldValidate` khi field thuộc form validation.
- Không dựng dropdown custom mới nếu `OptionField` đủ dùng.
