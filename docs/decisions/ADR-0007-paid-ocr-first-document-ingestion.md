# ADR-0007 - Paid OCR First Document Ingestion

Date: 2026-07-17
Status: Accepted

## Context

Bộ tài liệu chính gồm sách giáo khoa Kết nối tri thức với cuộc sống:

- 14 sách Toán lớp 3 đến lớp 9.
- 14 sách Tiếng Anh lớp 3 đến lớp 9.
- 7 sách Vật lý.
- 7 sách Hóa học.

Tổng ước tính khoảng 42 cuốn, mỗi cuốn khoảng 130 trang, tức khoảng 5,460 trang. Owner ưu tiên chất lượng OCR tốt nhất hơn tối ưu chi phí OCR, vì tài liệu Toán/Lý/Hóa có nhiều công thức, ký hiệu, bảng, hình học và nội dung STEM.

## Decision

Pipeline document ingestion mặc định cho tài liệu học chính là paid OCR-first:

1. API/worker lưu PDF gốc vào object storage và tính `content_hash`.
2. Worker dùng `pdf-parse` để lấy page count, metadata, preview/thumbnail và phục vụ local/dev fallback, nhưng text layer miễn phí không phải nguồn chính cho AI/RAG production.
3. Worker kiểm tra OCR artifact cache theo `content_hash`, provider, model/version, language/options và output format.
4. Nếu chưa có OCR artifact hợp lệ, gọi paid OCR provider từ file gốc admin upload.
5. Paid OCR chỉ nên chạy một lần cho mỗi tài liệu/provider/options, nhưng lần đó phải lấy artifact đầy đủ nhất có thể: text, Mathpix Markdown/Markdown, LaTeX/math, tables, figures/diagrams/cropped images, line/layout JSON, bounding boxes/regions, confidence, page metadata và searchable/converted outputs nếu cần.
6. Provider chính là Mathpix cho toàn bộ tài liệu học chính trong giai đoạn đầu, kể cả English, để thống nhất output và ưu tiên chất lượng trên Toán/Lý/Hóa.
7. Output chuẩn nội bộ ưu tiên giữ Markdown/Mathpix Markdown, plain text, LaTeX nếu có, confidence/quality flags, page index, layout regions và visual assets provider trả về.
8. Sau OCR, hệ thống lưu `source_document_pages`, quality metadata, visual references và artifact vào object storage.
9. Chunking/embedding chạy từ artifact đã lưu, theo lesson/page range của production.
10. Không gọi lại paid OCR nếu cùng file hash và cùng provider/options đã có artifact hợp lệ.

Google Document AI hoặc AWS Textract có thể là provider phụ nếu sau này muốn tối ưu chi phí cho sách English hoặc tài liệu chữ thường, nhưng không phải mặc định khi owner chọn chất lượng tốt nhất.

Free OCR bằng OCRmyPDF/Tesseract không còn là production default. Nó chỉ dùng cho:

- Local/dev không có paid OCR key.
- Test mock/fallback kỹ thuật.
- Trường hợp provider paid tạm lỗi và admin chủ động cho phép fallback chất lượng thấp hơn.

Local/dev được phép bật paid OCR thật để owner test vài cuốn đại diện trước khi production ingest:

- Test 1-3 cuốn đại diện như Toán nhiều công thức/hình, English, Lý/Hóa.
- Local vẫn phải dùng artifact cache theo `content_hash` để không gọi lại provider khi rerun cùng file.
- Không mặc định chạy paid OCR toàn bộ 42 cuốn ở local; production mới là nơi ingest chính thức toàn bộ bộ sách.
- Nếu local artifact cần dùng lại ở production, import artifact theo `content_hash` thay vì copy DB row.

Preprocess ảnh/PDF không nằm trong MVP app flow. Nếu một file gốc quá mờ/xấu và paid OCR cho kết quả kém, owner có thể xử lý file bằng công cụ ngoài hệ thống rồi upload lại như một file gốc mới. Khi đó `content_hash` mới sẽ tạo OCR artifact mới.

## Mathpix v3 Artifact Collection (chi tiết kỹ thuật)

Khi gọi `POST /v3/pdf`, request tất cả conversion formats trong 1 lần:

```json
{
  "conversion_formats": {
    "mmd": true,
    "mmd.zip": true,
    "lines.json": true,
    "md": true,
    "html.zip": true
  },
  "languages": ["vi", "en"],
  "include_page_data": true,
  "enable_tables_fallback": true
}
```

Mathpix tính phí theo page processed, không theo số format. Request tất cả formats không tốn thêm chi phí.

Artifacts phải thu thập và lưu vào artifact cache (object storage):

| Artifact | Ý nghĩa | Bắt buộc |
|---|---|---|
| `.mmd` | Mathpix Markdown, page-by-page (`\newpage` separator), giữ math/tables/headings | ✅ |
| `.mmd.zip` | MMD + embedded images/figures (Mathpix tự crop figures/diagrams) | ✅ |
| `.lines.json` | Per-line bounding boxes, confidence, type (text/math) | ✅ |
| `.md` | Plain Markdown fallback | ✅ |
| `.html.zip` | HTML + embedded images — phục vụ lesson viewer tương lai | ✅ |
| `metadata.json` | pdfId, numPages, processingTimeMs, createdAt | ✅ |

Không thu thập `.tex.zip` (không có use case trong dự án), `.md.zip` (trùng `.md` + images đã có trong `.mmd.zip`).

Lý do `.mmd.zip` bắt buộc: CDN Mathpix chỉ giữ ảnh crop (figures/diagrams) 30 ngày. Phải download zip và lưu images vĩnh viễn vào object storage để phục vụ visual Q&A, quiz hình, và hiển thị nội dung sau này.

Quality scoring per page dùng kết hợp:
- `lines.json` confidence per line (trọng số 60%)
- Heuristic trên text (replacement chars, text length, control chars) (trọng số 40%)

Artifact cache key: `{OCR_ARTIFACT_PREFIX}/{provider}/{content_hash}/` — mỗi file artifact lưu riêng trong thư mục này.

## Tính năng tương lai từ HTML artifact (ngoài MVP)

`.html.zip` được lưu sẵn để phục vụ các tính năng sau mà không cần OCR lại:

1. **Lesson viewer trên mobile** — Thay vì embed PDF nặng (~50MB), hiển thị HTML responsive. Text reflow theo màn hình, math render đẹp (KaTeX), load nhanh. Rất quan trọng vì đa số học sinh dùng điện thoại.

2. **AI citation link** — Khi AI giải thích hoặc sinh quiz, hệ thống link trả về đúng đoạn trong bài học gốc: "Xem lại phần này trong sách" → scroll tới đoạn HTML tương ứng, highlight. Giúp học sinh verify và học sâu hơn.

3. **Highlight & ghi chú cá nhân** — Student highlight đoạn text trong bài, ghi chú cá nhân khi ôn bài. Implement bằng Selection API trên HTML, rất khó làm trên PDF viewer.

4. **In-page search** — Student tìm kiếm từ khóa trong nội dung bài học, highlight kết quả. Native browser search trên HTML, không cần plugin PDF.

5. **Accessibility** — Chỉnh cỡ chữ, dark mode, screen reader cho học sinh khiếm thị. PDF không hỗ trợ tốt những thứ này.

## Consequences

- Cần env và provider abstraction cho OCR paid, ban đầu là Mathpix.
- Cần queue async vì OCR cả cuốn có thể mất vài phút; không xử lý trong HTTP request upload.
- Cần budget/rate limit riêng cho OCR ingest, tách khỏi AI chat/generation budget.
- Cần artifact cache bắt buộc để tránh double-charge giữa local/staging/production.
- Cần admin UI/job status hiển thị OCR provider, page count, cost estimate, started/finished, failed pages và quality summary.
- Cần lưu PDF gốc để học sinh xem tài liệu chuẩn, còn OCR output làm nguồn cho search/RAG/AI generation.
- Cần xem OCR artifact như tài sản lâu dài của hệ thống, không phải output tạm: lưu đủ dữ liệu để phục vụ Q&A, quiz, flashcard, test generation, search, citation, visual Q&A và các tính năng tương lai mà không OCR lại.
- Không xây UI/API/worker riêng cho preview tiền xử lý trong MVP; hệ thống đơn giản hơn và tránh làm hỏng tài liệu bằng xử lý ảnh quá tay.
- Quiz/flashcard/test vẫn phải sinh câu hỏi mới bám kiến thức, không copy nguyên văn bài tập/ví dụ từ OCR output.

