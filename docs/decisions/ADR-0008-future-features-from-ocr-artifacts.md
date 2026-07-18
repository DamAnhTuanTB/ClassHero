# ADR-0008: Tính Năng Tương Lai Từ OCR Artifacts

**Ngày:** 2026-07-18  
**Trạng thái:** Accepted  
**Quyết định bởi:** Owner  

---

## Bối Cảnh

Sau khi hoàn thành M4.4 (Paid OCR Pipeline), hệ thống đã có đầy đủ dữ liệu từ Mathpix OCR:

| Artifact | Phí | Dữ liệu |
|---|---|---|
| `.mmd` | Miễn phí | Text + LaTeX (cho AI/RAG) |
| `.lines.json` | Miễn phí | Per-page text + confidence + bounding box |
| `.mmd.zip` | Conversion | Text + 341 ảnh đã giải nén, lưu MinIO |
| `.html.zip` | Conversion | HTML rendered + ảnh |
| PDF gốc | Đã upload | File gốc trong MinIO |

**Hạn chế OCR tiếng Việt:** Mathpix rất tốt với công thức toán nhưng dấu tiếng Việt (ă, ắ, ầ, ổ, ứ...) vẫn bị sai một số chỗ. Ví dụ: "Số" → "Sǒ", "Tổng" → "Tông", "Hướng dẫn" → "Hung dan".

---

## Quyết Định

### 1. Xem Tài Liệu Online (Document Viewer)

**Quyết định:** Dùng kỹ thuật **scan overlay** (kết hợp PDF scan + OCR text layer):

- **Visual layer:** Ảnh trang scan từ PDF gốc → nhìn đẹp, chính xác 100%
- **Text layer:** OCR text (trong suốt) overlay lên trên → cho phép highlight, search, click
- **Bounding box:** Dùng `lines.json` để biết vị trí text trên ảnh

Lý do: PDF gốc là ảnh scan (không có text layer), HTML bị lỗi chính tả → kết hợp cả hai.

Tham khảo: Đây là cách Google Books, Adobe Scan, CamScanner hoạt động.

### 2. Sửa Lỗi Chính Tả OCR (Post-processing)

**Quyết định MVP:** Không cần fix ngay. AI hiểu text dù lỗi nhẹ, học sinh xem PDF gốc.

**Hướng nâng cấp tương lai:** Thêm bước post-process bằng GPT-3.5/4o-mini:
- Gửi từng trang text → AI sửa lỗi chính tả tiếng Việt, giữ nguyên LaTeX
- Chi phí: ~$0.001/trang, ~$0.12/cuốn sách 122 trang
- Chỉ fix text, không ảnh hưởng công thức toán

### 3. Xem Ảnh Trang Cụ Thể

**Quyết định:** Ảnh đã giải nén từ `mmd.zip`, lưu MinIO theo cấu trúc:
```
document-images/{docId}/page-{NNN}/{filename}.jpg
```

API endpoint:
```
GET /api/documents/{docId}/pages/{pageNumber}/images
→ Trả về danh sách ảnh URL của trang đó
```

Chi phí serve: $0 (từ MinIO local).

---

## Tính Năng Tương Lai (Backlog)

### Từ `.mmd.zip` (ảnh đã giải nén)

1. **Thumbnail trang:** Tạo ảnh nhỏ từng trang cho navigation sidebar
2. **Visual Q&A:** Học sinh hỏi AI về hình cụ thể → gửi ảnh + text cho AI multimodal
3. **Hình ảnh trong quiz:** Tạo quiz có hình minh họa từ sách gốc
4. **Image search:** Tìm kiếm theo mô tả hình (cần AI caption ảnh)

### Từ `.html.zip` (HTML rendered)

5. **Interactive document viewer:** Xem tài liệu có highlight, annotation, bookmark
6. **Text-to-speech:** Đọc bài cho học sinh nghe (cần fix chính tả trước)
7. **Collaborative annotation:** Giáo viên đánh dấu, ghi chú trên tài liệu
8. **Smart highlight:** AI tự highlight keyword/concept quan trọng

### Từ `.mmd` (text + LaTeX)

9. **Formula extraction:** Trích xuất công thức toán → tạo bài tập tương tự
10. **Table extraction:** Trích xuất bảng → tạo flashcard, quiz
11. **Cross-reference:** Liên kết giữa các bài học, tìm kiến thức liên quan
12. **Summary generation:** AI tóm tắt nội dung từng bài/chương

### Từ `lines.json` (bounding box + confidence)

13. **Scan overlay viewer:** Ghép ảnh scan + text layer cho highlight/search chính xác
14. **Quality dashboard:** Admin xem quality score từng trang, quyết định re-OCR trang kém
15. **Precision highlight:** Highlight chính xác từng dòng/từ dựa trên bounding box

---

## Ưu Tiên Khi Triển Khai

1. **M5 (Embedding):** Text chunks → pgvector → semantic search (cần cho tất cả tính năng AI)
2. **M6 (Quiz/Flashcard):** Dùng chunks + ảnh → AI tạo quiz/flashcard
3. **M9 (AI Chat):** RAG retrieval + multimodal → trả lời câu hỏi học sinh
4. **Document Viewer:** Scan overlay hoặc PDF viewer + text layer
5. **Post-processing OCR:** Fix chính tả khi cần interactive HTML features
