# UI Design System

Tài liệu này là nguồn gu thiết kế chính thức cho Codex khi làm UI. Mục tiêu là biến chữ "đẹp đúng ý" thành rule cụ thể để giảm vòng sửa lại.

Hiệu năng UI/mobile nằm ở file này; hiệu năng toàn hệ thống như API, database, worker, AI/RAG và observability nằm ở `docs/12-performance-and-observability.md`.

SEO cho landing, course public và các trang public indexable nằm ở `docs/13-seo-and-content-discovery.md`.

Cấu trúc source code UI, feature folders, shared components, alias import và anti-pattern nằm ở `docs/14-source-code-structure.md`.

Pattern code UI chuẩn cho form, modal, detail field grid, badge/action, upload preview và state view được điều hướng bởi `docs/ui-references/code-patterns.md`, còn pattern chi tiết nằm trong `docs/ui-references/code-patterns/`; khi tạo/sửa UI phải đọc mục routing `0. Cách Đọc Nhanh`, chọn file/section pattern gần nhất rồi mới tự viết biến thể mới.

## 1. Phong cách tổng thể

Sản phẩm là nền tảng học theo lộ trình cho học sinh THCS/THPT, phụ huynh và admin.

UI cần:

- Sạch, hiện đại, dễ hiểu.
- Có cảm giác giáo dục, đáng tin cậy, nhưng không khô cứng.
- Phù hợp học sinh, phụ huynh và admin; không quá trẻ con, không quá doanh nghiệp lạnh.
- Ưu tiên readability, whitespace và hierarchy rõ.
- Có năng lượng học tập nhẹ qua màu nhấn, icon, tiến độ, trạng thái; không game hóa quá mạnh.

Tránh:

- Màu quá chói, gradient quá nhiều, hiệu ứng rối.
- Layout một màu hoặc quá giống dashboard SaaS tối màu.
- Card quá bo tròn, shadow dày, nhồi nhiều card lồng nhau.
- Text sát mép, button quá nhỏ, hierarchy phẳng.

## 2. Tech UI bắt buộc

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Framer Motion cho micro-interaction vừa phải.
- TanStack Query cho server state.
- Zustand cho client state nhỏ.
- React Hook Form + Zod cho form.
- Tiptap, KaTeX và mhchem cho rich text/công thức.
- Icon ưu tiên `lucide-react`.

Không thêm component library hoặc CSS framework khác nếu owner chưa duyệt.

## 3. Màu sắc

Codex phải ưu tiên shadcn/Tailwind semantic tokens (`background`, `foreground`, `card`, `muted`, `border`, `primary`, `secondary`, `accent`, `destructive`, `ring`) thay vì rải màu hard-code trong component.

Token mặc định nếu project chưa có theme riêng:

| Token                | Mục đích                          | Gợi ý Tailwind                 |
| -------------------- | --------------------------------- | ------------------------------ |
| `background`         | Nền app chính                     | `slate-50` hoặc `white`        |
| `foreground`         | Text chính                        | `slate-950`                    |
| `muted`              | Nền phụ/skeleton                  | `slate-100`                    |
| `muted-foreground`   | Text phụ                          | `slate-500`                    |
| `border`             | Border nhẹ                        | `slate-200`                    |
| `primary`            | CTA chính/hành động học tập       | `sky-600` hoặc `teal-600`      |
| `primary-foreground` | Text trên primary                 | `white`                        |
| `accent`             | Highlight tiến độ/streak/nhấn nhẹ | `amber-400` hoặc `emerald-500` |
| `success`            | Thành công/hoàn thành             | `emerald-600`                  |
| `warning`            | Cảnh báo/chờ xử lý                | `amber-500`                    |
| `error/destructive`  | Lỗi/hành động nguy hiểm           | `red-600`                      |

Nguyên tắc dùng màu:

- Nền chính: sáng, sạch, dễ đọc.
- Primary: xanh học tập hoặc xanh ngọc dịu, không quá gắt.
- Accent: dùng tiết chế cho trạng thái học tập, streak, progress, CTA phụ.
- Success/warning/error phải nhất quán, không dùng đỏ cho CTA thường.
- Không lạm dụng tím/xanh tím, beige, dark slate hoặc gradient làm theme chính.
- Theo preference đã chốt của owner, không dùng tím/violet trong UI mới hay phần UI đang được chỉnh. Với chapter, timeline và các dải/mép trái phân cấp, không dùng cả lavender: ưu tiên xanh dương làm màu chủ đạo, sau đó xanh lá, vàng/cam và đỏ khi cần phân biệt trạng thái. Màu viền trái, số thứ tự, badge tiến độ và connector của cùng chapter phải dùng cùng tone; các chapter liền kề không được lặp lại tone nếu còn tone khác phù hợp.
- Không tạo palette một màu; mỗi màn nên có nền trung tính, primary rõ và accent vừa đủ.
- Nếu cần thêm màu mới, thêm vào theme/token trước hoặc ghi rõ lý do trong final response/docs liên quan; changelog chỉ ghi trong workflow `/commit`.

### 3.1. Light/Dark theme

Hệ thống sẽ có chế độ chuyển theme sáng/tối. Khi làm UI mới hoặc sửa UI hiện có, Codex phải:

- Mọi UI mới hoặc UI được sửa phải hỗ trợ đầy đủ cả theme sáng và theme tối trong cùng phạm vi task. Không được chỉ làm đẹp ở một theme rồi bỏ theme còn lại; text, surface, border, shadow, icon, button, label, form control, modal, table, badge/status, loading/empty/error state và media/overlay phải được kiểm contrast/state ở cả hai theme.
- Không đổi màu sáng/tối thủ công rải rác trong từng component. Màu theme phải đi qua token/utility semantic dùng chung như `--theme-*`, class theme chung, hoặc variant đã được chuẩn hóa; chỉ hard-code màu ở lớp token trung tâm hoặc trường hợp trạng thái đặc biệt thật sự bất khả kháng và phải nêu rõ lý do.
- Ưu tiên semantic token/CSS variable hoặc class Tailwind có biến thể dark mode thay vì hard-code màu chỉ hợp light mode.
- Kiểm tra text, border, surface, shadow, icon, trạng thái success/warning/error/info và skeleton/loading vẫn đủ contrast ở cả light và dark.
- Tránh dùng ảnh, gradient, overlay hoặc shadow chỉ đẹp trên nền sáng; nếu dùng phải có fallback/variant cho dark mode.
- Không giữ `inset` highlight màu trắng của light mode trên surface tối; phải bỏ hoặc override bằng màu semantic rất nhẹ để tránh tạo vệt trắng giả ở mép border.
- Với chart, badge, toast, form, table và dashboard/card, thiết kế state màu theo vai trò semantic để sau này đổi theme không phải sửa từng component.
- Nếu task chưa triển khai toggle theme thật, vẫn không được viết UI khóa cứng vào light-only style trừ khi có lý do rõ trong final response.

## 4. Typography

- Ưu tiên dễ đọc trên mobile.
- Heading rõ hierarchy, không quá to trong dashboard/tool surface.
- Body text đủ line-height để đọc bài học và lời giải.
- Nội dung học tập nhiều đoạn phải phân biệt rõ nhịp trong dòng và nhịp giữa
  các đoạn: dùng `line-height` khoảng `1.6-1.65` cho dòng chữ và thêm paragraph
  gap riêng khoảng `0.6rem` giữa các đoạn cấp cao. Với Mathpix Markdown, không
  được chỉ style thẻ `p` vì renderer có thể xuất paragraph thành các `div` anh
  em không có class; Quiz, lời giải và Sinh kiến thức phải dùng cùng rule này.
- Không dùng negative letter-spacing.
- Không scale font bằng viewport width.
- Công thức Toán/Lý/Hóa phải có khoảng thở, không chen sát text.
- Trong trình soạn và phần hiển thị công thức Quiz/Flashcard/Test, mọi ký tự
  chữ cái phải dùng kiểu chữ đứng, gồm ký tự chính, chỉ số trên, chỉ số dưới,
  Vector và công thức Hóa học; không dùng kiểu nghiêng mặc định của math font.
- Quiz/Flashcard/Test không được hiện delimiter LaTeX thô như `$...$`, `\\(...\\)`
  hoặc lệnh `\\frac`; rich-content mapper phải tạo math node và viewer phải có
  fallback tương thích cho dữ liệu AI cũ.

Scale mặc định:

| Context            | Size gợi ý                                    |
| ------------------ | --------------------------------------------- |
| Page title mobile  | `text-2xl`                                    |
| Page title desktop | `text-3xl` hoặc `text-4xl` nếu là public hero |
| Section title      | `text-lg` hoặc `text-xl`                      |
| Card title         | `text-base` hoặc `text-lg`                    |
| Body               | `text-sm` hoặc `text-base`                    |
| Helper/caption     | `text-xs` hoặc `text-sm`                      |

## 5. Spacing, radius, shadow

- Mobile: padding vừa đủ, không làm nội dung bị chật.
- Desktop: tận dụng chiều ngang nhưng không kéo content đọc dài quá mức.
- Card radius khoảng `8px` trừ khi shadcn mặc định khác.
- Shadow nhẹ, ưu tiên border/subtle background hơn shadow dày.
- Section không nên là card lớn lồng card; card dùng cho item, panel nhỏ, modal hoặc tool surface.

Spacing/radius mặc định:

| Pattern              | Rule                                                         |
| -------------------- | ------------------------------------------------------------ |
| Mobile page padding  | `px-4 py-4` hoặc tương đương                                 |
| Tablet page padding  | `px-6 py-6`                                                  |
| Desktop page padding | `px-8 py-8`, content đọc nên có `max-w-*`                    |
| Card/panel padding   | `p-4` mobile, `p-5` hoặc `p-6` desktop                       |
| Section gap          | `gap-4` mobile, `gap-6` desktop                              |
| Radius               | `rounded-lg` là mặc định; tránh radius quá lớn cho dashboard |
| Shadow               | ưu tiên `border`; nếu cần dùng `shadow-sm`                   |

## 6. Layout tổng thể

### Public

- Rõ value proposition, CTA học thử/mua lộ trình dễ thấy.
- Course card phải dễ so sánh môn, lớp, giá, trạng thái học thử.
- Mobile ưu tiên CTA và danh sách lộ trình dễ quét.
- Nội dung public phải có heading/text thật rõ ràng để vừa dễ đọc vừa thân thiện SEO.

### Student

- Ưu tiên nội dung học và hành động tiếp theo.
- Dashboard cần thấy nhanh: đang học gì, tiến độ, bài tiếp theo, thông báo.
- Lesson page ưu tiên video/tài liệu/nội dung chính; quiz, flashcard, test và AI chat không làm rối màn hình.
- Trạng thái khóa, học thử, hoàn thành phải rõ.
- Các màn học sinh dạng khám phá/list/progress nên bám direction đã duyệt của màn Khám phá: mobile-first, nền học tập sáng nhẹ, card trắng thoáng, minh họa môn học rõ, badge/status/progress/CTA có năng lượng nhưng không game hóa quá mức; desktop/laptop dùng sidebar role học sinh gọn, mobile dùng bottom nav. Khi làm màn tương tự, đọc `docs/ui-references/approved-patterns.md#student-explore-courses---2026-07-16` và `docs/ui-references/code-patterns/student-learning-surfaces.md` trước khi tự tạo biến thể mới.

### Parent

- Gọn, tin cậy, ít nhiễu.
- Ưu tiên tiến độ con, thanh toán, thông báo, khóa học liên quan.
- Không dùng style quá trẻ con.

### Admin

- Utilitarian, dense vừa phải, dễ quét.
- Sidebar trái, header trên, bảng/filter/action rõ.
- Không dùng hero/marketing layout trong admin.
- Với admin CRUD dạng phân cấp như lộ trình -> chương học -> buổi học, phải dùng flow master-detail: trang danh sách chỉ quản lý entity cha với list/filter/thêm/sửa/xóa; khi bấm vào một entity cha thì điều hướng sang trang chi tiết riêng để xem đầy đủ thông tin và quản lý entity con. Form tạo/sửa mở trong modal/drawer theo đúng ngữ cảnh, không render tất cả form thường trực trên cùng một trang.
- Stat cards trên trang danh sách admin chỉ nên tóm tắt entity chính của trang đó; chỉ số của entity con như buổi học, học thử, tài liệu hoặc nội dung chi tiết phải nằm ở trang detail/dashboard phù hợp.
- Form admin phải đi theo form chuẩn đã duyệt gần nhất, không tự dựng style/control mới nếu `apps/web/components/common/forms`, feature tương tự hoặc `docs/ui-references/approved-patterns.md` đã có pattern dùng được. Khi tạo form admin mới, Codex phải nêu rõ pattern tham chiếu trong kế hoạch/final.
- Form admin phải validate ngay khi nhập hoặc chọn (`mode: "onChange"` và `reValidateMode: "onChange"` với React Hook Form, hoặc flow tương đương), đặc biệt với modal tạo/sửa. Lỗi phải hiện inline gần field, có trạng thái border/focus/error rõ. Riêng modal/drawer form không được khóa nút action chỉ vì form đang invalid hoặc pristine; cho người dùng bấm để `handleSubmit` bật validation/error inline, chỉ disabled khi đang pending/saving hoặc thiếu prerequisite cứng khiến action thật sự không thể chạy.
- Field không bắt buộc trong form không được hiện badge chữ dài cạnh label. Dùng icon nhỏ cạnh tên field; khi hover hoặc focus icon thì hiện tooltip `Không bắt buộc nhập`.
- Field số trong admin như thứ tự, tiền VNĐ, phần trăm hoặc số lượng không dùng native number spinner/default browser UI; dùng input text styled cùng form chuẩn, `inputMode` phù hợp, chỉ nhận ký tự hợp lệ, normalize/format dữ liệu trước khi lưu và hiển thị đơn vị rõ khi cần.
- Không đặt toggle học thử ở form lộ trình; học thử là cấu hình của buổi học cụ thể.
- Action icon trong admin phải dùng màu theo ý nghĩa để dễ quét: sửa dùng xanh, xóa dùng đỏ, đóng/hủy dùng màu trung tính hoặc xanh nhẹ. Hành động xóa phải mở modal xác nhận rõ tên item trước khi thực thi.
- Action câu trước/câu tiếp theo thay nội dung ngay trong cùng một card phải giữ
  nguyên tọa độ cuộn của trang. Không focus một control nằm ngoài viewport sau
  click khiến trình duyệt tự cuộn. Keyboard navigation trong tablist vẫn được
  phép chuyển focus giữa các tab bằng cơ chế riêng, ngoại trừ tab Quiz và
  Flashcard của màn chi tiết buổi học: khi một trong hai tab đang active,
  `ArrowLeft`/`ArrowRight` được dành cho câu trước/câu tiếp theo hoặc thẻ
  trước/thẻ tiếp theo và không đổi sang tab nội dung liền kề. Shortcut này không
  bắt sự kiện trong input/editor/dialog hoặc composite control khác.
- Editor chỉnh nhẹ ảnh raster dùng icon `WandSparkles` với tooltip/aria-label
  `Chỉnh sửa ảnh`; chỉ hiện khi asset hỗ trợ, không để một nút disabled khó hiểu
  trên ảnh TeX. Modal giữ ba vùng header/content/footer, lazy-load và chỉ có hai
  tool `Làm nét ảnh`, `Xóa chi tiết thừa`. Mask dùng màu tương phản bán trong
  suốt, cỡ cọ nhỏ/vừa/lớn, undo/redo, xóa mask, zoom/pan và Pointer Events cho
  mouse/touch/pen. Hai tool loại trừ nhau; làm nét tự preview khi chọn, xóa tự
  cập nhật và hiển thị `Sau chỉnh sửa` sau mỗi stroke/undo/redo, trong khi canvas
  và con trỏ cọ vẫn active ngay trên ảnh kết quả để tô liên tiếp. Lớp nét đỏ hiển
  thị phải mất sau mỗi preview dù chi tiết có xóa được hay không; mask tích lũy
  cho apply phải tách khỏi canvas hiển thị. Không có nút preview riêng. Phải có
  before/after, cảnh báo giới hạn nền phẳng và khóa `Áp dụng` khi auto-preview
  hiện tại chưa sẵn sàng hoặc đã stale. `Áp dụng` chỉ commit tool đang chọn và
  giữ modal mở; sau thành công reset preview/mask và cập nhật ảnh hiện hành. Làm
  nét trở về trạng thái chưa chọn tool; xóa giữ cọ active để admin tô liên tiếp
  mà không phải chọn lại công cụ. Khi đã có lượt được commit, action thoát
  dùng nhãn `Đóng` thay vì `Hủy` vì đóng modal không hoàn tác revision đã lưu.
- Toolbar ngữ cảnh có nhiều lệnh ngắn như chỉnh bảng phải dùng icon, chia nhóm
  theo chức năng và có tooltip tùy biến xuất hiện ngay khi hover/focus cùng
  `aria-label`; không chỉ dựa vào `title` native bị trễ và không trải một hàng
  nút chữ dài làm người dùng khó quét.
- Với kích thước bảng, ưu tiên thao tác trực tiếp: kéo biên dọc để đổi độ rộng
  cột và kéo biên ngang để đổi chiều cao hàng. Không bắt người dùng nhập pixel
  thủ công khi kích thước có thể điều chỉnh trực quan.
- Action tạo một cấu trúc có nhiều tham số như bảng phải mở modal cấu hình gọn
  trước khi chèn, không làm toolbar/editor nở thêm một form inline gây dịch
  layout. Node cấu trúc hợp lệ như bảng hoặc ảnh phải làm placeholder biến mất
  và được validation nhận là nội dung, kể cả chưa có text thuần.
- Cắt ảnh trong editor phải là thao tác trực tiếp trên preview: phủ vùng tối bên
  ngoài, khung cắt có lưới một phần ba và handle ở cạnh/góc để kéo; cho phép kéo
  cả khung, Hủy, Đặt lại và Áp dụng ngay trên ảnh. Không dùng bốn slider cạnh
  ảnh làm tương tác crop chính.

## 7. Component rules

- Button dùng shadcn/ui `Button`.
- Với action quay về ở màn kết quả học tập, dùng nút bo góc gọn (`rounded-xl`)
  có icon kèm nhãn ngắn, cùng hệ với header; không đặt icon tròn đơn lẻ tách
  khỏi nhóm action. Nút phải có `aria-label` mô tả đích quay về.
- Text trong button không được xuống dòng trong mọi viewport. Button phải có `white-space: nowrap`/`whitespace-nowrap`; khi nhãn dài hoặc màn hẹp, ưu tiên chỉnh layout, độ rộng, padding, font size hoặc copy ngắn hơn thay vì cho chữ wrap.
- Mọi nút bấm và đường link có thể click được phải hiển thị `cursor: pointer`. Trạng thái không click được như disabled/loading phải dùng cursor đúng trạng thái (`not-allowed`, `wait`, `default` hoặc tương đương), không để người dùng hiểu nhầm là có thể bấm.
- Nếu action ngay lập tức mở một loading/transition surface lớn hoặc toàn màn
  hình, surface đó là feedback loading duy nhất. Button nguồn phải giữ nguyên
  icon và label, không thêm spinner, progress hoặc đổi copy sang `Đang...`;
  vẫn được khóa handler/disabled để chống bấm lặp. Chỉ dùng pending trực quan
  trong button khi không có loading surface lớn thay thế.
- Các nút cùng một flow hoặc action group phải dùng chung ngôn ngữ tương tác theo từng vai trò: cùng độ sâu shadow, cùng khoảng dịch chuyển khi pressed và cùng nhịp transition. Nút enabled phải có đổi màu hover rõ nhưng nhẹ; nút disabled không được đổi màu như thể vẫn tương tác được. Khi student theme chủ động bỏ shadow trên mobile, action cần giữ hiệu ứng 3D phải dùng utility ngoại lệ đã có thay vì tự tạo độ sâu/màu shadow khác ở từng màn.
- Form dùng React Hook Form + Zod; nếu đã setup shadcn Form thì dùng shadcn Form.
- Trước khi tạo form, phải kiểm tra form chuẩn đã duyệt và reusable primitives: `apps/web/components/common/forms`, các form tương tự trong feature đang làm, và `docs/ui-references/approved-patterns.md`. Reuse/nâng cấp component sẵn có thay vì tạo input/select/textarea/button cùng chức năng với style khác.
- Checklist bắt buộc cho mọi form mới hoặc form được sửa: schema Zod đủ required/min/max/format; React Hook Form validate khi nhập/chọn; lỗi inline có copy rõ và đúng rule đang fail; submit invalid phải bị chặn bằng validation handler thay vì khóa nút modal; action button trong modal vẫn bấm được để hiện lỗi, chỉ disabled khi pending/saving hoặc thiếu prerequisite cứng; pending state có feedback; reset/default values đúng khi mở lại modal/drawer; không có control nhìn bấm được nhưng thiếu handler/state thật.
- Modal/drawer form khi mở mới phải sạch lỗi ở trạng thái chưa tương tác. Không hiện inline error ngay lúc mở modal chỉ vì default value còn thiếu; error chỉ hiện sau khi người dùng chạm/sửa field, bấm submit, hoặc sau lỗi nghiệp vụ của hành động lưu.
- Modal/drawer luôn căn giữa theo chiều dọc và chiều ngang trong viewport trên mobile, tablet và desktop. Không top-align modal ở mobile; khi nội dung dài, giữ modal trong `max-height` và chỉ cho vùng body giữa scroll.
- Tất cả modal/drawer phải có cấu trúc 3 vùng rõ ràng: phần trên chỉ là tiêu đề ngắn và nút icon `X` để đóng, không có mô tả/subtitle dưới title; phần giữa là nội dung; phần dưới là action chính/phụ. Chỉ phần nội dung ở giữa được scroll; header/footer phải gọn và luôn nằm trong tầm mắt người dùng trên mobile, tablet và desktop. Footer modal luôn có nút `Hủy` để thoát/hủy thao tác và action chính/destructive khi có. Trên mobile, nếu thật sự chỉ có một action thì nút full width; mặc định hai action nằm cùng một hàng hai cột. Trên laptop/desktop, button trong footer modal co theo nội dung (`max-content`/`w-auto`), không kéo full width, và thường canh về phía phải.
- Button trong modal/drawer phải đồng nhất màu theo vai trò action trên toàn bộ flow: action chính/lưu dùng cùng màu `primary`, mặc định là xanh dương `sky-600` với hover `sky-700` và chữ trắng; hủy/đóng dùng trung tính; destructive dùng đỏ. Không dùng primary màu đen/tối trong một modal nếu các modal cùng hệ đang dùng xanh dương, vì làm UI mất nhất quán và người dùng khó nhận diện hành động chính.
- Bộ công cụ trợ giúp trong code editor dành cho người không kỹ thuật phải mở từ
  một trigger dễ hiểu như `Chỉnh nhanh`, có helper text ngắn, nhóm thao tác theo
  kết quả nhìn thấy thay vì thuật ngữ TikZ. Mỗi action một chạm phải mô tả rõ thứ
  bị thay đổi, tự cập nhật preview, có pending/error feedback và `Hoàn tác`; trên
  màn nhỏ panel dùng vùng cuộn giới hạn, không đẩy footer modal khỏi viewport.
- Panel `Chỉnh nhanh` phải là popover nổi có z-index/shadow/border rõ, neo dưới
  trigger và không tham gia layout của editor/preview. Escape hoặc click ra ngoài
  chỉ đóng popover; nhóm điều chỉnh nhiều mức như cỡ chữ dùng segmented controls
  với nhãn đời thường, không bắt admin nhập lệnh hoặc số pt.
- Khi `Chỉnh nhanh` liệt kê text lấy từ code, mỗi text slot phải có một row input
  riêng, icon áp dụng commit đúng row và action xóa sở hữu đúng row. Giữ thứ tự source, phân biệt các giá trị
  trùng nhau bằng định danh cú pháp thay vì nội dung chuỗi, dùng vùng cuộn giới
  hạn và empty/unsupported state rõ ràng. Không compile theo từng phím; commit ở
  blur/Enter, Escape hoàn nguyên edit chưa commit và lỗi compile không được làm
  mất source/input hợp lệ gần nhất.
- Footer `Biên dịch` chỉ refresh preview; khi popover `Chỉnh nhanh` hoặc vùng cài
  đặt một row đang mở, thao tác này phải giữ nguyên trạng thái mở để admin chỉnh
  liên tục. Icon áp dụng từng row dùng cùng compile guard và không phát sinh lượt
  compile thứ hai do sự kiện blur.
- Công cụ nhập hình học bằng tên điểm phải xác nhận lại cách hiểu trước submit:
  hiển thị tên góc chuẩn hóa, điểm giữa là đỉnh, số marker và cạnh sẽ tự thêm.
  Không ẩn hành vi nối cạnh phía sau CTA; dùng checkbox mặc định bật, lỗi inline
  và giữ source cũ khi tên điểm, tọa độ hoặc miền góc chưa xác định an toàn.
- Action destructive `Bỏ góc` đặt cạnh `Thêm góc`, dùng riêng tên góc đang nhập
  và không phụ thuộc field số đo. Không render banner đỏ/cảnh báo destructive
  trong lúc chỉ đang nhập tên; màu destructive ở CTA là đủ. Action phải xóa cả
  nhãn số đo embedded hoặc node rời có ownership tường minh, nhưng không được xóa
  named point hoặc topology của hình.
- `Thêm góc` phải là upsert: nhập lại cùng geometry với số đo mới sẽ thay số đo
  và trọn nhóm cung cũ. Góc bằng nhau dùng cùng kiểu cung; góc khác số đo hoặc
  chưa chứng minh bằng nhau không được dùng chung kiểu vì sẽ tạo ngụ ý hình học sai.
- Công cụ cạnh dùng một input hai điểm và hai action đối nghĩa `Nối`/`Bỏ nối`,
  luôn hiện trạng thái cạnh hiện tại trước khi admin bấm. Cạnh mới phải kế thừa
  độ dày chiếm ưu thế trong hình, không rơi về stroke mặc định mảnh hơn. Xóa một số đo góc do
  angle marker sở hữu phải xóa cả visual marker tương ứng; không để lại cung vô
  nghĩa sau khi nhãn biến mất và không xóa hai cạnh tạo góc.
- Công cụ midpoint dùng hai input ngắn `Đoạn thẳng`/`Tên trung điểm`, không yêu
  cầu admin tự viết TikZ. Cặp marker phải nằm ở hai nửa đoạn (`.25`/`.75` trên
  path toàn phần), tránh chồng lên điểm giữa; nhóm đoạn độc lập dùng lần lượt
  palette marker khác nhau, mỗi glyph tối đa hai nét gọn.
  Tên midpoint được chuẩn hóa viết hoa; nhãn midpoint kế thừa font-size đang dùng
  cho các nhãn điểm trong hình.
  Submit tên mới cho đoạn đã có đúng một midpoint do tool quản lý phải thay thế
  atomic midpoint cũ, giữ kiểu marker và cạnh; không nháy cảnh báo trùng tên do
  source vừa được cập nhật trong lúc compile.
  `Xóa trung điểm` là action destructive đối nghĩa và chỉ cần input đoạn thẳng;
  hệ thống tự tìm quan hệ duy nhất do tool sở hữu, xóa point/label/marker nhưng giữ
  nguyên đoạn gốc; ownership mơ hồ không được đoán.
- Công cụ đặt tên tâm dùng checkbox progressive disclosure: input và CTA chỉ hiện
  khi checkbox `Thêm tên tâm đường tròn` được bật. Tên tự viết hoa, nhãn kế thừa
  font point label, đặt cạnh tâm nhưng không thêm chấm mới hay thay geometry.
- Điều chỉnh thu/phóng figure đã lưu phải tác động lên toàn bộ visual card gồm
  ảnh, caption và badge, rồi căn giữa card. Ảnh bên trong lấp đúng content box
  của card; cấm giữ card full-width rồi chỉ thu nhỏ `<img>` vì tạo vùng trắng
  giả và khiến kết quả sau `Áp dụng` khác cảm nhận trong preview.
- Pattern form mặc định phải bám form chuẩn đã duyệt hoặc form tương tự đang chạy ổn trong dự án: dùng `mode: "onChange"`/`reValidateMode: "onChange"` và truyền `form.formState.errors.<field>` trực tiếp vào primitive field. Muốn modal không hiện lỗi lúc mở thì không gọi `trigger()` sau `reset()`; không tự bọc lỗi bằng `dirtyFields/touchedFields` nếu không có test/logic rõ.
- Với text input required, message "Nhập ..." chỉ được gắn với trạng thái rỗng sau khi trim. Nếu field có rule tối thiểu 2 ký tự trở lên, định dạng, khoảng giá trị hoặc kiểm tra trùng lặp, phải dùng message riêng tương ứng; không để người dùng đã nhập rồi vẫn thấy lỗi như chưa nhập.
- Text input required trong `apps/web` nên dùng helper validation chung như `requiredTrimmedText` để tách required/min/max message từ đầu. Nếu một field cần min length lớn hơn 1, helper phải nhận `minMessage` riêng; không dùng lại required message.
- Mọi ô input nhập liệu phải tắt gợi ý trình duyệt/autofill bằng cấu hình input chung; không dùng `autoComplete` semantic như `username`, `name`, `tel`, `street-address` hoặc `new-password` trong UI trừ khi owner yêu cầu rõ.
- Dialog, Drawer, Sheet, Tabs, Card, Table, Badge, Alert ưu tiên shadcn/ui.
- Icon button phải có `aria-label` hoặc tooltip nếu không hiển nhiên.
- Tooltip phải là tooltip tùy biến xuất hiện ngay ở frame hover/focus đầu tiên,
  không dùng `title` native bị trễ. Tooltip phải render ngoài container có
  `overflow`/scroll (ưu tiên portal vào `document.body`), tự giữ trong viewport
  và không được làm thay đổi `scrollWidth`, tạo scrollbar hoặc bị modal/editor
  cắt mất.
- Logo và text logo `ClassHero` là brand component dùng chung, không được tự dựng biến thể mới theo từng màn. Mọi header, app bar, auth brand, sidebar hoặc mobile bar khi cần hiển thị thương hiệu phải dùng cùng cấu trúc/logo/text/token đã có ở header chuẩn gần nhất, hiện là icon `GraduationCap` trên nền gradient `theme-brand` và chữ `Class`/`Hero` tách màu theo `--theme-brand-primary`/`--theme-brand-secondary`. Không dùng logo chữ tắt như `CH`, không đổi font, màu, khoảng cách hoặc icon brand nếu chưa có yêu cầu đổi brand toàn hệ thống.
- Loading, empty, error, disabled state phải được thiết kế cùng component/màn hình.
- Search, filter và sort ở màn danh sách cấp trang của Student, Parent và Admin phải đồng bộ vào URL query params để giữ nguyên sau refresh/F5, hỗ trợ điều hướng Back/Forward và không phụ thuộc state tạm trong component. Giá trị query phải được validate theo option hợp lệ; giá trị rỗng/mặc định nên được bỏ khỏi URL. State thuần trình bày như dropdown đang mở, modal đang mở hoặc item đang hover không lưu vào URL.
- Toast/notification ngắn hạn phải dùng thư viện toast chung của web app, hiện là `sonner`; không hand-roll toast cục bộ trong từng form/page.
- Toast phải giữ màu chủ đạo theo trạng thái trên nền/border/text, không chỉ ở icon: success dùng xanh lá, error dùng đỏ, warning dùng vàng/cam, info dùng xanh dương; icon phải có vùng/cột riêng và không được đè chữ; close button không được nổi lệch ra ngoài khối toast, không dùng biểu tượng trùng lặp với icon trạng thái và không làm toast quá thưa.
- Toast ngắn hạn chỉ hiển thị toast mới nhất; khi có toast mới, các toast cũ phải biến mất ngay thay vì xếp chồng bên dưới.
- Toast, banner, lỗi biểu mẫu và mô tả lỗi cho người dùng không được ghép hoặc hiển thị nguyên văn thông báo từ thư viện, schema, provider, database hay HTTP. Front-end phải đổi mã lỗi/lỗi đã biết thành câu tiếng Việt theo ngữ cảnh và dùng lời nhắc tiếng Việt an toàn cho lỗi chưa biết; tên trường, đường dẫn dữ liệu, stack trace và câu kỹ thuật tiếng Anh chỉ được giữ trong log hoặc vùng `Chi tiết kỹ thuật` dành riêng cho quản trị viên.
- Không fetch dữ liệu rải rác trong component sâu; dùng feature hook/API client.
- Mock data phải đặt rõ ràng, dễ xóa khi connect API.
- Màn UI có nhiều form, list, panel, trạng thái hoặc helper phải tách theo feature: page/manager chỉ compose layout; mỗi component render JSX ở file riêng; hook xử lý orchestration/state; schema/type và mapper/formatter/helper nằm ngoài file UI; mock data nằm file riêng. Không tạo file barrel/re-export chỉ để gom import cho tiện.
- Trước khi viết UI mới, áp dụng checklist trong `docs/14-source-code-structure.md`: route/page, screen, component, hook, schema, data, utils và shared layer phải có ranh giới rõ ngay từ đầu.
- Import/export nội bộ trong `apps/web` phải dùng alias tuyệt đối `@/...`, không dùng `../` hoặc `./` để trỏ file source khác. Điều này áp dụng cho route, feature, shared component và helper trong cùng module; chỉ bỏ qua file tự sinh hoặc import mà framework/tool yêu cầu giữ relative.
- Component/pattern đã được owner duyệt phải là nguồn ưu tiên cho màn sau. Trước khi tạo input, select, checkbox, button, card, filter, hook hoặc API service mới, kiểm tra `apps/web/components`, feature tương tự và `docs/ui-references/approved-patterns.md`; nếu chức năng/style có thể tái sử dụng thì dùng lại hoặc nâng lên shared. Chỉ giữ component lẻ trong feature khi nó thật sự gắn riêng với màn đó và không có giá trị dùng lại.
- Nếu routing index trong `docs/ui-references/code-patterns.md` trỏ tới pattern phù hợp, Codex phải đọc đúng file/section trong `docs/ui-references/code-patterns/` và copy/đối chiếu theo pattern đó trước khi tự thiết kế code flow mới.

### 7.1. Production-quality mock UI

Khi làm `/task-ui`, mock data chỉ là chi tiết kỹ thuật trong code để màn hình chạy được trước khi nối API. Giao diện vẫn phải trông như bản production thật.

Rules:

- Không đưa text kỹ thuật, task code, ghi chú Codex hoặc hướng dẫn implementation lên giao diện.
- Không hiển thị các cụm như `mock`, `M2.4`, `task-ui`, `connect API later`, `backend enforce`, `Codex`, debug/test hint hoặc roadmap label nếu người dùng thật không cần biết.
- Copy hiển thị phải viết cho người dùng thật theo role: học sinh, phụ huynh, admin hoặc public visitor.
- Empty/loading/error/success state phải là thông điệp sản phẩm tự nhiên, không phải chú thích kỹ thuật.
- Mock UI chỉ được mock dữ liệu hoặc API boundary; trải nghiệm hiển thị và tương tác phải giống production thật. Không để button, checkbox, tab, menu, input, toggle, accordion, modal, filter, pagination, upload, editor, chart control hoặc icon có vẻ bấm được nhưng thực chất là tĩnh.
- Mọi control tương tác phải dùng element semantic, state/handler thật, feedback bấm rõ và pending/disabled/loading state phù hợp. Nếu chưa nối API, dùng local/mock state để mô phỏng đúng hành vi sản phẩm thay vì bỏ trống interaction.
- Muốn giải thích mock/API/technical flow thì ghi trong final response, docs, code comment hoặc test name, không ghi trong UI.

### 7.2. Copy ngắn gọn cho UI người dùng thật

Các màn dành cho học sinh và phụ huynh phải giống sản phẩm thật, không giống tài liệu giải thích hệ thống.

Rules:

- Không đưa các đoạn mô tả dài để giải thích vì sao hệ thống làm như vậy.
- Không dùng nhiều card phụ chỉ để diễn giải lợi ích hiển nhiên của form.
- Không lặp lại cùng một ý ở nhiều vị trí trên màn hình.
- Auth/register/forgot/reset nên ưu tiên: brand nhỏ, một tiêu đề rõ, một câu phụ ngắn, form label dễ hiểu, CTA chính và link phụ cần thiết.
- Text hỗ trợ chỉ nên xuất hiện khi giúp người dùng nhập đúng hoặc xử lý lỗi ngay tại chỗ.
- Với học sinh/phụ huynh, giọng văn cần thân thiện, chuyên nghiệp, trực tiếp; tránh văn phong như tài liệu kỹ thuật, policy hoặc lời giải thích cho Codex.
- Auth UI cho học sinh/phụ huynh không được quá xám hoặc lạnh; cần có năng lượng học tập qua nền màu sáng, CTA nổi, ảnh/illustration hoặc visual nhẹ, subject chips ngắn và font phù hợp. Giữ trẻ trung vừa phải, không biến thành giao diện trẻ con.
- Khi dùng ảnh/visual cho auth học sinh, tránh ảnh coworking, văn phòng, người đi làm hoặc mood corporate. Ưu tiên minh họa/ảnh học đường như bàn học, sách vở, balo, lớp học, công thức, flashcard hoặc học sinh đúng độ tuổi.
- Auth desktop nên dùng split-screen rõ ràng khi có visual: bên trái là vùng ảnh/minh họa và slogan lớn, bên phải là form sạch trên nền trắng. Tránh đặt một glass hero card lơ lửng trên background nếu làm người dùng khó hiểu.
- Nội dung bên trái của auth nên là lời chào thương hiệu và slogan ngắn, ví dụ "Chào mừng bạn đến với..." + một câu định vị giá trị. Tránh biến phần này thành mô tả chức năng theo role quá chi tiết.
- Có thể dùng display font riêng cho heading ở visual panel auth để tạo cá tính trẻ trung, nhưng form/body vẫn dùng font dễ đọc và nhất quán.
- Visual panel auth không được để headline quá to, toàn màu đen nặng hoặc panel quá đục che mất ảnh nền. Ưu tiên chữ gradient/accent vừa phải, thẻ nền trong nhẹ, nhiều icon học tập ngắn gọn và animation tinh tế có hỗ trợ `prefers-reduced-motion`.

## 8. Responsive rules

UI của dự án ưu tiên viewport theo role, nhưng phải ổn trên 3 nhóm:

- Mobile: `375px-430px`.
- Tablet/iPad: `768px-1024px`.
- Laptop/desktop: `1366px-1440px`.

Priority:

- Admin: laptop-first trước. Thiết kế từ layout quản trị trên laptop/desktop, ưu tiên mật độ thông tin, bảng/list, filter, sidebar, split view, bulk action và thao tác lặp lại; sau đó đảm bảo tablet/iPad và mobile không vỡ layout, CTA vẫn bấm được và flow chính vẫn hoàn tất được.
- Public/student/parent: mobile-first trước. Thiết kế từ điện thoại, ưu tiên đọc nội dung, thao tác chạm, form ít ma sát và tốc độ cảm nhận; sau đó mở rộng layout cho tablet/iPad và laptop/desktop.

Rules:

- Mobile: layout một cột, CTA chính dễ bấm, touch target khoảng `44px`.
- Tablet/iPad: layout trung gian hợp lý; có thể 2 cột nếu giúp đọc/học tốt hơn.
- Desktop: tận dụng sidebar, split view, table, secondary panel khi có lợi.
- Không để tab/table/form gây overflow ngang vô kiểm soát.
- Thanh tab cuộn ngang trên mobile phải tự đưa tab active vào trọn vùng nhìn thấy sau click/keyboard, ưu tiên đặt gần giữa viewport tab khi còn khoảng cuộn và áp dụng đối xứng khi chọn item bên trái hoặc bên phải; không để chỉ còn icon, cắt mất nhãn hoặc giữ tab active lệch sát mép dù người dùng vừa chọn lại item trước đó. Nếu không dùng Tabs primitive của shadcn/Radix, custom tab phải giữ semantic `tablist`/`tab`, roving `tabIndex`, phím mũi tên/Home/End và hành vi reveal active item.
- Lesson/quiz/test mobile ưu tiên nội dung chính; điều hướng phụ dùng drawer/tabs/sticky footer.

Breakpoint/pattern mặc định:

| Viewport                   | Pattern                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| Mobile `375px-430px`       | Một cột, sticky CTA khi flow cần hành động liên tục              |
| Tablet/iPad `768px-1024px` | Hai cột nhẹ hoặc sidebar phụ khi giúp đọc/học tốt hơn            |
| Desktop `1366px-1440px`    | Sidebar, split view, bảng/filter rõ; tránh content text quá rộng |

## 9. Motion/animation

- Dùng Framer Motion cho chuyển trạng thái nhỏ: tab, card hover, progress, dialog.
- Animation nhanh, nhẹ, không làm chậm thao tác học.
- Không dùng animation trang trí quá nhiều trong admin/parent.
- Tôn trọng trạng thái loading; skeleton nên ổn định layout.

## 10. Performance, smooth interaction và mobile UX

UI không chỉ cần đẹp/responsive; mặc định phải cho cảm giác nhanh, mượt và phản hồi rõ trên mobile.

Mục tiêu:

- Tốc độ load trên điện thoại là mục tiêu ưu tiên mặc định ở mọi đường tải: lần mở đầu, chuyển trang, fetch/refetch dữ liệu, skeleton, asset/font/image, hydration và các thao tác có pending. Một UI chỉ được xem là mượt khi các đường load chính trên điện thoại đều nhanh, không chỉ khi điều hướng nội bộ nhanh nhờ cache/router.
- Mobile interaction phải phản hồi gần như tức thì sau khi bấm, kéo, chọn đáp án, lật flashcard, mở modal hoặc submit form.
- Hạn chế layout shift; skeleton/placeholder phải giữ kích thước gần với nội dung thật.
- Không để thao tác học chính bị delay vì animation, fetch thừa, render list quá dài hoặc logic chạy nặng trên main thread.
- Ưu tiên perceived performance: người dùng phải thấy trạng thái đang xử lý ngay cả khi API chưa trả kết quả.

Frontend rules:

- Dùng TanStack Query cho server state, cache, refetch, mutation và invalidate; không tự fetch rải rác trong component sâu.
- Dữ liệu TanStack Query dùng để render phải được đọc trực tiếp từ query/cache; không copy `query.data` sang local state rồi đồng bộ bằng `useEffect`, vì render thành công và effect lệch nhau một frame có thể làm UI nháy empty/error trước khi dữ liệu xuất hiện. Chỉ giữ local draft khi người dùng thật sự chỉnh sửa độc lập với server state.
- Màn biên tập, modal hoặc code editor đang giữ local draft không được tự nạp lại dữ liệu chỉ vì người dùng chuyển sang tab trình duyệt khác rồi quay lại. Query cấp dữ liệu cho phiên biên tập phải tắt `refetchOnWindowFocus` hoặc merge an toàn mà không reset draft; trạng thái job cần realtime vẫn dùng polling/invalidation riêng và tiếp tục cập nhật sau khi tab hoạt động lại.
- Initial fetch hoặc auth hydration phải hiện skeleton ngay và giữ skeleton khi query đang retry/refetch mà chưa có dữ liệu. Error toàn màn chỉ được hiện khi request đã dừng và vẫn thất bại; background refetch đã có dữ liệu phải giữ nội dung cũ.
- Với action có độ trễ như submit quiz, lưu note, favorite, thanh toán, gửi chat AI: hiển thị pending/disabled state ngay khi người dùng thao tác.
- Dùng optimistic UI chỉ khi rollback an toàn và không ảnh hưởng nghiệp vụ nhạy cảm; không optimistic cho payment, auth hoặc dữ liệu cần xác nhận server nghiêm ngặt.
- Debounce search/filter/input gọi API liên tục; không gọi API mỗi ký tự nếu không cần.
- Paginate, infinite query hoặc virtualize list dài; không render toàn bộ danh sách lớn trên mobile.
- Prefetch data cho bước kế tiếp khi flow học rõ ràng, ví dụ bài tiếp theo hoặc detail sau khi user sắp mở.
- Tách component nặng theo route/feature; lazy load phần ít dùng như editor nặng, chart lớn, AI panel hoặc admin tool nếu phù hợp.
- Với trang có form/modal/drawer/editor/chart chỉ dùng sau thao tác của user, không kéo toàn bộ stack đó vào bundle tải đầu. Lazy-load dialog/form nặng, giữ screen list/detail ban đầu nhẹ nhất có thể.
- Khi mock data hoặc nối API thật, ưu tiên server render/initial data/placeholder data an toàn để màn đầu không giữ skeleton lâu. Không thêm mock latency mặc định trừ khi task đang test trạng thái loading.
- Với route có auth và dữ liệu riêng của trang, hard refresh phải đưa shared header cùng payload chính (hoặc skeleton cùng hình học) vào HTML response đầu tiên. Chỉ render shell/background ở server rồi đợi auth store hydrate để gắn header/card/video ở client sẽ tạo nháy sáng dù nền trang vẫn ổn định.
- Route admin cấp trang phải verify session ở server và seed dữ liệu chính vào TanStack Query/component ngay trong HTML đầu; auth-store hydration phía client chỉ được bật revalidate/action, không được thay dữ liệu server bằng skeleton toàn màn. Nếu tab mặc định chiếm viewport đầu như Quiz trong chi tiết buổi học, set và nội dung tab đó cũng phải có initial data, nếu không phần vỏ ổn định nhưng panel con vẫn nháy riêng.
- Dữ liệu định danh dùng trong shell như tên, role và lớp học sinh phải được seed từ cùng server current-user response dùng để authorize route. Không render nhãn chung như `Học sinh` ở server rồi đổi riêng thành `Học sinh lớp 6` sau hydration.
- Route transition phải nhẹ: prefetch/cache khi hợp lý, chỉ tải chunk cần cho route đích, không để màn trắng, và tránh refetch lại dữ liệu đã có nếu cache còn đúng.
- Asset/font/image phải phục vụ mobile trước: không dùng ảnh quá lớn, không kéo nhiều font/weight, không tải chart/editor/media ngoài viewport hoặc chưa cần.
- API/data load phải trả đúng phần UI cần, phân trang/list limit rõ, tránh include/rich text/blob lớn ở màn chỉ cần metadata.
- Mọi output render lần đầu phải hydration-safe: không dùng formatter/sort phụ thuộc khác biệt server-client, `Date.now()`, `Math.random()` hoặc browser-only branch trong JSX đầu tiên; nếu browser/autofill chèn attribute ngoài ý muốn vào input, xử lý tại primitive thay vì để dev overlay làm người dùng tưởng app lỗi.
- Ảnh phải tối ưu kích thước, dùng responsive image, lazy load ảnh ngoài viewport và tránh ảnh quá lớn cho mobile.
- Không dùng animation trên thuộc tính gây layout/reflow nặng; ưu tiên transform/opacity.
- Với tab dữ liệu có panel lớn hoặc chiều cao khác nhau, không dùng shared-layout measurement/`layoutId`, animation `height` hoặc exit-before-enter làm việc đổi tab phải chờ đo lại toàn bộ DOM. Indicator nên chạy bằng `transform` trên một layout tab ổn định; panel dữ liệu đổi trực tiếp và dùng skeleton có kích thước phù hợp nếu phải tải lazy. Nếu panel mới hoặc query của nested tab có thể tạm co thấp hơn panel cũ, giữ `min-height` ít nhất bằng chiều cao panel đang hiển thị ngay trong cùng lần đổi state để document không co giãn qua nhiều frame; rule này áp dụng cả tab cấp trang lẫn tab set con như bộ Quiz/Flashcard.
- Nếu tab đích cần một status/query nhỏ để quyết định ngay nội dung đầu tiên, prefetch query đó từ lúc màn cha sẵn sàng. Khi người dùng bấm trước lúc prefetch xong, giữ nguyên panel hiện tại, đánh dấu tab đích đang pending và chỉ đổi panel một lần sau khi dữ liệu sẵn sàng; không commit tab vào một vùng trống/skeleton thoáng qua rồi thay ngay bằng card thật.
- CSS `hidden`, `display: none` hoặc opacity chỉ ẩn giao diện, không unmount React component và không dừng effect. Panel/tab không hoạt động không được tiếp tục sở hữu global side effect như khóa scroll, listener toàn trang hoặc portal fullscreen. Chỉ mount surface đang hoạt động hoặc truyền cờ `enabled` rõ ràng; mọi document scroll lock phải đi qua helper dùng reference count và chỉ tồn tại khi modal/fullscreen surface thật sự đang nhìn thấy.
- Root page phải giữ scrollbar gutter ổn định khi các tab/route có thể làm scrollbar dọc xuất hiện hoặc biến mất, tránh toàn bộ shell dịch ngang giữa hai trạng thái.
- Tôn trọng `prefers-reduced-motion` khi thêm animation đáng kể.

Mobile UX rules:

- Mobile header tự ẩn theo hướng cuộn phải lưu/khôi phục trạng thái theo từng
  browser history entry cùng `scrollY`, không cache chỉ theo pathname và không
  phụ thuộc browser/Next tự restore. Khi Back/Forward về một entry còn giữ vị
  trí cuộn sâu, student shell phải khôi phục đúng `scrollY` và header phải nhận
  trạng thái cũ trước frame đầu. Khi bấm link/CTA để mở một history entry mới,
  màn đích bắt đầu ở `scrollY = 0`, header hiện và không kế thừa trạng thái của
  entry cũ. Sau F5/reload, entry hiện tại được reset về `scrollY = 0` như lần đầu
  vào màn và header luôn khởi tạo ở trạng thái hiện.
- Touch target tối thiểu khoảng `44px` cho CTA, option quiz, tab, icon button quan trọng.
- Trạng thái bấm/tap phải rõ: pressed/active/loading/disabled.
- Form mobile phải ít ma sát: input label rõ, lỗi hiện gần field, keyboard type phù hợp, submit không bị che bởi keyboard/sticky footer.
- Trên iOS, mọi `input`, `textarea` và trigger nhập liệu/select trông như ô nhập phải dùng font-size tối thiểu `16px` ở mobile để tránh Safari/Chrome tự zoom khi focus; có thể giảm về size nhỏ hơn ở desktop bằng breakpoint lớn.
- Nếu form không muốn browser hiện gợi ý/autofill, không chỉ dựa vào `autocomplete="off"`; cần tránh DOM `name/id/type/label` dễ bị browser/password manager nhận diện, đồng thời vẫn giữ state/form library nhận field name thật.
- Control custom như select/checkbox phải dùng component semantic/thư viện ổn định, có state và handler thật. Khi gặp lỗi mobile, kiểm tra hydration/runtime/overlay pointer trước khi thay control bằng hướng khác.
- Select/dropdown không được ép mở bằng `touchstart`/`pointerdown` khi người dùng chỉ lướt qua; chỉ mở sau click/tap có chủ đích. Với form mobile đơn giản như auth, ưu tiên inline controlled button/listbox nếu portal dropdown tạo lỗi double-open trên touch viewport. Click/tap lại trigger khi đang mở phải đóng hẳn, và icon mũi tên phải phản ánh đúng trạng thái mở/đóng.
- Nút submit trong form mock/client-only nên có `preventDefault` rõ hoặc dùng intent handler riêng để tránh submit HTML mặc định làm reload trang khi client JS chưa hydrate.
- Với quiz/flashcard/test, thao tác chính phải nằm trong tầm ngón tay; tránh bắt user cuộn quá nhiều chỉ để submit/chuyển câu.
- Quiz là flow tham chiếu cho các hoạt động luyện tập trong lesson. Flashcard
  phải giữ panel vào bài trong tab lesson, nhưng sau `Bắt đầu`/`Tiếp tục`/`Xem
lại` phải chuyển sang runner hoặc result toàn màn hình có cùng header
  ClassHero, back/exit-confirm, scroll lock, progress hierarchy và responsive
  behavior; chỉ đổi tone/copy/action theo nghiệp vụ Flashcard.
- Flow học dài như Quiz/Test đang làm phải chịu được refresh/F5. Riêng Quiz,
  attempt, mọi đáp án nháp, trạng thái đã kiểm tra và vị trí câu phải autosave
  theo attempt ở server để resume được cả khi đổi thiết bị; browser storage chỉ
  được dùng làm cache tăng tốc, không phải nguồn duy nhất. Không được chỉ giữ
  flow bằng React state rồi đưa người học về màn bắt đầu sau reload.
- Autosave nền không được đưa runner đang hiển thị quay lại loading/skeleton hoặc
  chạy lại luồng resume sau mỗi response. Effect resume phải phụ thuộc vào danh
  tính attempt/surface cần khôi phục, không phụ thuộc vào các counter tiến độ
  thay đổi liên tục như số câu đã làm hoặc đã kiểm tra.
- Khi resume một flow fullscreen sau F5, trạng thái pending phải chiếm cùng
  fullscreen boundary và giữ gần đúng bố cục đích ngay từ HTML đầu tiên. Không
  render loading dạng card trong shell rồi mới phủ runner lên sau khi API trả về,
  vì sẽ làm màn trước nháy lên dù dữ liệu resume vẫn đúng.
- Danh tính của fullscreen surface cần resume (loại runner/result, set và
  attempt nếu có) phải nằm trong URL để server đọc được ở request F5. History
  state chỉ giữ semantics Back/Forward, còn browser storage chỉ giữ chi tiết
  phiên; nếu chỉ dùng hai nguồn browser-only này, server sẽ render lesson panel
  trước rồi client mới đổi sang runner và gây nháy/hydration mismatch.
- Khi API chậm, ưu tiên skeleton, inline progress hoặc retry thân thiện thay vì màn hình trắng.

Local dev/browser guardrails:

- Khi test Next.js dev server trên điện thoại qua IP LAN, nếu console/server báo chặn `/_next/webpack-hmr` hoặc dev resource theo origin, cấu hình `allowedDevOrigins` cho IP LAN và restart server trước khi debug UI control.
- Nếu Safari ổn nhưng Chrome/Google iOS hiện Next hydration overlay trong khi tương tác vẫn chạy, kiểm tra khả năng browser/extension/app wrapper chèn attribute vào DOM trước hydration; không vội refactor UI control.
- Khi nhiều control cùng lỗi trên một thiết bị như select không mở, checkbox không đổi state, validation không hiện và submit bị reload, ưu tiên điều tra client JS hydration/runtime thay vì sửa từng control rời rạc.

Performance budget/checklist:

| Hạng mục         | Mục tiêu                                                                                |
| ---------------- | --------------------------------------------------------------------------------------- |
| Core Web Vitals  | Hướng tới LCP tốt, CLS thấp, INP tốt trên mobile                                        |
| Route transition | Không trắng màn hình; có loading/skeleton nếu data chưa sẵn                             |
| Hard refresh     | HTML đầu có header và payload/skeleton riêng của trang; không chỉ có shared shell       |
| Mobile load      | Mọi đường load trên điện thoại phải nhẹ nhất có thể: cold load, transition, data, asset |
| Interaction      | Button/action đổi state ngay sau thao tác                                               |
| List dài         | Có pagination/infinite/virtualization                                                   |
| Animation        | Nhẹ, ngắn, không block thao tác                                                         |
| Bundle           | Không thêm thư viện nặng nếu shadcn/Tailwind/native API đủ dùng                         |

Khi làm UI phức tạp, Codex nên ghi rõ trong final response đã kiểm tra hoặc bỏ qua phần nào:

- mobile viewport,
- desktop viewport,
- loading/empty/error/disabled state,
- interaction latency/perceived response,
- browser/responsive check chỉ khi owner yêu cầu rõ; mặc định Codex dùng static/focused check và owner tự kiểm UI/tương tác,
- screenshot chỉ khi owner yêu cầu bằng command có từ `screenshot`.

## 11. Empty/loading/error states

Mỗi màn hình hoặc block có data fetching phải có:

- Loading của dữ liệu detail, danh sách, card và tab panel phải ưu tiên skeleton mô phỏng gần đúng bố cục thật; không dùng mặc định spinner kèm câu mô tả cho các surface này.
- Skeleton phải được thiết kế theo cấu trúc thật của từng màn: list mô phỏng row/card list, detail mô phỏng hero/stat/section, form mô phỏng field/action và tab mô phỏng đúng panel đích. Không dùng một skeleton tổng quát giống hệt cho nhiều loại màn chỉ để thay spinner; chỉ tái sử dụng primitive nhỏ như block màu khi hình học thực sự giống nhau.
- Spinner chỉ dành cho thao tác ngắn không có bố cục nội dung để mô phỏng, ví dụ pending ngay bên trong nút bấm hoặc bước kết nối đặc thù. Không thay toàn bộ detail/list/tab panel bằng một icon xoay và dòng “Đang tải…”.
- Empty state: nói rõ chưa có dữ liệu và CTA tiếp theo nếu có.
- Error state: message dễ hiểu và retry nếu hợp lý.
- Fetch/data error trong admin phải dùng shared `AdminDataErrorState`: surface nền trung tính, danger accent ở icon, copy ngắn và primary retry action; không tự dựng style riêng ở từng feature.
- Chọn kích thước error theo surface: `compact` cho modal/card/panel nhỏ, `section` cho list/tab/section, `page` chỉ khi toàn bộ content chính của route bị chặn. Lỗi danh sách nằm dưới header/stat/filter tuyệt đối không dùng viewport-height hoặc variant `page` làm khối lỗi phình gần hết màn hình.
- Disabled state: action chưa dùng được phải có lý do hoặc tooltip/helper text.
- Full-page loading/error phải căn giữa theo cả chiều ngang và chiều dọc của viewport. Nếu màn nằm trong shell có header/sidebar thì căn giữa phần content còn lại; loading/error của tab hoặc card chỉ căn giữa vùng của chính tab/card.
- Có thể trì hoãn skeleton khoảng `250-300ms` ở client transition chỉ khi header và surface ổn định của trang vẫn được giữ nguyên trong lúc chờ. Ở cold load/F5, không được dùng delay để trả một vùng trống chỉ có background; HTML đầu phải có dữ liệu server hoặc skeleton cấu trúc ngay. Nếu loading đã hiện, giữ tối thiểu khoảng `300ms` để trạng thái ổn định trước khi chuyển sang nội dung.
- Dữ liệu của các tab cùng một màn phải được fetch/prefetch sớm nhất có thể ngay khi đủ dependency và chạy song song khi độc lập; không đợi người dùng mở tab mới bắt đầu request. Chuyển tab phải ưu tiên dữ liệu cache và không đưa panel đã có dữ liệu quay lại skeleton khi background refetch.

Không để trắng màn hình hoặc chỉ hiện lỗi raw.

## 12. UI acceptance checklist

Một màn hình UI chỉ xem là xong khi:

- Đúng role và flow trong `docs/08-ui-pages-and-components.md`.
- Đúng gu trong tài liệu này.
- Trông như production thật: không có placeholder/debug/mock label, không có vùng tĩnh giả tính năng, copy/trạng thái/hành động đủ tự nhiên cho người dùng thật.
- Tương tác như production thật: control có semantic element, state/handler, feedback bấm, pending/loading/disabled/error/success khi phù hợp; mock data vẫn phải có local/mock interaction đúng hành vi.
- Responsive cơ bản trên mobile, tablet/iPad và laptop/desktop.
- Tương tác chính trên mobile phản hồi nhanh, có pending/pressed/loading state rõ.
- Không dùng animation hoặc render list làm chậm thao tác học/chấm bài/submit.
- Có loading/empty/error/disabled state nếu màn hình có data/action.
- Với màn auth/data, test hard refresh phải đọc HTML response đầu và assert marker/nội dung riêng của trang cùng các nhãn profile có thể đổi sau `/me`; chỉ assert marker của layout/shared shell là chưa đủ để kết luận không nháy.
- Không text tràn, overlap, button cắt chữ hoặc layout nhảy mạnh.
- Không hard-code khác API contract nếu API đã có trong `docs/05-api-contract.md`.
- Không thêm tính năng ngoài MVP.
- Theo preference của owner, Codex không tự kiểm browser/Playwright/responsive thật trừ khi owner yêu cầu rõ; mặc định dùng kiểm tĩnh/focused và để owner tự kiểm UI/tương tác trên app.
- Chỉ chụp screenshot khi owner yêu cầu bằng command có từ `screenshot`, ví dụ `/task-ui screenshot M3.4`. Ảnh review phải nằm trong `.codex/screenshots/<subtask-or-screen>-<viewport>.png`, bị ignore, không commit và được dọn khi không còn cần; UI đã chốt được ghi bằng pattern/rule và code thay vì giữ ảnh raster.
- Riêng visual Toán do AI sinh, khi owner yêu cầu nghiệm thu bằng screenshot phải
  chụp từng figure từ component thật và tự xem lại ảnh trước khi báo đạt. Ảnh đã
  đạt và ảnh còn lỗi phải ở hai thư mục cấp cao riêng biệt; không trộn ảnh chưa
  duyệt vào bộ mẫu chuẩn. Schema/DOM test pass không đủ để kết luận hình đúng.
- Review visual Toán phải có căn cứ: ưu tiên figure/trang chính xác trong SGK/SBT
  Kết nối tri thức của lesson, sau đó SGK/SBT/SGV điện tử và tài liệu tập huấn
  chính thức của NXBGDVN. Mỗi ảnh PASS phải ghi reference ID và comparison mode;
  nguồn blog/video không rõ xuất xứ không đủ làm bằng chứng nghiệm thu. Không cần
  giống pixel: tính đúng toán học đứng trước, responsive được phép bố trí lại nếu
  giữ nguyên quan hệ và ghi rõ adaptation.
- Ảnh trong `anh-chup-hinh-toan-dat-chuan/` chỉ được dùng làm golden cho ảnh khác
  sau khi đã tái kiểm chứng với nguồn chính thống và có entry trong
  `reference-golden-manifest.json`. Tên thư mục không tự chứng minh ảnh đúng; ảnh
  có feedback cũ chưa xử lý phải chuyển ra khỏi bộ đạt chuẩn.
- Mọi sửa compiler, label solver hoặc renderer visual Toán phải chạy lại golden
  đã tái kiểm chứng trên mobile Chromium, mobile WebKit, iPad và laptop. Không
  được chấp nhận một case mới bằng cách làm giảm chất lượng case cũ; phát sinh
  clip, chồng text–nét, chồng text–text, sai marker hoặc thay đổi ngữ nghĩa ở bất
  kỳ golden nào đều là regression chặn nghiệm thu.
- Bảng giả thiết–kết luận của chứng minh Hình học trong Summary/Example phải giữ
  đúng quy ước SGK: cột
  trái chỉ có nhãn `GT`, `KL`; một đường dọc ngăn cột nhãn với nội dung và một
  đường ngang ngăn hai hàng. Không thay bằng hai badge/heading rời. Trên mobile,
  cột nhãn thu gọn, nội dung/KaTeX tự xuống dòng hoặc cuộn ngang cục bộ nhưng các
  đường ngăn vẫn liên tục; màu đường và chữ phải đủ tương phản ở light/dark.
  Quiz không render bảng GT–KL và không nhận field này từ API.
- Trong modal sửa khối Ví dụ/Bài tập môn Toán, hai editor `Giả thiết` và
  `Kết luận` xếp dọc và chiếm toàn bộ chiều ngang, không chia hai cột. Nút xóa
  GT/KL chỉ đổi bản nháp trong modal và phải xóa luôn nội dung hai editor; khi
  bấm `Thêm GT/KL` lại, cả hai editor mở ở trạng thái rỗng. Hủy/đóng modal khôi
  phục dữ liệu đã lưu; các control GT/KL không xuất hiện ở môn khác.
- Công thức display dài trong nội dung học tập không được scale toàn bộ SVG/KaTeX
  để ép vừa viewport. Giữ cỡ chữ đọc được và cho chính khối công thức cuộn ngang
  cục bộ; nếu nội dung sinh được nhiều dòng theo ngữ nghĩa thì ưu tiên
  `aligned`/`split`. Khoảng trắng dọc quanh công thức phải gọn, không tạo vùng
  trống lớn trong khi chữ toán lại bị thu nhỏ.
- Text trong visual Toán không được đè lên nét hình hoặc marker. Cơ chế tránh va
  chạm phải ưu tiên vùng trống gần nhất, giữ đúng phía/ngữ nghĩa của nhãn và dùng
  khoảng dịch nhỏ có giới hạn; không được làm sạch hình bằng cách đẩy nhãn ra xa.
- Lớp chỉnh sửa trực tiếp visual Toán chỉ tồn tại khi admin editor truyền quyền
  edit; student/read-only không render focus target, highlight hoặc action xóa.
  Label/marker selectable phải có hit area trong suốt đủ dùng bằng chuột/touch và
  keyboard, nhưng không đổi nét nhìn thấy hoặc lọt vào screenshot figure chuẩn.
- Khi chọn một marker group bằng nhau, toàn bộ glyph cùng quan hệ phải
  highlight. Icon xóa là HTML overlay destructive có `aria-label`, touch target
  khoảng `44px`, nằm trong biên figure và mở confirm dialog trước khi thay draft.
  Click nền hoặc `Esc` bỏ chọn. Không dùng click một lần để xóa ngay phần tử SVG.
- Dropdown action nằm trong card có ancestor `overflow` phải render qua portal
  hoặc floating layer, neo theo trigger và giữ lề viewport tối thiểu `16px`;
  không được để mất border, bo góc hoặc option ở cạnh trái/dưới.
- Lượt chỉnh trực tiếp đầu tiên chỉ xóa label và toàn marker; không xóa
  point/primitive/topology. Summary đã phát hành phải thu hồi trước khi chỉnh hình;
  mọi mutation phải qua schema client và validation/publish guard của backend.
- Vùng cấm của nhãn phải tính theo toàn bộ khung chữ, không chỉ theo điểm neo. Quy
  tắc này áp dụng cả tên điểm, phương trình đồ thị, trục, đường dóng và
  marker; ảnh chỉ được đưa vào bộ đạt chuẩn sau khi kiểm lại trên mobile thật.
- Visual Toán phải kiểm cả va chạm text–text; hai nhãn có khung chữ giao nhau dù
  không chạm nét vẫn là lỗi. Với trục số, tên điểm ở trên, trị số đặc biệt ở hàng
  dưới và mốc nguyên gần trục để giữ quan hệ rõ trên màn hẹp. Tên điểm trên trục
  số phải giữ cùng hoành độ với dấu điểm/vạch mà nó gọi tên; khi vạch tại chính
  điểm neo gây va chạm, renderer phải ưu tiên tăng nhẹ khoảng cách theo phương
  vuông góc với trục và không đẩy nhãn ngang sang gần vạch kế bên.
- Tên điểm hình học phải dùng khoảng cách nhỏ thống nhất quanh điểm neo rồi chỉ
  tăng khoảng cách khi khung chữ thật sự đụng nét. Tâm đường tròn có tên (`O`,
  `I`,...) phải có một dấu tâm nhỏ; không được vì quy tắc ẩn chấm ở đỉnh thường mà
  làm mất vị trí chính xác của tâm. Cỡ chữ tên điểm phải có sàn theo kích thước
  SVG thực tế, mục tiêu tối thiểu `10px` trên mobile; không được co theo viewBox
  rộng đến mức hai hình đặt cạnh nhau làm tên đỉnh khó đọc.
- Vạch chia trục số là nét phân độ, không phải marker hai đoạn bằng nhau. UI phải
  bỏ `EQUAL_LENGTH` gắn nhầm vào vạch chia để tránh nét màu chồng lên
  đường trục. Vạch phải ngắn, đồng đều, mục tiêu khoảng 2% và không quá 3% cạnh
  ngắn viewBox; trên mobile không được cao như cột hoặc cạnh hình.
- Phải phân biệt đúng ba đối tượng cơ bản theo SGK Kết nối tri thức: `LINE` kéo
  dài qua hai điểm về cả hai phía, `RAY` bắt đầu tại gốc và kéo dài qua điểm thứ
  hai, `SEGMENT` kết thúc tại hai đầu mút; cả ba không tự gắn đầu mũi tên. Dùng
  dấu điểm nhỏ tại các điểm định danh/đầu mút để quan hệ vẫn đọc được trên mobile.
  Hệ trục/trục số là ngoại lệ có mũi tên chiều dương. Với thang đo như nhiệt kế,
  một giá trị chỉ ghi một lần; mức chất lỏng phải được nhấn trực quan và tách được
  khỏi hai biên ống, không chồng nét cùng màu khiến mức đo mất ý nghĩa.
- Text nằm trong ô bảng phải có ngưỡng cỡ chữ tối thiểu theo kích thước hiển thị
  mobile, căn giữa và không chạm đường viền; không chỉ co chữ theo viewBox rộng.
- Hình minh họa thao tác dựng đồ thị đường thẳng phải hiện ít nhất hai điểm dựng
  có ý nghĩa rồi mới nối đường. Với parabol, điểm dựng nhìn thấy không được chọn
  tùy ý: phải gồm đỉnh và tối thiểu hai cặp đối xứng được suy ra từ hàm/vạch đơn
  vị; các điểm lấy mẫu phụ chỉ làm mượt POLYLINE và không hiện. Điểm dựng phải nằm
  đúng trên đồ thị: parabol gồm đỉnh và tối thiểu hai cặp đối xứng; đường thẳng có
  hai điểm phân biệt ưu tiên giao trục/tọa độ nguyên. Theo contract riêng của sản
  phẩm, mọi điểm dựng phụ đang hiển thị trên mọi loại đồ thị đều bắt buộc có tên
  ngắn duy nhất, kể cả khi hình tham khảo SGK bỏ tên ở một số chấm; chỉ điểm lấy
  mẫu kỹ thuật `NONE` không hiển thị mới được để trống tên. Tên đặt sát chấm và có
  đường dóng nét đứt về Ox/Oy; không ghép tên với
  tọa độ. Điểm trên Ox/Oy vẫn cần nhãn số của vạch tương ứng. Nhãn số của trục và
  tên điểm phải ở trong bán kính nhỏ quanh vạch/dấu điểm: đổi hướng
  trước khi tăng khoảng cách, không né va chạm bằng cách đẩy chữ ra xa.
- Mọi hình trong hệ thống cấm tuyệt đối marker mũi tên/chevron dùng để đánh dấu
  hai đường hoặc hai cạnh song song, kể cả khi ảnh nguồn hay source hiện tại có
  marker đó. Quan hệ song song chỉ được thể hiện bằng phép dựng và nội dung đề/
  lời giải bên ngoài canvas; cấm ghi `AB \\parallel CD`, `BC // AD` hoặc câu
  quan hệ tương đương trực tiếp lên hình. Quy tắc này không cấm mũi tên mang nghĩa
  hướng của trục, vector, lực, tia hoặc luồng truyền.
- Cung và nhãn số đo góc phải nằm trong đúng miền giữa hai tia được gọi tên. Góc
  trong đa giác phải được vẽ phía trong đa giác; chỉ dùng miền ngoài hoặc góc phản
  khi nội dung yêu cầu rõ góc ngoài hoặc góc phản. Cấm ghi tên góc dạng chữ như
  `ABC`, `DAB`, `∠ABC` hoặc `$\widehat{ABC}$` cạnh cung góc trên canvas. Hình chỉ
  dùng cung góc/dấu vuông neo đúng tại đỉnh và chỉ kèm số đo/biểu thức nếu đó là
  dữ kiện đã cho; ký hiệu góc trong đề, lời giải hoặc caption phải dùng dạng SGK
  có dấu mũ như `$\widehat{ABC}$`, với chữ chỉ đỉnh ở vị trí thứ hai.
- Cung góc và nhãn số đo là hai phần tử độc lập, không dùng chung anchor hoặc bán
  kính. Nhãn đặt theo phân giác trong, mặc định xa đỉnh hơn cung; bounding box của
  cả số và ký hiệu độ phải tách rời hoàn toàn khỏi cung và hai tia/cạnh, có khoảng
  trắng nhìn thấy rõ. Khi va chạm phải dịch nhãn dọc phân giác, đổi bán kính cung
  hoặc dùng node riêng; không dùng một offset cố định cho mọi kích thước góc.
- Mọi nhãn phải gắn chính xác với đối tượng mà nó biểu diễn và đặt gần sát đối
  tượng đó nhất có thể. Nhãn độ dài ưu tiên vùng giữa cạnh nhưng không bắt buộc
  đúng midpoint. Nếu vùng ưu tiên đã có tên điểm, marker, nét hoặc nhãn khác thì
  lần lượt trượt nhãn dọc chính cạnh trong vùng giữa, đổi phía pháp tuyến hoặc
  tăng khoảng hở cục bộ vừa đủ; tên điểm có thể đổi góc neo quanh chính điểm.
  Nếu vùng giữa trống thì đặt đúng giữa vẫn hợp lệ. Không để nhãn chồng/cắt nét
  hoặc trôi sang gần đối tượng khác làm sai liên thuộc. Khoảng hở tính theo cỡ
  chữ thích ứng của hình, không lấy cạnh dài viewBox khiến `3 cm`, `4 cm`, `r`,
  `h` trôi xa trên mobile.
- Nhãn trực tiếp trên cạnh, đoạn hoặc cung phải gọn: chỉ ghi giá trị/biểu thức và
  đơn vị như `3 cm`, `x + 1`, `r`, không lặp tên đối tượng thành `AB = 3 cm`.
  Tên điểm và số đo là hai nhãn riêng. Cấm viết câu hoặc phương trình quan hệ giữa
  các đối tượng đã đặt tên như `AB = CD`, `AB \\parallel CD`, `OA \\perp BC`
  trực tiếp trên canvas; quan hệ phải nằm trong nội dung chữ bên ngoài hình và,
  khi cần hiển thị, được mã hóa bằng phép dựng hoặc marker hình học chuẩn.
- Dấu vuông góc, vạch bằng nhau và marker hình học khác phải dùng chung coordinate
  neo với phép dựng. Dấu vuông theo hai tia thật bằng `\\pic` `right angle` hoặc
  hệ trục cục bộ tương đương; vạch bằng nhau nằm trực tiếp trên path và quay theo
  tiếp tuyến/pháp tuyến. Không vẽ marker bằng offset x/y tuyệt đối hoặc co giãn
  x/y không đồng nhất. Gate visual phải kiểm marker đúng hình/đúng neo và bounding
  box nhãn không giao nhau, cắt nét hoặc marker ở mọi hướng của đoạn.
- Marker đoạn bằng nhau phải mã hóa đúng từng nhóm quan hệ: các đoạn cùng nhóm
  dùng cùng kiểu và số vạch; hai nhóm độc lập dùng marker khác nhau, trừ khi dữ
  kiện có thẩm quyền khẳng định chúng thuộc cùng một nhóm. Không gộp hai nhóm chỉ
  vì mỗi nhóm đều do một quan hệ trung điểm tạo ra. Nếu mọi đoạn được khẳng định
  cùng bằng nhau thì dùng chung marker là đúng. Vạch chia trục/hệ trục, marker
  điểm dựng và đầu mút mở-đóng không phải marker đoạn bằng nhau.
- Các rule nhãn/marker trên áp dụng cho toàn bộ hình AI của hệ thống: hình
  Summary/StemFigure và hình đề, hình lời giải mở rộng hoặc hình lời giải vẽ lại
  của Quiz trong mọi prompt mặc định. Đây là rule sinh hình, không phải điều kiện
  backend được phép reject artifact: backend không chặn output AI vì marker song
  song, tên góc hoặc chữ quan hệ còn xuất hiện. Custom system prompt của Quiz là
  full override có chủ đích nên admin phải tự đưa lại rule trình bày muốn giữ; ảnh
  upload thủ công giữ nguyên nội dung do admin cung cấp và phải được duyệt bằng mắt.
- Trục số chỉ hiển thị một kí hiệu tại gốc: ưu tiên nhãn số `0`; không đồng thời
  lặp thêm tên điểm `O` tại cùng vị trí. Hệ trục Oxy làm ngược lại: ưu tiên `O`
  và bỏ nhãn `0` trùng nghĩa tại gốc.
- Trên trục số dài bị thu nhỏ theo chiều ngang ở mobile, tên điểm như `P`, `Q`,
  `C`, `D` phải dùng ngưỡng cỡ chữ riêng đủ đọc, không co cùng tỉ lệ với toàn bộ
  viewBox; tên vẫn neo sát theo phương vuông góc với đúng dấu điểm.
- Bộ nghiệm thu visual Toán phải có laptop, iPad, Chromium Mobile và WebKit/iPhone;
  mobile là cổng bắt buộc quan trọng nhất. Ngoài hình nền tảng, phải có ca phức tạp
  lớp 9 như tiếp tuyến–đường tròn, tứ giác nội tiếp và đường tròn nội tiếp tam giác.
- Screenshot riêng từng figure phải cô lập target khỏi mọi phần tử ngoài figure
  trước khi chụp; không chỉ ẩn `fixed`/`sticky`, vì control tuyệt đối hoặc overlay
  của shell vẫn có thể lọt vào mép ảnh. Sau khi chụp phải phục hồi DOM rồi mới
  chuyển figure tiếp theo. Ảnh có vật thể UI lạ dù hình toán đúng vẫn không đạt.
- Duyệt bằng mắt còn phải kiểm ngữ nghĩa SGK: sơ đồ thanh có tỉ lệ/nhãn phần đúng;
  lục giác đều không bị mô tả thành chỉ có hai trục đối xứng; góc đối tứ giác nội
  tiếp được gọi là bù nhau; tâm đồng hồ có chấm; trục đồ thị có đủ vạch/nhãn đơn
  vị để đọc các điểm đặc biệt. Test overlap pass không thay thế các kiểm tra này.

## 13. Quy trình làm UI để giảm sửa lại

Nên làm theo thứ tự:

1. UI shell/layout nền.
2. UI từng màn hình với mock data rõ ràng.
3. Review bằng browser; chụp screenshot nếu command có từ `screenshot`.
4. Polish theo feedback cụ thể.
5. Connect API thật sau khi UI ổn.

Không nên làm cùng lúc UI lớn, API, business logic và polish nếu chưa có nền ổn.

Nếu owner đưa ảnh/reference UI:

1. Lưu hoặc ghi chú reference trong `docs/ui-references/reference-notes.md`.
2. Tách rõ phần nên học theo: layout, spacing, màu, typography, component hoặc interaction.
3. Không copy y nguyên brand/asset của sản phẩm khác nếu không có quyền.
4. Áp dụng lại theo design system của dự án; changelog chỉ ghi trong workflow `/commit`.
5. Nếu reference là dashboard nhưng màn đang làm là auth/register/login, chỉ lấy style direction như màu, bo góc, card, icon, spacing và năng lượng thị giác; không biến auth flow thành dashboard giả.
6. Nếu owner nói reference là thiết kế mobile, ưu tiên mobile layout giống reference trước; không tự thêm chip chân trang, tab phụ hoặc bước phụ ngoài flow hiện có.

## 14. Lưu pattern UI đã được duyệt

Khi owner review UI và nói rõ kiểu như "ưng rồi", "ok rồi", "đúng ý rồi", "chốt UI này" hoặc "giữ style này", Codex phải xem đó là tín hiệu UI đã được duyệt.

Sau tín hiệu này:

1. Ghi pattern đã duyệt vào `docs/ui-references/approved-patterns.md`.
2. Ghi ngắn: context, điểm đã được duyệt, điểm cần tránh, màn hình/flow có thể tái sử dụng, screenshot/file liên quan nếu có.
3. Chỉ cập nhật `docs/11-ui-design-system.md` nếu owner chốt một nguyên tắc áp dụng rộng cho nhiều màn, ví dụ màu chủ đạo, spacing/card style chung, typography chung hoặc motion chung.
4. Không ghi mọi sở thích tạm thời thành rule toàn hệ thống.
5. Không cập nhật changelog trong task UI thường; changelog chỉ ghi trong workflow `/commit`.

Ví dụ phân loại:

- "Landing page này ưng rồi" -> ghi vào `approved-patterns.md` cho public landing page.
- "Sau này các card cứ dùng spacing và radius kiểu này" -> cập nhật `approved-patterns.md` và cân nhắc cập nhật design system.

## 15. Prompt UI nên dùng

```txt
Màn hình/component: <tên màn hình>
Người dùng chính: <student/parent/admin/public>
Mục tiêu: <người dùng cần làm gì>
Dữ liệu hiển thị: <các trường/chỉ số chính>
Hành động chính: <CTA hoặc workflow>
Cảm giác UI: <sáng/gọn/học tập/tin cậy/...>
Ưu tiên viewport: admin laptop-first; public/student/parent mobile-first
Thiết bị cần ổn: mobile, tablet/iPad, laptop/desktop
Ưu tiên hiệu năng: mượt trên mobile, phản hồi nhanh, độ trễ thấp
Phạm vi: chỉ UI với mock data / connect API / polish UI
Không làm: <những thứ ngoài MVP hoặc không muốn>
```
