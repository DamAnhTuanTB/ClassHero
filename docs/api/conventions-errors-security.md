# API Conventions Errors Security

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 1. Quy ước chung

### 1.1. Response envelope

Response thành công:

```json
{
  "data": {},
  "meta": {}
}
```

Response lỗi:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ",
    "details": []
  }
}
```

### 1.2. Pagination

Query:

```txt
?page=1&pageSize=20&search=abc&sort=createdAt:desc
```

Response meta:

```json
{
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 1.3. Auth/RBAC

Header:

```txt
Authorization: Bearer <access_token>
```

Roles:

```txt
ADMIN
STUDENT
PARENT
```

Backend phải enforce RBAC và ownership ở service/policy layer, không chỉ ở frontend.

### 1.4. HTTP status

```txt
200 OK
201 Created
202 Accepted - job đã được queue
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
500 Internal Server Error
```

### 1.5. Async job convention

Các API tạo job nền trả `jobId = background_jobs.id`.

Response queued chuẩn:

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

Client có thể poll:

```txt
GET /jobs/:jobId
```

hoặc nhận Socket.IO event nếu user online.

---

## 23. Error codes đề xuất

```txt
VALIDATION_ERROR
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
CONFLICT
INVALID_CREDENTIALS
DUPLICATE_EMAIL
DUPLICATE_PHONE
DUPLICATE_USERNAME
INVALID_RESET_TOKEN
RESET_TOKEN_EXPIRED
INVALID_CHILD_CODE
STUDENT_ALREADY_LINKED_TO_PARENT
ENROLLMENT_REQUIRED
ACTIVE_ENROLLMENT_EXISTS
TRIAL_NOT_AVAILABLE
LESSON_NOT_OPEN
TEST_NOT_OPEN
ATTEMPT_ALREADY_SUBMITTED
PAYMENT_NOT_FOUND
PAYMENT_WEBHOOK_INVALID_SIGNATURE
PAYMENT_ALREADY_PROCESSED
DISCOUNT_INVALID
DISCOUNT_EXPIRED
AI_CONTEXT_NOT_FOUND
AI_OUTPUT_INVALID
AI_JOB_NOT_FOUND
FILE_TYPE_NOT_ALLOWED
FILE_TOO_LARGE
FILE_PURPOSE_NOT_ALLOWED
REPORT_TARGET_INVALID
PERSONAL_LEARNING_PATH_EXISTS
PERSONAL_LEARNING_PATH_NOT_READY
PERSONAL_LEARNING_PATH_ACCESS_DENIED
PERSONAL_LEARNING_PATH_CLONE_FAILED
```

---

## 24. Security rules bắt buộc

- Backend enforce RBAC cho mọi endpoint cần quyền.
- Student không được xem attempt/note/comment/favorite của student khác.
- Parent chỉ được xem con đã link.
- Admin endpoint phải role `ADMIN`.
- Payment webhook verify checksum.
- Payment webhook phải idempotent.
- File signed URL phải kiểm tra quyền trước.
- Không trả correct answer cho test trước khi submit.
- Không trả password hash, refresh token hash, reset token hash, provider secret, raw secret.
- Không lưu secret/API key trong database job result hoặc AI prompt.
