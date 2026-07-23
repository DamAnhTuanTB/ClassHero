# ADR-0010 - Personalized learning path private fork

Date: 2026-07-23
Status: Accepted

## Context

Một khóa học được bán cho nhiều học sinh nhưng một số học sinh cần chương trình thay đổi sâu và riêng biệt trong quá trình học. Admin cần được nhân bản khóa đã mua rồi chỉnh sửa tự do, trong khi bản nhân chỉ thuộc học sinh cần tùy chỉnh.

Nếu coi bản nhân là một khóa catalog thông thường, payment, enrollment, discovery, báo cáo doanh thu và ownership sẽ bị phân tán. Nếu chỉ dùng một số override nhỏ, admin không có trải nghiệm chỉnh sửa toàn bộ khóa như yêu cầu.

## Decision

- Khóa gốc `CATALOG` tiếp tục là sản phẩm được mua và được lưu ở `Enrollment.learningPathId`.
- Bản nhân là learning path `PERSONALIZED`, private, có `sourceLearningPathId` và chỉ được giao cho một enrollment qua `deliveryLearningPathId`.
- Mỗi enrollment có tối đa một bản cá nhân đang được sử dụng.
- Bản cá nhân là snapshot độc lập; khóa gốc không tự đồng bộ vào bản cá nhân sau khi clone.
- Clone sao chép cấu trúc và nội dung quản trị mutable, nhưng tái sử dụng file R2/OCR artifact bất biến; không gọi paid OCR chỉ vì clone.
- Chapter/lesson clone giữ source lineage để bảo toàn lịch sử tiến độ và chống cộng XP trùng.
- Enrollment chỉ chuyển sang bản cá nhân sau khi clone job hoàn tất; failure không làm thay đổi lộ trình hiện tại.
- Sau activation, chuyển đổi là một chiều: bản cá nhân trở thành curriculum chính thức, lâu dài của enrollment và không có flow quay lại khóa gốc.
- Mọi dữ liệu học tập mới ghi theo bản cá nhân; admin xử lý thay đổi hoặc sai sót bằng cách thêm, sửa, xóa nội dung ngay trên bản đó.

## Consequences

Tích cực:

- Admin có thể chỉnh sửa toàn bộ bản riêng mà không ảnh hưởng khóa gốc.
- Học sinh vẫn sở hữu đúng sản phẩm đã mua; báo cáo doanh thu không bị phân mảnh.
- Private fork không xuất hiện ở catalog và không thể bị mua nhầm.
- Có thể giữ lịch sử học trước/sau cá nhân hóa thông qua lineage.
- Không phát sinh bài toán merge tiến độ ngược từ bản cá nhân về khóa gốc.

Đánh đổi:

- Cần clone service/job, source lineage và effective learning path resolver.
- Progress, attempt, note, comment và XP cần policy ánh xạ rõ, không thể chỉ đổi foreign key enrollment.
- Bản cá nhân không nhận tự động bản sửa lỗi từ khóa gốc trong MVP; nếu cần đồng bộ/merge sau này phải làm tính năng riêng.
- Vì không có revert, cần audit/version history đủ tốt để admin sửa sai trực tiếp trên bản cá nhân.
