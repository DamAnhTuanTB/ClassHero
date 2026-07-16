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
