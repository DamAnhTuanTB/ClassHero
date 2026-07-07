# Database Auth And Users

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 3. Auth và user

### 3.1. `users`

Mục đích: tài khoản dùng chung cho admin, student, parent.

```txt
id uuid pk
role UserRole
status UserStatus default ACTIVE
email string? unique
phone string? unique
username string? unique
password_hash string
full_name string?
gender Gender default UNKNOWN
date_of_birth date?
avatar_file_id uuid? fk files.id
last_login_at timestamp?
email_verified_at timestamp?
phone_verified_at timestamp?
created_at timestamp
updated_at timestamp
deleted_at timestamp?
```

Index/constraint:

- unique email nếu not null.
- unique phone nếu not null.
- unique username nếu not null.
- index `(role, status)`.

Không bao giờ trả `password_hash` ra API.

### 3.2. `student_profiles`

```txt
id uuid pk
user_id uuid unique fk users.id
grade int
child_code string unique
address string?
display_name string?
total_xp int default 0
level int default 1
created_at timestamp
updated_at timestamp
```

Rules:

- `child_code` dùng để phụ huynh liên kết con.
- Một student có thể có 0 hoặc 1 parent link.

### 3.3. `parent_profiles`

```txt
id uuid pk
user_id uuid unique fk users.id
created_at timestamp
updated_at timestamp
```

### 3.4. `parent_student_links`

```txt
id uuid pk
parent_user_id uuid fk users.id
student_user_id uuid fk users.id
created_at timestamp
```

Constraint:

- unique `(parent_user_id, student_user_id)`.
- unique `student_user_id` để đảm bảo một học sinh chỉ có một phụ huynh.

### 3.5. `refresh_tokens`

```txt
id uuid pk
user_id uuid fk users.id
token_hash string
expires_at timestamp
revoked_at timestamp?
created_at timestamp
```

Index:

- `user_id`.
- `expires_at`.

Rules:

- Không lưu raw refresh token.
- Revoke token khi logout hoặc rotate refresh token.

### 3.6. `password_reset_tokens`

Dùng cho quên mật khẩu/reset mật khẩu.

```txt
id uuid pk
user_id uuid fk users.id
token_hash string
expires_at timestamp
used_at timestamp?
revoked_at timestamp?
request_ip string?
user_agent string?
created_at timestamp
```

Index/constraint:

- unique `token_hash`.
- index `user_id`.
- index `expires_at`.

Rules:

- Không lưu raw reset token.
- Token phải hết hạn sau thời gian ngắn.
- Sau khi reset password thành công, set `used_at`.
- Token đã used/revoked/expired không được dùng lại.

---
