# Basic Auth API

## Tính năng này giải quyết gì?

`M2.2` thêm nền đăng ký và đăng nhập cho Student/Parent. Sau bước này hệ thống có thể tạo tài khoản, kiểm tra mật khẩu, cấp JWT access token, rotate refresh token và logout bằng cách revoke refresh token.

## Bức tranh tổng thể

Auth trong repo tách thành 2 loại token:

- Access token là JWT ngắn hạn, dùng về sau cho header `Authorization: Bearer ...`.
- Refresh token là chuỗi ngẫu nhiên dài hạn hơn. Backend chỉ lưu hash, không lưu raw token.

Register chỉ tạo tài khoản và profile. Login mới cấp cặp access/refresh token.

## Luồng code end-to-end

1. Request đi vào `AuthController` ở route `/api/v1/auth/...`.
2. DTO trong `modules/auth/dto` validate body bằng `class-validator`.
3. `AuthService` chuẩn hóa email/username/phone, kiểm tra duplicate và hash password.
4. Prisma ghi `users`, `student_profiles` hoặc `parent_profiles`.
5. Khi login, service verify password rồi ký JWT access token.
6. Refresh token raw được sinh bằng `crypto.randomBytes`, hash SHA-256 rồi lưu vào `refresh_tokens`.
7. Khi refresh, backend tìm token hash, kiểm tra chưa revoke/chưa hết hạn, revoke token cũ và tạo token mới.
8. Response đi qua global API envelope thành `{ data, meta }`.

## Back-end/API

Các endpoint thuộc `M2.2`:

- `POST /auth/register/student`
- `POST /auth/register/parent`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

M2.2 chưa làm RBAC guard hoặc `GET /me`; phần đó nằm ở `M2.3`.

## Database

Các bảng dùng lại từ `M1.2`:

- `users`: role, identifier, password hash, trạng thái tài khoản.
- `student_profiles`: grade và `child_code` để phụ huynh liên kết con.
- `parent_profiles`: hồ sơ phụ huynh nền.
- `refresh_tokens`: chỉ lưu `token_hash`, `expires_at`, `revoked_at`.

## Kỹ thuật cần nhớ

- Password không được lưu plain text; repo dùng `scrypt` với salt riêng khi tạo tài khoản mới.
- Seed dev cũ cũng dùng format `scrypt`, nên AuthService vẫn verify được user seed.
- Refresh token raw chỉ trả cho client một lần. DB chỉ giữ SHA-256 hash để nếu DB lộ cũng không dùng trực tiếp được token.
- Refresh token rotation giúp token cũ bị vô hiệu hóa ngay sau khi đổi token mới.

## File quan trọng

- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/dto/*.ts`
- `docs/api/auth-profile.md`

## Task liên quan

- `M2.2`: Register, login, refresh và logout.
- `M2.3`: RBAC, `GET /me`, profile base và forgot/reset password.
