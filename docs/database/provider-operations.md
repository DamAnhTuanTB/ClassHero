# Provider operations: model routing, bảng giá và usage

Domain này phục vụ màn `/admin/ai-settings` và không lưu secret provider.

## Bảng chính

- `provider_catalog_items`: catalog model AI/dịch vụ OCR, capability, trạng thái và tên env credential để kiểm tra readiness.
- `provider_price_versions` + `provider_price_rates`: bảng giá USD có thời điểm hiệu lực. Giá cũ không bị sửa để usage lịch sử giữ nguyên snapshot.
- `ai_feature_model_configs`: model chính/dự phòng, temperature, max input token
  và max output token cho `SUMMARY`, `QUIZ`, `FLASHCARD`, `TEST`; `version` dùng
  optimistic concurrency.
- `provider_usage_events`: một record bất biến cho mỗi provider attempt hoặc OCR cache hit; liên kết được với `ai_generations`, `background_jobs`, `source_documents`.
- `provider_budget_policies`: ngân sách tháng `ALL`, `AI`, `OCR`; mặc định cảnh báo mềm, `hard_stop=false`.
- `provider_budget_reservations` (`M9.12`): giữ chỗ chi phí trước paid call, có `idempotency_key` unique, period theo múi giờ kế toán, category, số tiền giữ/quyết toán, trạng thái `RESERVED/SETTLED/RELEASED/UNCERTAIN`, expiry/heartbeat và liên kết usage/job/generation/document.
- `provider_accounting_settings`: múi giờ, ngày bắt đầu tuần, tỷ giá USD/VND và ngưỡng giá cũ.

## Quy tắc

- Tiền VND dùng integer; USD/tỷ giá dùng Decimal chỉ ở lớp accounting.
- Usage event lưu cả price version, tỷ giá, raw unit, USD và VND tại thời điểm gọi; không tính ngược bằng bảng giá mới.
- `provider_usage_events` là nguồn chuẩn khi hiển thị tổng số lượt gọi và tổng
  chi phí của một lần sinh. `ai_generations.estimated_cost_vnd` chỉ là projection
  denormalized để truy vấn nhanh/giữ tương thích; UI/API phải aggregate hoặc đối
  chiếu event khi cần số tiền chính xác sau các lượt gọi phase sau.
- AI token tách input, cached input và output. OCR lưu pages; cache hit có `cost_vnd=0` và `estimated_saved_cost_vnd`.
- `raw_usage_json` của lượt AI mới tách `providerUsage` nguyên bản khỏi
  `fileOperations` do backend ghi. Không trộn metadata xử lý file vào object usage
  của provider; các cột token chuẩn hóa mới là nguồn tính phí và aggregate.
- Index chính theo `created_at`, category/provider/model/feature/status để phục vụ dashboard.
- Cấu hình và giá thay đổi phải ghi `audit_logs`; API không trả API key.
- `ai_feature_model_configs.max_input_tokens` là nguồn chuẩn cho reservation AI;
  admin quản lý cùng `max_output_tokens` theo từng tính năng. Catalog model và
  price version không sở hữu cấu hình này; metadata
  `provider_price_rates.conditions_json.maxInputTokens` chỉ còn để đọc route
  snapshot/job cũ trong giai đoạn tương thích.
- Catalog AI mặc định chỉ seed model text/structured-output ổn định dùng được cho `SUMMARY`, `QUIZ`, `FLASHCARD`, `TEST`. Model preview, audio, image và deprecated không xuất hiện trong ô chọn.
- Catalog hiện gồm các họ OpenAI GPT-5.6/GPT-5.4/GPT-4.1 và Gemini 3.6/3.5/3.1/2.5; bảng giá seed lấy từ trang giá chính thức của từng provider và vẫn phải tạo price version mới khi provider đổi giá.

### Reservation và tính nhất quán ngân sách (`M9.12`)

- Period lưu bằng khóa tháng local `YYYY-MM` tính theo `provider_accounting_settings.timezone`; index tối thiểu theo `(period_key, status, category)`.
- Transaction reserve lấy advisory/row lock cho `ALL` và scope category theo thứ tự cố định, tính `SUM(cost_vnd đã settle) + SUM(reserved_vnd đang RESERVED/UNCERTAIN)`, rồi mới insert reservation. Không tách check và insert thành hai transaction.
- `SETTLED` phải cập nhật usage cost và reservation trong cùng transaction; actual cost không được lớn hơn mức đã giữ. Nếu không chứng minh được upper bound trước call thì fail-closed.
- `RELEASED` chỉ dùng khi chắc chắn provider chưa bill. Timeout/crash/billing không rõ chuyển `UNCERTAIN`; reconciliation chỉ giải phóng khi có bằng chứng.
- Unique idempotency key chống worker retry/resume giữ chỗ hai lần. Constraint giữ mọi số tiền không âm và cấm transition trạng thái ngược.
- Usage hiện có vẫn được tính từ `created_at` theo biên tháng local; lần deploy đầu không coi lịch sử tháng hiện tại là 0.
