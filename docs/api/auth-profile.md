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

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "STUDENT",
      "email": "student1@example.com",
      "phone": "0900000001",
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

Response:

```json
{
  "data": {
    "user": {
      "id": "uuid",
      "role": "PARENT",
      "email": "parent1@example.com",
      "phone": "0910000001",
      "username": null,
      "fullName": "Phụ huynh A"
    }
  }
}
```

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
{ "identifier": "student1@example.com" }
```

Side effects:

- Tạo `password_reset_tokens` với `token_hash`, `expires_at`.
- Gửi email qua Resend nếu user có email và `RESEND_API_KEY`/`RESEND_FROM_EMAIL` đã cấu hình thật.
- Không tiết lộ email/identifier có tồn tại hay không.

Response:

```json
{
  "data": {
    "success": true
  }
}
```

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
