# ADR-0011 - Client-side Quiz feedback ưu tiên tốc độ

Date: 2026-07-29
Status: Accepted

## Context

Luồng Quiz `M7.2` ban đầu giữ đáp án đúng trên server và gọi API mỗi lần student
bấm `Kiểm tra đáp án`. Cách này không lộ đáp án trong DevTools và lưu feedback
từng câu trên server, nhưng tạo độ trễ mạng ở tương tác lặp lại quan trọng nhất
của runner.

Owner quyết định tốc độ và cảm giác phản hồi tức thì quan trọng hơn việc che dữ
liệu chấm khỏi DevTools trong Quiz học tập.

## Decision

- API start/resume Quiz trả `correctAnswerJson`, `gradingConfigJson` và
  `explanationJson` đã duyệt cùng nội dung câu hỏi.
- `Kiểm tra đáp án` chấm local và không gọi API theo từng câu.
- UI chỉ hiện đáp án/feedback sau action kiểm tra dù dữ liệu đã có ở client.
- Các câu đã kiểm tra và vị trí hiện tại được lưu local theo `attemptId`; đáp án
  nháp chưa kiểm tra không được lưu.
- `Hoàn thành` gửi toàn bộ answer trong một request. Backend vẫn validate đúng
  tập question của attempt, chấm lại authoritative và lưu kết quả trong
  transaction.
- Endpoint check từng câu được giữ tương thích cho client cũ nhưng không thuộc
  luồng UI hiện hành.

## Consequences

Tích cực:

- Feedback sau khi bấm `Kiểm tra đáp án` xuất hiện tức thì, không phụ thuộc độ
  trễ mạng.
- Một attempt chỉ cần request start/resume và một request submit cho luồng làm
  bài chính.
- Backend vẫn là nguồn điểm chính thức khi submit; client không thể tự khai điểm
  cuối cùng.

Đánh đổi:

- Student có thể xem đáp án đúng và lời giải bằng DevTools trước khi kiểm tra.
- Feedback của attempt chưa submit chỉ khôi phục trên cùng trình duyệt; thiết bị
  khác chỉ biết attempt đang dở, không có tiến độ local từng câu.
- Logic chấm local phải được regression test để bám logic authoritative của
  backend cho mọi loại câu.
