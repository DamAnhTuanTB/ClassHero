# ADR-0014 - Atomic reservation cho hard-stop ngân sách provider

Date: 2026-08-03
Status: Accepted

## Context

Kiểm tra tổng chi đã ghi trước provider call không thể bảo đảm hard limit khi nhiều worker chạy đồng thời, khi request cuối có thể đẩy chi phí vượt ngưỡng, hoặc khi timeout không rõ provider đã bill. Chu kỳ hiện tại dùng UTC cũng lệch với tháng kế toán theo giờ Việt Nam.

## Decision

- Hard-stop dùng mô hình `reserve -> provider call -> settle/release/uncertain`.
- Reservation và kiểm tra hai scope `ALL` + `AI/OCR` chạy trong một PostgreSQL transaction có khóa theo `period + scope`; lock chỉ tồn tại trong bước reserve.
- Reservation là record riêng, idempotent, có state machine và liên kết usage/job. Số dư khả dụng tính cả chi phí đã settle lẫn reservation đang giữ.
- Mức reserve là upper bound bảo thủ, quy đổi VNĐ và làm tròn lên. Nếu không chứng minh được upper bound do thiếu giá/tỷ giá/trần usage thì fail-closed.
- Period bám timezone kế toán. Budget error là non-transient, không fallback và không retry worker.
- Timeout/billing mơ hồ giữ `UNCERTAIN`; chỉ reconciliation có bằng chứng mới release.

## Consequences

- Có migration/model reservation, index/constraint và gateway paid-call cho AI/OCR.
- Có thể chặn bảo thủ hơn chi phí thật trong lúc request đang chạy hoặc billing chưa rõ, đổi lại không vượt ngân sách đã cấu hình.
- Cần test PostgreSQL concurrency và observability/reconciliation; mock provider là đủ, không cần gọi provider trả phí để xác minh.
