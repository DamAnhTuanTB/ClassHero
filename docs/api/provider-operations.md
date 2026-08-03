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
- Price version chỉ thêm mới. Backend đóng khoảng hiệu lực cũ thay vì overwrite.
- Timeline dùng múi giờ `Asia/Ho_Chi_Minh`, tuần bắt đầu thứ Hai.
- Response chỉ có boolean `credentialConfigured`, tuyệt đối không trả secret/key.
