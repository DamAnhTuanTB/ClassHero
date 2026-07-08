# Basic Auth API

## Tính năng này giải quyết gì?

`M2.2` thêm nền đăng ký và đăng nhập cho Student/Parent. `M2.3` bổ sung lớp bảo vệ API bằng JWT/RBAC, API xem/sửa hồ sơ cơ bản và luồng quên/đặt lại mật khẩu.

## Bức tranh tổng thể

Auth trong repo tách thành 2 loại token:

- Access token là JWT ngắn hạn, dùng về sau cho header `Authorization: Bearer ...`.
- Refresh token là chuỗi ngẫu nhiên dài hạn hơn. Backend chỉ lưu hash, không lưu raw token.
- Reset password token cũng là chuỗi ngẫu nhiên. Backend chỉ lưu SHA-256 hash trong `password_reset_tokens`.

Register chỉ tạo tài khoản và profile. Login mới cấp cặp access/refresh token.

`M2.4` thêm lớp UI mock cho auth. Mock UI chưa gọi API thật, nhưng bám đúng contract để sau này thay bằng API client mà không đổi luồng màn hình.

## Luồng code end-to-end

1. Request đi vào `AuthController` ở route `/api/v1/auth/...`.
2. DTO trong `modules/auth/dto` validate body bằng `class-validator`.
3. `AuthService` chuẩn hóa email/username/phone, kiểm tra duplicate và hash password.
4. Prisma ghi `users`, `student_profiles` hoặc `parent_profiles`.
5. Khi login, service verify password rồi ký JWT access token.
6. Refresh token raw được sinh bằng `crypto.randomBytes`, hash SHA-256 rồi lưu vào `refresh_tokens`.
7. Khi refresh, backend tìm token hash, kiểm tra chưa revoke/chưa hết hạn, revoke token cũ và tạo token mới.
8. API cần đăng nhập đi qua `JwtAuthGuard`: verify JWT, kiểm tra user còn active trong database, rồi gắn `request.user`.
9. API cần role cụ thể đi qua `RolesGuard` và `@Roles(...)`; sai role trả `403`.
10. Response đi qua global API envelope thành `{ data, meta }`.
11. Với UI mock `M2.4`, route Next.js render từng form public, React Hook Form validate bằng Zod, mock submit tạo trạng thái loading/success/error để owner review flow trước khi nối API.

## Front-end

Các route UI auth hiện có:

- `/login`: form identifier + password cho Student/Parent/Admin.
- `/register/student`: form tạo tài khoản học sinh theo body `POST /auth/register/student`.
- `/register/parent`: form tạo tài khoản phụ huynh theo body `POST /auth/register/parent`.
- `/forgot-password`: form gửi identifier, luôn hiển thị thông báo chung để không lộ tài khoản có tồn tại hay không.
- `/reset-password`: form token + mật khẩu mới, mô phỏng reset thành công và revoke phiên cũ.

UI tách thành:

- route/page trong `apps/web/app/(public)/...`,
- shell chung trong `apps/web/features/auth/auth-page-shell.tsx`,
- form client trong `apps/web/features/auth/auth-forms.tsx`,
- Zod schema trong `apps/web/features/auth/auth-schemas.ts`,
- mock action trong `apps/web/features/auth/mock-auth.ts`.

Khi làm `/task-connect M2.4`, phần mock action sẽ được thay bằng API client thật, còn layout/form state có thể giữ lại.

## Back-end/API

Các endpoint thuộc `M2.2`:

- `POST /auth/register/student`
- `POST /auth/register/parent`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Các endpoint/lớp thuộc `M2.3`:

- `GET /me`
- `PATCH /me/student-profile`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser`

## Database

Các bảng dùng lại từ `M1.2`:

- `users`: role, identifier, password hash, trạng thái tài khoản.
- `student_profiles`: grade và `child_code` để phụ huynh liên kết con.
- `parent_profiles`: hồ sơ phụ huynh nền.
- `refresh_tokens`: chỉ lưu `token_hash`, `expires_at`, `revoked_at`.
- `password_reset_tokens`: chỉ lưu `token_hash`, trạng thái used/revoked và thời hạn ngắn.
- `audit_logs`: ghi lại request reset password, reset hoàn tất và cập nhật profile.

## Worker/AI/Integration

M2.3 chưa thêm worker email riêng. Forgot password sẽ gọi Resend trực tiếp nếu `RESEND_API_KEY` và `RESEND_FROM_EMAIL` đã cấu hình thật. Nếu local/dev chưa có env thật, API vẫn tạo reset token hash và trả response chung để không lộ identifier có tồn tại hay không.

## Kỹ thuật cần nhớ

- Password không được lưu plain text; repo dùng `scrypt` với salt riêng khi tạo tài khoản mới.
- Seed dev cũ cũng dùng format `scrypt`, nên AuthService vẫn verify được user seed.
- Refresh token raw chỉ trả cho client một lần. DB chỉ giữ SHA-256 hash để nếu DB lộ cũng không dùng trực tiếp được token.
- Refresh token rotation giúp token cũ bị vô hiệu hóa ngay sau khi đổi token mới.
- Reset password token raw cũng không lưu DB. Khi reset thành công, backend set `used_at` và revoke toàn bộ refresh token cũ của user.
- RBAC phải nằm ở backend guard/service, không được chỉ ẩn nút trên UI.

## File quan trọng

- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/profile.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/dto/*.ts`
- `apps/api/src/common/auth/*.ts`
- `apps/web/app/(public)/login/page.tsx`
- `apps/web/app/(public)/register/student/page.tsx`
- `apps/web/app/(public)/register/parent/page.tsx`
- `apps/web/app/(public)/forgot-password/page.tsx`
- `apps/web/app/(public)/reset-password/page.tsx`
- `apps/web/features/auth/*.tsx`
- `apps/web/features/auth/*.ts`
- `docs/api/auth-profile.md`

## Task liên quan

- `M2.2`: Register, login, refresh và logout.
- `M2.3`: RBAC, `GET /me`, profile base và forgot/reset password.
- `M2.4`: Auth UI login/register/forgot/reset password.
