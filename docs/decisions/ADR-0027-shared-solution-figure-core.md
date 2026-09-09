# ADR-0027 - Dùng chung Solution Figure Core

Date: 2026-09-08
Status: Accepted

## Context

Sinh kiến thức, Quiz và Flashcard đều có thao tác tạo hình minh họa cho lời giải.
Ba implementation trước đây cùng giữ invariant `solution > problem` và cùng trả
`{ latexSource }`, nhưng lại sở hữu ba builder, schema và system prompt khác nhau.
Điều này làm chất lượng, số token ước tính và quy tắc TeX/TikZ lệch nhau dù tác vụ
gửi provider là tương đương.

## Decision

- Ba feature dùng chung một `Solution Figure Core` cho đúng role `SOLUTION`.
- Core sở hữu request chuẩn hóa `problem + solution`, mode
  `REGENERATE | EDIT_CURRENT`, system prompt hoàn chỉnh theo từng môn, schema
  `{ latexSource }`, model defaults, prompt version và cache namespace.
- Flashcard adapter ánh xạ `front -> problem`; `back` không được gửi vào lượt tạo
  hình. Summary adapter trích `problem/solution` từ block Ví dụ/Bài tập. Quiz dùng
  trực tiếp `problem/solution` trong plan đã persist.
- Các prompt vẫn cô lập theo môn `MATH | PHYSICS | CHEMISTRY | GENERAL`; dùng
  chung theo feature không có nghĩa ghép policy Toán/Lý/Hóa vào một prompt.
- API, authorization, provider operation, queue, job, database, revision, asset,
  audit và serialization vẫn do từng domain sở hữu. Core không đọc hoặc ghi dữ
  liệu domain.
- Hình đề Quiz, hình từ ảnh nguồn Summary, technical repair và refinement toàn
  diện không thuộc core này và tiếp tục dùng contract riêng.
- Custom system/user prompt override tiếp tục thay thế request mặc định tại
  adapter nhưng không làm thay đổi default shared contract.

## Consequences

- Cùng môn và cùng nội dung sẽ có system prompt, schema và ước tính text input
  tương đương giữa ba feature.
- Một thay đổi quy tắc hình lời giải được version và kiểm thử tại một nơi; không
  còn phải copy thủ công sang Summary, Quiz và Flashcard.
- Stable prompt prefix/cache namespace mới cần warm up.
- ADR-0022, ADR-0025 và ADR-0026 bị thay thế một phần tại các đoạn yêu cầu prompt,
  schema hoặc builder hình lời giải phải độc lập theo feature. Các quyết định về
  độc lập theo môn và độc lập persistence/runtime domain vẫn còn hiệu lực.
