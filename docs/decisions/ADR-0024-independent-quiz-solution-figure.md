# ADR-0024 - Hình đề và hình lời giải Quiz độc lập

Date: 2026-08-28
Status: Accepted

## Context

Contract mode cũ buộc hình lời giải phải phân loại mở rộng hay vẽ lại, đồng thời
giữ lineage tới hình đề. Điều đó làm Phase 1 trả cả kế hoạch dựng hình dù nhiệm vụ
của phase này chỉ cần quyết định có tạo từng hình hay không, và khiến hai resource
hình ảnh phụ thuộc nhau không cần thiết.

## Decision

- Phase 1 chỉ trả đúng hai boolean độc lập: `requiresQuestionFigure` và
  `solutionFigure`. Không trả mode, figure plan, TeX/TikZ hoặc mô tả dựng hình.
- `solutionFigure=true` khi và chỉ khi solution thêm ít nhất một đối tượng hoặc
  quan hệ trực quan mới so với problem và thực sự dùng phần mới đó trong mạch giải.
  Chỉ thay số, biến đổi công thức, tính giá trị hoặc kết luận không tạo hình.
- Phase 2 hình lời giải dựng một source hoàn chỉnh mới từ `problem` và `solution`,
  với thứ tự authority `solution > problem`.
- Hình đề và hình lời giải không nhận source/asset/revision của nhau, không có
  lineage phụ thuộc và không tự xóa hay tái tạo nhau.
- Admin authoring/refinement dùng hai role `QUESTION | SOLUTION`; output của cả
  hai luôn là `{ latexSource }`.

## Consequences

- Xóa enum/column mode và revision lineage khỏi database; migration chỉ gỡ
  metadata phụ thuộc, không xóa source hoặc asset hình hiện có.
- Cache key/prompt/schema version phải bump vì Phase 1 và Phase 2 đổi contract.
- Worker có thể enqueue hai role độc lập ngay sau khi lưu câu; lỗi của một role
  không chặn role còn lại.
- UI chỉ còn hai action tạo hình theo role, không còn lựa chọn extend/redraw.
