# Frontend Bundle Isolation

## Chủ đề này dùng để làm gì?

Bundle isolation là cách giữ cho mỗi route chỉ tải phần JavaScript, CSS, asset và provider mà route đó thật sự cần. Chủ đề này đặc biệt quan trọng vì dự án đặt public/client, auth, student, parent và admin trong cùng một `apps/web` Next.js app.

Nếu không kiểm soát ranh giới này, trang public hoặc client có thể tải nhầm code admin như toaster, modal CRUD, editor, chart, export tool hoặc CSS admin dù người dùng không vào admin.

## Cách nó hoạt động trong repo

Next.js App Router đã tách code theo route, nhưng route splitting chỉ hiệu quả khi code nặng không bị import từ entry chung.

Entry chung hiện quan trọng nhất là:

- `apps/web/app/layout.tsx`: root layout cho mọi route.
- `apps/web/app/globals.css`: CSS global cho mọi route.
- `apps/web/app/(admin)/layout.tsx`: shell riêng cho admin.
- `apps/web/app/(auth)/layout.tsx`: shell riêng cho auth.
- Tránh `apps/web/features/*/index.ts` nếu chỉ re-export; route nên import thẳng screen/file thật.

Kỹ thuật đã áp dụng sau audit bundle:

- Root layout bỏ `AppToaster`, để public route không tải `sonner` và toast icon không cần thiết.
- `(auth)/layout.tsx` và `(admin)/layout.tsx` tự mount `AppToaster`, vì các route này có form/action cần toast.
- CSS admin chuyển khỏi `globals.css` sang `apps/web/app/(admin)/admin-theme.css` và import từ admin layout.
- Admin course pages import trực tiếp screen manager thay vì đi qua file re-export như `@/features/admin/courses`.

## Luồng kỹ thuật

1. Root layout chỉ giữ provider/theme/script thật sự dùng cho mọi route.
2. Role layout giữ shell/tool riêng cho role đó.
3. Route page import đúng screen entry cần render, càng trực tiếp càng dễ kiểm soát chunk.
4. Dialog/editor/export/chart/admin tool ít dùng được lazy-load bằng `next/dynamic`.
5. Sau khi build production, so HTML hoặc manifest của `/` với route admin chính để xác nhận public không tải chunk admin.

## Kỹ thuật chính

- Không mount UI/action host toàn cục nếu route public không dùng, ví dụ toaster, command palette, admin sidebar hoặc notification panel riêng role.
- Không đặt CSS role-specific trong `globals.css`. Global chỉ nên chứa theme token, reset/base và utility dùng chung.
- Không dùng barrel/re-export file ở route boundary. Import trực tiếp từ `screens/<screen-name>`.
- Không để shared module import ngược vào admin feature. Shared layer chỉ chứa primitive nhẹ, generic và không phụ thuộc role.
- Asset hoặc font chỉ dành cho auth/admin không preload từ root layout.
- Đo bằng production build/curl, không đo bằng cảm giác hoặc tên folder.

## File quan trọng

- `apps/web/app/layout.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/(admin)/layout.tsx`
- `apps/web/app/(admin)/admin-theme.css`
- `apps/web/app/globals.css`
- `docs/12-performance-and-observability.md`
- `docs/14-source-code-structure.md`

## Khi nào cần nhớ lại?

- Khi thêm route group mới như student/parent.
- Khi thêm admin editor, chart, export Excel/PDF/CSV, upload/image tool hoặc AI panel.
- Khi thêm provider/toaster/notification/modal host vào layout.
- Khi public/client route tự nhiên chậm hơn sau một task admin.
- Khi audit bundle hoặc chuẩn bị production performance.

## Task liên quan

- Bundle audit và cleanup admin/client chung repo, ngày `2026-07-11`.
