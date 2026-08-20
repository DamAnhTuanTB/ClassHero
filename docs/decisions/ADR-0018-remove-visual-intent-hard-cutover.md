# ADR-0018 - Xóa visual intent bằng hard cutover

Date: 2026-08-19
Status: Accepted

## Context

Dù contract v2 nói ảnh nguồn có thẩm quyền cao hơn, Stage 2 vẫn nhận đồng thời
ảnh và một đoạn `visualIntent` do Stage 1 viết. Trong thực tế provider có thể bám
đoạn text này mạnh hơn ảnh, khiến hình dựng lại lệch baseline quan sát được.
Precedence viết trong prompt không phải ràng buộc xác định và không có semantic
visual validator local đủ sức bảo đảm model luôn nghe ảnh trước.

## Decision

- Xóa `visualIntent` khỏi Phase 1, render plan, Summary content, raw provider
  output, API/UI, generation brief, provider request, hash, fixtures và test.
- Phase 1 chỉ trả `figureOrigin`, structured `sourceReferences/sourceTarget`,
  `altText` và `caption`.
- Có ảnh nguồn: Stage 2 nhận ảnh + source target + projection tối thiểu của block;
  ảnh khóa baseline, `adminInstructions` chỉ khóa delta được gọi tên.
- Không ảnh nguồn: Stage 2 tự dựng từ projection block, không qua semantic brief
  trung gian. Mỗi block có tối đa một logical generated figure.
- Example chỉ gửi `problem`, `isGeometry` và hypotheses GT–KL nếu có; không gửi
  `solution`, `answer` hoặc conclusions. Theory/note gửi title/content phù hợp.
- Contract duy nhất là `figurePlanContractVersion=3`. Runtime không đọc v1/v2,
  không dual-write, không fallback và không tạo field khác trùng chức năng.
- Trước deploy, dữ liệu vận hành được chuyển một chiều sang v3; job/snapshot cũ
  không chuyển an toàn phải bị cancel hoặc invalidated. Migration fail thì dừng
  deploy, không để runtime tự suy.

## Consequences

- Không còn text brief cạnh tranh với ảnh nguồn trong request dựng hình.
- Hình không nguồn phụ thuộc trực tiếp chất lượng `problem`/nội dung kiến thức;
  vì vậy projection phải ổn định, tối thiểu và không gửi lời giải/đáp án.
- Alt/caption vẫn phục vụ UI/accessibility nhưng không được dùng như prompt ngầm.
- Cutover cần maintenance window, migration JSON, cancel job v2 và restart
  worker; không thể rolling deploy API/worker khác version.
- Các request full-page mơ hồ phải dừng trước paid call và chờ admin chọn target.
- Quy trình chi tiết và regression matrix nằm tại
  `.codex/plans/m9-2-remove-visual-intent-hard-cutover-plan.md`.
