# 02. User Flows - Luồng sử dụng chính

Tài liệu này mô tả các luồng nghiệp vụ chính để Codex triển khai API, UI và worker đúng hướng.

---

## 1. Student đăng ký tài khoản

Actor: Student.

Tiền điều kiện:

- Student chưa có tài khoản.
- Username chưa bị dùng; email/số điện thoại cũng chưa bị dùng nếu student có cung cấp.

Các bước:

1. Student mở màn đăng ký.
2. Nhập họ tên, khối lớp, năm sinh, giới tính, địa chỉ, số điện thoại, username, password và nhập lại mật khẩu. Nếu không có số điện thoại, student chọn "Không có số điện thoại" để bỏ qua field này. Email là optional ở API nhưng không hiển thị trong form đăng ký học sinh hiện tại.
3. Front-end validate form.
4. Backend validate dữ liệu và kiểm tra unique.
5. Backend hash password.
6. Backend tạo `users` role `STUDENT`.
7. Backend tạo `student_profiles`.
8. Backend tạo mã con duy nhất để phụ huynh liên kết.
9. Backend trả thông tin user cơ bản.

Acceptance Criteria:

- Không lưu password plain text.
- Username phải unique; email/phone phải unique nếu được cung cấp.
- Khối lớp chỉ nhận từ lớp 3 đến lớp 12.
- Năm sinh chỉ nhận khoảng phù hợp với học sinh lớp 3 đến lớp 12.
- Địa chỉ là bắt buộc trong form đăng ký học sinh.
- Số điện thoại là bắt buộc trừ khi student chọn "Không có số điện thoại".
- Mật khẩu chỉ yêu cầu tối thiểu 6 ký tự.
- Mật khẩu nhập lại phải khớp ở front-end trước khi gửi request.
- Response không trả password hash.
- Nếu input trùng, trả lỗi rõ ràng.

---

## 2. Parent đăng ký tài khoản

Actor: Parent.

Các bước:

1. Parent mở màn đăng ký.
2. Nhập email, số điện thoại, password và thông tin cơ bản.
3. Backend validate dữ liệu.
4. Backend hash password.
5. Backend tạo `users` role `PARENT`.
6. Backend tạo `parent_profiles`.

Acceptance Criteria:

- Parent chưa liên kết con ngay sau khi đăng ký.
- Parent có thể liên kết con ở flow riêng.
- Response không trả password hash.

---

## 3. Đăng nhập

Actor: Admin, Student, Parent.

Các bước:

1. User nhập identifier và password.
   - Student có thể dùng username/email/số điện thoại.
   - Parent dùng email/số điện thoại.
   - Admin dùng email hoặc username tùy seed/admin creation.
2. Backend tìm user theo identifier.
3. Backend verify password.
4. Backend tạo access token và refresh token.
5. Backend hash refresh token rồi lưu DB.
6. Front-end lưu access token theo cơ chế an toàn.
7. Front-end điều hướng theo role sau khi đăng nhập thành công; Admin vào trang admin hiện có, Student/Parent vào trang phù hợp khi dashboard tương ứng đã triển khai.

Acceptance Criteria:

- Sai password trả lỗi chung, không tiết lộ tài khoản có tồn tại hay không.
- Access token chứa user id và role.
- Refresh token có thể revoke khi logout.
- Admin đăng nhập thành công phải được chuyển vào trang admin, không ở lại màn login.

---

## 4. Admin tạo lộ trình học

Actor: Admin.

Các bước:

1. Admin mở trang quản lý lộ trình.
2. Admin bấm tạo lộ trình.
3. Nhập tên, môn, khối lớp, giá gốc, giá sau khuyến mãi, ảnh đại diện, mô tả, tổng số buổi, trạng thái.
4. Backend validate dữ liệu.
5. Backend tạo `learning_paths`.
6. Backend ghi audit log.

Acceptance Criteria:

- Môn chỉ thuộc Toán/Lý/Hóa.
- Giá không âm.
- Slug unique.
- Trạng thái mặc định là `DRAFT`.
- Khi admin xóa lộ trình, backend chuyển trạng thái sang `ARCHIVED`; lộ trình này không xuất hiện ở danh sách chính và chỉ xem/khôi phục trong thùng rác quản trị. Thùng rác cho phép chọn từng dòng hoặc chọn tất cả để khôi phục hoặc xóa vĩnh viễn. Khôi phục đưa lộ trình về `DRAFT`.
- Chỉ admin được gọi API này.

---

## 5. Admin tạo chương học và buổi học

Actor: Admin.

Các bước:

1. Admin vào chi tiết lộ trình.
2. Admin bấm thêm chương học.
3. Nhập tên chương, thứ tự, mô tả/tổng quan ngắn, mục tiêu học tập hoặc nội dung trọng tâm nếu có, trạng thái.
4. Backend tạo `learning_path_chapters`.
5. Admin mở chương học và bấm thêm buổi học.
6. Nhập title, order index, mô tả ngắn, ngày/giờ học hoặc ngày/giờ mở bài thi, video URL, tiêu chí hoàn thành.
7. Backend tạo `lessons` thuộc chương học.
8. Backend cập nhật tổng số buổi nếu cần.
9. Backend ghi audit log.

Acceptance Criteria:

- `order_index` của chương không trùng trong cùng lộ trình.
- `order_index` của buổi học không trùng trong cùng chương.
- Chương học chỉ chứa thông tin tổng quan, không có video/tài liệu/PDF/quiz/flashcard/test riêng.
- `completion_min_score` mặc định là 7.
- Video URL chấp nhận YouTube hoặc Google Drive.
- Chỉ admin được tạo/sửa/xóa.

---

## 6. Admin upload tài liệu/PDF cho buổi học

Actor: Admin.

Flow chính MVP: upload một tài liệu nguồn dài cho lộ trình rồi gán trang vào từng buổi học.

Các bước:

1. Admin tạo trước các buổi học bằng metadata thô.
2. Admin upload một PDF/tài liệu nguồn dài ở cấp lộ trình.
3. Backend validate file type và size.
4. Backend tạo object key.
5. Backend upload file lên object storage theo môi trường: MinIO local/dev hoặc Cloudflare R2 staging/production.
6. Backend lưu metadata vào `files`.
7. Backend tạo source document và enqueue job xử lý PDF nếu là PDF.
8. Worker extract/OCR theo từng trang, lưu page text, snapshot/thumbnail nếu có và quality status.
9. Admin gán khoảng trang cho từng buổi học.
10. Backend validate page range và tạo mapping `lesson -> page ranges`.
11. Worker chunk nội dung theo từng lesson dựa trên page range.
12. Worker tạo embedding.
13. Worker lưu chunks/embedding vào database với `lesson_id` đúng.

Fallback:

- Admin vẫn có thể upload tài liệu lẻ trực tiếp cho từng buổi học nếu tài liệu không nằm trong một source PDF dài.
- Sau khi đã gán trang từ source PDF dài, admin vẫn có thể upload thêm tài liệu bổ sung cho một vài buổi học, ví dụ phiếu bài tập riêng, file đáp án, ảnh công thức hoặc tài liệu tham khảo. Các tài liệu bổ sung này gắn trực tiếp vào `lesson_id` và được xử lý/chunk như nguồn context bổ sung của chính buổi học đó.

Acceptance Criteria:

- File chính không lưu trong disk app/VPS.
- PDF processing chạy background theo page-level trước, chunking theo lesson sau khi có page range.
- Nếu xử lý lỗi, document status là `FAILED`.
- Admin thấy trạng thái xử lý tài liệu nguồn, từng trang, từng lesson mapping và tài liệu bổ sung nếu có.

---

## 7. Admin dùng AI tạo tóm tắt/quiz/flashcard/bài kiểm tra

Actor: Admin.

Các bước chung:

1. Admin mở buổi học.
2. Chọn loại nội dung cần tạo bằng AI.
3. Nhập tham số như số lượng, độ khó, loại câu hỏi, thời gian làm bài nếu có.
4. Backend tạo BullMQ job.
5. Worker lấy context đúng `lesson_id`.
6. Worker gọi AI qua `AiProvider`.
7. Worker validate output bằng schema.
8. Worker lưu kết quả vào bảng tương ứng.
9. Admin xem, sửa, thêm, xóa và duyệt/publish.

Acceptance Criteria:

- Không gửi toàn bộ PDF nếu đã có chunk/embedding.
- Output không đúng schema thì không lưu dữ liệu lỗi.
- Nội dung có `source = AI` và `review_status` phù hợp.
- Có log AI generation.

---

## 8. Student/Parent thanh toán mua lộ trình

Actor: Student hoặc Parent.

Các bước:

1. User chọn lộ trình.
2. Nếu là parent, chọn con cần mua.
3. User nhập mã giảm giá nếu có.
4. Backend validate discount code.
5. Backend tính amount trên server.
6. Backend tạo payment order payOS.
7. Front-end hiển thị QR/checkout.
8. User thanh toán.
9. payOS gọi webhook.
10. Backend verify webhook signature/checksum.
11. Backend kiểm tra idempotency.
12. Backend cập nhật payment status `PAID`.
13. Backend tạo enrollment cho student trong 12 tháng.
14. Backend gửi notification/email nếu cần.

Acceptance Criteria:

- Không tin amount từ client.
- Webhook phải idempotent.
- Enrollment tạo đúng cho student.
- `expires_at = paid_at + 12 months`.
- Payment logs và webhook logs được lưu.

---

## 9. Học sinh xem danh sách lộ trình

Actor: Student.

Các bước:

1. Student đăng nhập.
2. Mở danh sách lộ trình.
3. Backend trả các lộ trình đang publish.
4. Front-end nhóm theo lớp.
5. Nếu student lớp 7, hàng đầu ưu tiên lộ trình lớp 7.
6. UI hiển thị trạng thái: chưa mua, đã mua còn hạn, hết hạn, có học thử.

Acceptance Criteria:

- Không hiển thị lộ trình hidden/archive.
- Thứ tự ưu tiên theo grade của student.
- Không tự động mở khóa nếu chưa enrollment hợp lệ.

---

## 10. Học sinh học thử buổi học được bật trial

Actor: Student.

Các bước:

1. Student vào chi tiết lộ trình chưa mua.
2. Nếu có buổi học được bật học thử, UI hiển thị buổi học đó.
3. Student mở buổi đầu.
4. Backend kiểm tra quyền trial.
5. Student được xem nội dung học thử được phép.

Acceptance Criteria:

- Chỉ buổi học được admin bật học thử mới mở quyền trial.
- Trial không mở khóa toàn bộ lộ trình.

ASSUMPTION: MVP cho phép học thử nội dung buổi được bật trial gồm video/tài liệu/tóm tắt/quiz/flashcard. Quyền làm bài kiểm tra trong trial cần owner chốt nếu muốn giới hạn khác.

---

## 11. Học sinh học trong một buổi

Actor: Student.

Tiền điều kiện:

- Student có enrollment còn hạn hoặc đang dùng trial hợp lệ.

Các bước:

1. Student mở buổi học.
2. Backend kiểm tra quyền truy cập.
3. UI hiển thị video, phiếu tài liệu, tóm tắt, quiz, flashcard, bài kiểm tra, ghi chú, comment riêng, chat AI, nút bài trước/bài tiếp theo.
4. Student học nội dung.
5. Student có thể tạo ghi chú/comment riêng.

Acceptance Criteria:

- Trước ngày mở bài thi, student chưa được làm bài kiểm tra.
- Student chỉ thấy comment riêng của chính mình.
- Ghi chú riêng chỉ thuộc student đó.

---

## 12. Học sinh làm quiz

Actor: Student.

Các bước:

1. Student chọn một bộ quiz trong buổi học.
2. Backend tạo quiz attempt.
3. Student trả lời từng câu.
4. Student nộp bài.
5. Backend chấm câu.
6. Backend lưu attempt và answers.
7. UI hiển thị số câu đúng/sai.
8. UI cho chọn làm lại tất cả, làm lại câu sai hoặc làm bộ quiz khác.

Acceptance Criteria:

- Attempt lưu đầy đủ lịch sử.
- Câu đúng/sai tính nhất quán.
- Student không sửa được attempt đã submit.

---

## 13. Học sinh học flashcard

Actor: Student.

Các bước:

1. Student chọn một bộ flashcard.
2. UI hiển thị từng flashcard.
3. Student đánh dấu đã thuộc/chưa thuộc.
4. Backend lưu progress theo từng flashcard.
5. UI tổng kết đã thuộc/chưa thuộc.
6. UI cho chọn ôn lại tất cả, ôn lại câu chưa thuộc hoặc học bộ khác.

Acceptance Criteria:

- Progress gắn với student và flashcard.
- Student khác không thấy progress của nhau.

---

## 14. Học sinh làm bài kiểm tra

Actor: Student.

Tiền điều kiện:

- Student có quyền truy cập buổi học.
- Đã đến ngày/giờ mở bài kiểm tra.

Các bước:

1. Student bấm làm bài kiểm tra.
2. Backend chọn một `test_set` phù hợp.
3. Backend tạo `test_attempt`.
4. Student làm bài trong thời gian quy định.
5. Student nộp bài.
6. Backend chấm bài.
7. Backend tính điểm thang 10.
8. Backend lưu attempt và answers.
9. Backend cập nhật best attempt của lesson nếu tốt hơn.
10. Nếu điểm >= 7, backend đánh dấu lesson completed.
11. Backend tạo XP event nếu hoàn thành.
12. Backend gửi notification cho student/parent nếu cần.

Acceptance Criteria:

- Không được làm bài trước giờ mở.
- Làm lại nhiều lần được.
- Kết quả tốt nhất ưu tiên điểm cao, sau đó thời gian nhanh.
- Lesson completed khi best score >= 7.
- Parent xem được kết quả tốt nhất.

---

## 15. Học sinh bấm “Giải thích cho tôi”

Actor: Student.

Áp dụng cho quiz question, flashcard, test question sau khi đã nộp bài.

Các bước:

1. Student bấm “Giải thích cho tôi”.
2. Backend kiểm tra quyền xem item.
3. Backend kiểm tra đã có `ai_explanations` cho target chưa.
4. Nếu có, trả lời giải đã cache.
5. Nếu chưa có, backend tạo job hoặc gọi AI theo mode phù hợp.
6. AI tạo lời giải dựa trên tài liệu buổi học.
7. Backend validate output.
8. Backend lưu lời giải.
9. UI hiển thị lời giải ngay dưới câu.

Acceptance Criteria:

- Nếu đã cache thì không gọi AI mới.
- Lời giải không cần cá nhân hóa theo đáp án sai của học sinh.
- Với test question, nút chỉ hiện sau khi student đã nộp bài.
- Không chuyển sang chat AI khi chỉ bấm giải thích.

---

## 16. Học sinh bấm “Chat thêm với AI”

Actor: Student.

Các bước:

1. Student đang xem lời giải.
2. Student bấm “Chat thêm với AI”.
3. UI chuyển sang khung chat AI của buổi học.
4. UI truyền context gồm target item và lời giải đã lưu.
5. Student nhập câu hỏi tiếp.
6. Backend retrieval tài liệu trong cùng lesson.
7. AI trả lời trong phạm vi bài học.
8. Backend lưu message.

Acceptance Criteria:

- Chat session gắn với student và lesson.
- AI không trả lời ngoài phạm vi lesson.
- Không cho upload file/ảnh trong chat.

---

## 17. Học sinh report lỗi

Actor: Student.

Các bước:

1. Student bấm report ở một câu quiz/flashcard/câu thi.
2. Chọn lý do và nhập mô tả nếu có.
3. Backend lưu `reports`.
4. Admin thấy report trong khu vực kiểm duyệt.

Acceptance Criteria:

- Report target chỉ là item lẻ.
- Không report cả bộ quiz/flashcard/test.
- Một student không nên spam report trùng cho cùng target.

---

## 18. Admin xử lý report

Actor: Admin.

Các bước:

1. Admin mở danh sách report.
2. Xem target bị report và nội dung report.
3. Chọn xử lý: sửa, ẩn, khôi phục, đánh dấu đã xử lý.
4. Backend cập nhật report status.
5. Backend ghi `report_actions` và audit log.

Acceptance Criteria:

- Chỉ admin được xử lý report.
- Mọi action quan trọng phải có log.

---

## 19. Parent liên kết con

Actor: Parent.

Các bước:

1. Parent đăng nhập.
2. Mở màn liên kết con.
3. Nhập mã con.
4. Backend tìm student theo mã con.
5. Backend kiểm tra student chưa có parent.
6. Backend tạo `parent_student_links`.
7. Parent thấy con trong danh sách.

Acceptance Criteria:

- Một student chỉ có một parent.
- Parent có thể liên kết nhiều con.
- Không cho parent liên kết chính mình hoặc user không phải student.

---

## 20. Parent chọn con và theo dõi tiến độ

Actor: Parent.

Các bước:

1. Parent đăng nhập.
2. Nếu có nhiều con, UI hiển thị màn chọn con.
3. Parent chọn một con.
4. UI lưu selected child state.
5. Parent mở dashboard tiến độ.
6. Backend kiểm tra parent-child link.
7. Backend trả tiến độ theo từng lộ trình/chương học/buổi học.

Acceptance Criteria:

- Parent chỉ xem con đã liên kết.
- Nếu parent có một con, có thể bỏ qua màn chọn con.
- Dữ liệu gồm trạng thái học, quiz, flashcard, điểm bài thi tốt nhất, thời gian tốt nhất, thành tích cao nhất.

---

## 21. Admin gửi thông báo thủ công

Actor: Admin.

Các bước:

1. Admin mở trang gửi thông báo.
2. Nhập tiêu đề, nội dung, danh sách tài khoản nhận.
3. Backend validate recipient là student/parent.
4. Backend tạo notifications.
5. Nếu recipient online, gửi realtime event.
6. Nếu cần, enqueue email/Zalo delivery.
7. Recipient mở nút thông báo và thấy thông báo mới.

Acceptance Criteria:

- Chỉ admin được gửi thủ công.
- Notification lưu DB trước khi gửi realtime.
- Nếu realtime fail, DB vẫn có thông báo.

---

## 22. Hệ thống gửi thông báo tự động

Actor: System/Worker.

Trigger có thể gồm:

- Sắp đến giờ học.
- Bài thi được mở.
- Student hoàn thành buổi học.
- Student có điểm bài thi.
- Student vào học muộn hoặc chưa học đúng lịch.

Các bước:

1. Scheduler hoặc service phát hiện trigger.
2. Backend/worker tạo notification.
3. Lưu DB.
4. Gửi realtime nếu user online.
5. Gửi email/Zalo nếu loại thông báo cần kênh ngoài.

Acceptance Criteria:

- Không gửi trùng trong cùng một trigger.
- Có delivery status cho email/Zalo.
- Có thể retry job nếu provider lỗi.

---

## 23. Admin tạo tin tức/sự kiện/livestream

Actor: Admin.

Các bước:

1. Admin mở trang tin tức/sự kiện/livestream.
2. Tạo bài viết hoặc lịch livestream.
3. Nhập title, content, thời gian, trạng thái publish.
4. Backend lưu.
5. Student/Parent xem danh sách published.

Acceptance Criteria:

- Draft không hiển thị cho student/parent.
- Chỉ admin được CRUD.

---

## 24. Yêu thích item

Actor: Student.

Các bước:

1. Student bấm yêu thích ở quiz question hoặc flashcard.
2. Backend kiểm tra quyền xem item.
3. Backend tạo hoặc xóa favorite.
4. Student mở danh sách yêu thích trong buổi học.

Acceptance Criteria:

- Favorite unique theo student + target.
- Chỉ hỗ trợ quiz question và flashcard trong MVP.

---

## 25. Top 5 bài thi trong buổi học

Actor: System.

Trigger: sau khi student nộp bài kiểm tra.

Các bước:

1. Backend tính best attempt của student trong lesson.
2. Backend lấy top 5 theo điểm cao hơn, nếu bằng điểm thì thời gian nhanh hơn.
3. UI hiển thị top 5 trong buổi học.

Acceptance Criteria:

- Chỉ dùng best attempt của mỗi student.
- Không hiển thị nhiều attempt của cùng một student trong top 5.

---

## 26. XP và cấp bậc

Actor: System.

Trigger: Student hoàn thành buổi học.

Các bước:

1. Backend xác định lesson completed.
2. Tính XP dựa trên điểm bài thi và thời gian hoàn thành.
3. Tạo `xp_events`.
4. Cập nhật tổng XP và level của student.
5. Cập nhật bảng xếp hạng.

Acceptance Criteria:

- Không cộng XP trùng cho cùng lesson completed.
- Nếu student làm lại sau khi đã hoàn thành, chỉ cập nhật XP nếu rule cho phép.

TODO: Công thức XP và level cần chốt chi tiết. Trong MVP có thể triển khai công thức tạm trong `GamificationService` và cấu hình bằng constant để dễ đổi.
