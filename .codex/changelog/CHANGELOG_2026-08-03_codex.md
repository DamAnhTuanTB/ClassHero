# 2026-08-03

## M3: Trải nghiệm duyệt khóa học học sinh

- 2026-08-03: Hoàn thiện giao diện Khám phá và Học tập với card khóa học responsive, trạng thái tiến độ/giá rõ hơn, accent xanh phân bổ riêng từng card và skeleton xám đồng nhất.
- 2026-08-03: Chuẩn hóa nhãn đối tượng khóa học theo palette xanh dương riêng cho từng khối/nhóm, với nền nhạt, chữ sáng rõ và badge nhóm không viền.
- 2026-08-03: Thay môn/lớp cố định bằng catalog Lĩnh vực và Đối tượng hướng đến, bổ sung metadata lịch học, quản trị lĩnh vực và bộ lọc động cho khóa học.
- 2026-08-03: Hoàn thiện flow thanh toán payOS với tạo/đối soát đơn, webhook idempotent, màn kết quả học sinh và quyền học sau thanh toán.
- 2026-08-03: Đồng nhất skeleton xám và các trạng thái lỗi/điều hướng hồi phục ở bề mặt học tập của học sinh.
- 2026-08-03: Migration fixture test API sang catalog Lĩnh vực và Đối tượng hướng đến, đồng thời đồng bộ assertion lịch sử bài thi.
- 2026-08-03: Đổi ribbon khu vực khóa học đã mua sang hệ xanh dương để đồng nhất với palette Khám phá.
- 2026-08-03: Tinh chỉnh UI khóa học học sinh với palette nhãn/ribbon và layout chi tiết nhất quán, đồng thời đồng bộ active sidebar quản trị và tăng nhận diện ClassHero trên các luồng auth.

## M3: Cấu trúc lộ trình linh hoạt

- 2026-08-03: Cho phép bài học nằm trực tiếp trong lộ trình mà không bắt buộc thuộc chương, bổ sung thao tác di chuyển/sắp xếp, đồng bộ quyền truy cập học sinh, clone lộ trình và giao diện quản trị responsive.

## M9: Nền tảng sinh nội dung AI

- 2026-08-03: Hoàn thiện M9.1-M9.3 với job AI bền vững, lifecycle/audit, sinh tóm tắt, quiz, flashcard và bài test có structured output, provenance và luồng duyệt nội dung trước khi phát hành.
- 2026-08-03: Bổ sung abstraction OpenAI/Gemini, timeout, theo dõi provider operation/usage/chi phí, ngân sách OCR/AI và màn quản trị AI settings phục vụ vận hành.
