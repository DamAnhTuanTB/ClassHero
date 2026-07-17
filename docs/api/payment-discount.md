# API Payment And Discount

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 16. Payment API

### `POST /student/payments`

Role: `STUDENT`.

Body:

```json
{
  "learningPathId": "uuid",
  "discountCode": "SALE10",
  "idempotencyKey": "client-generated-key"
}
```

Behavior:

- Kiểm tra student chưa có active enrollment còn hạn.
- Nếu có payment `PENDING` chưa hết hạn cho cùng student + learning path, có thể trả payment cũ.
- Server tính giá, không tin amount từ client.
- Tạo payOS order.
- Lưu payment `PENDING`.
- Trả checkout/QR.

### `POST /student/payments/mock-success`

Role: `STUDENT`.

Body:

```json
{
  "learningPathId": "uuid"
}
```

Behavior:

- Endpoint giả để test nhanh nút `Mua ngay` trong môi trường dev/MVP.
- Không gọi payOS và không dùng cho production payment thật.
- Kiểm tra lộ trình published và student chưa có active enrollment còn hạn.
- Nếu student đã có active enrollment, trả enrollment hiện có với `mode = "ALREADY_ENROLLED"`.
- Nếu chưa có enrollment, tạo payment `PAID` nguồn mock và tạo enrollment active 12 tháng.
- Server vẫn tự tính amount theo giá lộ trình, không nhận amount từ client.
- Front-end invalidate/refetch danh sách hoặc chi tiết lộ trình để trạng thái chuyển sang đã mua.

Response:

```json
{
  "data": {
    "mode": "MOCK_SUCCESS",
    "learningPathId": "uuid",
    "payment": {
      "id": "uuid",
      "status": "PAID",
      "amountVnd": 4000000,
      "paidAt": "2026-07-17T10:00:00.000Z"
    },
    "enrollment": {
      "id": "uuid",
      "status": "ACTIVE",
      "startsAt": "2026-07-17T10:00:00.000Z",
      "expiresAt": "2027-07-17T10:00:00.000Z"
    }
  }
}
```

### `GET /payments/:paymentId`

Role: authenticated.

Behavior:

- Student xem payment của mình.
- Parent xem payment mình tạo.
- Admin xem mọi payment.

### `POST /webhooks/payos`

Role: public webhook, nhưng phải verify checksum.

Behavior:

- Lưu `payment_webhook_logs` ngay khi nhận.
- Verify signature/checksum.
- Idempotency theo `provider_order_code` và event id nếu có.
- Update payment.
- Create enrollment 12 tháng nếu paid.
- Trigger notification.
- Không xử lý paid hai lần.

---

## 17. Discount API

### `GET /admin/discount-codes`

Role: `ADMIN`.

### `POST /admin/discount-codes`

Role: `ADMIN`.

Body:

```json
{
  "code": "SALE10",
  "type": "PERCENT",
  "value": 10,
  "startsAt": "2026-08-01T00:00:00.000Z",
  "endsAt": "2026-09-01T00:00:00.000Z",
  "maxUses": 100,
  "isActive": true
}
```

### `POST /discount-codes/validate`

Role: authenticated.

Body:

```json
{
  "code": "SALE10",
  "learningPathId": "uuid"
}
```

Response: amount preview. Server vẫn phải tính lại khi tạo payment.

---
