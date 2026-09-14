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
- Admin có màn `Chat với AI` để mô phỏng chính runtime Chat AI của học sinh theo
  một buổi học, một khóa học hoặc một tập khóa học được chọn; từng lượt cho xem
  input đã gửi provider, tham số hiệu lực, token, chi phí và thời gian phản hồi.
- Khi admin sinh kiến thức, số bài tập vận dụng chuẩn và số bài ứng dụng thực tế
  được cấu hình độc lập, mặc định `2` cho mỗi nhóm. Đây là số lượng mục tiêu của
  Phase 1; nếu AI trả thiếu hoặc thừa, các bài hợp lệ vẫn được lưu và hiển thị.
- System prompt vẫn độc lập theo Toán, Vật lý, Hóa học và fallback `GENERAL`;
  không lấy quy tắc của một môn làm core cho môn khác. Riêng thao tác tạo hình
  lời giải tương đương của Sinh kiến thức, Quiz và Flashcard dùng chung Solution
  Figure Core; API, queue, dữ liệu và lifecycle của từng domain vẫn độc lập.
- Admin quản lý hai route model độc lập theo từng tính năng `SUMMARY`, `QUIZ`,
  `FLASHCARD`, `TEST` trong tab `Thiết lập mặc định`: `Phase 1 - tạo text` và
  `Phase 2 - tạo ảnh`. Mỗi route có model chính/dự phòng, capability setting và
  giới hạn token đầu vào/đầu ra riêng; không yêu cầu admin nhập giới hạn kỹ thuật
  của provider ở catalog model.
- Khi quản lý catalog model, UI liệt kê hợp đầy đủ các mức Reasoning Effort
  `none | minimal | low | medium | high | xhigh | max` theo thứ tự tăng dần.
  Admin tự chọn tập mức mà từng model hỗ trợ; mọi select cấu hình phía sau chỉ
  hiển thị tập đã chọn và vẫn giữ thứ tự chuẩn này.
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
- Tạo bản tóm tắt video ngắn gọn bằng AI từ mốc thời gian/chapter và bản chép
  lời đã lưu của đúng buổi học; admin được xem chính xác dữ liệu sẽ gửi, duyệt
  và chỉnh nội dung trước khi dùng.
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
- Với hình Sinh kiến thức và Quiz có asset hiện hành được tạo qua OpenAI, admin
  thấy chi phí thực tế của đúng asset. Nếu usage của asset có
  `cachedInputTokens > 0`, khung ảnh hiển thị thêm nhãn cache ngay trước nhãn chi
  phí. Ảnh upload/code, crop SGK hoặc provider khác không được suy diễn là đã
  dùng cache.
- Trong lịch sử từng lượt gọi AI của Sinh kiến thức và Quiz, admin thấy thời
  gian phản hồi, Reasoning Effort thực tế đã gửi và tên tác vụ đúng mục đích.
  Các tác vụ sinh nội dung, tạo/tinh chỉnh/chỉnh sửa/sửa lỗi ảnh và tinh chỉnh
  hoặc tạo lại lời giải không được gom dưới một nhãn chung.
- Modal chỉnh sửa bằng mã code của cả Sinh kiến thức và Quiz có bộ `Chỉnh nhanh`
  dùng chung, dành cho admin không cần biết TikZ: ẩn nhãn độ dài, số đo góc hoặc
  nhãn chỉ chứa số; xóa nét phụ đứt/chấm; chọn độ đậm nét; dùng slider `10%–200%`
  với mốc gốc `100%` cho toàn hình, `Nhãn chính` và `Nhãn phụ`; hoàn tác thao tác gần nhất. Bảng
  công cụ mở dạng popover nổi nên không chiếm chỗ của editor/preview. Mỗi action
  biến đổi source theo quy tắc xác
  định rồi tự gọi pipeline compile/validator hiện có để cập nhật preview; current
  revision chỉ đổi khi admin bấm `Áp dụng`. Bộ công cụ không gọi provider AI,
  không xóa tên điểm/ký hiệu nguyên tố theo heuristic mơ hồ và chỉ thay đổi hình
  học khi admin nhập rõ tên góc/cạnh cần tạo. Slider chỉ commit khi thả/blur/Enter để không gọi
  compile liên tục trong lúc kéo. Thu/phóng dùng metadata comment an toàn trong source
  để cùng tỷ lệ được giữ ở preview, card admin và giao diện học sinh; ảnh cũ chưa
  chỉnh giữ nguyên cách hiển thị hiện tại.
- Trong cùng bộ `Chỉnh nhanh`, nhóm `Nhãn và số đo` liệt kê riêng từng nội dung
  chữ mà transformer xác định chắc chắn đang được render bởi source TikZ, theo
  đúng thứ tự xuất hiện. Admin sửa trực tiếp giá trị trong input hoặc xóa đúng
  mục đó mà không phải tìm dòng code. Mỗi row có icon `Áp dụng` để commit riêng
  nhãn và biên dịch đúng một lần, kế tiếp là icon cài đặt và icon xóa; icon cài đặt mở ba slider
  nằm ngay dưới input của chính slot: dịch ngang/dọc `-50pt–+50pt` với vị trí
  hiện tại là `0`, và cỡ chữ riêng `10%–200%` với cỡ hiện tại là `100%`. Thay đổi
  chỉ tác động text slot được chọn, giữ nguyên geometry/anchor và tự biên dịch
  lại preview; `Áp dụng` vẫn là bước lưu duy nhất. Cỡ chữ riêng được nhân trên
  cỡ nền của nhóm `Nhãn chính/Nhãn phụ`, nên đổi hai lớp slider theo bất kỳ thứ
  tự nào cũng không làm mất tỷ lệ riêng. Source mơ hồ hoặc cú pháp text chưa được
  hỗ trợ phải được báo để admin sửa trong editor, không được đoán rồi thay nhầm
  nội dung khác. Riêng row số đo góc có thêm slider `Khoảng cách cung tới đỉnh`
  `4pt–50pt`; slider chỉ đổi bán kính toàn bộ nhóm cung của đúng góc và bù
  `angle eccentricity` để text số đo giữ nguyên vị trí.
- `Nhập góc nhanh` nhận tên góc ba điểm như `ABD` hoặc `A-B-D` (điểm giữa là
  đỉnh) và số đo nguyên `1°–179°`. Nếu admin bật tự nối, hệ thống chỉ thêm hai
  đoạn thẳng tạo góc còn thiếu, không nhân đôi cạnh đã có; sau đó thêm nhãn số đo
  và nhóm cung liền có số lượng khác các nhóm số đo khác đang tồn tại. Góc cùng
  số đo dùng cùng kiểu cung; góc khác số đo phải dùng kiểu khác, còn số đo đại số
  chưa chứng minh bằng nhau vẫn chiếm một kiểu riêng. Nếu góc đã có, `Thêm góc`
  thay nguyên tử số đo và toàn bộ nhóm cung cũ thay vì báo trùng hoặc thêm chồng.
  Thao tác
  dùng tọa độ Descartes hoặc tọa độ cực dạng số (kể cả cực tương đối quanh một
  named point có tọa độ số) để chọn miền góc nhỏ, tự compile preview và tạo
  đúng một bước hoàn tác. Point/geometry mơ hồ phải báo lỗi, không tự đoán.
  Cùng card có action `Bỏ góc`: chỉ cần tên góc, hệ thống xóa toàn bộ số đo và
  ký hiệu cung của đúng cặp tia đó, kể cả số đo nằm trong `pic` hoặc `node` rời
  neo tường minh vào góc, nhưng giữ nguyên hai cạnh, named point và các nhóm góc
  khác.
- `Chỉnh đoạn thẳng` nhận hai tên điểm như `BD` hoặc `B-D`, cho phép admin `Nối`
  một cạnh trực tiếp chưa có hoặc `Bỏ nối` đúng cạnh đang có. Cạnh trong path
  thẳng dạng chuỗi/chu trình được tách hoặc mở chu trình mà không vô tình nối hai
  điểm còn lại; lệnh vẽ phức tạp chưa chứng minh được boundary phải giữ nguyên và
  yêu cầu sửa mã. Cạnh mới kế thừa độ dày chiếm ưu thế của các cạnh hình học đang
  có. Mỗi thao tác tự compile preview và có một bước hoàn tác.
- `Thêm trung điểm` nhận hai điểm như `AB` và tên điểm mới như `M`; nếu `AB` chưa
  nối thì tự thêm đúng một cạnh, sau đó tạo coordinate chính xác tại
  `($(A)!0.5!(B)$)`, dấu điểm/nhãn và một cặp marker bằng nhau nằm trong hai nửa
  đoạn. Tên midpoint được chuẩn hóa viết hoa và nhãn mới kế thừa font-size của
  các nhãn điểm hiện có. Mỗi đoạn độc lập phải dùng marker khác nhóm đã có; cùng một đoạn dùng
  đúng một kiểu cho cả hai nửa. Nếu đoạn đã có đúng một midpoint do Chỉnh nhanh
  quản lý và admin nhập tên mới, action thêm phải ghi đè atomic midpoint cũ, tái
  sử dụng kiểu marker và không nhân đôi cạnh. Tên trùng với điểm khác hoặc source
  không chứng minh an toàn phải báo lỗi và giữ nguyên hình. Action `Xóa trung điểm` chỉ cần input đoạn
  thẳng, tự tìm quan hệ trung điểm duy nhất do Chỉnh nhanh quản lý, bỏ coordinate/
  dấu điểm/nhãn/cặp marker của quan hệ đó nhưng luôn giữ đoạn gốc.
- Card tên tâm đường tròn có checkbox `Thêm tên tâm đường tròn`; chỉ khi bật mới
  hiện input và CTA `Thêm tên tâm`. Tên nhập được chuẩn hóa viết hoa. Transformer
  chỉ nhận đúng một tâm của đường tròn đơn xác định từ source, thêm coordinate
  khi cần và nhãn cạnh tâm với font-size kế thừa nhãn điểm; không tạo thêm chấm
  tâm, không thay hình học và không gọi AI. Nhập tên mới lần nữa thay atomic block
  nhãn tâm do Chỉnh nhanh quản lý; nhiều tâm hoặc tên đã dùng ở vị trí khác phải
  giữ nguyên source và báo lỗi.
- Khi Sinh kiến thức tự chạy Phase 2 cho khối Ví dụ/Bài tập không có ảnh gốc tài
  liệu, hệ thống dựng một hình lời giải hoàn chỉnh từ `solution > problem`, không
  phụ thuộc hình đề hay ảnh nguồn. Khi admin mở menu ảnh trên một khối chưa có
  figure, action `Tạo mới bằng AI` được thay bằng hai action độc lập `Tạo hình cho
đề bài` và `Tạo hình cho lời giải`: hình đề chỉ dùng `problem`, hình lời giải
  dùng `solution > problem`; hai hình lần lượt sở hữu slot `0` và `1`. Nếu khối đã
  có hình đề được dựng từ ảnh SGK, menu giữ action vẽ lại hình hiện tại và thêm
  `Tạo hình cho lời giải` không gửi/kế thừa ảnh SGK. Summary giữ prompt/runtime
  riêng nhưng áp dụng cùng invariant nghiệp vụ với Quiz. Hai modal target luôn có
  `Tạo mới lại`; chỉ khi đúng slot target đã có asset AI/TikZ hiện hành thì mới
  hiện thêm `Chỉnh sửa hình hiện tại`. Lựa chọn chỉnh sửa dùng trực tiếp source
  hiện tại và không phụ thuộc figure có ảnh SGK hay không. Khối thường giữ nguyên.
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
- Tạo, sửa, xóa quiz. Riêng action xóa cả bộ Quiz là xóa cứng: bộ câu hỏi, mọi
  câu/lời giải/hình và toàn bộ lịch sử làm bài phụ thuộc bị xóa vĩnh viễn; audit
  log quản trị vẫn được giữ.
- Dùng AI tạo quiz.
- Tại từng khối lời giải Quiz, admin có hai action riêng `Tinh chỉnh lời giải`
  và `Tạo lại lời giải`.
  Modal tự điền đề bài, phương án/mệnh đề, đáp án đúng và lời giải hiện tại; admin
  có thể thêm yêu cầu riêng và xem request/chi phí trước khi thực hiện. AI làm rõ
  lập luận, bổ sung mắt xích còn viết tắt, sửa câu từ/công thức và làm đẹp cách
  trình bày nhưng phải giữ nguyên đề, đáp án và gợi ý. `Tạo lại lời giải` giải
  độc lập từ đề, không nhận đáp án/gợi ý/lời giải cũ và được cập nhật đồng bộ đáp
  án, gợi ý, lời giải. Cả hai action đều đưa câu về trạng thái cần duyệt lại.
  Riêng `Tạo lại lời giải` có checkbox mặc định tắt để gửi lời giải hiện tại như
  mẫu sai cần tránh; khi bật vẫn ẩn đáp án và gợi ý cũ.
- Với từng hình đề/hình lời giải của Quiz, admin có cùng bộ thao tác quản trị như
  hình Sinh kiến thức: chỉnh sửa hoặc tạo mới bằng mã code, tạo mới bằng AI, tải
  ảnh lên, xóa ảnh và chỉnh sửa caption.
- Trên header từng card Quiz, admin có một menu ảnh AI để tạo trực tiếp hình đề,
  tạo hình lời giải bằng cách mở rộng exact hình đề AI, hoặc vẽ lại một mô hình
  lời giải độc lập. EXTEND chỉ khả dụng khi current hình đề thực sự do AI tạo và
  đã render thành công; REDRAW không yêu cầu hình đề. Mỗi lựa chọn mở lại đúng
  modal cấu hình/prompt/request/chi phí của luồng `Tạo mới bằng AI` hiện có. Menu
  này hiện cho mọi loại câu Quiz, gồm cả `Đúng/Sai` một mệnh đề; riêng pipeline
  sinh Quiz tự động vẫn không tự quyết định tạo hình cho loại câu đó.
- Với hình Quiz TikZ đã sinh thành công, admin có action `Tinh chỉnh`. Hệ thống
  gửi source hiện tại, ảnh render hiện tại và figure plan gốc cho model ảnh để
  đánh giá toàn diện. Riêng `EXTEND_QUESTION`, request gửi thêm exact source và
  ảnh render của revision hình đề bất biến; model chỉ trả phần extension mới để
  backend ghép vào exact base. Các mode còn lại trả source TikZ hoàn chỉnh mới.
  Tinh chỉnh bao gồm sửa sai/vô lý/thiếu đối tượng, quan hệ, nhãn, số đo, bố cục
  và khả năng đọc; không bị giới hạn ở làm đẹp mỹ thuật. Bấm action chỉ mở modal cho admin
  xem ảnh, prompt/request thực tế và chi phí tối đa ước tính; chỉ nút `Thực hiện`
  mới enqueue paid call, còn `Hủy` không phát sinh chi phí. Ảnh hiện hành chỉ đổi
  sau khi source mới vượt source policy, compile, SVG validator và promote thành công.
- Quiz không lặp lại nguyên hình đề trong phần lời giải. Hình lời giải chỉ được
  tạo khi cần bổ sung nét trên đúng hình đề hoặc cần vẽ lại toàn bộ thành một mô
  hình toán học khác về bố cục/phong cách nhưng giữ nguyên dữ kiện. Đề bài và lời
  giải bằng chữ luôn phải tự đủ nghĩa khi không tải được hình.
- Tạo, sửa, xóa flashcard.
- Dùng AI tạo flashcard.
- Tạo, sửa, xóa bài kiểm tra.
- Dùng AI tạo câu hỏi bài kiểm tra.
- Cấu hình model chính/dự phòng cho từng chức năng AI, xem bảng giá/usage AI và OCR, đặt ngân sách, chủ động bật hard-stop tuyệt đối và xem audit thay đổi; không xem hoặc sửa API key trên UI.
- Mở màn `Chat với AI` từ sidebar Admin, tạo phiên mô phỏng theo một buổi học,
  một khóa học hoặc nhiều khóa học; cấu hình riêng từng phiên, chỉnh cấu hình
  mặc định `CHAT/TEXT` và kiểm tra chi tiết request/usage của từng câu trả lời.
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
- Với YouTube player tùy biến, khi video đang phát, học sinh có thể dùng phím mũi
  tên trái/phải để tua lùi/tới theo đúng bước tua đã cấu hình.
- Bản chép lời video tùy chọn theo từng mốc thời gian. Với video YouTube, admin có
  thể thử lấy toàn bộ caption công khai và chapter của video gốc. UI hiển thị đồng
  thời thời gian sau cắt và thời gian gốc; chapter/cue nằm ngoài khoảng phát vẫn
  xuất hiện đầy đủ nhưng ở trạng thái disabled, không cho chỉnh sửa, xóa hoặc
  phát. Các mục trong khoảng phát được ánh xạ về trục bắt đầu tại `0:00`, làm nổi
  bật và tự cuộn theo đoạn đang phát, đồng thời cho phát video từ từng mốc trước
  khi admin duyệt/chỉnh sửa và lưu.
- Bản tóm tắt video AI tùy chọn, độc lập với `Tóm tắt bài học`: trình bày ngắn
  gọn các phần nội dung chính và nội dung của từng phần. Output ưu tiên bám
  chapter đã cấu hình, hỗ trợ
  công thức Toán/Lý/Hóa đúng rich-text/LaTeX. Khi Video URL đổi hoặc bị xóa,
  hệ thống xóa bản tóm tắt video hiện hành và reset chapter/transcript vì các dữ
  liệu này không còn cùng nguồn; thay đổi riêng transcript/chapter làm bản tóm
  tắt hiện hành bị stale. Ở giao diện học sinh, bản này
  có chế độ xem toàn bộ hoặc chỉ hiện khối kiến thức/ví dụ đang ứng với thời gian
  phát hiện tại của video.
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
- Chat mở từ sub-tab `Video` ưu tiên khối kiến thức/ví dụ trong Video Summary bao
  phủ mốc đang phát, đồng thời vẫn search toàn bộ Video Summary và RAG đúng
  lesson. Raw transcript không phải nguồn Chat và không lấy context lesson khác.
- Admin có thể sinh một bản tóm tắt toàn video từ transcript đã lưu và chapter
  tùy chọn; flow này không thay thế Summary kiến thức sinh từ PDF.
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
- Mỗi thẻ AI có `front` là câu hỏi, `back` là câu trả lời trực tiếp và
  `solution` là lời giải chi tiết cho chính câu hỏi ở `front` theo phong cách
  lời giải Quiz.
- Flashcard chỉ có một loại hình AI: hình minh họa cho `solution`. Lượt tạo nội
  dung trả một quyết định `requiresSolutionFigure`; không tạo asset riêng cho
  mặt trước hoặc mặt sau.
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

- Admin Test là mode `TEST` của cùng Quiz/Assessment implementation: mọi CRUD,
  rich editor, review/publish, generation JSON, figure và solution refinement
  tái sử dụng Quiz; không tạo code admin Test độc lập.
- Modal tạo/sửa TestSet chỉ thêm `durationSeconds` vào modal QuizSet. Thời gian
  chỉ được cấu hình tại TestSet editor, không có trong modal AI, không được gửi
  từ modal AI và không là input prompt.
- AI Test append vào `targetTestSetId` đã chọn. Nếu lesson chưa có TestSet,
  admin vẫn có thể bắt đầu tạo; backend tự tạo `Bộ đề 1` với thời gian mặc định
  15 phút. Admin đổi thời gian sau đó tại modal sửa bộ đề, không phải modal AI.
  Duration không làm thay đổi nội dung hoặc shape câu AI sinh ra.
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

### 4.10. Chat AI cho học sinh

Học sinh có một chat hub và một danh sách lịch sử chung. Mỗi cuộc trò chuyện có
scope bất biến `LIBRARY` hoặc `COURSE`; scope chỉ quyết định dữ liệu RAG, không
tách lịch sử thành nhiều danh sách.

- Mở từ màn Học tập: `LIBRARY`, gồm toàn bộ lesson thuộc các enrollment còn hiệu
  lực mà học sinh đã mua.
- Mở từ course detail hoặc lesson detail: `COURSE`, gồm toàn bộ lesson của đúng
  khóa đã mua. Lesson hiện tại chỉ là tín hiệu ưu tiên retrieval.
- Không bao giờ lấy context từ khóa chưa mua hoặc lesson trial.
- Duy nhất khi Quiz attempt hoặc Flashcard study session còn `IN_PROGRESS`,
  AI chỉ gợi ý và không tiết lộ đáp án. Mọi trạng thái khác, bao
  gồm nội dung học thông thường và Quiz/Flashcard/Test đã nộp hoặc
  đang xem lại, dùng `FULL_ANSWER`: AI được nêu đáp án đúng và giải
  thích chi tiết. Trong chính Test runner, icon bị ẩn; ở tab/màn khác,
  icon vẫn
  hiện nhưng disabled với tooltip `Bạn không thể sử dụng tính năng này khi đang
  làm bài thi!`. Backend khóa mọi API chat khi còn Test attempt thực sự đang
  hiệu lực để không thể lách qua tab khác. Attempt đã quá thời lượng kèm grace
  ngắn được tự chuyển `CANCELLED` và không được làm khóa nhầm Chat AI.
- Với câu hỏi ngoài context, thiếu ảnh được nhắc tới hoặc ảnh không đủ chắc thuộc
  scope, AI tự quyết định từ chối/hỏi lại theo prompt. Backend không tự viết câu
  từ chối và không dùng heuristic/classifier để chặn hoặc thay nội dung model.
  Response được stream theo delta thật; lời từ chối của AI là một response hoàn
  tất bình thường.
- Tin nhắn hỗ trợ text/LaTeX và tối đa 5 ảnh JPEG/PNG/WebP, mỗi ảnh tối đa 10 MB.
  Ảnh là attachment private của chat, không được đưa vào OCR artifact nguồn.
- Học sinh tạo nhiều cuộc trò chuyện, mở lại và tiếp tục thread cũ. Khi gửi câu
  đầu, thread dùng chính câu đó làm tên mặc định ngay lập tức; AI đồng thời tạo
  tên ngắn và cập nhật trên danh sách/header trong lúc phản hồi đầu đang stream.
  Nếu call đặt tên lỗi, tên mặc định được giữ và câu trả lời không bị fail. Khi
  gọi AI, chỉ gửi các message gần nhất và conversation summary nếu thread dài.

#### 4.10.1. Admin mô phỏng Chat AI

Admin có một màn riêng `Chat với AI` để kiểm chứng hành vi của tính năng trước
khi học sinh sử dụng thật.

- Mỗi phiên mô phỏng chọn đúng một scope bất biến: một buổi học, một khóa học
  hoặc một danh sách khóa học. Backend tự resolve tài liệu/chunk từ các ID đã
  chọn; client không được gửi thẳng context tùy ý để chèn vào prompt.
- Phiên mô phỏng thuộc admin đang đăng nhập, tách khỏi lịch sử học sinh, không
  mạo danh học sinh và không tiêu hao quota theo ngày của học sinh. Mọi paid call
  vẫn đi qua budget reservation và được tính vào usage AI chung.
- Admin chat phải dùng cùng runtime core với Student Chat: cùng prompt builder,
  retrieval, history/context cap, response policy, provider gateway, streaming,
  LaTeX auto-repair, refusal, usage accounting và error mapping. Chỉ auth/scope
  resolver, quyền sở hữu phiên và khả năng xem trace là adapter riêng; không tạo
  prompt/service/provider flow song song cho admin.
- `Thiết lập mặc định` trên màn này đọc và cập nhật đúng cấu hình `CHAT/TEXT`
  đang dùng ở `/admin/ai-settings`; không có bản cấu hình mặc định thứ hai.
- Mỗi phiên khởi tạo từ default hiện hành và có thể lưu override riêng gồm model,
  fallback, `temperature` hoặc `reasoningEffort` theo capability, giới hạn input
  và output. Không nhận raw provider JSON hoặc tham số model không hỗ trợ.
- Admin có thể đổi cấu hình phiên giữa các câu chat. Giá trị mới chỉ áp dụng cho
  lượt kế tiếp; từng lượt đã chạy giữ immutable snapshot của default, override
  và effective request thực tế để lịch sử không đổi theo cấu hình mới.
- Tại mỗi câu trả lời, admin xem được system/user input, lịch sử gần, context RAG
  và ảnh thực sự được dùng, provider/model/tham số đã resolve, provider request
  ID, token input/cache/output/reasoning, chi phí thực tế, tổng thời gian và thời
  gian tới token đầu tiên khi provider có trả. Secret, credential, signed URL,
  raw base64 và object key nội bộ luôn bị loại hoặc che trước khi lưu/hiển thị.

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
