# ADR-0019 - Chỉnh nhẹ raster STEM bằng pipeline local

Date: 2026-08-20
Status: Accepted

## Context

Crop ảnh sách giáo khoa có thể nhòe, nhiễu hoặc còn chi tiết nhỏ không liên quan.
Admin cần sửa nhanh tại figure nhưng phạm vi MVP không cần một editor ảnh đầy đủ,
semantic object detection hay chi phí/rủi ro nội dung của generative inpainting.

## Decision

M9.18 dùng Canvas/Pointer Events ở web để tạo mask và Sharp ở API để xử lý
deterministic, versioned. V1 có preset làm nét bảo thủ và fill vùng mask nhỏ
trên nền gần đồng nhất; vùng nền phức tạp bị từ chối. Preview không persist;
apply tạo immutable delivery revision WebP lossless và promote atomically.
Preset v2 giữ median denoise 3x3, contrast tuyến tính mức vừa và sharpen của v1,
đồng thời thêm saturation `1.06` để màu ký hiệu đậm hơn nhẹ. Không threshold nền,
không upscale, không hạ brightness toàn ảnh và không đổi hue chủ ý. Revision/audit
mới ghi `TEXTBOOK_RASTER_CLEANUP_V2`; revision v1 cũ vẫn bất biến.
Mỗi request chỉ bật đúng một tool. Làm nét tự preview khi được chọn; xóa tự
preview sau mỗi nét mask. Current revision vừa promote luôn là input của lần sửa
kế tiếp, không quay lại crop OCR ban đầu. Mỗi apply chỉ commit một operation và
không đóng editor; figure response trở thành working asset/guard cho operation
tiếp theo trong cùng modal.

Mask xóa được clip theo biên raster. Component chạm cạnh không bị reject chỉ vì
thiếu vòng nền ở phía ngoài ảnh; backend lấy mẫu từ các phía còn nằm trong ảnh và
vẫn áp dụng coverage/bounding-box cap, minimum sample count cùng variance gate.

Tính năng chỉ hỗ trợ asset raster `TEXTBOOK_SOURCE` đã thành công. `AI_TEX` tiếp
tục sửa bằng source editor, không bị rasterize. Không dùng AI provider, worker,
database migration hoặc package image-editor nặng.

Preset `ENHANCE` cũng được tái sử dụng trong M9.17 khi admin bật checkbox phụ
`Tự động làm nét ảnh`. Mọi crop auto-promote chạy cùng pipeline versioned trước
khi tạo delivery WebP lossless; không tạo một thuật toán làm nét riêng trong
worker và không fallback sang bản chưa làm nét nếu xử lý thất bại.

## Consequences

- Chi phí provider bằng 0, behavior có thể test và audit theo pipeline version.
- Có thể cải thiện độ rõ cảm nhận nhưng không khôi phục thông tin đã mất.
- Xóa chi tiết chỉ an toàn trên nền phẳng; hình phức tạp phải tải ảnh thay thế
  hoặc được xử lý bằng một feature khác nếu owner mở scope sau này.
- WebP lossless sau edit có thể lớn hơn WebP quality 92 nhưng tránh thêm vòng
  nén mất dữ liệu trên asset vốn đã được chuẩn hóa trước đó.
