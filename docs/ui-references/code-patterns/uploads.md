# Upload Code Patterns

Dùng file này cho upload ảnh/file, local preview và fallback media.

## 1. Upload Preview

Dùng cho upload ảnh/file mock hoặc local preview.

### Pattern chuẩn

- Nếu preview cần tồn tại sau khi đóng/mở modal mock, dùng `FileReader.readAsDataURL`.
- Nếu dùng `URL.createObjectURL`, phải revoke đúng vòng đời và không lưu URL đó làm dữ liệu lâu dài.
- Luôn có fallback placeholder khi ảnh lỗi.

### Không làm

- Không lưu `blob:` URL vào mock data dài hạn rồi dùng lại sau khi component unmount.

## 2. Source Document Page Mapping Upload

Dùng cho admin upload một tài liệu nguồn dài rồi gán khoảng trang vào từng entity con đã tồn tại, ví dụ mỗi buổi học nhận một page range từ sách PDF.

### Pattern chuẩn

- Entity con phải có id thật trước khi upload; không upload file tài liệu trong modal tạo entity con nếu chưa có yêu cầu rõ.
- Màn quản lý tổng upload source document ở cấp entity cha, hiển thị tổng số trang, provider/cost estimate nếu có và trạng thái paid OCR artifact/page-level.
- Danh sách entity con có field `fromPage`/`toPage`, preview thumbnail/text ngắn và warning range trùng/bỏ sót khi có.
- Khi lưu mapping, API gắn page range vào đúng entity id và enqueue chunking cho entity con liên quan.
- Mỗi entity con có hai action riêng: upload/thay thế tài liệu gốc và upload tài liệu bổ sung; hai action này không dùng chung handler/state.
- Mỗi dòng có pending/success/error/retry state riêng để một mapping/chunking lỗi không khóa toàn bộ danh sách.
- Trạng thái tài liệu dùng badge/mapping chung: chưa có, đang xử lý, sẵn sàng, lỗi.
- Upload lẻ từng dòng là tài liệu bổ sung; action phải phân biệt rõ `Upload tài liệu bổ sung`, `Upload/Thay thế tài liệu gốc`, `Xem trang` hoặc `Xử lý lại` theo trạng thái hiện tại.

### Không làm

- Không bulk upload nhiều source files rồi bắt admin map file vào entity trong MVP; flow chính chỉ dùng một source document dài rồi gán page range.
- Không trình bày supplemental upload như tài liệu chính; UI phải phân nhóm rõ `Tài liệu chính từ sách` và `Tài liệu bổ sung`.
- Không để thay thế tài liệu chính xóa nhầm tài liệu bổ sung.
- Không để file tạm chưa gắn entity tồn tại âm thầm; nếu bắt buộc có staging thì phải có session, expiry và cleanup job.
- Không chunk toàn bộ source document trước rồi đoán entity; phải chunk sau khi page range đã được xác nhận.
- Không khóa cả panel khi một dòng đang mapping/chunking; chỉ disabled action của dòng đang pending.
