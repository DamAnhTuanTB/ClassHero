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
