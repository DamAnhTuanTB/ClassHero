# ADR-0028 - Dùng chung Question Figure Core

Date: 2026-09-09
Status: Accepted

## Context

Sinh kiến thức và Quiz đều có thao tác tạo hình cho đề bài. Hai implementation
đều giữ cùng invariant `problem-only`, cùng hai mode tạo lại/chỉnh source hiện
tại và cùng output `{ latexSource }`, nhưng từng feature từng sở hữu builder,
schema, prompt version và cache namespace riêng. Điều đó làm các quy tắc chống lộ
đáp án, completeness theo họ hình và ước tính request có thể lệch nhau dù tác vụ
gửi provider là tương đương.

## Decision

- Summary và Quiz dùng chung một `Question Figure Core` cho đúng role
  `QUESTION` không có ảnh nguồn.
- Core sở hữu request chuẩn hóa chỉ có `problem`, mode
  `REGENERATE | EDIT_CURRENT`, current source của chính hình đề, system prompt
  hoàn chỉnh theo từng môn, schema `{ latexSource }`, source safety/auto-repair,
  model defaults, prompt version và cache namespace.
- Core tuyệt đối không nhận `solution`, `answer`, `hint`, options,
  statements, source/crop sách hoặc ảnh hình khác. `adminInstructions` chỉ được
  điều chỉnh cách thể hiện và không được thêm dữ kiện hay làm lộ đáp án.
- Các prompt vẫn cô lập theo môn `MATH | PHYSICS | CHEMISTRY | GENERAL`.
  Mỗi prompt giữ đầy đủ quy tắc chuyên môn, họ hình, liên thuộc nhãn, marker,
  phép dựng, TeX safety, whitelist dữ kiện trực tiếp và cổng chống lộ đáp án.
- Summary adapter chỉ áp dụng core cho target `QUESTION` của block
  `example|exercise` với `NONE` hoặc `CURRENT_ONLY`. Vẽ lại/cắt hình từ
  nguồn sách, figure generic của block khác và technical repair tiếp tục dùng
  StemFigure contract riêng.
- Quiz adapter dùng core cho create/regenerate/edit role `QUESTION`.
  Refinement toàn diện có current PNG + figure plan tiếp tục dùng contract Quiz
  riêng vì đó là tác vụ multimodal audit, không tương đương create/edit source.
- API, authorization, provider operation, queue, job, database, revision, asset,
  audit và serialization vẫn do từng domain sở hữu. Core không đọc hoặc ghi dữ
  liệu domain.
- Custom system/user prompt vẫn là full override tại adapter; khi dùng override,
  owner chịu trách nhiệm bảo toàn invariant chống lộ đáp án.

## Consequences

- Cùng môn và cùng `problem` cho request mặc định sẽ có system prompt, schema,
  model settings, token estimate và cache contract tương đương giữa Summary và
  Quiz.
- Prompt version là `question-figure-<subject>-v1-shared`, schema version là
  `question-figure-schema-v1`, cache namespace là `question-figure`.
- Đây là `NEW_STABLE_PREFIX_WARMUP`: cache prefix cũ của hình đề không được giả
  định tái sử dụng. Sau warm-up, dữ liệu `problem`, current source và yêu cầu
  admin vẫn nằm sau breakpoint nên các request cùng subject tiếp tục dùng chung
  stable prefix.
