# ADR-0021 - Vẽ lại hình lời giải Quiz thành mô hình toán học

Date: 2026-08-24
Status: Superseded by ADR-0024

## Context

`REUSE_QUESTION` từng khiến student API gán lại cùng asset hình đề thành hình lời
giải và UI render cùng ảnh hai lần trong một card. Trong khi đó, đề bài và lời
giải đã bắt buộc tự đủ nghĩa, hình đề vẫn còn hiển thị phía trên lời giải nên bản
sao này không tạo thêm giá trị sư phạm.

Một nhu cầu khác chưa được contract cũ biểu diễn là bài toán ứng dụng có hình đề
mang phong cách thực tế, còn lời giải cần một sơ đồ toán học được vẽ lại hoàn
toàn: lược bỏ trang trí, đổi bố cục và thêm đường/nhãn phục vụ mô hình hóa. Đây
không phải extension trên exact source hình đề.

## Decision

- Hard-cutover bỏ `REUSE_QUESTION`; dữ liệu cũ dùng mode này được migrate về
  `NONE` và student API không nhân đôi `questionFigure` thành `solutionFigure`.
- Figure decision còn `NONE | EXTEND_QUESTION | REDRAW_AS_MODEL`.
- `EXTEND_QUESTION` giữ behavior hiện tại: Phase 2 trả `extensionLatex`, backend
  chèn vào marker của exact source hình đề.
- `REDRAW_AS_MODEL` yêu cầu hình đề và một plan gồm `caption`, `modelingGoal`,
  `modeledObjects[]`, `clarifiedRelations[]`. Phase 2 nhận exact source hình đề
  làm tham chiếu/provenance nhưng trả một `latexSource` hoàn chỉnh mới.
- `problem` và `solution` là nguồn dữ kiện có thẩm quyền. Hình/caption/plan không
  được thêm dữ kiện mới; mọi điểm phụ, đường dựng hoặc quan hệ cần thiết phải có
  trong nội dung chữ tương ứng. Lời giải không được nhắc hoặc phụ thuộc vào hình.
- Revision lời giải của cả hai mode giữ `derived_from_question_revision_id`.
  Với EXTEND đây là exact base; với REDRAW đây là lineage/provenance, không hàm ý
  source lời giải chứa nguyên source hình đề.
- Hình vẽ lại dùng cùng queue, renderer, source policy, revision, R2 asset và UI
  component của Quiz; không tạo pipeline hoặc provider call phụ chỉ để đổi style.

## Consequences

- Card Quiz không còn lặp ảnh khi mở lời giải.
- Bài toán ứng dụng có thể chuyển từ minh họa thực tế sang sơ đồ toán học rõ ràng
  mà không lạm dụng extension marker.
- Provider schema/prompt và worker phải phân nhánh output full source với output
  extension; test phải khóa cả hai đường.
- Deploy phải chạy migration cùng API/worker/web và khởi động lại worker; runtime
  mới không đọc mode `REUSE_QUESTION`.
