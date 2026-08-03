# ADR-0013 - Provider operations và immutable cost snapshot

Date: 2026-08-03
Status: Accepted

## Context

Hệ thống dùng OpenAI, Gemini và Mathpix cho nhiều chức năng có đơn vị tính giá khác nhau. Nếu chỉ lưu model/token trên `ai_generations` hoặc tính lịch sử bằng bảng giá hiện tại, admin không biết chi phí thật tại thời điểm gọi và OCR retry có nguy cơ double-charge.

## Decision

- Tách domain `provider-operations` dùng chung cho AI/OCR.
- Catalog model/service và bảng giá được version theo ngày hiệu lực; admin nhập thủ công kèm link nguồn chính thức.
- Mỗi provider attempt/cache hit tạo immutable `provider_usage_events` snapshot model, price version, tỷ giá, token/page và chi phí.
- AI feature route có primary/fallback và được snapshot khi enqueue. Chỉ lỗi timeout/429/5xx được fallback.
- API key tiếp tục nằm trong env; API/UI chỉ trả credential readiness boolean.
- Mathpix lưu `pdfId` ngay sau submit để retry resume; cache hit ghi cost 0 và saving.
- Budget mặc định soft warning; hard stop là tùy chọn admin bật rõ ràng.
- Embedding model/dimension không cho đổi qua màn này để giữ một vector space ổn định.

## Consequences

- Có thêm schema catalog/price/config/usage/budget/accounting và ADMIN API/UI.
- Cần duy trì bảng giá khi provider thay đổi giá; hệ thống cảnh báo stale nhưng không scrape tự động.
- Usage lịch sử đáng tin cậy hơn và không đổi khi cập nhật bảng giá/tỷ giá.
- Worker phải được restart sau deploy để nhận routing/accounting/OCR retry code mới.
