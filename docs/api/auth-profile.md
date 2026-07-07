# API Auth And Profile

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 2. Auth API

### `POST /auth/register/student`

Role: public.

Body:

```json
{
  "email": "student1@example.com",
  "phone": "0900000001",
  "username": "student1",
  "password": "Password123!",
  "fullName": "Nguyễn Văn A",
  "grade": 7,
  "gender": "MALE",
  "dateOfBirth": "2012-01-01"
}
```

Side effects:

- Tạo `users` role `STUDENT`.
- Tạo `student_profiles` và `child_code`.
- Hash password.

Errors: `DUPLICATE_EMAIL`, `DUPLICATE_PHONE`, `DUPLICATE_USERNAME`, `VALIDATION_ERROR`.

### `POST /auth/register/parent`

Role: public.

Body:

```json
{
  "email": "parent1@example.com",
  "phone": "0910000001",
  "password": "Password123!",
  "fullName": "Phụ huynh A"
}
```

Side effects:

- Tạo `users` role `PARENT`.
- Tạo `parent_profiles`.
- Hash password.

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

### `POST /auth/refresh`

Role: authenticated by refresh token.

Body:

```json
{ "refreshToken": "token" }
```

Side effects:

- Validate token hash trong `refresh_tokens`.
- Có thể rotate refresh token.

### `POST /auth/logout`

Role: authenticated.

Body:

```json
{ "refreshToken": "token" }
```

Side effects:

- Revoke refresh token.

### `POST /auth/forgot-password`

Role: public.

Body:

```json
{ "identifier": "student1@example.com" }
```

Side effects:

- Tạo `password_reset_tokens` với `token_hash`, `expires_at`.
- Gửi email qua Resend nếu user có email.
- Không tiết lộ email/identifier có tồn tại hay không.

### `POST /auth/reset-password`

Role: public.

Body:

```json
{
  "token": "reset-token",
  "newPassword": "NewPassword123!"
}
```

Side effects:

- Hash token để tra `password_reset_tokens`.
- Reject nếu token expired/used/revoked.
- Cập nhật `users.password_hash`.
- Set `password_reset_tokens.used_at`.
- Revoke refresh tokens hiện có của user.

---

## 3. Current user/profile API

### `GET /me`

Role: authenticated.

Behavior: trả user và profile theo role. Không trả hash/token/secret.

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

---
