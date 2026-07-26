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
7. Front-end điều hướng theo role sau khi đăng nhập thành công; Admin vào `/admin/courses`, Student vào `/student/courses`, Parent vào trang phù hợp khi dashboard tương ứng đã triển khai.

Acceptance Criteria:

- Sai password trả lỗi chung, không tiết lộ tài khoản có tồn tại hay không.
- Access token chứa user id và role.
- Refresh token có thể revoke khi logout.
- Admin đăng nhập thành công phải được chuyển vào màn quản lý khóa học, không ở lại màn login.
- Student đăng nhập thành công phải được chuyển vào màn học tập/khóa học của tôi, không ở lại màn login.

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
6. Nhập title, order index, loại buổi học, mô tả ngắn, ngày/giờ học hoặc ngày/giờ mở bài thi, video URL và tiêu chí hoàn thành. Loại mặc định là `BASIC`; khi chọn `LIVE`, form hiển thị thêm field link học live tùy chọn.
7. Backend tạo `lessons` thuộc chương học.
8. Backend cập nhật tổng số buổi nếu cần.
9. Backend ghi audit log.

Acceptance Criteria:

- `order_index` của chương không trùng trong cùng lộ trình.
- `order_index` của buổi học không trùng trong cùng chương.
- Chương học chỉ chứa thông tin tổng quan, không có video/tài liệu/PDF/quiz/flashcard/test riêng.
- `completion_min_score` mặc định là 7.
- `lesson_type` mặc định là `BASIC`; chỉ nhận `BASIC` hoặc `LIVE`.
- `live_url` là optional, chỉ được giữ khi `lesson_type = LIVE`; khi chuyển về `BASIC`, backend clear field này.
- Video URL chấp nhận YouTube hoặc Google Drive.
- Chỉ admin được tạo/sửa/xóa.

---

## 5.1. Admin lấy và duyệt bản chép lời video

Actor: Admin.

Các bước:

1. Admin mở màn chi tiết một buổi học có video YouTube.
2. Admin mở panel `Bản chép lời video` cạnh khu vực cấu hình video và bấm `Lấy transcript từ YouTube`.
3. Backend thử lấy toàn bộ caption công khai theo trình tự thời gian; ưu tiên tiếng Việt, nếu không có thì dùng ngôn ngữ công khai phù hợp đầu tiên.
4. Backend đọc cấu hình player hiện tại, chỉ giữ các đoạn có timestamp nguồn nằm từ `startTimeInSeconds` đến `videoDuration - endTimeCutInSeconds`, rồi trừ `startTimeInSeconds` để ánh xạ về trục phát bắt đầu từ `0:00`. Nếu custom player bị tắt, giữ toàn bộ video và offset bằng `0`.
5. Backend giữ nguyên từng cue caption mà YouTube trả về: `time = offset` và `endTime = offset + duration`, sau đó ánh xạ cả hai về trục phát sau cắt. Không chia lại text theo khoảng thời gian tự đặt.
6. UI chỉ đưa kết quả vào form nháp, chèn header chapter kèm mốc thời gian trước đúng cụm transcript và chưa tự động ghi đè dữ liệu lesson.
7. Khi video phát hoặc được tua, UI chọn cue có khoảng timestamp gốc `[time, endTime)` đang chứa thời gian hiện tại, làm nổi bật đoạn đó và tự cuộn bên trong danh sách để giữ đoạn active trong vùng nhìn.
8. Admin tìm kiếm, duyệt, sửa mốc thời gian hoặc nội dung từng đoạn; có thể bấm action phát của một đoạn để player cộng lại phần cắt đầu, tua tới đúng timestamp nguồn và phát video.
9. Admin bấm lưu; frontend cộng lại `startTimeInSeconds` để PATCH transcript theo timestamp nguồn ổn định.

Acceptance Criteria:

- Chỉ hỗ trợ best-effort cho video YouTube có caption công khai; không chạy speech-to-text thay thế trong task này.
- Không có caption hoặc YouTube từ chối truy cập phải trả lỗi thân thiện và không ảnh hưởng phát video hay transcript đã lưu.
- Transcript được sắp xếp theo mốc thời gian tăng dần; mỗi đoạn có thời gian không âm và nội dung không rỗng.
- Transcript chỉ chứa caption thuộc khoảng video học viên thực sự được xem; timestamp trên form thuộc trục phát sau cắt, trong đó đoạn đầu bắt đầu tại `0:00`, còn dữ liệu lưu giữ timestamp nguồn để ánh xạ lại nếu cấu hình cắt thay đổi.
- Transcript lấy mới giữ nguyên ranh giới cue do YouTube cung cấp; độ dài mỗi đoạn có thể khác nhau. Timestamp được giữ tối đa 3 chữ số thập phân để action phát không làm tròn sai điểm bắt đầu.
- Header chapter hiển thị tên và timestamp trên cùng trục phát sau cắt với transcript.
- Action phát của từng đoạn chỉ khả dụng khi timestamp hợp lệ; khi bấm, player ánh xạ mốc sau cắt về timestamp nguồn, được đưa vào vùng nhìn và phát từ mốc tương ứng.
- Player chỉ thông báo thời gian qua listener nhẹ; panel chỉ đổi state khi chuyển sang đoạn transcript khác. Đoạn active có trạng thái `Đang phát`; auto-scroll chỉ tác động container transcript và tạm dừng khi admin đang tìm kiếm.
- Nếu cue YouTube chồng thời gian, UI ưu tiên cue có timestamp bắt đầu mới nhất đã tới thay vì giữ cue cũ đến hết `duration`; mỗi thời điểm chỉ có một đoạn transcript active.
- Chỉ admin được lấy và lưu transcript.

---

## 6. Admin upload tài liệu/PDF cho buổi học

Actor: Admin.

Flow chính MVP: upload một hoặc nhiều tài liệu nguồn ở cấp lộ trình rồi tạo các khối trích xuất cho từng buổi học. Hệ thống hỗ trợ cả hai thứ tự thao tác phổ biến:

- Tạo chương/buổi học trước, sau đó upload sách và gán page range hàng loạt.
- Upload sách trước, sau đó tạo chương/buổi học và gán page range ngay trong modal tạo/sửa buổi học.

Các bước:

1. Admin upload một hoặc nhiều PDF/tài liệu nguồn ở cấp lộ trình, hoặc dùng source documents đã upload trước đó. Mọi tài liệu trong danh sách đều là nguồn trích xuất ngang hàng.
2. Admin tạo/sửa chương và buổi học.
3. Backend validate file type và size.
4. Backend tạo object key.
5. Backend upload file lên object storage theo môi trường: MinIO local/dev hoặc Cloudflare R2 staging/production.
6. Backend lưu metadata vào `files`.
7. Backend tạo source document và enqueue job xử lý PDF nếu là PDF.
8. Worker kiểm tra OCR artifact cache theo `content_hash`; nếu chưa có thì gọi paid OCR provider từ file gốc, rồi lưu page text/Markdown/LaTeX, layout/region refs, visual refs nếu có, snapshot/thumbnail và quality status.
9. Modal tạo/sửa buổi học cho admin tạo nhiều khối trích xuất. Mỗi khối gồm select `Tài liệu trích xuất`, `Từ trang`, `Đến trang` và preview. Select chỉ chứa source document đã đủ trang, mọi page `READY` và đã xác nhận hết cảnh báo số trang in; danh sách giữ thứ tự upload cũ đến mới và mặc định chọn item hợp lệ đầu tiên.
10. Section `Tài liệu nền tảng` có hai action độc lập: `Thêm trích xuất` luôn nối thêm một khối trích xuất và `Thêm tài liệu` nối thêm một file PDF nền tảng trực tiếp. Modal tạo mới hiển thị sẵn một khối trích xuất; khối và file hiển thị theo đúng thứ tự admin bấm thêm. Admin cũng có thể thêm nhiều tài liệu bổ sung và tài liệu bài tập về nhà theo từng dòng gồm tên tài liệu và file PDF.
11. Nếu các buổi học đã tồn tại, admin bấm `Nhập khoảng trang` ở course detail để mở modal gán trang hàng loạt và nhập/chỉnh nhiều lesson cùng lúc.
12. Backend validate từng page range và toàn bộ collection: các range dùng cùng source document không được giao nhau theo biên inclusive; các source document khác nhau có thể dùng cùng số trang.
13. Worker chunk nội dung theo từng lesson dựa trên page range.
14. Worker tạo embedding.
15. Worker lưu chunks/embedding vào database với `lesson_id` đúng.

Fallback:

- Admin vẫn có thể upload tài liệu lẻ trực tiếp cho từng buổi học nếu tài liệu không nằm trong một source PDF dài.
- Sau khi đã gán trang từ source PDF dài, admin vẫn có thể upload thêm tài liệu bổ sung cho một vài buổi học, ví dụ phiếu bài tập riêng, file đáp án, ảnh công thức hoặc tài liệu tham khảo. Các tài liệu bổ sung này gắn trực tiếp vào `lesson_id` và được xử lý/chunk như nguồn context bổ sung của chính buổi học đó.
- Riêng tài liệu tham khảo thêm ngay trong modal tạo buổi học là storage-only: vẫn lưu file và `lesson_documents` để xem/tải lại theo lesson, nhưng không tạo OCR artifact, chunk hoặc embedding.

Acceptance Criteria:

- File chính không lưu trong disk app/VPS.
- PDF processing chạy background theo paid OCR artifact/page-level trước, chunking theo lesson sau khi có page range.
- Nếu xử lý lỗi, document status là `FAILED`.
- Admin thấy trạng thái `Sẵn sàng`/`Cần xác nhận` ngay trên từng tài liệu nguồn, đồng thời thấy trạng thái xử lý từng trang, từng lesson mapping và tài liệu bổ sung nếu có.
- Course detail không nhét toàn bộ form nhập khoảng trang vào màn chính; màn chính chỉ hiển thị danh sách/status gọn, còn chỉnh nhanh toàn bộ lesson nằm trong modal `Nhập khoảng trang`.
- Upload source PDF vẫn nằm ở cấp lộ trình/course detail. Modal lesson không upload source PDF mới; modal chỉ chọn nguồn đã có, tạo các khối trích xuất và preview nội dung để tránh chọn nhầm trang.
- Các input khoảng trang trong modal lesson và modal `Nhập khoảng trang` phải disabled cho tới khi source document ở trạng thái sẵn sàng, đủ page records, tất cả page đã xử lý xong và không còn warning số trang in cần admin xác nhận.
- Modal tạo/sửa buổi học hỗ trợ nhiều khối trích xuất và nhiều file nền tảng upload cùng lúc. Xóa một khối không xóa các khối/file còn lại.
- Nút `Thêm trích xuất` luôn khả dụng khi form không pending và mỗi lần bấm nối thêm một khối mới.
- Khi vừa append khối/file trống, UI chưa hiện lỗi. Lỗi realtime bắt đầu sau khi người dùng tương tác; submit vẫn hiển thị đầy đủ lỗi bắt buộc.
- Các range cùng `sourceDocumentId` không được giao nhau, kể cả chạm biên (`1-5` và `5-10`); range của các source khác nhau được phép trùng số trang.

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

## 11.1. Học sinh học video thông minh

Actor: Student.

Tiền điều kiện:

- Student có quyền truy cập lesson.
- Video lesson phát được; transcript/chapter là optional.
- Luồng lesson/quiz/test/completion ở `M7.1-M7.5` đã sẵn sàng.

Các bước:

1. Student mở lesson; backend trả vị trí gần nhất, watched percent và optional chapter mastery.
2. Nếu có lịch sử, UI cho chọn `Tiếp tục từ ...` hoặc `Xem lại từ đầu`.
3. Khi video chạy, client mở playback session, gửi heartbeat nhẹ theo chu kỳ và flush khoảng đã xem khi pause, seek, đổi chapter, kết thúc hoặc rời trang.
4. Student có thể tạo note theo timestamp, bấm note để quay lại mốc, làm checkpoint hoặc chọn `Hỏi đoạn này`/`Em chưa hiểu`.
5. Context AI gồm timestamp hiện tại, chapter, một cửa sổ transcript lân cận và retrieval của đúng lesson; thiếu transcript thì fallback rõ ràng.
6. Hệ thống cập nhật watched intervals/mastery và đề xuất chapter/đoạn nên ôn lại bằng nhiều tín hiệu.
7. Student có thể tìm theo ý nghĩa trong transcript, bấm kết quả để phát từ đúng timestamp, hoặc bỏ qua recommendation.

Acceptance Criteria:

- Tua thẳng tới cuối không làm watched percent thành 100%.
- Resume, note, checkpoint, search result và AI source đều dùng timeline sau cắt mà học sinh nhìn thấy.
- Video vẫn dùng được khi không có transcript.
- Chapter mastery không tự đánh dấu completed; completed vẫn theo `M7.5`.
- Auto tracking không gửi request theo từng frame và không làm player/input bị giật.
- Difficulty không được suy luận từ một event đơn lẻ; admin analytics chỉ hiển thị dữ liệu tổng hợp có ngưỡng riêng tư.

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

---

## 27. Admin tạo bản lộ trình cá nhân cho học sinh

Actor: Admin.

Precondition:

- Học sinh có enrollment hợp lệ với khóa học gốc.
- Enrollment chưa có tác vụ tạo bản cá nhân đang chạy.

Các bước:

1. Admin mở danh sách học sinh của khóa học gốc.
2. Admin chọn học sinh và bấm `Tạo bản cá nhân`.
3. UI hiển thị tên học sinh, khóa gốc và cảnh báo bản cá nhân không tự nhận các thay đổi tương lai từ khóa gốc.
4. Backend tạo clone job idempotent và trả trạng thái xử lý.
5. Worker nhân bản cấu trúc/nội dung mutable, giữ lineage về khóa/chương/buổi học gốc và tái sử dụng file/OCR artifact bất biến.
6. Khi clone hoàn tất, backend mới gán bản cá nhân làm lộ trình được giao của enrollment.
7. Admin được điều hướng tới màn chỉnh sửa bản cá nhân và có thể thêm, sửa, xóa mềm hoặc sắp xếp lại nội dung.

Acceptance Criteria:

- Bản cá nhân không xuất hiện trong public/student explore và không thể được mua.
- Chỉnh sửa bản cá nhân không làm thay đổi khóa gốc hoặc lộ trình của học sinh khác.
- Clone lỗi không được chuyển enrollment sang một bản chưa hoàn chỉnh.
- Gửi lại cùng yêu cầu không tạo nhiều bản cá nhân đang hoạt động.
- Không gọi lại paid OCR chỉ để nhân bản nội dung đã có artifact/cache hợp lệ.
- Mọi thao tác tạo, kích hoạt và chỉnh sửa bản cá nhân có audit log.
- Sau khi kích hoạt thành công, không có action quay lại khóa gốc; admin tiếp tục thêm, sửa, xóa trên bản cá nhân.

---

## 28. Học sinh học theo bản lộ trình cá nhân

Actor: Student.

Các bước:

1. Student mở khóa học đã mua bằng route/CTA hiện có của khóa gốc.
2. Backend xác định lộ trình hiệu lực của enrollment: bản cá nhân nếu enrollment đã được cá nhân hóa, ngược lại dùng khóa gốc.
3. UI hiển thị badge nhỏ `Lộ trình cá nhân` và cây chương/buổi học hiệu lực.
4. Student học, làm bài và lưu tiến độ trên các lesson thuộc lộ trình hiệu lực.
5. Tiến độ từ lesson gốc đã học trước khi cá nhân hóa được giữ thông qua lineage; lesson mới bắt đầu ở trạng thái chưa học.
6. Từ thời điểm kích hoạt, mọi progress, attempt, note, comment và favorite mới được ghi theo lesson/content của bản cá nhân.

Acceptance Criteria:

- Student khác không thể truy cập bản cá nhân qua ID hoặc URL.
- Progress percent, lesson tiếp theo và số buổi học được tính theo lộ trình hiệu lực.
- Không cộng XP lần hai cho một lesson gốc đã hoàn thành trước khi nhân bản.
- Attempt/note/comment cũ vẫn truy xuất được theo policy lineage, không bị sao chép thành dữ liệu của học sinh khác.
- Parent đã liên kết chỉ xem được bản cá nhân của đúng người con đang chọn.
- Không có API/UI để student, parent hoặc admin chuyển enrollment đã cá nhân hóa quay lại khóa gốc.
