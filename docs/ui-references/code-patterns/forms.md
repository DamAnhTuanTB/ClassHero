# Form Code Patterns

Dùng file này cho form, modal/drawer form, text validation, numeric input và select/dropdown thuộc form.

## 0. Focus Và Select Chuẩn

Áp dụng cho mọi form control trong dự án: text input, select/listbox, checkbox và icon button nằm bên trong field.

### Pattern chuẩn

- Dùng shared focus class từ `apps/web/components/common/forms/form-styles.ts` cho form primitives.
- Focus ring của form control phải mảnh: light mode dùng tối đa `ring-2`; dark mode dùng `ring-1` và opacity dịu hơn để không bị chói trên nền tối.
- Không thêm `focus:shadow-*` hoặc box-shadow riêng cho input/select. Trạng thái focus chỉ nên thể hiện bằng border + ring mảnh.
- Select/listbox sau khi chọn option phải đóng dropdown và blur trigger nếu owner muốn ô mất trạng thái focus sau khi chọn.
- Nếu cùng một màu token nhưng dark mode nhìn khác do kích thước/shape, được phép giảm riêng opacity của select để cân bằng thị giác.

### Không làm

- Không dùng `focus:ring-4`, `focus-visible:ring-4` hoặc `peer-focus-visible:ring-4` cho form control.
- Không để input và select cùng một nhóm filter dùng hai tông border focus khác nhau trong cùng theme.
- Không giữ focus trên select trigger sau khi chọn option nếu UX mong muốn field trở về trạng thái nghỉ.

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
- Modal cấu hình AI có vùng xem system/user prompt dài được phép giữ một khung cuộn có giới hạn riêng để đọc prompt mà không làm trôi toàn bộ form. Wrapper gần nhất của preview phải cô lập overflow (`overflow-hidden` hoặc containment tương đương) để nội dung renderer bên trong không làm phình `scrollHeight` của body modal. Khi xuất hiện khoảng trắng dư, phải đo DOM runtime và sửa ownership của overflow; không được bỏ scrollbar prompt hoặc giới hạn chiều cao panel để che triệu chứng.
- Không top-align modal trên mobile. Overlay/shell phải dùng căn giữa dọc-ngang (`items-center justify-center`) ở mọi breakpoint; modal dài thì dùng `max-height` và body scroll.
- Không đặt mô tả/subtitle dưới title trong header modal. Header chỉ giữ title ngắn và nút icon `X` để đóng, hoặc control phụ thật cần thiết.
- Không tạo modal thiếu đường thoát rõ ràng. Modal phải có nút action `Hủy` trong footer và nút icon `X` đóng ở header/shell.
- Không để footer modal quá dày. Footer chỉ giữ action, padding gọn; trên mobile một action thì full width, hai action mặc định cùng một hàng hai cột; trên laptop/desktop button co theo nội dung (`max-content`/`w-auto`) và không kéo full width.
- Không bao giờ cho text trong button xuống dòng. Nếu label không vừa, chỉnh grid/flex layout, width, padding, font size hoặc copy ngắn hơn; button vẫn phải giữ `whitespace-nowrap`.
- Không để primary/action button trong modal cùng flow tự lệch màu. Action chính/lưu dùng màu `primary` thống nhất, mặc định `bg-sky-600 hover:bg-sky-700 text-white`; hủy/đóng dùng trung tính và destructive dùng đỏ.
- Không disable nút submit/action trong modal chỉ vì form đang invalid, pristine hoặc field bắt buộc còn trống. Cho nút bấm được để `handleSubmit`/validation hiển thị lỗi inline; chỉ disable khi pending/saving hoặc thiếu prerequisite cứng khiến action không thể chạy.
- Không gọi `form.trigger()` ngay sau `form.reset()` khi mở modal, vì sẽ hiện lỗi ở trạng thái pristine.
- Không tự bọc error bằng `dirtyFields`/`touchedFields` trong từng form nếu chưa có test/logic rõ; nhập rồi xóa về default có thể làm `dirty` quay về false và mất realtime validation.
- Không tự dựng input/select/submit mới nếu `apps/web/components/common/forms` đã có primitive phù hợp.

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

## 5. Mobile-Safe Select Trigger

Dùng cho select/dropdown filter trên mobile khi người dùng có thể bấm lại trigger đang mở để đóng dropdown. Với filter ngắn như lớp/môn học, ưu tiên custom `button + listbox` local thay vì Radix/shadcn Select nếu từng gặp lỗi đóng rồi mở lại rất nhanh trên điện thoại thật.

### Pattern chuẩn

```tsx
const [isOpen, setIsOpen] = useState(false);

<div
  className="relative"
  onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  }}
>
  <button
    type="button"
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    onClick={() => setIsOpen((open) => !open)}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }

      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen(true);
      }
    }}
  >
    {selectedOption.label}
  </button>

  {isOpen ? (
    <div role="listbox">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          onClick={() => {
            onChange(option.value);
            setIsOpen(false);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  ) : null}
</div>
```

Nếu bắt buộc dùng Radix/shadcn Select, phải test trên điện thoại thật. Chỉ thêm `onPointerDownCapture` để `setIsOpen(false)` là chưa đủ, vì mobile có thể vẫn phát tiếp chuỗi event làm dropdown mở lại.

```tsx
onOpenChange={(nextOpen) => {
  if (nextOpen && suppressReopenRef.current) {
    return;
  }

  setIsOpen(nextOpen);
}}
```

### Không làm

- Không dùng Radix/shadcn Select cho filter mobile đã từng lỗi đóng rồi mở lại nhanh nếu custom listbox local đủ dùng.
- Không chỉ gọi `setIsOpen(false)` trong `onPointerDownCapture` rồi để `onOpenChange` tự xử lý. Trên mobile, chuỗi pointer/click/open event có thể làm dropdown đóng rồi mở lại rất nhanh.
- Không thêm `touchstart`/`touchend` handler riêng để vá cảm giác; ưu tiên một trigger `button` semantic với `onClick` toggle thật và `onBlur` đóng khi focus rời khỏi wrapper.
- Không bỏ keyboard cơ bản: `Escape` đóng, `Enter`/`Space`/`ArrowDown` mở, item dùng `role="option"` và `aria-selected`.

## 6. Helper Panel Action Ownership

Dùng khi một field mở panel công cụ phụ như nhập công thức, chọn ký hiệu, xem trước hoặc cấu hình nâng cao.

### Pattern chuẩn

- State mở/đóng panel và action đóng/xóa panel phải nằm trong cùng component sở hữu panel.
- Icon đứng cạnh hoặc căn theo panel phải điều khiển chính panel đó; action đóng panel chỉ đổi UI state, không được xóa giá trị field hoặc phần tử của field array.
- Nút đóng/xóa panel chỉ hiện khi panel đang mở, dùng `type="button"` và `aria-label` mô tả đúng hành vi như `Ẩn công cụ nhập công thức`.
- Giá trị người dùng đã nhập/chèn phải được giữ nguyên khi ẩn panel, trừ khi UI nói rõ đây là action xóa dữ liệu.
- Nếu field array có hàng đầu tiên bắt buộc làm hàng neo, action xóa đáp án phải nằm ở cấp row và dùng `disabled={index === 0}`; các hàng từ thứ hai trở đi vẫn phải xóa được.
- Khi cùng UI có cả xóa row và xóa/ẩn helper panel, đặt hai action ở hai vị trí tương ứng với đối tượng bị tác động và dùng `aria-label`/`title` khác nhau.

### Không làm

- Không nối icon đứng cạnh panel công cụ với `fieldArray.remove()` chỉ vì icon dùng hình thùng rác.
- Không đặt action ở component cha rồi điều khiển nhầm entity/field khi state panel nằm trong component con.
- Không dùng cùng một icon/action mơ hồ cho cả “ẩn panel” và “xóa đáp án”; nếu cần cả hai, phải tách vị trí và `aria-label` theo đúng đối tượng bị tác động.
- Không dùng `fields.length <= 1` để khóa xóa nếu rule nghiệp vụ là “không bao giờ xóa hàng đầu tiên”; điều kiện theo độ dài có thể cho phép xóa nhầm hàng neo khi danh sách có nhiều phần tử.
