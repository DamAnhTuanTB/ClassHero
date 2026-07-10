# Form Code Patterns

Dùng file này cho form, modal/drawer form, text validation, numeric input và select/dropdown thuộc form.

## 1. React Hook Form Modal Form

Dùng cho modal/drawer tạo/sửa có React Hook Form + Zod.

### Pattern chuẩn

```tsx
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

- Không gọi `form.trigger()` ngay sau `form.reset()` khi mở modal, vì sẽ hiện lỗi ở trạng thái pristine.
- Không tự bọc error bằng `dirtyFields`/`touchedFields` trong từng form nếu chưa có test/logic rõ; nhập rồi xóa về default có thể làm `dirty` quay về false và mất realtime validation.
- Không tự dựng input/select/submit mới nếu `apps/web/components/forms` đã có primitive phù hợp.

### Checklist

- `mode: "onChange"` và `reValidateMode: "onChange"`.
- Error truyền trực tiếp từ `form.formState.errors.<field>` vào primitive field.
- Submit dùng `handleSubmit`, hoặc helper intent đã có nếu form dùng button `type="button"`.
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
