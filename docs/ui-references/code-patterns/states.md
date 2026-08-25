# State View Code Patterns

Dùng file này cho loading, empty, error và disabled/pending state.

## 1. Loading, Empty, Error State

Dùng cho màn có data/action.

### Pattern chuẩn

- Loading detail, danh sách, card hoặc tab panel: dùng skeleton mô phỏng gần đúng bố cục thật, không để vùng trống và không dùng mặc định spinner kèm câu mô tả.
- Thiết kế skeleton theo layout thật của từng màn; không áp một component skeleton tổng quát cho list, detail, form và tab có cấu trúc khác nhau. Chỉ dùng chung primitive nhỏ khi không làm mất đặc trưng bố cục của màn đích.
- Empty: nói người dùng có thể làm gì tiếp theo.
- Error: có action retry khi có thể.
- Disabled/pending: action đang chạy phải disabled và có feedback.
- Khi một surface có nhiều action độc lập, pending state phải định danh theo từng
  action (`start`, `review`, `restart`, `open-result`, ...) và chỉ disabled action
  đang chạy. Không dùng `disabled={Boolean(pendingAction)}` cho cả nhóm nút; điều
  kiện khóa nghiệp vụ cố định như thiếu prerequisite hoặc không có dữ liệu vẫn
  được giữ riêng trên đúng action liên quan.
- Action mở loading/transition surface lớn hoặc toàn màn hình: surface lớn sở
  hữu feedback loading; button nguồn giữ nguyên icon/label, không render
  spinner, progress hoặc copy `Đang...`, nhưng vẫn khóa bấm lặp bằng state nội
  bộ/disabled.
- Khi tác vụ đang tạo candidate mới nhưng vẫn giữ media hiện hành, progress phải
  nằm trong normal flow ở một khối riêng bên dưới media. Không dùng margin âm,
  absolute positioning hoặc bỏ biên phía trên khiến progress chồng lên nội dung
  hiện hành.
- Full-page loading/error phải căn giữa cả chiều ngang lẫn chiều dọc bằng vùng bao có chiều cao viewport. State trong shell có header/sidebar căn giữa phần nội dung còn lại; state trong tab/card chỉ căn giữa vùng được cấp.
- Với initial loading ngắn, trì hoãn hiển thị khoảng `250-300ms`; nếu loading đã xuất hiện thì giữ tối thiểu khoảng `300ms` để tránh nháy.
- Fetch/prefetch dữ liệu của các tab ngay khi đủ dependency và chạy song song khi có thể; khi đổi tab, ưu tiên cache và không thay dữ liệu đang có bằng skeleton chỉ vì background refetch.

### Không làm

- Không để button nhìn bấm được nhưng thiếu handler hoặc pending state.
- Không hiển thị loading đồng thời trong button và trên loading/transition
  surface lớn được chính button đó mở.
- Không hiển thị text kỹ thuật như `mock`, task code, stack trace hoặc TODO trong UI.
- Không thay một detail/list/tab panel bằng icon xoay kèm dòng “Đang tải…”. Spinner chỉ dùng cho pending cục bộ không có layout nội dung để skeleton hóa, ví dụ bên trong nút bấm.

### Admin fetch/data error

Mọi lỗi tải dữ liệu trong admin phải dùng shared component:

```tsx
<AdminDataErrorState
  description="Vui lòng thử lại để tiếp tục quản lý dữ liệu."
  isRetrying={query.isFetching}
  onRetry={() => query.refetch()}
  title="Không tải được danh sách"
  variant="section"
/>
```

Chọn variant theo surface sở hữu lỗi:

- `compact`: modal, card hoặc panel con nhỏ.
- `section`: list, tab hoặc section còn nằm dưới header/stat/filter. Đây là mặc định cho lỗi danh sách.
- `page`: chỉ khi toàn bộ content chính của route bị chặn và màn không còn surface hữu ích khác để hiển thị.

Quy tắc bắt buộc:

- Giữ nền error surface trung tính; màu danger chỉ dùng làm accent cho icon/vùng cảnh báo.
- Tiêu đề nói rõ loại dữ liệu bị lỗi; mô tả ngắn, không hiển thị raw error hoặc chi tiết kỹ thuật.
- Có retry khi query hỗ trợ refetch; truyền `isRetrying` để khóa bấm lặp và hiển thị pending feedback.
- Dùng `headingLevel` đúng hierarchy của page/panel và giữ button label một dòng.
- Error trong container đã có border có thể bỏ border/shadow của component bằng `className`, nhưng không được thay đổi cấu trúc, icon, typography và retry behavior.

Không làm:

- Không dùng `page` hoặc viewport-based `min-height` cho lỗi list/tab/panel; lỗi danh sách không được phình cao gần hết màn hình.
- Không copy một error block riêng vào feature mới.
- Không áp dụng component fetch-error cho validation field, upload error, lỗi từng item/job hoặc status badge nghiệp vụ.

Evidence: `apps/web/components/admin/admin-data-error-state.tsx`.

## 2. Animated Connection State

Dùng cho trạng thái chờ ngắn khi hai đầu của một media hoặc dịch vụ đang kết nối.

### Pattern chuẩn

- Giữ khung hình học ổn định giữa state kết nối và state kế tiếp; dùng `key` riêng cho root của mỗi conditional state để React không tái sử dụng các node có transition khác vị trí.
- Cho chuyển động diễn ra bên trong khung: dải sáng co giãn từ tâm, glow theo nhịp hoặc nghiêng rất nhẹ tại chỗ.
- Chuyển động trang trí không được thay đổi vị trí theo trục dọc và phải có `prefers-reduced-motion`.
- Copy chỉ dùng một dòng trạng thái ngắn.
- Với transition che toàn màn hình trước navigation, provider phải nằm ở route
  shell/layout để còn tồn tại khi route nguồn unmount. Ngay khi click, chạy
  song song animation đóng, `router.prefetch` và TanStack Query
  `fetchQuery`/`prefetchQuery`; giữ overlay nếu dữ liệu cốt lõi chưa xong và chỉ
  mở overlay sau khi pathname đích đã commit.

### Không làm

- Không dùng nhiều chấm sáng chạy liên tục qua lại nếu chúng trở thành điểm nhìn chính.
- Không dùng spinner mặc định khi surface học sinh đã có ngôn ngữ minh họa riêng.
- Không animate từ vị trí của loading state sang vị trí của ready state.
- Không đợi animation đóng hoàn tất rồi mới bắt đầu gọi API hoặc prefetch route,
  vì hai độ trễ sẽ bị cộng dồn.
- Nếu có vật thể chạy theo quỹ đạo, tâm vật thể phải bám đúng nét quỹ đạo đang
  hiển thị ở mọi breakpoint; không đặt một animation ngang độc lập bên dưới
  hoặc bên trên đường mà người dùng nhìn thấy.

### Evidence

- `apps/web/components/shared/custom-youtube-player.tsx`
- `apps/web/app/globals.css`
