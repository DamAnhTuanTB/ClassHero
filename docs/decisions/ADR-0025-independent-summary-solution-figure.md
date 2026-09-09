# ADR-0025 - Hình lời giải độc lập cho Summary Ví dụ/Bài tập

Date: 2026-09-05
Status: Superseded in part by ADR-0027

## Context

Summary trước đây dùng cùng mode `GENERATE_FROM_BLOCK` và projection problem-only
cho mọi block không có ảnh nguồn. Với Ví dụ/Bài tập, cách này không đủ dữ kiện để
Phase 2 dựng phần hình phục vụ mạch giải. Owner yêu cầu hành vi phải giống luồng
hình lời giải Quiz, đồng thời vẫn giữ Summary và Quiz là hai domain độc lập.

## Decision

Khi figure là `GENERATED_FROM_BRIEF`, block là `example` hoặc `exercise` và
`referenceImageMode=NONE`, Summary dùng mode riêng
`GENERATE_SOLUTION_FROM_BLOCK`. Brief gửi `problem` và `solution`, loại `answer`;
prompt áp dụng authority `solution > problem` và bắt buộc dựng full source không
phụ thuộc hình đề, ảnh SGK hoặc source khác.

Summary giữ worker, persistence và contract domain riêng. System prompt, schema
và request builder của đúng role `SOLUTION` đã được chuyển sang Solution Figure
Core dùng chung theo ADR-0027.

Manual authoring dùng target tường minh `QUESTION | SOLUTION`. `QUESTION` chỉ gửi
`problem` và dùng slot `0`; `SOLUTION` gửi `solution > problem`, loại `answer` và
dùng slot `1`. `NONE` tạo mới lại; `CURRENT_ONLY` chỉ sửa source hiện hành của đúng
slot và không yêu cầu ảnh SGK; `SOURCE_CROP_ONLY` không hợp lệ cho target độc lập.
Hai resource không đọc hoặc kế thừa ảnh/source của nhau. Với block không có hình
đề từ SGK, menu luôn giữ hai target; với block đã có hình slot `0` mang reference
SGK, menu giữ action vẽ lại hình hiện tại và thêm target lời giải độc lập.
Renderer dùng `figureIndex` làm vai trò hiển thị: slot `0` thuộc phần đề;
slot `1` nằm ngay sau tiêu đề `Lời giải`. Overview admin phải hiển thị
nhãn vai trò tương ứng thay vì buộc admin suy ra từ thứ tự ảnh.

Luồng `TEXTBOOK_SOURCE`, sửa current source và block thường không thay đổi. Modal
admin mode `NONE` dùng cùng generation-brief builder nên preview và execute bám
đúng contract tự động.

## Consequences

- Phase 2 có đủ dữ kiện dựng hình phục vụ lời giải cho cả Ví dụ và Bài tập.
- Hai domain có thể version/rollout độc lập; thay đổi prompt Quiz không âm thầm làm
  đổi Summary và ngược lại.
- Mode mới làm ấm stable cache prefix riêng; cache các mode hiện hữu không bị
  invalidation.
- Không cần migration database hoặc đổi JSON Schema output.
- Hai modal target luôn có `Tạo mới lại`; `Chỉnh sửa hình hiện tại` chỉ hiện khi
  đúng slot có current asset `AI_TEX`, và bị ẩn khi slot chưa có hình hoặc raster-only.
