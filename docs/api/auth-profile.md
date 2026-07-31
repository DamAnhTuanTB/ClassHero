# API Auth And Profile

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 2. Auth API

### `POST /auth/register/student`

Role: public.

Body:

```json
{
  "phone": "0900000001",
  "username": "student1",
  "password": "123456",
  "fullName": "Nguyễn Văn A",
  "grade": 7,
  "gender": "MALE",
  "birthYear": 2012,
  "address": "Hà Nội"
}
```

Side effects:

- Tạo `users` role `STUDENT`.
- Tạo `student_profiles` và `child_code`.
- Hash password.

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "STUDENT",
      "email": null,
      "phone": null,
      "username": "student1",
      "fullName": "Nguyễn Văn A"
    },
    "studentProfile": {
      "grade": 7,
      "childCode": "LP123456"
    }
  }
}
```

Notes:

- `email` là optional cho student và không hiển thị trong form đăng ký học sinh hiện tại.
- `phone` là optional ở API. Trên UI, student phải nhập số điện thoại hoặc chọn "Không có số điện thoại".
- `grade` chỉ nhận từ lớp 3 đến lớp 12.
- `birthYear` chỉ nhận khoảng năm sinh phù hợp với học sinh lớp 3 đến lớp 12. Backend lưu nội bộ vào `users.date_of_birth` bằng ngày `01/01` của năm sinh.
- `address` là bắt buộc và được lưu vào `student_profiles.address`.
- `password` chỉ yêu cầu tối thiểu 6 ký tự, tối đa 72 ký tự.

Errors: `DUPLICATE_EMAIL`, `DUPLICATE_PHONE`, `DUPLICATE_USERNAME`, `VALIDATION_ERROR`. `DUPLICATE_EMAIL` và `DUPLICATE_PHONE` chỉ áp dụng khi request có gửi `email` hoặc `phone`.

### `POST /auth/register/parent`

Role: public.

Body:

```json
{
  "phone": "0910000001",
  "password": "123456",
  "fullName": "Phụ huynh A"
}
```

Side effects:

- Tạo `users` role `PARENT`.
- Tạo `parent_profiles`.
- Hash password.

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "PARENT",
      "email": null,
      "phone": "0910000001",
      "username": null,
      "fullName": "Phụ huynh A"
    }
  }
}
```

Notes:

- Form phụ huynh hiện tại không yêu cầu email; parent có thể đăng ký bằng số điện thoại.
- API vẫn chấp nhận `email` optional nếu client tương lai cần gửi, nhưng không được làm UI hiện tại tự thêm ô email.

### `POST /auth/login`

Role: public.

Body:

```json
{
  "identifier": "student1",
  "password": "Password123!"
}
```

Response:

```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "token",
    "user": {
      "id": "uuid",
      "role": "STUDENT",
      "email": "student1@example.com",
      "username": "student1"
    }
  }
}
```

Web session bridge:

- NestJS vẫn nhận access token bằng header `Authorization: Bearer ...`; không đổi request/response contract của endpoint login.
- Sau login thành công, Next.js web gọi route nội bộ `POST /api/auth/session` để lưu một bản access token vào cookie `HttpOnly`, `SameSite=Lax` có hạn dùng không vượt quá `exp` của token. Route nội bộ kiểm tra same-origin và shape/expiry trước khi set cookie.
- Layout protected đọc cookie này rồi gọi `GET /me` với `cache: no-store`. Chỉ response thật từ API mới được dùng để server-render shell Admin/Student và xác nhận role; payload JWT decode tại web không thay thế verify của backend.
- `DELETE /api/auth/session` xóa cookie token và marker khi logout hoặc khi client phát hiện session thiếu/hết hạn.
- Browser storage hiện vẫn giữ session để các API client phía client gửi Bearer token. Cookie server là cầu nối SSR nhằm loại bỏ màn trống khi hard refresh, không phải nguồn phân quyền độc lập.

### `POST /auth/refresh`

Role: authenticated by refresh token.

Body:

```json
{ "refreshToken": "token" }
```

Side effects:

- Validate token hash trong `refresh_tokens`.
- Rotate refresh token: revoke token cũ và trả token mới.

Response:

```json
{
  "data": {
    "accessToken": "jwt",
    "refreshToken": "new-token",
    "user": {
      "id": "uuid",
      "role": "STUDENT",
      "email": "student1@example.com",
      "username": "student1"
    }
  }
}
```

### `POST /auth/logout`

Role: authenticated.

Body:

```json
{ "refreshToken": "token" }
```

Side effects:

- Revoke refresh token.

Response:

```json
{
  "data": {
    "success": true
  }
}
```

### `POST /auth/forgot-password`

Role: public.

Body:

```json
{
  "identifier": "student1",
  "fullName": "Nguyễn Văn An",
  "grade": 7
}
```

Side effects:

- Tạo `password_reset_tokens` với `token_hash`, `expires_at`.
- Xác minh cả 3 thông tin trên UI đã duyệt: tên đăng nhập/số điện thoại, họ tên và khối lớp.
- `fullName` được so khớp không phân biệt chữ hoa/thường sau khi trim và gộp khoảng trắng; dấu tiếng Việt vẫn phải nhập đúng.
- Nếu 3 thông tin khớp với hồ sơ học sinh trong database, API trả `resetToken` raw một lần để UI chuyển sang bước đổi mật khẩu.
- Nếu không khớp hoặc tài khoản không phải học sinh active, trả `INVALID_RECOVERY_INFO` để UI hiển thị toast lỗi.

Response:

```json
{
  "data": {
    "success": true,
    "resetToken": "raw-reset-token"
  }
}
```

Errors: `INVALID_RECOVERY_INFO`, `VALIDATION_ERROR`.

### `POST /auth/reset-password`

Role: public.

Body:

```json
{
  "token": "reset-token",
  "newPassword": "123456"
}
```

Side effects:

- Hash token để tra `password_reset_tokens`.
- Reject nếu token expired/used/revoked.
- Cập nhật `users.password_hash`.
- Set `password_reset_tokens.used_at`.
- Revoke refresh tokens hiện có của user.

Response:

```json
{
  "data": {
    "success": true
  }
}
```

Errors: `INVALID_RESET_TOKEN`, `RESET_TOKEN_EXPIRED`, `VALIDATION_ERROR`.

---

## 3. Current user/profile API

### `GET /me`

Role: authenticated.

Behavior: trả user và profile theo role. Không trả hash/token/secret.

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "STUDENT",
      "status": "ACTIVE",
      "email": "student1@example.com",
      "phone": "0900000001",
      "username": "student1",
      "fullName": "Nguyễn Văn A",
      "gender": "MALE",
      "dateOfBirth": "2012-01-01",
      "avatarFileId": null,
      "lastLoginAt": "2026-07-08T05:00:00.000Z",
      "emailVerifiedAt": null,
      "phoneVerifiedAt": null,
      "createdAt": "2026-07-08T05:00:00.000Z"
    },
    "studentProfile": {
      "id": "uuid",
      "grade": 7,
      "childCode": "LP123456",
      "address": null,
      "displayName": "An",
      "totalXp": 0,
      "level": 1
    },
    "parentProfile": null
  }
}
```

Errors: `UNAUTHORIZED`, `FORBIDDEN`.

### `PATCH /me/student-profile`

Role: `STUDENT`.

Body:

```json
{
  "displayName": "An",
  "address": "Hà Nội",
  "avatarFileId": "uuid"
}
```

Không cho đổi:

- ngày sinh,
- họ tên,
- giới tính,
- số điện thoại,
- email.

ASSUMPTION: MVP chưa cần endpoint đổi profile riêng cho parent ngoài avatar nếu sau này chốt.

Response: cùng shape với `GET /me`.

Errors: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`.

---
