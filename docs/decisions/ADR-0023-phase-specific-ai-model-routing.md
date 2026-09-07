# ADR-0023 - Tách model routing theo phase AI

Date: 2026-08-25
Status: Accepted

## Context

Mỗi `SUMMARY`, `QUIZ`, `FLASHCARD`, `TEST` trước đây chỉ có một cấu hình model.
Summary và Quiz dùng cùng route đó cho cả lượt sinh text Phase 1 và các lượt sinh
hình Phase 2. Điều này khiến admin không thể chọn model tối ưu riêng theo mục
đích, chi phí/token limit của hai phase bị gắn với nhau và thay model tạo text có
thể vô tình thay model tạo ảnh của job sau.

Flashcard và Test hiện chưa có figure pipeline nhưng owner yêu cầu màn Cài đặt AI
quản lý đủ hai loại thiết lập cho mọi feature để contract không phải đổi lại khi
hai flow này hỗ trợ hình.

## Decision

- Khóa cấu hình model là `(feature, purpose)` thay vì chỉ `feature`.
- `purpose=TEXT` thuộc Phase 1 tạo nội dung; `purpose=IMAGE` thuộc Phase 2 tạo hình.
- Cả bốn feature đều có hai cấu hình. Flashcard/Test chưa tiêu thụ route IMAGE
  cho đến khi một task riêng bổ sung figure pipeline.
- Summary/Quiz snapshot riêng route text và route ảnh trong preview/draft/job.
  Mọi paid call tạo hình, kể cả retry/tạo mới riêng, chỉ resolve route IMAGE.
- Request Summary/Quiz giữ nhóm override hiện tại cho Phase 1 và bổ sung nhóm
  `figure*` cho Phase 2 để giảm breaking change cho client.
- Migration clone config legacy sang cả TEXT và IMAGE. Job legacy chỉ có một
  snapshot vẫn được đọc tương thích; job mới không được fallback ngầm từ IMAGE
  sang TEXT khi đã có hai route snapshot.
- Token limit, reservation, fallback, usage và audit được áp dụng/ghi nhận theo
  đúng phase đang gọi.
- Preview và runtime phải chuyển nguyên giá trị `reasoningEffort` và
  `maxOutputTokens` đã cấu hình cho đúng cặp `(feature, purpose)` xuống provider.
  Default cục bộ chỉ được dùng khi route hoặc trường tương ứng thật sự không có;
  service/worker không được âm thầm cap, nâng hoặc ghi đè cấu hình đã chọn. Nếu
  cần một hard limit an toàn cấp provider/hệ thống, limit đó phải là contract
  riêng được tài liệu hóa và hiển thị cho admin, đồng thời preview phải phản ánh
  đúng effective request sẽ chạy.

## Consequences

- Admin kiểm soát độc lập chất lượng, latency và chi phí tạo text/tạo ảnh.
- API cấu hình tăng từ tối đa bốn lên tám item; optimistic version và validation
  phải dùng composite key.
- Summary/Quiz modal và panel data lớn hơn nhưng vẫn dùng một lần fetch, không
  phát sinh query theo từng phase.
- Cần migration/backfill, cập nhật API/web/worker đồng bộ và restart worker khi
  triển khai `M9.20`.
- Flashcard/Test sẽ hiển thị cấu hình IMAGE chưa được dùng; UI phải diễn đạt đây
  là thiết lập sẵn, không được báo rằng pipeline hiện tại đã tạo hình.
