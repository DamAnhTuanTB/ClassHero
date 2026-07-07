# Database Payment And Discount

Chi tiết tách từ `docs/04-database-model.md`. File index chính vẫn là `docs/04-database-model.md`.

---

## 12. Payment và discount

### 12.1. `discount_codes`

```txt
id uuid pk
code string unique
type DiscountType
value int
starts_at timestamp?
ends_at timestamp?
max_uses int?
used_count int default 0
is_active boolean default true
created_by_id uuid? fk users.id
created_at timestamp
updated_at timestamp
```

Rules:

- `PERCENT`: value từ 1 đến 100.
- `FIXED_AMOUNT`: value là số VNĐ.
- Service phải validate thời hạn, số lượt dùng, active status.
- Server luôn tính lại giá khi tạo payment, không tin amount từ client.

### 12.2. `payments`

```txt
id uuid pk
provider PaymentProvider default PAYOS
status PaymentStatus default PENDING
payer_user_id uuid fk users.id
student_user_id uuid fk users.id
learning_path_id uuid fk learning_paths.id
discount_code_id uuid? fk discount_codes.id
idempotency_key string?
provider_order_code string unique
provider_payment_link_id string?
checkout_url string?
qr_code string?
amount_vnd int
original_amount_vnd int
discount_amount_vnd int default 0
paid_at timestamp?
expired_at timestamp?
raw_response_json jsonb?
created_at timestamp
updated_at timestamp
```

Index/constraint:

- unique `provider_order_code`.
- index `(payer_user_id, status)`.
- index `(student_user_id, learning_path_id, status)`.
- index `idempotency_key` nếu not null.

Rules:

- Webhook phải idempotent theo `provider_order_code` và/hoặc event id.
- Nếu client gửi `idempotency_key`, service không tạo trùng payment cho cùng payer + student + learning path + key.
- Nếu đã có payment `PENDING` chưa hết hạn cho cùng student + learning path, service có thể trả lại payment cũ.
- Nếu student đã có enrollment active còn hạn, không tạo payment mới.

### 12.3. `payment_webhook_logs`

```txt
id uuid pk
provider PaymentProvider default PAYOS
event_id string?
provider_order_code string?
raw_payload_json jsonb
signature string?
verified boolean default false
processed boolean default false
processing_error text?
received_at timestamp
processed_at timestamp?
```

Index/constraint:

- unique `event_id` nếu payOS cung cấp id unique.
- index `provider_order_code`.
- index `(verified, processed)`.

---
