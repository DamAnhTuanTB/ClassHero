# Admin Course Management

## Tính năng này giải quyết gì?

Admin dùng màn quản lý lộ trình để tạo/sửa lộ trình học, nhập thông tin cơ bản như tên, slug, môn, lớp, giá, ảnh đại diện và mô tả. Đây là phần UI thuộc `M3.4`; API/storage thật sẽ được nối ở các task sau.

## Front-end

Modal lộ trình được compose từ `PathEditor`. Các field nhỏ tách thành component riêng trong `apps/web/features/admin-courses/components/` để tránh dồn logic upload, textarea và form state vào một file lớn.

Luồng đọc dữ liệu của admin course nên đi qua 4 lớp:

```txt
api/admin-courses-api.ts
-> hooks/use-admin-course-queries.ts
-> hooks/use-admin-courses-manager.ts hoặc use-admin-course-detail-manager.ts
-> screens/components
```

`api/` là boundary để sau này đổi mock sang REST thật mà không chạm JSX. TanStack Query nằm ở hook query riêng để giữ cache/loading/error/refetch. Manager hook chỉ giữ orchestration của màn: form state, selection, modal state và action local/mock. Screen component chỉ compose sidebar, header, stats, content và dialog.

Các helper thuần như filter/sort/thống kê/detail lookup đặt ở `utils/admin-courses-utils.ts`. Không để helper so sánh, tính stats hoặc tìm lesson nằm cuối hook/screen vì hook sẽ phình nhanh và khó test.

Field số trong admin form không dùng `type="number"` native. Dùng input text styled theo form chuẩn, `inputMode` phù hợp và normalize bằng React Hook Form trước khi schema Zod validate.

Với upload ảnh mock/local, preview không nên lưu bằng `URL.createObjectURL` nếu giá trị cần tồn tại sau khi đóng/mở modal. Object URL là link tạm của phiên component; nếu component cleanup hoặc unmount, link có thể hết hiệu lực và ảnh sẽ bị broken khi edit lại.

## Luồng lỗi thường gặp

- Lỗi: chọn ảnh trong modal, lưu, đóng modal, bấm edit lại thì ảnh đại diện hiển thị broken image.
- Nguyên nhân: state form/mock giữ `blob:` URL tạo bằng `URL.createObjectURL`, nhưng component upload đã revoke URL khi unmount.
- Cách tránh trong mock UI: dùng `FileReader.readAsDataURL` để lưu data URL ổn định trong state local, và thêm fallback placeholder khi ảnh hiện tại không load được.
- Lỗi: mở modal tạo chương học đã thấy lỗi required dù người dùng chưa nhập gì.
- Nguyên nhân: gọi validate toàn form ngay sau `reset()` để tính `isValid`, rồi truyền thẳng `formState.errors` vào field. Validation state và error visibility bị trộn làm một.
- Cách tránh trong modal form: bám pattern form chuẩn đã duyệt hoặc form tương tự đang chạy ổn; dùng `mode: "onChange"` và truyền thẳng `formState.errors.<field>` vào primitive field; không gọi `trigger()` ngay sau `reset()` khi mở modal. Không tự bọc bằng `dirtyFields/touchedFields` trong component, vì nhập rồi xóa về default có thể làm `dirty` quay về false và mất validate realtime.

## File quan trọng

- `apps/web/features/admin-courses/api/admin-courses-api.ts`
- `apps/web/features/admin-courses/hooks/use-admin-course-queries.ts`
- `apps/web/features/admin-courses/hooks/use-admin-courses-manager.ts`
- `apps/web/features/admin-courses/hooks/use-admin-course-detail-manager.ts`
- `apps/web/features/admin-courses/components/chapter-editor.tsx`
- `apps/web/features/admin-courses/components/path-cover-upload.tsx`
- `apps/web/features/admin-courses/components/path-editor.tsx`
- `apps/web/features/admin-courses/schemas/admin-courses-schemas.ts`

## Task liên quan

- `M3.4`: Admin learning path/chapter/lesson UI cơ bản.
- `M4.1`: Storage service thật cho upload file sau này.
