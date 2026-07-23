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

Dùng cho admin upload một hoặc nhiều tài liệu nguồn rồi tạo các khối trích xuất cho từng entity con, ví dụ mỗi buổi học nhận nhiều page ranges từ một hoặc nhiều sách PDF.

### Pattern chuẩn

- Entity con phải có id thật trước khi upload; không upload file tài liệu trong modal tạo entity con nếu chưa có yêu cầu rõ.
- Màn quản lý tổng upload nhiều source documents ở cấp entity cha, cho chọn tài liệu đang quản lý và hiển thị tổng số trang, provider/cost estimate nếu có cùng trạng thái paid OCR artifact/page-level.
- Luồng happy case phải có state nhập khoảng trang riêng sau khi tài liệu nguồn sẵn sàng; không dùng màn lỗi hoặc màn summary làm đại diện cho bước nhập range.
- Mỗi khối trích xuất có source select, `fromPage`/`toPage`, preview thumbnail/text ngắn và warning. Nếu có nguồn, mặc định chọn phần tử đầu danh sách API.
- Cho phép nhiều khối dùng cùng nguồn nhưng cấm overlap inclusive; range thuộc nguồn khác được phép trùng số trang.
- Khi lưu mapping, API gắn page range vào đúng entity id và enqueue chunking cho entity con liên quan.
- Mỗi entity con có hai action riêng: upload/thay thế tài liệu gốc và upload tài liệu bổ sung; hai action này không dùng chung handler/state.
- Mỗi dòng có pending/success/error/retry state riêng để một mapping/chunking lỗi không khóa toàn bộ danh sách.
- Trạng thái tài liệu dùng badge/mapping chung: chưa có, đang xử lý, sẵn sàng, lỗi.
- Upload lẻ từng dòng là tài liệu bổ sung; action phải phân biệt rõ `Upload tài liệu bổ sung`, `Upload/Thay thế tài liệu gốc`, `Xem trang` hoặc `Xử lý lại` theo trạng thái hiện tại.
- Copy trong UI upload/mapping phải là copy sản phẩm thật, ngắn và hướng hành động; chi tiết kiểu `job`, `queue`, `artifact`, schema/provider internals chỉ đặt trong docs hoặc báo cáo kỹ thuật.

### Không làm

- Không coi một source file là “tài liệu gốc duy nhất”; mọi source file đã upload ở entity cha đều là nguồn trích xuất ngang hàng.
- Không trình bày supplemental upload như tài liệu chính; UI phải phân nhóm rõ `Tài liệu chính từ sách` và `Tài liệu bổ sung`.
- Không để thay thế tài liệu chính xóa nhầm tài liệu bổ sung.
- Không để file tạm chưa gắn entity tồn tại âm thầm; nếu bắt buộc có staging thì phải có session, expiry và cleanup job.
- Không chunk toàn bộ source document trước rồi đoán entity; phải chunk sau khi page range đã được xác nhận.
- Không khóa cả panel khi một dòng đang mapping/chunking; chỉ disabled action của dòng đang pending.
- Không nhét đoạn hướng dẫn sử dụng dài vào màn thao tác; hướng dẫn nhanh thuộc flow-board/HTML review, không thuộc UI production.
