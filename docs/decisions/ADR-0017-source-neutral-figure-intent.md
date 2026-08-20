# ADR-0017 - Tách semantic figure intent khỏi source locator

Date: 2026-08-17
Status: Superseded by ADR-0018

## Context

Stage 1 từng cho phép `visualIntent` vừa mô tả mục tiêu chuyên môn vừa chứa mã
hình, trang hoặc vị trí hình con trong sách. Khi admin chọn `CURRENT_ONLY`, Stage
2 vẫn có thể nhận nhãn của ảnh SGK cũ dù ảnh đính kèm là revision hiện tại. Cùng
một field cũng bị resolver dùng để tìm crop, nên provenance nguồn và ngữ nghĩa
hình bị trộn và khó áp dụng đúng theo reference mode.

## Decision

- Contract mới dùng `figurePlanContractVersion=2`.
- Provider Stage 1 bắt buộc khai `figureOrigin=TEXTBOOK_SOURCE |
GENERATED_FROM_BRIEF`. `TEXTBOOK_SOURCE` phải có ít nhất một
  `sourceReferences`; `GENERATED_FROM_BRIEF` phải có mảng reference rỗng. Zod
  reject tổ hợp mâu thuẫn trước persistence.
- `visualIntent` luôn độc lập nguồn, chỉ mô tả mục tiêu chuyên môn và thông điệp
  thị giác.
- Mỗi `sourceReferences[]` mới có `sourceTarget`: `WHOLE_FIGURE` dùng
  `locator=null`; `SUBFIGURE` bắt buộc locator ngắn để định vị hình con.
- Resolver chỉ dùng `figureLabel` cùng `sourceTarget.locator`, không dùng
  `visualIntent` để rank crop.
- Stage 2 gửi source target chỉ ở `SOURCE_CROP_ONLY`. `CURRENT_ONLY` và `NONE`
  không mang locator SGK cũ; `CURRENT_ONLY` legacy bỏ hẳn visual intent cũ thay
  vì regex-sanitize dữ liệu đã trộn nghĩa.
- Resolver và provider boundary ưu tiên provenance: `GENERATED_FROM_BRIEF` luôn
  tạo snapshot/brief không ảnh và không được gửi OCR crop hoặc `PDF_PAGE`
  fallback, kể cả có asset stale bị truyền nhầm.
- Reader tiếp tục đọc plan legacy nhưng writer không rewrite/migrate hàng loạt.

## Consequences

- Chuyển lựa chọn từ ảnh SGK sang ảnh hiện tại không còn làm nhãn/panel SGK cũ
  chi phối request gửi provider.
- Full-page fallback và subfigure có locator rõ ràng, còn semantic intent vẫn tái
  sử dụng được giữa các reference mode.
- Provider schema Stage 1 chặt hơn và output không tuân contract bị reject trước
  khi persist; dữ liệu legacy vẫn xem/sinh lại được theo nhánh tương thích.
- Plan legacy thiếu `figureOrigin` tiếp tục được suy theo `sourceReferences`; chỉ
  writer mới bắt buộc field nên không cần migration JSON hàng loạt.
- Không cần migration database vì plan và snapshot đã lưu JSON; cần theo dõi lỗi
  contract, crop fallback và kết quả Stage 2 theo version/mode khi rollout.
