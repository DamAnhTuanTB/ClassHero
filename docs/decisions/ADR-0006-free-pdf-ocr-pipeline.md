# ADR-0006 - Free PDF OCR Pipeline

Date: 2026-07-17
Status: Superseded by ADR-0007

## Context

Tài liệu học chính của dự án thường là PDF sách giáo khoa dài, nhiều trang scan có text layer sẵn hoặc PDF scan ảnh không có text. Worker cần extract page-level text ổn định để admin gán page range, chunk theo lesson và tạo RAG context.

Owner muốn ưu tiên OCR miễn phí/offline để tránh chi phí AI Vision khi xử lý hàng loạt sách nhiều trang.

File kiểm tra thực tế `docs/Toan-7-Tap-1-searchable.pdf` có 122 trang, 53 MB, mỗi trang đều có ảnh scan và hầu hết đã có text layer. Test local cho thấy:

- Text layer gốc extract được 129k+ ký tự, 120/122 trang có từ 200 ký tự trở lên và không có ký tự replacement.
- `pdf-parse` đọc page-level text đủ 122 trang trong khoảng 160 ms và render thumbnail trang đơn trong khoảng 179 ms trên máy local.
- Ép OCR lại toàn bộ bằng OCRmyPDF/Tesseract `vie+eng` mất khoảng 191 giây với 4 worker; output vẫn có 120/122 trang từ 200 ký tự trở lên, nhưng exact phrase match giảm mạnh do công thức, ký hiệu nhỏ và layout sách Toán bị méo.
- Chế độ OCRmyPDF `--skip-text` skip toàn bộ file searchable trong khoảng 1.2 giây và giữ nguyên text layer gốc.

## Decision

Pipeline mặc định cho `M4.4` là:

1. Extract text layer trước bằng `pdf-parse` trong worker Node/NestJS.
2. Dùng `pdf-parse` để lấy page count, page-level text và render thumbnail/snapshot khi cần preview hoặc OCR fallback.
3. Chỉ chạy OCR fallback cho trang/file có text quá ít hoặc không có text layer.
4. OCR fallback dùng OCRmyPDF CLI + Tesseract native với language `vie+eng`.
5. Với PDF đã searchable, dùng chế độ skip text hoặc bỏ qua OCR; không force OCR lại vì chậm và có thể làm giảm chất lượng so với text layer sẵn có.
6. AI Vision không phải OCR mặc định của MVP. Chỉ cân nhắc sau này cho trang quá khó, công thức/bảng phức tạp hoặc khi OCR miễn phí không đủ chất lượng.
7. Paid OCR nếu được bật phải cache theo content hash của file gốc, provider/model/version và options OCR. Local/staging/production được phép import lại OCR artifact đã có, không gọi lại provider cho cùng một tài liệu nếu artifact còn hợp lệ.

## Consequences

- `apps/api` cần dependency runtime `pdf-parse`.
- Worker Docker image cần cài system dependencies cho OCR fallback: OCRmyPDF, Tesseract và Vietnamese/English language data. Nếu image Alpine gây khó ở bước cài OCRmyPDF/Tesseract, M4.4 được phép tách worker image sang Debian/Ubuntu slim trong khi vẫn giữ API/web image hiện tại.
- OCR free đủ tốt cho search/RAG nội dung chữ tiếng Việt, nhưng không được coi là nguồn LaTeX/công thức chuẩn.
- Quality scoring cần đánh dấu trang có nhiều ký hiệu/công thức nhỏ, text quá ít, hoặc OCR confidence thấp để admin biết cần kiểm tra thủ công.
- Với quiz/flashcard/test, page/chunk source dùng để grounding và truy vết chất lượng, không phải để copy nguyên văn bài tập/ví dụ từ tài liệu nguồn.
- Không test full paid OCR lặp lại ở nhiều môi trường nếu tài liệu giống hệt nhau. Test local nên dùng mock/free OCR hoặc import artifact đã tạo một lần; chỉ gọi paid provider lại khi file hash, provider version hoặc OCR options thay đổi.
- M4.4 test nên có cả searchable PDF và image-only/scanned PDF. Test searchable PDF phải xác nhận không OCR lại khi text layer đã đủ tốt.

## Superseded

Owner đã đổi ưu tiên sang chất lượng OCR tốt nhất cho bộ sách chính. ADR-0007 thay thế quyết định này: paid OCR-first bằng Mathpix cho tài liệu học chính, free OCR chỉ còn dùng cho local/mock hoặc fallback vận hành có kiểm soát.
