# Admin provider operations API

Tất cả endpoint dưới đây yêu cầu Bearer token role `ADMIN`, prefix `/api/v1` và dùng envelope chung.

| Method | Path | Mục đích |
| --- | --- | --- |
| `GET` | `/admin/provider-operations/overview` | KPI chi phí tháng, cache saving, reliability và budget |
| `GET` | `/admin/provider-operations/catalog` | Catalog AI/OCR, credential status và price versions |
| `POST` | `/admin/provider-operations/catalog/:id/price-versions` | Thêm giá có ngày hiệu lực và nguồn chính thức |
| `GET/PUT` | `/admin/provider-operations/ai-configurations` | Đọc/lưu model chính, fallback, temperature, token limit |
| `GET/PUT` | `/admin/provider-operations/ocr-settings` | Trạng thái OCR/cache và thiết lập tỷ giá/price freshness |
| `GET/PUT` | `/admin/provider-operations/budgets` | Ngân sách `ALL/AI/OCR`, warning thresholds, hard stop |
| `GET` | `/admin/provider-operations/usage/timeline` | Timeline `DAY/WEEK/MONTH`, tối đa 366 ngày |
| `GET` | `/admin/provider-operations/usage/breakdown` | Breakdown theo provider/model/feature |
| `GET` | `/admin/provider-operations/usage/events` | Event list phân trang và filter |
| `GET` | `/admin/provider-operations/audit-history` | Lịch sử đổi model/giá/budget/accounting |

## Concurrency và validation

- PUT configuration/budget/accounting bắt buộc `expectedVersion`; mismatch trả `409` để UI tải lại.
- Model phải đúng category/capability; fallback khác primary.
- Catalog trả toàn bộ model AI `ACTIVE` phù hợp capability để UI nhóm ô chọn theo provider; model thiếu credential vẫn được hiển thị nhưng bị vô hiệu hóa kèm lý do.
- Price version chỉ thêm mới. Backend đóng khoảng hiệu lực cũ thay vì overwrite.
- Timeline dùng múi giờ `Asia/Ho_Chi_Minh`, tuần bắt đầu thứ Hai.
- Response chỉ có boolean `credentialConfigured`, tuyệt đối không trả secret/key.

## Hard-stop tuyệt đối (`M9.12`)

- `GET /overview` và `GET /budgets` trả riêng `usedVnd`, `reservedVnd`, `availableVnd` và `enforcementState` cho từng scope. `availableVnd` không âm và được tính từ cùng period/counter logic dùng để chặn provider call.
- Khi `hardStop=true`, provider gateway phải tạo reservation trước khi gọi dịch vụ ngoài. Reservation kiểm tra đồng thời scope `ALL` và `AI` hoặc `OCR` trong một PostgreSQL transaction có khóa theo `period + scope`.
- Nếu số tiền giữ chỗ làm vượt một trong các scope, trả domain error `PROVIDER_BUDGET_HARD_LIMIT` với HTTP `409`; `details` chỉ gồm `scope`, `period`, `limitVnd`, `usedVnd`, `reservedVnd`, `requestedVnd`, `availableVnd`.
- Nếu thiếu bảng giá/tỷ giá/trần usage để chứng minh reservation đủ lớn, trả `PROVIDER_BUDGET_ESTIMATE_UNAVAILABLE` với HTTP `409` và không gọi provider.
- Hai mã lỗi trên là business/non-transient: không kích hoạt model fallback, không retry job. Job lưu mã lỗi và message tiếng Việt để UI polling hiển thị được.
- Reservation dùng idempotency key ổn định theo provider attempt/job. Request lặp lại trả cùng reservation, không giữ chỗ lần hai.
- Khi bật hard-stop, PUT ngân sách thấp hơn số đã dùng + đang giữ bị từ chối; không hủy hoặc giảm reservation đang chạy.
