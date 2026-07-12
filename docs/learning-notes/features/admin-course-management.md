# Admin Course Management

## Tính năng này giải quyết gì?

Admin dùng màn quản lý lộ trình để tạo/sửa lộ trình học, nhập thông tin cơ bản như tên, slug, môn, lớp, giá, ảnh đại diện và mô tả. `M3.4` hiện đã được nối với API thật cho lộ trình/chương/buổi học; upload ảnh đại diện đi qua Files API và lưu object bằng adapter S3-compatible local MinIO.

## Front-end

Modal lộ trình được compose từ `PathEditor`. Các field nhỏ tách thành component riêng trong `apps/web/features/admin-courses/components/` để tránh dồn logic upload, textarea và form state vào một file lớn.

Luồng đọc dữ liệu của admin course nên đi qua 4 lớp:

```txt
api/admin-courses-api.ts
-> hooks/use-admin-course-queries.ts
-> hooks/use-admin-courses-manager.ts hoặc use-admin-course-detail-manager.ts
-> screens/components
```

`api/` là boundary gọi REST thật và map response DTO về UI type. TanStack Query nằm ở hook query riêng để giữ cache/loading/error/refetch và invalidate sau mutation. Manager hook chỉ giữ orchestration của màn: form state, selection, modal state và action pending/error. Screen component chỉ compose sidebar, header, stats, content và dialog.

Các helper thuần như filter/sort/thống kê/detail lookup đặt ở `utils/admin-courses-utils.ts`. Không để helper so sánh, tính stats hoặc tìm lesson nằm cuối hook/screen vì hook sẽ phình nhanh và khó test.

Field số trong admin form không dùng `type="number"` native. Dùng input text styled theo form chuẩn, `inputMode` phù hợp và normalize bằng React Hook Form trước khi schema Zod validate.

Với upload ảnh thật, UI upload file trước qua `POST /files/upload` với purpose `EDITOR_IMAGE`, nhận `fileId`, lấy URL đọc qua `GET /files/:fileId/signed-url` khi cần, rồi lưu `thumbnailFileId` vào learning path. Preview trong modal vẫn có thể dùng object URL tạm khi upload đang pending, nhưng dữ liệu bền phải là `fileId`/signed URL từ backend, không phải `blob:` URL hoặc data URL local.

## Luồng lỗi thường gặp

- Lỗi: chọn ảnh trong modal, lưu, đóng modal, bấm edit lại thì ảnh đại diện hiển thị broken image.
- Nguyên nhân: state form/mock giữ `blob:` URL tạo bằng `URL.createObjectURL`, nhưng component upload đã revoke URL khi unmount.
- Cách tránh khi còn mock UI: dùng `FileReader.readAsDataURL` để lưu data URL ổn định trong state local, và thêm fallback placeholder khi ảnh hiện tại không load được. Khi đã nối API thật, phải upload lên Files API trước và lưu `thumbnailFileId`; không lưu URL tạm vào dữ liệu production-connected.
- Lỗi: mở modal tạo chương học đã thấy lỗi required dù người dùng chưa nhập gì.
- Nguyên nhân: gọi validate toàn form ngay sau `reset()` để tính `isValid`, rồi truyền thẳng `formState.errors` vào field. Validation state và error visibility bị trộn làm một.
- Cách tránh trong modal form: bám pattern form chuẩn đã duyệt hoặc form tương tự đang chạy ổn; dùng `mode: "onChange"` và truyền thẳng `formState.errors.<field>` vào primitive field; không gọi `trigger()` ngay sau `reset()` khi mở modal. Không tự bọc bằng `dirtyFields/touchedFields` trong component, vì nhập rồi xóa về default có thể làm `dirty` quay về false và mất validate realtime.
- Lỗi: trên điện thoại hiện hydration mismatch ở input dù HTML/app state không đổi.
- Nguyên nhân: một số trình duyệt, autofill hoặc extension có thể chèn attribute riêng vào input trước khi React hydrate, ví dụ `__gcruniqueid`; React thấy DOM client khác HTML server nên báo overlay đỏ trong dev.
- Cách tránh: với input primitive dùng chung, đặt `suppressHydrationWarning` trên chính element input để bỏ qua attribute ngoài ý muốn từ browser. Không dùng cách này để che mismatch do app tự tạo bằng `Date.now()`, `Math.random()` hoặc format ngày/tiền khác giữa server và client.
- Lỗi: bật giao diện tối ở trang danh sách, chuyển sang trang chi tiết thì giao diện quay về sáng hoặc card vẫn trắng.
- Nguyên nhân: theme là state cục bộ trong từng manager hook, nên route mới mount lại với default `false`; một số panel detail, modal shell, footer form, textarea/upload và checkbox native còn hard-code `bg-white`, `bg-slate-50`, `text-slate-950` hoặc dùng browser style mặc định.
- Cách tránh: theme phải là state chung của app, lưu bền bằng `localStorage` và được hydrate ở provider/root layout; component admin nhận `isDarkTheme` từ cùng store và mọi surface chính phải có variant dark hoặc dùng semantic token. Modal cần xử lý cả shell/header/body/footer, form primitive cần nhận `isDarkTheme`, còn checkbox native nên có class style riêng để không phụ thuộc nền trắng mặc định của trình duyệt.
- Lỗi: reload khi đang ở giao diện tối bị nháy sáng trước khi chuyển về tối.
- Nguyên nhân: theme được hydrate sau paint hoặc script khởi tạo theme đặt sai chỗ; nếu client store đọc `localStorage` ngay khi module load thì server render light còn client render dark, gây hydration mismatch.
- Cách tránh: lưu theme vào cookie cùng key với `localStorage` để admin layout và admin pages server đọc theme ngay từ request đầu tiên. Screen/hook nhận `initialThemeMode` từ server để render frame đầu đúng theme, sau đó Zustand hydrate bằng `useLayoutEffect` và tiếp quản trạng thái. Vẫn dùng `next/script` với `strategy="beforeInteractive"` để đồng bộ localStorage/cookie/system preference trước hydrate. Các vùng admin cần CSS bridge theo `.dark [data-admin-theme]` để HTML render sáng từ server vẫn hiển thị tối trước khi store hydrate. Nếu server layout bọc một wrapper `.dark`, client theme store phải cập nhật cả wrapper `[data-theme-root]`; nếu chỉ gỡ `dark` trên `<html>`, CSS bridge vẫn ép giao diện ở theme tối khi người dùng bấm chuyển sáng.

## File quan trọng

- `apps/web/features/admin-courses/api/admin-courses-api.ts`
- `apps/web/features/admin-courses/hooks/use-admin-course-queries.ts`
- `apps/web/features/admin-courses/hooks/use-admin-courses-manager.ts`
- `apps/web/features/admin-courses/hooks/use-admin-course-detail-manager.ts`
- `apps/api/src/modules/files`
- `apps/api/src/modules/learning-paths/controllers/admin-chapters.controller.ts`
- `apps/api/src/modules/learning-paths/services/chapters.service.ts`
- `apps/web/lib/theme-store.ts`
- `apps/web/features/admin-courses/components/editor-dialog-shell.tsx`
- `apps/web/features/admin-courses/components/delete-confirm-dialog.tsx`
- `apps/web/features/admin-courses/components/chapter-editor.tsx`
- `apps/web/features/admin-courses/components/chapter-lesson-panel.tsx`
- `apps/web/features/admin-courses/components/learning-path-summary-panel.tsx`
- `apps/web/features/admin-courses/components/learning-path-row.tsx`
- `apps/web/features/admin-courses/components/learning-paths-table.tsx`
- `apps/web/features/admin-courses/components/path-cover-upload.tsx`
- `apps/web/features/admin-courses/components/path-editor.tsx`
- `apps/web/features/admin-courses/schemas/admin-courses-schemas.ts`
- `apps/web/components/forms/text-field.tsx`

## Task liên quan

- `M3.4`: Admin learning path/chapter/lesson UI cơ bản và `/task-connect` sang API thật.
- `M4.1`: Storage service thật cho upload file, local MinIO dev và S3-compatible adapter.
