# ADR-0022: System prompt AI độc lập theo môn

- Date: 2026-08-25
- Status: Accepted

## Context

Prompt hình trước đây có một policy được gọi là toàn hệ thống nhưng phần lớn là
quy tắc Hình học Toán. Cách ghép đó làm Lý/Hóa nhận vocabulary không thuộc môn,
đồng thời rule chống lộ kết luận của hình đề có thể lan sang các lượt vẽ hình lời
giải `EXTEND_QUESTION` và `REDRAW_AS_MODEL` vốn phải thể hiện quan hệ đã làm rõ.

Owner yêu cầu Toán, Vật lý và Hóa học có system prompt riêng trong cả Sinh kiến
thức và Quiz. Không dùng bất kỳ core prompt chung nào; kể cả phần role,
output/safety contract giống hệt nhau cũng phải được viết đầy đủ trong từng môn.

## Decision

- Sinh kiến thức và Quiz mỗi domain tự sở hữu ba system prompt hoàn chỉnh cho
  `MATH`, `PHYSICS`, `CHEMISTRY`; `GENERAL` là fallback riêng.
- Summary/StemFigure không import prompt hình của Quiz và ngược lại.
- Chỉ chia sẻ hạ tầng code nằm ngoài prompt như provider, queue, structured-output
  schema, TeX safety/allowlist, accounting và persistence. Không chia sẻ prompt
  prose, prompt constant, common policy hoặc helper ghép section giữa các môn.
- Mỗi subject module tự xử lý các mode của chính nó. Dispatcher chỉ chọn môn và
  mode; không nối thêm nội dung sau khi subject đã được resolve.
- Mỗi operation có mục tiêu khác biệt phải có prompt chuyên dụng trong từng môn.
  Cấm tạo prompt mới bằng cách nối nguyên một prompt của operation khác rồi thêm
  câu yêu cầu model bỏ qua/thay thế contract cũ. Cụ thể, Quiz `Tinh chỉnh` không
  được prepend prompt sinh hình `QUESTION`, `EXTEND_QUESTION` hoặc
  `REDRAW_AS_MODEL`; nó chỉ mang authority, policy chuyên môn cần thiết, đánh giá
  lỗi mở, output/safety contract của chính operation tinh chỉnh.
- User input gửi model phải tối giản theo nguồn sự thật: không lặp `role` ngoài
  `figurePlan`, không đưa operation/job metadata hoặc metadata mô tả ảnh nếu cùng
  ý nghĩa đã nằm trong system prompt và attachment. Operation vẫn được giữ ở
  durable job/audit bên ngoài prompt.
- Prompt version Phase 1 chứa subject; figure Phase 2 chứa subject và mode/role.
- Rule chống lộ đáp án nằm trong hợp đồng hình đề, không nằm trong policy môn.
- Regression test phải chứng minh vocabulary Toán/Lý/Hóa không xuất hiện chéo,
  đồng thời bao phủ Quiz `NONE`, hình đề, `EXTEND_QUESTION`, `REDRAW_AS_MODEL` và
  các mode tạo/sửa/repair hình của Sinh kiến thức.

## Consequences

- Có lượng lặp lớn nhưng chủ ý giữa các prompt để giữ ranh giới hoàn toàn độc lập.
- Thay đổi policy của một môn chỉ bump version và test của môn đó/mode liên quan.
- Prompt ngắn hơn giảm token/chi phí và tránh mâu thuẫn chú ý giữa contract sinh
  mới, sửa tối thiểu và tinh chỉnh toàn diện. Regression test phải khóa các từ
  khóa/section của operation cũ không quay lại prompt tinh chỉnh.
- Không còn file common chứa bất kỳ system-prompt prose nào. Mọi đề xuất đưa role,
  output/safety instruction, visual policy hoặc subject policy vào prompt common
  đều bị từ chối; contract kỹ thuật chỉ được dùng chung ở schema/validator/runtime.
