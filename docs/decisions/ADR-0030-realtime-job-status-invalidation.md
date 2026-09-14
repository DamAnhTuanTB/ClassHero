# ADR-0030 - Realtime job status là invalidation signal

Date: 2026-09-11

Status: Accepted

## Context

Admin lesson detail có nhiều background job độc lập cho document, embedding,
Summary, Video Summary, Quiz, Flashcard, Test và figure. Poll 1,5-5 giây cho từng
query tạo request trùng lặp, phản hồi vẫn trễ theo interval và tăng tải khi nhiều
Admin cùng mở màn hình. API và worker chạy ở process/container riêng nên emit
Socket.IO trực tiếp từ worker không fan-out được tới mọi API instance.
Danh sách enrollment cũng poll 4 giây khi đang clone lộ trình cá nhân và dùng
cùng lifecycle background job nên thuộc cùng cơ chế đồng bộ.

## Decision

- Dùng một authenticated Socket.IO connection cho mỗi Admin web session.
- API/worker publish event `background_job.status_changed.v1` qua Redis Pub/Sub
  channel riêng của ứng dụng; mỗi API instance subscribe và emit vào user/lesson
  room cục bộ.
- Event chỉ là invalidation signal tối thiểu, versioned và không chứa dữ liệu
  nhạy cảm. Database + REST/TanStack Query tiếp tục authoritative.
- Lesson room là Admin-only và được backend kiểm tra trước khi join. Client
  dedupe `eventId`, patch cache job, invalidate resource liên quan và refetch
  snapshot khi subscribe/reconnect.
- Giữ slow polling reconciliation khi connected và polling nhanh hơn khi
  disconnected. Hai feature flag backend/frontend cho phép rollback transport.
- V1 chấp nhận Redis Pub/Sub at-most-once, không thêm outbox/database migration;
  missed event được chữa bằng snapshot và fallback polling. Lỗi realtime không
  được làm provider/background job retry.

## Consequences

- Giảm mạnh request polling thường trực và trạng thái terminal xuất hiện sớm hơn.
- Mọi transition job mới phải đi qua lifecycle publisher hoặc snapshot publisher;
  event schema/shared mapping cần được cập nhật khi thêm resource type mới.
- Deploy phải proxy WebSocket upgrade đúng `SOCKET_IO_PATH` và restart đồng thời
  API, worker, web. Nếu Redis/subscriber lỗi, UI vẫn đúng sau nhịp REST fallback
  nhưng không còn độ trễ realtime.
