# Student Learning Surface Code Patterns

Dùng file này cho các màn học sinh có shell, list/filter, card khóa học/bài học, progress và CTA học tập. Pattern này xuất phát từ một student course browsing surface đã được owner duyệt, nhưng viết generic để tái dùng cho các màn học sinh sau.

## 1. Student Learning Shell And Navigation

### Pattern chuẩn

- Role học sinh dùng shell riêng, không đặt sidebar/bottom nav vào root layout chung.
- Desktop/laptop có sidebar cố định/collapsible; mobile dùng bottom nav.
- Active nav item là pill rõ, có `aria-current="page"`, icon Lucide lớn vừa phải, label ngắn và hover/focus state.
- Theme sáng/tối đi qua scope role, ví dụ wrapper `data-student-shell="true"` và CSS variables/classes dùng chung.
- Navigation item là `Link` semantic; action như theme/logout là `button` có pending/disabled state khi cần.

### Không làm

- Không làm nav chỉ đẹp ở desktop rồi bỏ mobile bottom nav.
- Không dùng icon không nhãn hoặc thiếu `aria-label` cho action icon-only.
- Không đưa shell role học sinh vào root layout nếu chỉ role này cần.

## 2. Student Search And Filter Panel

### Pattern chuẩn

- Search/filter đặt trước list, trong panel gọn, mobile một cột hoặc hai control nhỏ, desktop chia search và filter theo grid.
- Search input có icon trái, clear button thật, `role="searchbox"`, `inputMode="search"`, `autoComplete="off"` khi không muốn browser gợi ý.
- Filter select là controlled component thật: trigger button có `aria-haspopup="listbox"`, `aria-expanded`, option có `role="option"`/`aria-selected`, Escape đóng, click/tap lại trigger toggle đúng.
- Dropdown dài nên tự cuộn option đang chọn vào vùng nhìn; không kéo cả trang mobile nhảy vị trí.
- Trạng thái focus/hover/open dùng cùng token/class student surface để light/dark đều ổn.

### Không làm

- Không render filter/select như UI tĩnh hoặc chỉ đổi text mà không có state.
- Không ép dropdown mở bằng `touchstart`/`pointerdown`.
- Không để clear button nhìn bấm được khi không có query; disabled phải có cursor/state đúng.

## 3. Student Learning Card

### Pattern chuẩn

- Card list dùng cấu trúc media trái, nội dung phải trên mobile; desktop/tablet có thể mở rộng thành grid nhiều cột.
- Card có `min-w-0`, line-clamp/truncate ở title, description, metadata và CTA để không overflow ngang.
- Phần nhận diện gồm minh họa môn học, accent strip, subject badge, grade label và status badge. Badge dùng mapping chung theo status/subject, không copy màu rời rạc.
- Accent strip của course card đi qua một helper palette dùng chung: khoảng 50% là các sắc xanh dương pastel, phần còn lại luân phiên màu pastel đa dạng; mỗi index trong cùng list phải tạo màu riêng và không dùng màu đậm. Không copy bảng màu này thành class rời rạc ở từng screen.
- Màu badge đối tượng phải bám đúng độ chi tiết của label đang hiển thị: `Khối 12` là một identity màu riêng, không được collapse về cùng màu với nhóm cha `Khối THPT` chỉ vì cùng target-audience code; tương tự cho các khối số và nhóm Tiểu học/THCS/THPT. Palette phải đi qua shared helper để cùng một identity có màu ổn định giữa màn Khám phá, Học tập và Chi tiết; các identity khác tên dùng base hue riêng, không đổi màu theo vị trí card.
- Ribbon section đại diện một khối/nhóm đối tượng phải dùng cùng base hue với badge identity tương ứng; chỉ saturation/lightness được tăng để giữ chữ trắng dễ đọc. Không duy trì một bảng hue riêng cho ribbon khiến `Khối 12` hoặc `Khối THPT` lệch màu badge bên trong card.
- Các nhãn học tập trọng tâm `Khối THCS`, `Khối 12`, `Khối 9` và `Khối THPT` đều dùng họ xanh dương làm màu chủ đạo, nhưng phải tách rõ bằng hue, saturation và surface lightness chứ không chỉ kiểm giá trị HSL có khác nhau hay không. Riêng Khối 12 dùng royal-blue sáng, nền badge rất nhạt và ribbon có gradient sáng riêng để không nhìn giống ribbon cyan/sky của `Khóa học phù hợp với bạn`; không dùng navy đậm hoặc periwinkle ngả tím/đục.
- Card có panel theo trạng thái:
  - enrolled: progress, next item và CTA học.
  - locked/not enrolled: price/summary và CTA chi tiết.
  - trial: trial panel và CTA học thử.
  - expiring: warning/status rõ, không dùng màu đỏ nếu chưa phải lỗi.
- CTA là `Link` hoặc `button` semantic, label một dòng, có focus-visible ring và active/pressed feedback.
- Progress gồm label, percent, thanh fill và marker; percent size trên mobile phải nhất quán giữa card nổi bật và card thường.

### Không làm

- Không để card lồng nhiều card nặng hoặc shadow dày khiến list học sinh giống dashboard doanh nghiệp.
- Không hard-code màu chỉ hợp light mode trong card; dùng token/class role hoặc variant dark tương ứng.
- Không dùng accent strip bão hòa/đậm, không để hai card trong cùng list trùng màu và không đổi màu ribbon section khi task chỉ yêu cầu dải mép trái card.
- Không ưu tiên mã nhóm cha trước label khối cụ thể khi resolve màu badge, vì sẽ tạo các nhãn khác tên nhưng trùng màu.
- Không copy bảng màu badge vào từng screen hoặc tạo biến thể theo index khiến cùng một nhãn đổi màu giữa list và detail.
- Không coi hai màu đã “khác” chỉ vì HSL lệch vài đơn vị; nếu mắt thường vẫn nhìn như cùng màu thì phải tăng khoảng cách hue và/hoặc thay saturation/lightness trong cùng họ màu.
- Không để CTA client-only giả thành công khi flow đã được coi là connected/production.
- Không để badge/status chen vào title hoặc làm title xuống dòng xấu.

## 4. Student Section And State Rhythm

### Pattern chuẩn

- Section trong màn học sinh nên có heading ngắn, icon/ribbon/accent vừa đủ để tạo nhịp, không biến mỗi section thành hero.
- List dùng gap ổn định và `min-w-0` ở mọi layer để card, badge, progress, CTA không làm layout nhảy.
- Count/summary hint dùng icon nhỏ + copy ngắn, giúp người dùng biết kết quả filter nhưng không chiếm hierarchy chính.
- Loading/empty/error dùng state component riêng, copy nói với học sinh bằng ngôn ngữ sản phẩm thật và có hành động tiếp theo khi hợp lý.
- Animation chỉ dùng cho feedback nhỏ như CTA pressed/progress fill; phải nhẹ và không block thao tác.

### Không làm

- Không đưa label kỹ thuật, mock/API hint, task code hoặc ghi chú roadmap lên UI.
- Không render list dài không phân trang/không giới hạn nếu dữ liệu thật có thể lớn.
- Không dùng section ribbon/accent quá dày đặc làm màn bị rối; mỗi section chỉ cần một tín hiệu chính.

## 5. Student Course Detail Summary And Progress

### Pattern chuẩn

- Detail course dùng route riêng và screen component riêng; page chỉ lấy server theme/params rồi compose screen.
- Mobile detail cần app bar full-width liền mạch, có back button ở mép trái và dùng đúng brand component/brand token `ClassHero`; desktop/laptop dùng shared student header sticky như các màn học sinh khác.
- Content detail giữ một cột chính, `max-w-3xl` trên laptop/desktop; không thêm right sidebar phụ nếu owner chưa yêu cầu rõ. Page background dùng `--student-screen-bg`.
- Hero summary gồm media/illustration lớn, title, subject/grade/status badge, mô tả và metadata ngắn. Badge/status phải nằm trong grid ổn định để không đẩy layout ngang trên mobile.
- Khóa chưa mua phải là trạng thái riêng: status label `Chưa mua`, box giá gồm sale price, original price, discount percent và CTA mua. Khi course chưa mua/locked, ẩn card tiến độ và ẩn phần trăm hoàn thành ở chapter.
- Progress card cho khóa đã có quyền học tách thành component riêng: header icon + title + percent, full-width progress bar, marker sao, nhãn ngữ cảnh một dòng riêng và tên buổi học dòng riêng lớn hơn.
- Copy/CTA progress đi qua helper theo trạng thái tiếp tục học, ví dụ first/current/next/last lesson. `current` dùng CTA `Học tiếp`; các trường hợp vào bài mới dùng CTA `Vào học`.

### Không làm

- Không để header mobile thành card bo góc hoặc width không full.
- Không tự dựng biến thể logo/wordmark riêng cho từng màn; dùng cùng brand structure/token đã duyệt.
- Không truncate tên bài học trong progress card. Nếu text dài, đặt nhãn và tên bài ở hai dòng riêng, dùng `break-words`.
- Không show progress/percent cho khóa chưa mua nếu dữ liệu đó không nên lộ trước khi mua.
- Không dùng shadow/border xanh nổi bật cho progress/detail card khi màn đang theo direction card phẳng.

## 6. Student Curriculum Accordion

### Pattern chuẩn

- Chapter accordion là controlled multi-open state bằng mảng id; mở một chương không tự đóng các chương đang mở khác.
- Animation mở/đóng dùng `AnimatePresence` + `motion.div` height/opacity, có `useReducedMotion` fallback và transition ngắn, không block click.
- Chapter card dùng left border theo tone, border width do CSS student shell kiểm soát để dễ chỉnh thống nhất; số chương là circle nhỏ, sát mép trái, icon chevron sát mép phải.
- Chapter progress badge chỉ render khi screen cho phép hiển thị progress. Với khóa chưa mua, không render badge phần trăm và không render trạng thái khóa ở cấp chương.
- Lesson list nằm trong `ul` relative; timeline connector là line dọc gradient theo tone chương, nằm dưới các icon lesson.

### Không làm

- Không dùng accordion kiểu single-open nếu owner đã duyệt multi-open.
- Không hard-code màu connector một màu xanh duy nhất; màu connector phải bám tone/màu số chương và nên ở dạng gradient.
- Không đặt số chương/card header quá rộng làm thiếu không gian cho tên chương.
- Không để icon đóng/mở chiếm vùng giữa khiến title bị wrap xấu.

## 7. Student Lesson Timeline Row

### Pattern chuẩn

- Lesson row dùng grid hai cột: icon status cố định bên trái và content/CTA bên phải. Tất cả layer phải có `min-w-0`.
- Separator giữa lesson là line mảnh từ sau trục icon tới mép phải content, không kéo dài quá trục timeline.
- Status icon nằm ở đầu hàng, không thêm cột icon thừa ở cuối. Completed dùng check trong circle, current/entry dùng play trong circle, locked dùng lock nổi bật hơn text xám.
- Buổi có CTA nhỏ ở bên phải content, label một dòng, padding gọn; CTA text phải khớp CTA chính của progress card khi cùng một lesson (`Học tiếp` hoặc `Vào học`).
- Trial lesson luôn có badge `Học thử`, icon play trong circle và CTA `Vào học`.
- Locked lesson disable link/action bằng semantic state rõ: không click được, màu muted, lock icon dễ nhận ra.

### Không làm

- Không dùng icon radio/wifi hoặc chấm tròn cho lesson có CTA `Vào học`.
- Không để một hàng icon trạng thái phụ ở mép phải làm rối timeline.
- Không truncate title lesson quan trọng; title được wrap tự nhiên và CTA không được làm xô layout.

## 8. Student Detail State Data

### Pattern chuẩn

- Mock/detail data cần bao phủ ít nhất các state chủ đạo khi UI phụ thuộc trạng thái: bài đầu tiên chưa học, bài đang học dở, bài tiếp theo sau bài đã hoàn thành, bài cuối cùng, khóa chưa mua, lesson học thử và lesson khóa.
- State copy nên được derive qua helper thay vì rải ternary trong component để progress card, lesson CTA và course card dùng cùng label.
- Access/enrollment state nên quyết định visibility của cả khối UI: progress card, chapter percent, price box, purchase CTA và lesson CTA.

### Không làm

- Không chỉ thêm một case mock đẹp rồi bỏ các state dễ vỡ như locked/trial/last lesson.
- Không để label progress và CTA timeline lệch nhau cho cùng một continue lesson.
- Không để business wording hoặc option list riêng của một course trở thành pattern chung; pattern chung chỉ ghi state/visibility/interaction.

## 9. Lesson Practice Entry And Fullscreen Runner

### Pattern chuẩn

- Tab lesson chỉ giữ panel vào hoạt động với metadata ngắn và CTA theo state.
  Quiz/Flashcard dùng `Bắt đầu`, `Tiếp tục...`, `Xem lại` khi nghiệp vụ có trạng
  thái tương ứng; không nhúng toàn bộ runner dài ngay trong panel.
- Sau CTA, runner/result dùng `fixed inset-0` ở layer cao, khóa scroll document,
  header ClassHero + back action, content `max-w-2xl` và màu semantic riêng cho
  từng hoạt động.
- Back khi lượt chưa hoàn thành phải mở confirm dialog; browser Back và back
  button trong header có cùng outcome. Đóng dialog giữ nguyên vị trí/nội dung
  đang học. Với Bài thi có giới hạn thời gian, copy phải nói rõ xác nhận Back sẽ
  hủy lượt hiện tại và học sinh phải bắt đầu bài thi mới.
- Progress hierarchy giữ cùng cấu trúc: tên lesson, vị trí hiện tại/tổng, số đã
  làm hoặc đã ôn và progress bar. Action chính có pending/disabled tức thì,
  touch target tối thiểu 44px và không wrap label.
- Runner/result phải có light/dark cùng lúc. Transition, scroll lock, brand,
  dialog và button feedback đang dùng ổn ở Quiz phải được reuse thay vì tạo một
  shell khác cho Flashcard.
- Runner dài trên cùng route phải tách ba lớp state: dữ liệu nghiệp vụ đã lưu ở
  server, state phiên trình bày trong browser storage và history marker xác định
  surface đang mở. Marker một mình không đủ để khôi phục runner sau F5 nếu deck,
  vị trí item, trạng thái đã xử lý trong lượt hoặc mặt nội dung vẫn chỉ nằm trong
  React `useState`.
- Với surface được lazy-mount sau khi Next.js hydrate/query xong, không dựa duy
  nhất vào custom field của `window.history.state`: router có thể chuẩn hóa
  history trước khi component đó mount. Mirror marker runner/result vào
  `sessionStorage`, validate theo entity ID khi đọc và xóa marker đúng lúc
  student xác nhận rời surface.
- Effect dọn marker stale chỉ được chạy một lần khi hydrate phiên ban đầu. Không
  phụ thuộc trực tiếp vào object query có thể đổi identity sau invalidate/refetch,
  nếu không một progress mutation hợp lệ sẽ vô tình xóa marker runner đang mở.
- F5 khi runner Quiz/Flashcard đang mở phải dựng lại đúng phiên; sau khi student
  xác nhận thoát, F5 giữ panel/result và chỉ CTA tiếp tục mới mở runner cũ. Kết
  quả được khôi phục không chạy lại animation ăn mừng. Riêng runner Bài thi có
  giới hạn thời gian phải đăng ký `beforeunload`; nếu student xác nhận reload/
  rời trang thì hủy runner hiện tại và yêu cầu bắt đầu bài thi mới.
- Khi một lesson có nhiều Quiz/Flashcard set, phải lưu riêng identity của active
  set theo `user + lesson` trong storage bền và kiểm tra ID đó còn thuộc danh
  sách set hiện tại trước khi dùng. Không lấy history marker làm active-set
  storage: marker phải bị xóa khi Back khỏi fullscreen, còn active set phải sống
  qua Back, refetch, F5 và đóng/mở lại web để panel không nhảy về bộ đầu tiên.
- Khi CTA dùng hoạt ảnh che toàn màn hình để vào runner/result, request chuẩn bị
  dữ liệu có thể chạy song song với pha che nhưng không được commit state làm
  đổi surface đang render. Chỉ commit destination khi overlay đã che kín và
  bắt đầu pha mở, để runner/result được hé lộ theo hoạt ảnh thay vì xuất hiện
  phía sau khi màn vẫn đang khép.
- Với deck được lọc như `chưa thuộc`, chốt danh sách ID khi bắt đầu lượt. Không
  filter trực tiếp mảng đang render theo state vừa mutation vì có thể làm index
  nhảy và bỏ qua item.
- Khi một action trong modal lịch sử mở child surface toàn màn hình và Back cần
  quay lại modal ngay, ưu tiên giữ modal mounted bên dưới child surface và đặt
  child surface ở layer cao hơn nhưng thấp hơn transition. Back chỉ unmount
  child surface để lộ lại cùng modal instance, nhờ đó giữ nguyên scroll/state và
  không chạy lại animation mở modal. Không đặt `inert` trên toàn bộ overlay của
  bottom-sheet vì WebKit/mobile compositor có thể loại cả layer khỏi trạng thái
  hiển thị. Trong lúc bị che, giữ overlay nguyên vẹn, khóa pointer ở wrapper,
  đặt `aria-hidden` cho dialog, blur focus còn sót lại và chặn Escape bằng state
  của child surface. Chỉ snapshot/restore `scrollTop` khi kiến trúc bắt buộc phải
  unmount modal. Action chỉ đọc dữ liệu lịch sử không được đổi identity state
  của panel nguồn (ví dụ active set ID): query phụ có thể chuyển sang loading,
  thay panel bằng skeleton và remount modal dù child surface vẫn mở bình thường.
- Child review mở từ một item lịch sử phải nhận và hiển thị `displayName` của
  chính item đó; không thay bằng copy phạm vi chung hoặc tên lesson làm người
  dùng mất ngữ cảnh đang xem bộ nào.
- Điều hướng tuần tự trong review dùng action thoát có nghĩa ở hai biên: item
  đầu có `Trở về`, item cuối có `Kết thúc xem lại`; chỉ item giữa mới dùng
  `... trước`/`... tiếp`. Hai action biên cùng trả về surface nguồn.

### Không làm

- Không để CTA `Bắt đầu` chỉ mở card dài ngay bên dưới tab khiến video/tab và
  điều hướng lesson vẫn cạnh tranh không gian với hoạt động chính.
- Không cập nhật state runner/result ngay khi vừa bấm CTA nếu transition che
  toàn màn hình chưa khép kín.
- Không đề xuất lại các ngôn ngữ transition đã bị owner loại khỏi random:
  `math-tiles`, `geometric-shatter`, `chalk-dust`, `book-pop-up`,
  `bookmark-scroll` và `secret-bookshelf`. Khi thiết kế biến thể mới, ưu tiên
  một chuyển động chính liền mạch như rèm/trang giấy/vở, cổng hình học hoặc một
  vật thể trung tâm rõ ràng; tránh bố cục nhiều ô, nhiều mảnh rời, bụi hạt và
  cảnh chứa nhiều đạo cụ cạnh tranh điểm nhìn.
- Không tạo header/logo/back behavior khác nhau giữa Quiz và Flashcard.
- Không tự thêm caret trang trí cho popover khi vị trí neo đã đủ rõ. Nếu luồng
  khác thật sự cần caret, không dùng hình vuông `rotate-45` làm caret vì sẽ lộ
  thành hình kim cương; phải render tam giác thật và giữ đúng màu light/dark.
- Không đổi danh sách item giữa một lượt chỉ vì progress mutation vừa thành công.
- Không đưa action chọn bộ hoặc danh sách thẻ sai vào result nếu contract chỉ
  cho ôn lại tất cả/chưa thuộc.
