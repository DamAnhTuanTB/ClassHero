# 2026-08-08

## M18 - AI Features & Provider Operations

### Features & Fixes
- **Admin AI Settings - Usage Cost UI Updates**:
  - Sửa lại tiêu đề và cách gộp nhóm chi phí trong `usage-cost-tab.tsx`: gộp theo model thay vì feature.
  - Sửa hiển thị của nhóm Mathpix để không thể mở rộng (expand) vì không có các model con.
  - Sửa lại bảng "Lượt sử dụng gần đây" thành "Tất cả lượt sử dụng" và bổ sung phân trang (sử dụng thuộc tính `events.pagination`).
  - Đổi nhãn hiển thị thành "Uncached Prompt Tokens" thay cho "Prompt Tokens" để tránh nhầm lẫn về tổng token và token dùng tính phí.
  - Gỡ bỏ định dạng viết tắt (compact) trong hàm `formatNumber` của `provider-operations-formatters.ts` để hiển thị con số token chính xác tuyệt đối, giúp người dùng có thể tự đối chiếu và nhân giá trị để kiểm tra chi phí.
