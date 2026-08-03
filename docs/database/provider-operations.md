# Provider operations: model routing, bảng giá và usage

Domain này phục vụ màn `/admin/ai-settings` và không lưu secret provider.

## Bảng chính

- `provider_catalog_items`: catalog model AI/dịch vụ OCR, capability, trạng thái và tên env credential để kiểm tra readiness.
- `provider_price_versions` + `provider_price_rates`: bảng giá USD có thời điểm hiệu lực. Giá cũ không bị sửa để usage lịch sử giữ nguyên snapshot.
- `ai_feature_model_configs`: model chính/dự phòng, temperature và max output token cho `SUMMARY`, `QUIZ`, `FLASHCARD`, `TEST`; `version` dùng optimistic concurrency.
- `provider_usage_events`: một record bất biến cho mỗi provider attempt hoặc OCR cache hit; liên kết được với `ai_generations`, `background_jobs`, `source_documents`.
- `provider_budget_policies`: ngân sách tháng `ALL`, `AI`, `OCR`; mặc định cảnh báo mềm, `hard_stop=false`.
- `provider_accounting_settings`: múi giờ, ngày bắt đầu tuần, tỷ giá USD/VND và ngưỡng giá cũ.

## Quy tắc

- Tiền VND dùng integer; USD/tỷ giá dùng Decimal chỉ ở lớp accounting.
- Usage event lưu cả price version, tỷ giá, raw unit, USD và VND tại thời điểm gọi; không tính ngược bằng bảng giá mới.
- AI token tách input, cached input và output. OCR lưu pages; cache hit có `cost_vnd=0` và `estimated_saved_cost_vnd`.
- Index chính theo `created_at`, category/provider/model/feature/status để phục vụ dashboard.
- Cấu hình và giá thay đổi phải ghi `audit_logs`; API không trả API key.
