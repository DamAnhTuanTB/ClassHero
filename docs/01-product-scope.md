# 01. Product Scope - Phạm vi MVP

## 1. Mục tiêu sản phẩm

Hệ thống là nền tảng học theo lộ trình rõ ràng cho học sinh.

Mỗi lộ trình tương ứng với một Lĩnh vực và một hoặc nhiều Đối tượng hướng đến, ví dụ:

- Toán — Khối 7, Khối 8.
- Toán 8.
- Lý 8.
- Hóa 9.

Mỗi lộ trình gồm các buổi học/bài học được sắp xếp theo thứ tự. Chương học là lớp nhóm tùy chọn: admin có thể tạo khóa chỉ gồm các buổi học không thuộc chương, khóa chỉ dùng chương chứa buổi học, hoặc kết hợp cả hai. Học sinh học lần lượt các buổi cho đến hết lộ trình.

MVP tập trung vào việc giúp:

- Admin tạo và quản lý lộ trình học.
- Admin tạo chương học, buổi học, nội dung học tập, quiz, flashcard, bài kiểm tra.
- AI hỗ trợ tạo nội dung, tạo lời giải và chat theo tài liệu buổi học.
- Học sinh học theo từng buổi, làm quiz, flashcard, bài kiểm tra và nhận XP.
- Phụ huynh thanh toán cho con, theo dõi tiến độ và nhận thông báo.
- Hệ thống tự động mở khóa lộ trình sau khi thanh toán thành công.

---

## 2. Phạm vi MVP đã chốt

### Trong scope

- Chỉ làm các môn: Toán, Lý, Hóa.
- Đối tượng học sinh trong MVP bao phủ từ lớp 3 đến lớp 12, gồm Tiểu học, THCS và THPT.
- Có các role: Admin, Student, Parent.
- Có lộ trình học theo môn và khối lớp.
- Mỗi lộ trình có nhiều buổi học; mỗi buổi có thể thuộc một chương hoặc không thuộc chương nào.
- Chương học là lớp nhóm tùy chọn và có thể không tồn tại trong một khóa học.
- Admin có thể tạo một bản lộ trình cá nhân riêng tư từ khóa học mà học sinh đã mua để chỉnh sửa độc lập cho đúng học sinh đó.
- Có học thử ở buổi học cụ thể do admin bật.
- Có thanh toán QR/đối soát tự động bằng payOS.
- Lộ trình học có hạn 12 tháng sau khi thanh toán.
- Có mã giảm giá.
- Có quiz.
- Có flashcard.
- Có bài kiểm tra ngắn.
- Có nhiều bộ quiz/flashcard/bài thi trong một buổi học.
- Có kho bộ dự phòng do AI tạo.
- Có AI tạo tóm tắt, quiz, flashcard, bài kiểm tra, lời giải chi tiết và chat theo buổi học.
- Admin quản lý giới hạn token đầu vào và đầu ra theo từng tính năng trong tab
  `Thiết lập mặc định` của màn Cài đặt AI; không yêu cầu admin nhập giới hạn kỹ
  thuật của provider ở catalog model.
- Khi sinh tóm tắt, admin có thể chọn dùng trực tiếp crop ảnh gốc sách giáo khoa
  đã trích xuất thay vì gọi AI vẽ lại hình.
- Admin có thể chỉnh nhẹ ảnh raster sách giáo khoa đã dùng trong tóm tắt bằng
  preset làm nét/giảm nhiễu và cọ tô vùng xóa chi tiết đơn giản trên nền phẳng.
  Đây là xử lý ảnh local có preview, không phải AI inpainting hay phục dựng nội
  dung đã mất.
- Có học video thông minh theo `M15`: lưu khoảng đã xem/tiếp tục học, ghi chú theo timestamp, checkpoint, hỏi AI theo đoạn, tìm trong video, chapter mastery và đề xuất ôn tập. Đây là scope mở rộng được ưu tiên sau khi luồng lesson/quiz/test phía học sinh hoàn tất.
- Có report lỗi ở cấp item lẻ.
- Có quản lý nội dung AI chưa duyệt.
- Có comment/ý kiến riêng dưới video cho từng học sinh.
- Có ghi chú cá nhân.
- Có yêu thích quiz/flashcard.
- Có top 5 bài thi trong buổi học.
- Có XP, cấp bậc và bảng xếp hạng.
- Có tin tức/sự kiện/lịch livestream.
- Có thông báo realtime trong hệ thống qua biểu tượng/nút thông báo.
- Có thông báo email/Zalo cho một số thông báo quan trọng.
- Admin có thể gửi thông báo thủ công tới từng tài khoản student/parent.

### Ngoài scope MVP

Không làm trong MVP:

- Format riêng cho môn Tiếng Anh.
- Chat realtime học sinh với học sinh.
- Chat realtime học sinh với admin.
- Chat realtime phụ huynh với admin.
- Bạn thân.
- Chat nhóm theo khóa.
- Học bổng.
- Chống gian lận bài kiểm tra.

---

## 3. Role và quyền tổng quan

### 3.1. Admin

Admin có quyền:

- Quản lý lộ trình học.
- Tạo, chỉnh sửa, ngừng sử dụng bản lộ trình cá nhân của một enrollment.
- Quản lý buổi học.
- Upload tài liệu/PDF/ảnh.
- Tạo hoặc chỉnh sửa tóm tắt bài học.
- Dùng AI tạo tóm tắt bài học.
- Chọn theo từng lượt sinh tóm tắt giữa luồng AI vẽ lại hình mặc định và luồng
  tự điền crop ảnh gốc sách giáo khoa, không gọi AI tạo hình ở giai đoạn sau.
- Khi dùng crop ảnh gốc sách giáo khoa, có thể bật thêm `Tự động làm nét ảnh` để
  mọi crop được giảm nhiễu/làm nét và tăng độ đậm màu nhẹ bằng pipeline local
  trước khi lưu delivery; lựa chọn này không xuất hiện và không có hiệu lực ở
  luồng AI vẽ lại mặc định.
- Quản lý từng hình STEM trong tóm tắt: xem lỗi, xóa, tải ảnh thay thế, sinh lại
  bằng AI, xem SVG preview và tự sửa LaTeX figure snippet khi cần. Không có
  editor click-to-source/SyncTeX trên PDF hoặc preview trong phạm vi hiện tại.
- Mỗi hình có asset hiện hành hiển thị action `Đổi caption`. Modal cho phép sửa
  hoặc xóa trắng caption; caption rỗng được lưu hợp lệ thành `null` mà không thay
  ảnh, biên dịch lại hoặc gọi AI.
- Menu ảnh của block có lựa chọn `Xem ảnh sách giáo khoa` khi figure đích có
  reference SGK; lựa chọn này mở cùng khung ảnh nguồn ngay trong block như icon
  mở nhanh ở figure. Trong khung, checkbox `Tự động làm nét ảnh` mặc định tắt.
  Admin bấm `Dùng hình này` để promote crop; chỉ khi checkbox được bật hệ
  thống mới chạy preset làm nét local trước khi promote. Cả hai nhánh đều
  không phát sinh provider trả phí.
- Có thể thay hàng loạt các hình còn tồn tại từ lượt AI sinh Summary ban đầu bằng
  crop SGK đã làm nét. Action không tạo lại hình đã xóa và không thay hình admin
  đã tạo mới bằng AI, tạo bằng mã code, tải lên/thay thủ công hoặc ảnh SGK đã dùng.
- Với figure raster `TEXTBOOK_SOURCE` đã thành công, mở editor từ icon cây đũa,
  chọn đúng một trong hai công cụ làm nét hoặc xóa vùng thừa đơn giản. Làm nét tự
  giảm nhiễu, làm rõ nét và tăng độ đậm màu nhẹ mà không đổi hue chủ ý; kết quả
  cập nhật ngay khi chọn. Xóa tự cập nhật sau mỗi nét tô. `Áp dụng` chỉ
  chốt thao tác đang chọn và giữ modal mở để admin chọn công cụ tiếp theo. Mỗi
  lần áp dụng tạo revision/file delivery mới và audit; output thành công lập tức
  trở thành input của lượt chỉnh kế tiếp trong cùng modal, còn ảnh hiện hành
  không đổi nếu xử lý thất bại. Nét tô vượt mép được clip theo biên ảnh và phần
  mask hợp lệ bên trong vẫn được xử lý.
- Tạo, sửa, xóa quiz.
- Dùng AI tạo quiz.
- Với từng hình đề/hình lời giải của Quiz, admin có cùng bộ thao tác quản trị như
  hình Sinh kiến thức: chỉnh sửa hoặc tạo mới bằng mã code, tạo mới bằng AI, tải
  ảnh lên, xóa ảnh và chỉnh sửa caption.
- Tạo, sửa, xóa flashcard.
- Dùng AI tạo flashcard.
- Tạo, sửa, xóa bài kiểm tra.
- Dùng AI tạo câu hỏi bài kiểm tra.
- Cấu hình model chính/dự phòng cho từng chức năng AI, xem bảng giá/usage AI và OCR, đặt ngân sách, chủ động bật hard-stop tuyệt đối và xem audit thay đổi; không xem hoặc sửa API key trên UI.
- Tạo hoặc cập nhật lời giải chi tiết cho từng câu bằng AI.
- Xem và xử lý report lỗi.
- Xem, sửa, duyệt hoặc ẩn nội dung AI chưa duyệt.
- Tạo mã giảm giá.
- Tạo tin tức/sự kiện/lịch livestream.
- Gửi thông báo thủ công đến tài khoản student/parent.

### 3.2. Student

Học sinh có quyền:

- Đăng ký bằng họ tên, lớp, năm sinh, giới tính, địa chỉ, số điện thoại, username và password; số điện thoại có thể bỏ qua nếu học sinh chọn "Không có số điện thoại", email optional nếu học sinh có.
- Đăng nhập bằng username/email/số điện thoại + password.
- Quên mật khẩu.
- Xem danh sách lộ trình học.
- Mua lộ trình bằng thanh toán QR.
- Nhập mã giảm giá khi thanh toán.
- Học thử buổi học cụ thể nếu admin bật cho buổi đó.
- Vào buổi học đã mở quyền truy cập.
- Xem video bài giảng.
- Tiếp tục video từ vị trí gần nhất và xem tiến độ dựa trên phần thực sự đã xem.
- Ghi chú, tìm kiếm, làm checkpoint hoặc hỏi AI theo timestamp/chapter của video khi lesson hỗ trợ.
- Xem chapter cần ôn lại và lý do đề xuất; có quyền bỏ qua đề xuất.
- Xem phiếu tài liệu trước buổi học.
- Xem tóm tắt bài học.
- Làm quiz.
- Học flashcard.
- Làm bài kiểm tra khi đến ngày/giờ mở.
- Làm lại bài kiểm tra nhiều lần, mỗi lần là một bộ đề khác nhau.
- Xem kết quả bài kiểm tra.
- Bấm “Giải thích cho tôi” ở từng câu quiz/flashcard/câu thi.
- Bấm “Chat thêm với AI” từ lời giải.
- Chat với trợ lý AI trong phạm vi buổi học hiện tại.
- Tạo comment/ý kiến riêng dưới video.
- Tạo ghi chú cá nhân.
- Đánh dấu yêu thích câu quiz/flashcard.
- Report lỗi từng item.
- Xem top 5 bài thi trong buổi học.
- Nhận XP, lên cấp, xem bảng xếp hạng.
- Cập nhật avatar, username hiển thị, địa chỉ nhà.
- Xem thông báo.
- Xem tin tức/sự kiện/livestream.

Học sinh không được đổi:

- Ngày sinh.
- Họ tên.
- Giới tính.
- Số điện thoại.
- Email.

### 3.3. Parent

Phụ huynh có quyền:

- Đăng ký bằng email, số điện thoại, password.
- Đăng nhập bằng email/số điện thoại + password.
- Liên kết con bằng mã con.
- Chọn con nếu có nhiều con.
- Xem danh sách lộ trình học theo lớp của người con đang chọn.
- Thanh toán mua lộ trình cho con.
- Nhập mã giảm giá khi thanh toán.
- Theo dõi tiến độ và thành tích của con.
- Nhận thông báo qua email, Zalo và notification trong hệ thống.
- Xem tin tức/sự kiện/livestream.

Quy tắc liên kết:

- Một học sinh chỉ có một tài khoản phụ huynh.
- Một phụ huynh có thể liên kết nhiều con.

---

## 4. Quy tắc nghiệp vụ chính

### 4.1. Lộ trình học

- Mỗi lộ trình gắn với một môn và một khối lớp.
- Mỗi lộ trình gồm nhiều buổi học theo thứ tự; buổi học có thể thuộc một chương hoặc nằm trực tiếp trong lộ trình.
- Chương học là lớp nhóm tùy chọn. Một lộ trình có thể không có chương, hoặc có cả chương và các buổi học không thuộc chương.
- Cấu trúc top-level của khóa học là một danh sách có thứ tự chung gồm chapter và lesson không thuộc chapter; hai loại có thể xen kẽ tùy ý.
- Admin có thể di chuyển lesson tới bất kỳ vị trí nào trong cùng chapter, sang chapter khác, ra top-level hoặc từ top-level vào chapter.
- Giới hạn bảo toàn tiến độ: sau một thao tác move, lesson đang di chuyển không được đứng trước bất kỳ lesson khác đã có ít nhất một học sinh hoàn thành. Các lesson đã có completion tạo thành mốc khóa thứ tự; backend kiểm tra authoritative.
- Lộ trình có thể có giá gốc, giá sau khuyến mãi và mã giảm giá.
- Học thử được bật/tắt ở từng buổi học cụ thể, không cấu hình ở cấp lộ trình.
- Sau khi thanh toán thành công, enrollment có hạn 12 tháng.

#### 4.1.1. Bản lộ trình cá nhân

- Bản lộ trình cá nhân chỉ được tạo cho một enrollment hợp lệ của học sinh đã mua khóa học gốc.
- Khóa học gốc tiếp tục là sản phẩm dùng cho giá, payment, enrollment, doanh thu và báo cáo bán hàng.
- Enrollment có thể dùng khóa gốc hoặc một bản lộ trình cá nhân làm nội dung được giao để học.
- Mỗi enrollment chỉ có tối đa một bản lộ trình cá nhân đang được sử dụng tại một thời điểm.
- Bản cá nhân là riêng tư: không xuất hiện ở public/student explore, không có giá riêng, không thể mua, không tạo payment hoặc enrollment mới.
- Admin được thêm, sửa, xóa mềm và sắp xếp chương/buổi học trong bản cá nhân mà không làm thay đổi khóa gốc.
- Bản cá nhân là snapshot độc lập; thay đổi về sau ở khóa gốc không tự đồng bộ sang bản cá nhân trong MVP.
- Sau khi clone hoàn tất và được kích hoạt, bản cá nhân trở thành lộ trình học chính thức, lâu dài của enrollment; không có flow quay lại khóa gốc.
- Mọi thay đổi và dữ liệu học tập phát sinh sau thời điểm kích hoạt đi theo bản cá nhân; sai sót được sửa trực tiếp trên bản cá nhân thay vì đổi lại nguồn học.
- File/object storage và OCR artifact không bị sao chép vật lý nếu nội dung không đổi; các bản ghi nội dung có thể tái sử dụng file/artifact nguồn an toàn.
- Việc nhân bản phải giữ lineage từ chương/buổi học mới về chương/buổi học gốc để bảo toàn và giải thích lịch sử tiến độ.

### 4.2. Chương học

Chương học là lớp nhóm nội dung tùy chọn trong một lộ trình. Khóa học không bắt buộc phải có chương. Mỗi chương chỉ chứa thông tin tổng quan:

- Tên chương học.
- Thứ tự trong lộ trình.
- Mô tả/tổng quan ngắn.
- Mục tiêu học tập chính hoặc nội dung trọng tâm nếu admin nhập.
- Trạng thái hiển thị.

Chương học không có video, tài liệu/PDF riêng, tóm tắt bài học riêng, quiz, flashcard hoặc bài kiểm tra. Các nội dung học chi tiết này chỉ nằm trong buổi học.

ASSUMPTION: Ở MVP, chương học chỉ dùng để chia cấu trúc và giải thích tổng quan. Tiến độ hoàn thành và chấm điểm chính vẫn tính theo từng buổi học.

### 4.3. Buổi học

Mỗi buổi học gồm:

- Chương học tùy chọn; để trống khi buổi nằm trực tiếp trong lộ trình.
- Tên buổi học.
- Loại buổi học: học cơ bản hoặc học live; mặc định là học cơ bản.
- Link học live tùy chọn khi loại buổi học là học live.
- Tóm tắt ngắn nội dung sẽ học.
- Phiếu tài liệu trước buổi học.
- Ngày/giờ diễn ra hoặc ngày/giờ mở bài thi.
- Link video bài giảng YouTube hoặc Google Drive.
- Bản chép lời video tùy chọn theo từng mốc thời gian. Với video YouTube, admin có thể thử lấy caption công khai; hệ thống chỉ giữ phần nằm trong khoảng phát thực tế, ánh xạ timestamp về trục phát bắt đầu từ `0:00` sau khi cắt đầu/đuôi, gom các caption ngắn thành cụm dễ đọc, không gom qua ranh giới chapter, hiển thị tên/thời gian chapter, làm nổi bật và tự cuộn theo đoạn đang phát, đồng thời cho phát video từ từng mốc transcript trước khi admin duyệt/chỉnh sửa và lưu.
- PDF tài liệu sách giáo khoa/tài liệu bài học.
- Tóm tắt bài học.
- Quiz.
- Flashcard.
- Bài kiểm tra ngắn.
- Tiêu chí hoàn thành.

Trước ngày mở bài thi, học sinh vẫn có thể:

- Xem video.
- Xem tài liệu.
- Xem tóm tắt.
- Làm quiz.
- Học flashcard.

Nhưng chưa được làm bài kiểm tra.

### 4.4. Hoàn thành buổi học

Ở MVP, tiêu chí hoàn thành buổi học là:

- Học sinh đạt điểm bài kiểm tra từ 7/10 trở lên.
- Chỉ cần một attempt đã nộp từng đạt ngưỡng thì buổi học giữ trạng thái
  hoàn thành; các lần thi lại chưa đạt không hủy tiến độ đã có.
- Hai nút `Bài học trước` và `Bài học kế tiếp` luôn xuất hiện ở cuối trang
  lesson. Ở bài đầu tiên, nút trái đổi thành `Trở về` và dẫn về chi tiết khóa
  học; từ bài thứ hai, nút này là `Bài học trước`. Nút kế tiếp chỉ bật khi có
  bài đứng sau và học sinh đã từng nộp một bài thi đạt ngưỡng hoàn
  thành của lesson.

ASSUMPTION: Nếu một buổi học có nhiều bộ đề/bài kiểm tra, kết quả dùng để xét hoàn thành là kết quả tốt nhất của học sinh trong buổi học.

### 4.4.1. Học video thông minh

Phần mở rộng `M15` được triển khai sau luồng học sinh cốt lõi `M7.1-M7.5`.

- Hệ thống lưu playback session, vị trí gần nhất và các khoảng video thực sự đã xem theo timeline sau khi cắt đầu/đuôi.
- Tua tới cuối không được tính như đã xem toàn bộ.
- Học sinh có thể tạo ghi chú theo timestamp, bấm để quay lại đoạn video, làm checkpoint trong video và xem chapter mastery.
- `Hỏi đoạn này`/`Em chưa hiểu` dùng chapter, transcript lân cận và RAG của đúng lesson; không lấy context lesson khác.
- Tóm tắt chapter, flashcard từ video, semantic search và đề xuất ôn tập phải giữ liên kết timestamp nguồn.
- Difficulty/recommendation phải kết hợp nhiều tín hiệu như watched interval, replay, checkpoint, quiz/test, flashcard và action chủ động; không kết luận từ một lần pause/seek.
- Admin chỉ xem analytics video tổng hợp có ngưỡng riêng tư, không dùng event thô để giám sát học sinh.
- Watched percent và chapter mastery là tín hiệu hỗ trợ, không thay thế điều kiện hoàn thành lesson 7/10 ở MVP.

### 4.5. Quiz

- Một buổi học có thể có nhiều bộ quiz.
- Quiz có thể do admin tạo hoặc AI tạo.
- Admin có thể phát hành một bộ Quiz ngay khi có ít nhất một câu đã duyệt; câu
  chưa duyệt không xuất hiện với học sinh và không chặn phát hành.
- Sau lần phát hành đầu tiên, action `Lưu` đưa các câu mới duyệt vào lượt phát
  hành gần nhất của cùng bộ thay vì tạo một lượt phát hành mới.
- Mỗi câu quiz có câu hỏi, lựa chọn/câu trả lời, đáp án đúng, gợi ý, lời giải chi tiết.
- Hình đề và hình lời giải là resource có revision riêng; admin có thể sửa/tạo
  TeX, tạo lại bằng AI, thay bằng ảnh upload, xóa và đổi caption ngay trên card.
- Loại câu hỏi gồm bốn lựa chọn: trắc nghiệm, đúng/sai, đúng/sai nhiều mệnh đề
  và tự nhập đáp án.
- `Đúng/Sai` giữ dạng một câu hỏi với một đáp án boolean chung.
- `Đúng/Sai nhiều mệnh đề` có một đề dẫn chung và danh sách tối thiểu 2 mệnh
  đề; từng mệnh đề được gán `Đúng` hoặc `Sai` độc lập.
- Câu hỏi, phương án, gợi ý và lời giải dùng rich content: văn bản có thể bôi
  chọn để in đậm/in nghiêng/gạch chân/đổi màu, tạo bullet hoặc danh sách đánh
  số, căn trái/giữa/phải/đều, chèn ảnh và chèn công thức Toán/Lý/Hóa bằng
  LaTeX/KaTeX + mhchem; phím `Tab` thụt đoạn sang phải và `Shift + Tab` lùi
  đoạn về trái, còn trong danh sách thì tăng/giảm cấp danh sách con.
- Nút chèn bảng mở modal cấu hình số hàng, số cột và hàng tiêu đề trước khi
  chèn. Sau khi chèn, admin kéo trực tiếp đường biên dọc để đổi độ rộng cột,
  kéo đường biên ngang để đổi chiều cao hàng, thêm/xóa hàng hoặc cột, gộp/tách
  các ô đã chọn và bật/tắt hàng/cột tiêu đề; không cần nhập chiều cao thủ công.
- Ảnh đã chèn có thể căn trái/giữa/phải, kéo đổi kích thước theo tỷ lệ vùng
  editor, cắt xén trực tiếp bằng khung kéo phủ trên ảnh với lưới một phần ba,
  đặt lại vùng cắt và xóa nhanh ngay trên preview ảnh; thao tác cắt không phá
  hủy ảnh gốc và alignment/kích thước/vùng cắt được lưu cùng Tiptap JSON.
- Câu `TEXT_INPUT` chỉ có một chuỗi đáp án canonical do admin nhập; modal không
  cho thêm biến thể và không hiển thị cấu hình phân biệt hoa/thường hoặc khớp
  toàn bộ. Backend tự chấm tương đương: nếu hai chuỗi là số hợp lệ thì so sánh
  giá trị chính xác (`0.5`, `0,5`, `1/2`, `2/4` tương đương), nếu không thì
  chuẩn hóa Unicode/khoảng trắng và so sánh không phân biệt hoa thường. Field
  đáp án vẫn hỗ trợ LaTeX/mhchem và xem trước công thức.
- Panel Quiz hiển thị `Bắt đầu` khi student chưa từng mở runner của lượt hiện
  tại, `Tiếp tục làm` ngay khi lượt đã từng được mở dù chưa kiểm tra câu nào,
  và `Xem lại` khi đã hoàn thành mà không còn lượt đang làm. `Bắt đầu` luôn mở
  câu đầu tiên; `Tiếp tục làm` mở đúng câu gần nhất đã lưu ở server sau Back,
  F5, đóng/mở lại web hoặc đăng nhập trên thiết bị khác.
- Mọi đáp án Quiz đã chọn/đã nhập, kể cả chưa bấm `Kiểm tra đáp án`, phải được
  autosave theo attempt. Lượt `IN_PROGRESS` khôi phục đúng đáp án, trạng thái
  đã kiểm tra và vị trí câu trên mọi thiết bị; lịch sử hiển thị tiến độ
  `X/Y câu đã làm` của lượt hiện tại.
- Trong runner, `Đã làm` và điều kiện bấm `Hoàn thành` dựa trên số câu đã có đáp
  án đầy đủ, không dựa trên số lần bấm `Kiểm tra đáp án`. Khi mọi câu đã đủ đáp
  án, action `Hoàn thành` tự chấm các câu chưa kiểm tra trước khi submit.
- Khi đã hoàn thành, panel có thêm `Làm bộ Quiz mới` để tạo một lượt đầy đủ mới
  của bộ quiz hiện tại; luồng yêu cầu bộ nội dung khác/AI vẫn thuộc kho dự phòng.
- Học sinh làm xong quiz hoặc lượt làm lại thì luôn thấy số câu đúng/sai cộng
  dồn của bài Quiz gốc, không hiển thị một màn tổng kết riêng cho bộ câu con.
- Học sinh có thể làm lại tất cả, làm lại câu sai hoặc làm bộ quiz khác.

### 4.6. Flashcard

- Một buổi học có thể có nhiều bộ flashcard.
- Flashcard có thể do admin tạo hoặc AI tạo.
- Panel Flashcard trong lesson dùng cùng mô hình vào bài như Quiz: `Bắt đầu`
  khi student chưa từng mở runner của lượt hiện tại, `Tiếp tục học` ngay khi
  lượt đã từng được mở dù chưa đánh dấu thẻ nào và `Xem lại` khi đã hoàn thành.
  `Bắt đầu` luôn mở thẻ đầu tiên; `Tiếp tục học` mở đúng thẻ gần nhất đã lưu
  trên cùng trình duyệt sau Back, F5 hoặc đóng/mở lại web.
- Sau khi bấm CTA, UI chuyển sang runner toàn màn hình riêng thay vì tiếp tục
  học ngay bên trong panel/tab lesson. Runner có header ClassHero, tiến độ,
  xác nhận khi thoát giữa lượt và trạng thái pending/disabled rõ ràng.
- Học sinh học xong thì thấy đã thuộc bao nhiêu, chưa thuộc bao nhiêu.
- Runner có dải chấm điều hướng theo từng thẻ: chấm hiện tại kéo dài, thẻ đã
  thuộc dùng xanh, chưa thuộc dùng đỏ và chưa đánh dấu dùng xám.
- Khi học sinh đánh dấu `Đã thuộc` hoặc `Chưa thuộc`, runner hiển thị nhãn xác
  nhận có hoạt ảnh ngay trên thẻ hiện tại rồi mới tự chuyển sang thẻ kế tiếp;
  thao tác được khóa cho tới khi progress lưu thành công và hoạt ảnh kết thúc.
- Nếu bấm `Hoàn thành` khi còn thẻ chưa được đánh dấu, runner không mở kết quả
  và hiển thị cảnh báo inline liệt kê đúng số thứ tự các thẻ còn thiếu.
- Màn kết quả Flashcard là màn toàn màn hình, có `Ôn lại tất cả`,
  `Ôn lại thẻ chưa thuộc` và `Xem lại thẻ yêu thích`; không liệt kê từng thẻ cần
  ôn hoặc thêm action chọn bộ. Action yêu thích bị khóa khi bộ không có thẻ yêu
  thích.
- `Ôn lại tất cả` mở một lượt mới gồm toàn bộ thẻ, đưa vị trí, bộ đếm và nhãn
  `Đã thuộc`/`Chưa thuộc` của lượt về trạng thái ban đầu. Lịch sử progress đã lưu
  không bị xóa; lựa chọn trong lượt mới cập nhật lại progress của từng thẻ.
- `Xem lại thẻ yêu thích` chốt một lượt chỉ gồm các thẻ đang được yêu thích
  trong bộ Flashcard hiện tại.

### 4.7. Bài kiểm tra

- Bài kiểm tra chỉ mở vào ngày/giờ admin thiết lập.
- Bài kiểm tra chỉ mở sau khi học sinh đã hoàn thành cả Quiz và Flashcard của
  lesson. Lesson thiếu bộ Quiz/Flashcard có nội dung được duyệt vẫn phải khóa
  bài thi; không được coi nội dung còn thiếu là tiến độ đã hoàn thành.
- Form câu hỏi bài kiểm tra có bốn lựa chọn: `Trắc nghiệm`, `Đúng/Sai`,
  `Đúng/Sai nhiều mệnh đề` và `Nhập đáp án`.
- `Đúng/Sai` cũ tiếp tục dùng một đáp án boolean chung. `Đúng/Sai nhiều mệnh
đề` là loại độc lập, không thay thế hoặc làm thay đổi dữ liệu câu Đúng/Sai
  cũ.
- Học sinh được làm lại nhiều lần.
- Mỗi lần làm là một bộ đề khác nhau nếu còn bộ phù hợp.
- Trong lúc đang làm, nút Back của trình duyệt và nút quay lại trong header phải
  cảnh báo rằng lượt hiện tại sẽ bị hủy và học sinh phải làm bài thi mới.
- F5/reload/đóng trang phải dùng cảnh báo rời trang của trình duyệt. Nếu học sinh
  vẫn tiếp tục rời hoặc reload, runner hiện tại bị hủy và không được khôi phục
  như Quiz/Flashcard.
- Hệ thống lưu toàn bộ lịch sử làm bài.
- Kết quả dùng để hiển thị/gửi phụ huynh/tính thành tích/xếp hạng là kết quả tốt nhất.

Kết quả tốt nhất ưu tiên:

1. Điểm cao hơn.
2. Nếu bằng điểm, thời gian làm nhanh hơn.

Sau khi nộp bài, học sinh thấy:

- Số câu đúng.
- Số câu sai.
- Điểm.
- Thời gian làm bài.
- Xem lại toàn bộ đề.
- Xem lại câu sai.
- Làm bài thi mới.

### 4.8. Kho bộ dự phòng quiz/flashcard/bài thi

Khi học sinh bấm tạo bộ quiz/flashcard/bài thi mới:

1. Hệ thống kiểm tra còn bộ dự phòng phù hợp không.
2. Nếu còn, dùng bộ có sẵn.
3. Nếu hết, AI tạo bộ mới.
4. Bộ mới được lưu database.
5. Bộ mới trở thành bộ dự phòng cho học sinh khác.
6. Bộ mới được đánh dấu là AI tạo và chưa được admin duyệt.

Dù chưa duyệt, học sinh vẫn được dùng và kết quả vẫn được tính điểm/xếp hạng.

### 4.9. Lời giải AI inline

Ở mỗi câu quiz và flashcard có nút “Giải thích cho tôi”.

Ở câu hỏi trong bài thi, nút này chỉ hiện sau khi học sinh đã nộp bài.

Khi bấm:

1. Nếu đã có lời giải lưu sẵn, hiển thị lại ngay.
2. Nếu chưa có, AI tạo lời giải, lưu lại rồi hiển thị.
3. Lời giải hiển thị ngay dưới câu.
4. Không chuyển sang khung chat AI.

Lời giải là lời giải chi tiết chung, không cần giải thích riêng theo đáp án học sinh chọn sai.

### 4.10. Chat AI trong buổi học

Mỗi buổi học có khung chat AI.

Input chỉ cho nhập text, gồm văn bản thường và ký hiệu Toán/Hóa/Lý. Không cho upload ảnh/file.

AI chỉ trả lời dựa trên tài liệu của buổi học hiện tại. Nếu câu hỏi không liên quan đến buổi học, AI không trả lời và yêu cầu học sinh hỏi lại câu liên quan hơn.

Toàn bộ lịch sử chat AI của từng học sinh trong từng buổi học được lưu lại.

Khi gọi AI, hệ thống không cần gửi toàn bộ lịch sử. Chỉ gửi một số tin nhắn gần nhất và conversation summary nếu hội thoại dài.

### 4.11. Report lỗi

Học sinh report lỗi ở cấp item lẻ:

- Một câu quiz.
- Một flashcard.
- Một câu hỏi đề thi.

Không report cả bộ quiz/flashcard/bài thi chỉ vì một câu lỗi.

Admin xử lý report bằng cách sửa, ẩn, khôi phục hoặc đánh dấu đã xử lý.

### 4.12. Notification

Học sinh và phụ huynh có biểu tượng/nút thông báo trên giao diện.

Khi ấn vào, hệ thống hiển thị danh sách thông báo của tài khoản đang đăng nhập, thông báo mới nhất nằm đầu danh sách.

Thông báo gồm:

- Thông báo realtime trong hệ thống.
- Thông báo tự động từ hệ thống.
- Thông báo thủ công do admin gửi riêng.
- Email/Zalo cho phụ huynh hoặc thông báo quan trọng.

Thông báo tự động có thể tạo khi:

- Sắp đến giờ học.
- Bài thi được mở.
- Học sinh hoàn thành buổi học.
- Học sinh có điểm bài thi.
- Học sinh vào học muộn hoặc chưa học đúng lịch.
- Có sự kiện hệ thống khác nếu cần.

---

## 5. TODO cần chốt sau MVP hoặc trong quá trình dev

Các điểm chưa được chốt chi tiết, không được tự bịa thành quyết định cố định:

- TODO: Thiết kế UI final cho từng màn hình.
- TODO: Giới hạn dung lượng file upload final.
- TODO: Quy tắc chi tiết tính XP và cấp bậc.
- TODO: Tần suất gửi email/Zalo để tránh spam.
- TODO: Chính sách xóa tài khoản và lưu trữ dữ liệu.
- TODO: SLA/backup policy cụ thể cho production.
- TODO: Nội dung mẫu email/Zalo.
