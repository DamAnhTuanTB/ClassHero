# Milestone Overview - Diễn giải dễ hiểu

File này giúp owner nhìn nhanh từng milestone lớn `M0` đến `M14` theo ngôn ngữ sản phẩm. Nếu cần phạm vi chi tiết, `Mode`, `Done khi` và các subtask nhỏ, mở file `docs/implementation/Mx.md` tương ứng.

---

## M0 - Nền repo và môi trường chạy local

Mục tiêu: dựng bộ khung dự án để cả front-end, back-end, database, Redis và tooling có thể chạy thống nhất.

Khi xong milestone này:

- Repo có cấu trúc monorepo rõ ràng.
- Có lệnh chạy dev, check, typecheck.
- Có Docker local cho database/Redis và các cấu hình env mẫu.
- Owner/Codex có nền để bắt đầu làm tính năng thật.

Milestone này chưa tạo nghiệp vụ học tập; nó là phần dựng móng.

---

## M1 - Database và dữ liệu nền

Mục tiêu: tạo các bảng/model chính để hệ thống có nơi lưu user, lộ trình, chương học, buổi học, bài tập, thanh toán, thông báo, AI log và tiến độ học.

Khi xong milestone này:

- Database có schema nền bằng Prisma.
- Có dữ liệu seed tối thiểu để test.
- Các quan hệ lớn như user-profile, learning path-chapter-lesson, payment-enrollment, document-chunk đã có chỗ đứng.
- Các milestone sau có thể xây API/UI dựa trên dữ liệu thật.

Milestone này chủ yếu là nền dữ liệu, chưa phải màn hình hoàn chỉnh cho người dùng.

---

## M2 - Auth, tài khoản và phân quyền

Mục tiêu: cho Admin, Student và Parent đăng ký/đăng nhập an toàn, có session và phân quyền cơ bản.

Khi xong milestone này:

- Student/Parent/Admin đăng nhập được.
- Backend có JWT access/refresh token.
- Có RBAC để phân biệt quyền Admin, Student, Parent.
- Có API lấy thông tin người dùng hiện tại.
- Có UI đăng nhập/đăng ký/quên mật khẩu.

Milestone này là cổng vào hệ thống. Các màn admin/student/parent sau đó mới dựa vào session này để bảo vệ quyền.

---

## M3 - Lộ trình học, chương học và buổi học

Mục tiêu: tạo phần lõi của sản phẩm: Admin quản lý lộ trình học, chương học tổng quan và buổi học; người dùng xem được danh sách lộ trình.

Khi xong milestone này:

- Admin tạo/sửa/xóa/publish lộ trình học.
- Admin tạo/sửa/xóa chương học trong từng lộ trình.
- Admin tạo/sửa/xóa buổi học trong từng chương.
- Public/Student xem được lộ trình đã phát hành.
- Có UI quản trị lộ trình, chi tiết lộ trình, chương học và buổi học.

Đây là milestone biến sản phẩm từ “có tài khoản” thành “có khóa/lộ trình học thật”.

---

## M4 - Upload tài liệu và xử lý PDF

Mục tiêu: cho Admin upload tài liệu học tập, lưu file vào object storage và xử lý PDF bằng worker.

Khi xong milestone này:

- Có FilesModule/storage service.
- Local/dev dùng MinIO, production dùng Cloudflare R2.
- Admin upload PDF/tài liệu vào buổi học.
- Worker nhận job xử lý tài liệu.
- PDF được xử lý bằng paid OCR artifact/page-level content rồi chunk thành đoạn nhỏ để chuẩn bị cho AI/RAG.

Milestone này là cầu nối giữa “bài học có metadata” và “bài học có tài liệu thật để AI hiểu”.

---

## M5 - Embedding và tìm kiếm tài liệu bằng RAG

Mục tiêu: biến tài liệu đã xử lý thành dữ liệu có thể tìm kiếm bằng vector/keyword để AI trả lời theo đúng buổi học.

Khi xong milestone này:

- Có `AiProvider` cho embedding.
- Worker tạo embedding cho document chunks.
- RetrievalService tìm đoạn tài liệu liên quan theo lesson.
- Có hybrid search để hỗ trợ ký hiệu/công thức.

Milestone này chưa tập trung vào UI chat; nó tạo nền truy xuất kiến thức cho AI.

---

## M6 - Quiz, flashcard và bài kiểm tra thủ công

Mục tiêu: cho Admin tạo nội dung luyện tập cơ bản bằng tay trước khi AI tạo tự động.

Khi xong milestone này:

- Có schema nội dung rich text dùng chung.
- Admin tạo/sửa/xóa quiz.
- Admin tạo/sửa/xóa flashcard.
- Admin tạo/sửa/xóa bài kiểm tra.
- Student có API đọc nội dung bài học đã publish.

Milestone này tạo “đồ học” chính: câu hỏi, thẻ ghi nhớ và đề kiểm tra.

---

## M7 - Luồng học của học sinh

Mục tiêu: cho Student thật sự học trong từng buổi: xem nội dung, làm quiz, học flashcard, làm bài kiểm tra, lưu tiến độ.

Khi xong milestone này:

- Student vào được lesson nếu có quyền hoặc đang học thử.
- Student làm quiz và submit.
- Student học flashcard, đánh dấu yêu thích/ôn lại.
- Student làm bài kiểm tra, xem kết quả.
- Hệ thống tính bài tốt nhất, hoàn thành buổi học và top 5.
- Có dashboard học tập cơ bản cho Student.

Đây là milestone biến nội dung admin tạo thành trải nghiệm học thật cho học sinh.

---

## M8 - Thanh toán, mã giảm giá và mở khóa lộ trình

Mục tiêu: cho Student/Parent mua lộ trình bằng payOS, áp mã giảm giá và tự động mở quyền học.

Khi xong milestone này:

- Admin quản lý mã giảm giá.
- Backend tạo payment order payOS.
- Webhook payOS được verify và xử lý idempotent.
- Thanh toán thành công tạo enrollment 12 tháng.
- UI thanh toán hiển thị trạng thái và kết quả.

Milestone này biến hệ thống thành sản phẩm có thể bán khóa/lộ trình.

---

## M9 - AI tạo nội dung, giải thích và chat theo bài học

Mục tiêu: thêm AI vào trải nghiệm học và quản trị nội dung.

Khi xong milestone này:

- Admin dùng AI tạo tóm tắt bài học.
- Admin dùng AI tạo quiz/flashcard/test.
- Student bấm “Giải thích cho tôi” và nhận lời giải theo item.
- Student chat với AI trong phạm vi buổi học hiện tại.
- AI có cache/log/schema validation để kiểm soát chất lượng và chi phí.

Milestone này phụ thuộc nhiều vào M4/M5 vì AI cần tài liệu đã xử lý và retrieval đúng lesson.

---

## M10 - Thông báo realtime, email và Zalo

Mục tiêu: đưa thông báo vào hệ thống để học sinh/phụ huynh/admin nhận được sự kiện quan trọng.

Khi xong milestone này:

- Có API notification in-app.
- Có NotificationBell và trang danh sách thông báo.
- Có realtime notification bằng Socket.IO.
- Admin gửi thông báo thủ công.
- Hệ thống tạo thông báo tự động từ một số sự kiện học tập/thanh toán.
- Email/Zalo được gửi qua worker cho thông báo quan trọng.

Milestone này giúp sản phẩm không bị “im lặng” sau các hành động quan trọng.

---

## M11 - Cổng phụ huynh

Mục tiêu: cho Parent liên kết con, mua lộ trình cho con và theo dõi tiến độ học.

Khi xong milestone này:

- Parent liên kết được với Student bằng mã con.
- Parent chọn con nếu có nhiều con.
- Parent xem dashboard tiến độ.
- Parent xem danh sách lộ trình phù hợp và thanh toán cho con.
- Parent xem thông báo/tin tức liên quan.

Milestone này mở rộng sản phẩm từ học sinh sang phụ huynh, đúng nghiệp vụ thanh toán và theo dõi.

---

## M12 - Report lỗi, moderation, tin tức/sự kiện

Mục tiêu: thêm luồng phản hồi lỗi nội dung, duyệt nội dung AI và quản lý tin tức/sự kiện/livestream.

Khi xong milestone này:

- Student report lỗi ở từng item.
- Admin xem và xử lý report.
- Admin duyệt/ẩn nội dung AI chưa duyệt.
- Admin tạo tin tức/sự kiện/lịch livestream.
- Student/Parent xem được tin tức/sự kiện.

Milestone này giúp vận hành nội dung tốt hơn sau khi hệ thống có nhiều bài học và AI output.

---

## M13 - XP, leaderboard, profile và dashboard admin

Mục tiêu: thêm động lực học tập và các màn tổng quan hồ sơ/thành tích.

Khi xong milestone này:

- Student nhận XP và lên level.
- Có bảng xếp hạng học sinh.
- Student cập nhật một số trường profile được phép.
- Student upload avatar.
- Admin có dashboard overview.

Milestone này làm trải nghiệm học có cảm giác tiến bộ và giúp admin nhìn nhanh tình hình hệ thống.

---

## M14 - Test, hardening, deploy và vận hành

Mục tiêu: làm hệ thống chắc hơn trước khi chạy production.

Khi xong milestone này:

- Có unit test cho service quan trọng.
- Có API test cho flow nhạy cảm.
- Có E2E cho flow chính.
- Có security hardening/rate limit.
- Có logging/monitoring/error tracking.
- Có Docker Compose production, Nginx, health check.
- Có notes backup/restore/vận hành.

Milestone này không thêm nhiều tính năng mới; nó làm sản phẩm đủ tin cậy để vận hành thật.
