# ADR-0026 - Flashcard chỉ tạo hình minh họa lời giải

Date: 2026-09-08
Status: Superseded in part by ADR-0027

## Context

Luồng hình Flashcard ban đầu cho phép AI quyết định và tạo hai asset riêng cho
mặt trước và mặt sau. Cách này làm schema, prompt, API, worker và UI phải mang
hai role `FRONT|BACK`, trong khi contract nội dung đã xác định `back` là câu trả
lời ngắn và `solution` mới là lời giải chi tiết cần trực quan hóa.

Quiz đã có invariant hình lời giải rõ ràng, nhưng Flashcard vẫn phải giữ domain,
prompt, schema, queue, service và dữ liệu độc lập với Quiz.

## Decision

1. Lượt tạo nội dung Flashcard chỉ trả một boolean
   `requiresSolutionFigure`. Không còn `requiresFrontFigure` hoặc
   `requiresBackFigure` trong schema mới.
2. Lượt tạo hình chỉ tạo logical figure role `SOLUTION`. Nội dung hình lấy
   `solution` làm authority chính và dùng `front` để kiểm chứng ngữ cảnh; không
   dùng `back` làm nguồn thay thế cho lời giải.
3. Flashcard ánh xạ `front -> problem` và dùng chung system prompt, schema và
   request builder của Solution Figure Core theo ADR-0027; queue, persistence,
   compiler adapter, storage và UI state vẫn thuộc domain Flashcard.
4. Menu tạo ảnh trên thẻ giữ pattern dạng danh sách nhưng chỉ có lựa chọn
   `Tạo ảnh cho lời giải`.
5. Modal dùng cùng request builder và worker với luồng tự động. Modal luôn hỗ
   trợ `REGENERATE`; chỉ hiển thị `Chỉnh sửa hình hiện tại` khi current revision
   là `AI_TEX`, thành công và còn source hợp lệ để truyền bằng mode
   `EDIT_CURRENT`.
6. Enum/database giữ `FRONT|BACK` để đọc dữ liệu legacy không phá hủy, nhưng
   selector, serializer và toàn bộ runtime mới chỉ tạo/đọc `SOLUTION`.
7. Thay đổi schema/prompt/cache namespace phải tăng version; không tái sử dụng
   cache artifact của contract hai mặt.

## Consequences

- Schema, chi phí dự kiến, số job và UI đơn giản hơn: mỗi thẻ chỉ có 0 hoặc 1
  hình lời giải.
- Hình gắn đúng nơi có nội dung diễn giải đầy đủ, đồng thời không làm mặt trước
  vô tình lộ đáp án.
- Dữ liệu hình `FRONT|BACK` cũ không bị xóa nhưng không còn xuất hiện trong
  luồng mới; nếu cần chuyển đổi/xóa về sau phải có task dữ liệu riêng.
- Mọi thay đổi code worker cần restart worker trước khi kiểm thử luồng mới.
