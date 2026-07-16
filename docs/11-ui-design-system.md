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
- Không tạo palette một màu; mỗi màn nên có nền trung tính, primary rõ và accent vừa đủ.
- Nếu cần thêm màu mới, thêm vào theme/token trước hoặc ghi rõ lý do trong final response/docs liên quan; changelog chỉ ghi trong workflow `/commit`.

### 3.1. Light/Dark theme

Hệ thống sẽ có chế độ chuyển theme sáng/tối. Khi làm UI mới hoặc sửa UI hiện có, Codex phải:

- Mọi UI mới hoặc UI được sửa phải hỗ trợ đầy đủ cả theme sáng và theme tối trong cùng phạm vi task. Không được chỉ làm đẹp ở một theme rồi bỏ theme còn lại; text, surface, border, shadow, icon, button, label, form control, modal, table, badge/status, loading/empty/error state và media/overlay phải được kiểm contrast/state ở cả hai theme.
- Không đổi màu sáng/tối thủ công rải rác trong từng component. Màu theme phải đi qua token/utility semantic dùng chung như `--theme-*`, class theme chung, hoặc variant đã được chuẩn hóa; chỉ hard-code màu ở lớp token trung tâm hoặc trường hợp trạng thái đặc biệt thật sự bất khả kháng và phải nêu rõ lý do.
- Ưu tiên semantic token/CSS variable hoặc class Tailwind có biến thể dark mode thay vì hard-code màu chỉ hợp light mode.
- Kiểm tra text, border, surface, shadow, icon, trạng thái success/warning/error/info và skeleton/loading vẫn đủ contrast ở cả light và dark.
- Tránh dùng ảnh, gradient, overlay hoặc shadow chỉ đẹp trên nền sáng; nếu dùng phải có fallback/variant cho dark mode.
- Với chart, badge, toast, form, table và dashboard/card, thiết kế state màu theo vai trò semantic để sau này đổi theme không phải sửa từng component.
- Nếu task chưa triển khai toggle theme thật, vẫn không được viết UI khóa cứng vào light-only style trừ khi có lý do rõ trong final response.

## 4. Typography

- Ưu tiên dễ đọc trên mobile.
- Heading rõ hierarchy, không quá to trong dashboard/tool surface.
- Body text đủ line-height để đọc bài học và lời giải.
- Không dùng negative letter-spacing.
- Không scale font bằng viewport width.
- Công thức Toán/Lý/Hóa phải có khoảng thở, không chen sát text.

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

## 7. Component rules

- Button dùng shadcn/ui `Button`.
- Text trong button không được xuống dòng trong mọi viewport. Button phải có `white-space: nowrap`/`whitespace-nowrap`; khi nhãn dài hoặc màn hẹp, ưu tiên chỉnh layout, độ rộng, padding, font size hoặc copy ngắn hơn thay vì cho chữ wrap.
- Mọi nút bấm và đường link có thể click được phải hiển thị `cursor: pointer`. Trạng thái không click được như disabled/loading phải dùng cursor đúng trạng thái (`not-allowed`, `wait`, `default` hoặc tương đương), không để người dùng hiểu nhầm là có thể bấm.
- Form dùng React Hook Form + Zod; nếu đã setup shadcn Form thì dùng shadcn Form.
- Trước khi tạo form, phải kiểm tra form chuẩn đã duyệt và reusable primitives: `apps/web/components/common/forms`, các form tương tự trong feature đang làm, và `docs/ui-references/approved-patterns.md`. Reuse/nâng cấp component sẵn có thay vì tạo input/select/textarea/button cùng chức năng với style khác.
- Checklist bắt buộc cho mọi form mới hoặc form được sửa: schema Zod đủ required/min/max/format; React Hook Form validate khi nhập/chọn; lỗi inline có copy rõ và đúng rule đang fail; submit invalid phải bị chặn bằng validation handler thay vì khóa nút modal; action button trong modal vẫn bấm được để hiện lỗi, chỉ disabled khi pending/saving hoặc thiếu prerequisite cứng; pending state có feedback; reset/default values đúng khi mở lại modal/drawer; không có control nhìn bấm được nhưng thiếu handler/state thật.
- Modal/drawer form khi mở mới phải sạch lỗi ở trạng thái chưa tương tác. Không hiện inline error ngay lúc mở modal chỉ vì default value còn thiếu; error chỉ hiện sau khi người dùng chạm/sửa field, bấm submit, hoặc sau lỗi nghiệp vụ của hành động lưu.
- Modal/drawer luôn căn giữa theo chiều dọc và chiều ngang trong viewport trên mobile, tablet và desktop. Không top-align modal ở mobile; khi nội dung dài, giữ modal trong `max-height` và chỉ cho vùng body giữa scroll.
- Tất cả modal/drawer phải có cấu trúc 3 vùng rõ ràng: phần trên chỉ là tiêu đề ngắn và nút icon `X` để đóng, không có mô tả/subtitle dưới title; phần giữa là nội dung; phần dưới là action chính/phụ. Chỉ phần nội dung ở giữa được scroll; header/footer phải gọn và luôn nằm trong tầm mắt người dùng trên mobile, tablet và desktop. Footer modal luôn có nút `Hủy` để thoát/hủy thao tác và action chính/destructive khi có. Trên mobile, nếu thật sự chỉ có một action thì nút full width; mặc định hai action nằm cùng một hàng hai cột. Trên laptop/desktop, button trong footer modal co theo nội dung (`max-content`/`w-auto`), không kéo full width, và thường canh về phía phải.
- Button trong modal/drawer phải đồng nhất màu theo vai trò action trên toàn bộ flow: action chính/lưu dùng cùng màu `primary`, mặc định là xanh dương `sky-600` với hover `sky-700` và chữ trắng; hủy/đóng dùng trung tính; destructive dùng đỏ. Không dùng primary màu đen/tối trong một modal nếu các modal cùng hệ đang dùng xanh dương, vì làm UI mất nhất quán và người dùng khó nhận diện hành động chính.
- Pattern form mặc định phải bám form chuẩn đã duyệt hoặc form tương tự đang chạy ổn trong dự án: dùng `mode: "onChange"`/`reValidateMode: "onChange"` và truyền `form.formState.errors.<field>` trực tiếp vào primitive field. Muốn modal không hiện lỗi lúc mở thì không gọi `trigger()` sau `reset()`; không tự bọc lỗi bằng `dirtyFields/touchedFields` nếu không có test/logic rõ.
- Với text input required, message "Nhập ..." chỉ được gắn với trạng thái rỗng sau khi trim. Nếu field có rule tối thiểu 2 ký tự trở lên, định dạng, khoảng giá trị hoặc kiểm tra trùng lặp, phải dùng message riêng tương ứng; không để người dùng đã nhập rồi vẫn thấy lỗi như chưa nhập.
- Text input required trong `apps/web` nên dùng helper validation chung như `requiredTrimmedText` để tách required/min/max message từ đầu. Nếu một field cần min length lớn hơn 1, helper phải nhận `minMessage` riêng; không dùng lại required message.
- Mọi ô input nhập liệu phải tắt gợi ý trình duyệt/autofill bằng cấu hình input chung; không dùng `autoComplete` semantic như `username`, `name`, `tel`, `street-address` hoặc `new-password` trong UI trừ khi owner yêu cầu rõ.
- Dialog, Drawer, Sheet, Tabs, Card, Table, Badge, Alert ưu tiên shadcn/ui.
- Icon button phải có `aria-label` hoặc tooltip nếu không hiển nhiên.
- Logo và text logo `ClassHero` là brand component dùng chung, không được tự dựng biến thể mới theo từng màn. Mọi header, app bar, auth brand, sidebar hoặc mobile bar khi cần hiển thị thương hiệu phải dùng cùng cấu trúc/logo/text/token đã có ở header chuẩn gần nhất, hiện là icon `GraduationCap` trên nền gradient `theme-brand` và chữ `Class`/`Hero` tách màu theo `--theme-brand-primary`/`--theme-brand-secondary`. Không dùng logo chữ tắt như `CH`, không đổi font, màu, khoảng cách hoặc icon brand nếu chưa có yêu cầu đổi brand toàn hệ thống.
- Loading, empty, error, disabled state phải được thiết kế cùng component/màn hình.
- Toast/notification ngắn hạn phải dùng thư viện toast chung của web app, hiện là `sonner`; không hand-roll toast cục bộ trong từng form/page.
- Toast phải giữ màu chủ đạo theo trạng thái trên nền/border/text, không chỉ ở icon: success dùng xanh lá, error dùng đỏ, warning dùng vàng/cam, info dùng xanh dương; icon phải có vùng/cột riêng và không được đè chữ; close button không được nổi lệch ra ngoài khối toast, không dùng biểu tượng trùng lặp với icon trạng thái và không làm toast quá thưa.
- Toast ngắn hạn chỉ hiển thị toast mới nhất; khi có toast mới, các toast cũ phải biến mất ngay thay vì xếp chồng bên dưới.
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
- Với action có độ trễ như submit quiz, lưu note, favorite, thanh toán, gửi chat AI: hiển thị pending/disabled state ngay khi người dùng thao tác.
- Dùng optimistic UI chỉ khi rollback an toàn và không ảnh hưởng nghiệp vụ nhạy cảm; không optimistic cho payment, auth hoặc dữ liệu cần xác nhận server nghiêm ngặt.
- Debounce search/filter/input gọi API liên tục; không gọi API mỗi ký tự nếu không cần.
- Paginate, infinite query hoặc virtualize list dài; không render toàn bộ danh sách lớn trên mobile.
- Prefetch data cho bước kế tiếp khi flow học rõ ràng, ví dụ bài tiếp theo hoặc detail sau khi user sắp mở.
- Tách component nặng theo route/feature; lazy load phần ít dùng như editor nặng, chart lớn, AI panel hoặc admin tool nếu phù hợp.
- Với trang có form/modal/drawer/editor/chart chỉ dùng sau thao tác của user, không kéo toàn bộ stack đó vào bundle tải đầu. Lazy-load dialog/form nặng, giữ screen list/detail ban đầu nhẹ nhất có thể.
- Khi mock data hoặc nối API thật, ưu tiên server render/initial data/placeholder data an toàn để màn đầu không giữ skeleton lâu. Không thêm mock latency mặc định trừ khi task đang test trạng thái loading.
- Route transition phải nhẹ: prefetch/cache khi hợp lý, chỉ tải chunk cần cho route đích, không để màn trắng, và tránh refetch lại dữ liệu đã có nếu cache còn đúng.
- Asset/font/image phải phục vụ mobile trước: không dùng ảnh quá lớn, không kéo nhiều font/weight, không tải chart/editor/media ngoài viewport hoặc chưa cần.
- API/data load phải trả đúng phần UI cần, phân trang/list limit rõ, tránh include/rich text/blob lớn ở màn chỉ cần metadata.
- Mọi output render lần đầu phải hydration-safe: không dùng formatter/sort phụ thuộc khác biệt server-client, `Date.now()`, `Math.random()` hoặc browser-only branch trong JSX đầu tiên; nếu browser/autofill chèn attribute ngoài ý muốn vào input, xử lý tại primitive thay vì để dev overlay làm người dùng tưởng app lỗi.
- Ảnh phải tối ưu kích thước, dùng responsive image, lazy load ảnh ngoài viewport và tránh ảnh quá lớn cho mobile.
- Không dùng animation trên thuộc tính gây layout/reflow nặng; ưu tiên transform/opacity.
- Tôn trọng `prefers-reduced-motion` khi thêm animation đáng kể.

Mobile UX rules:

- Touch target tối thiểu khoảng `44px` cho CTA, option quiz, tab, icon button quan trọng.
- Trạng thái bấm/tap phải rõ: pressed/active/loading/disabled.
- Form mobile phải ít ma sát: input label rõ, lỗi hiện gần field, keyboard type phù hợp, submit không bị che bởi keyboard/sticky footer.
- Trên iOS, mọi `input`, `textarea` và trigger nhập liệu/select trông như ô nhập phải dùng font-size tối thiểu `16px` ở mobile để tránh Safari/Chrome tự zoom khi focus; có thể giảm về size nhỏ hơn ở desktop bằng breakpoint lớn.
- Nếu form không muốn browser hiện gợi ý/autofill, không chỉ dựa vào `autocomplete="off"`; cần tránh DOM `name/id/type/label` dễ bị browser/password manager nhận diện, đồng thời vẫn giữ state/form library nhận field name thật.
- Control custom như select/checkbox phải dùng component semantic/thư viện ổn định, có state và handler thật. Khi gặp lỗi mobile, kiểm tra hydration/runtime/overlay pointer trước khi thay control bằng hướng khác.
- Select/dropdown không được ép mở bằng `touchstart`/`pointerdown` khi người dùng chỉ lướt qua; chỉ mở sau click/tap có chủ đích. Với form mobile đơn giản như auth, ưu tiên inline controlled button/listbox nếu portal dropdown tạo lỗi double-open trên touch viewport. Click/tap lại trigger khi đang mở phải đóng hẳn, và icon mũi tên phải phản ánh đúng trạng thái mở/đóng.
- Nút submit trong form mock/client-only nên có `preventDefault` rõ hoặc dùng intent handler riêng để tránh submit HTML mặc định làm reload trang khi client JS chưa hydrate.
- Với quiz/flashcard/test, thao tác chính phải nằm trong tầm ngón tay; tránh bắt user cuộn quá nhiều chỉ để submit/chuyển câu.
- Khi API chậm, ưu tiên skeleton, inline progress hoặc retry thân thiện thay vì màn hình trắng.

Local dev/browser guardrails:

- Khi test Next.js dev server trên điện thoại qua IP LAN, nếu console/server báo chặn `/_next/webpack-hmr` hoặc dev resource theo origin, cấu hình `allowedDevOrigins` cho IP LAN và restart server trước khi debug UI control.
- Nếu Safari ổn nhưng Chrome/Google iOS hiện Next hydration overlay trong khi tương tác vẫn chạy, kiểm tra khả năng browser/extension/app wrapper chèn attribute vào DOM trước hydration; không vội refactor UI control.
- Khi nhiều control cùng lỗi trên một thiết bị như select không mở, checkbox không đổi state, validation không hiện và submit bị reload, ưu tiên điều tra client JS hydration/runtime thay vì sửa từng control rời rạc.

Performance budget/checklist:

| Hạng mục         | Mục tiêu                                                        |
| ---------------- | --------------------------------------------------------------- |
| Core Web Vitals  | Hướng tới LCP tốt, CLS thấp, INP tốt trên mobile                |
| Route transition | Không trắng màn hình; có loading/skeleton nếu data chưa sẵn     |
| Mobile load      | Mọi đường load trên điện thoại phải nhẹ nhất có thể: cold load, transition, data, asset |
| Interaction      | Button/action đổi state ngay sau thao tác                       |
| List dài         | Có pagination/infinite/virtualization                           |
| Animation        | Nhẹ, ngắn, không block thao tác                                 |
| Bundle           | Không thêm thư viện nặng nếu shadcn/Tailwind/native API đủ dùng |

Khi làm UI phức tạp, Codex nên ghi rõ trong final response đã kiểm tra hoặc bỏ qua phần nào:

- mobile viewport,
- desktop viewport,
- loading/empty/error/disabled state,
- interaction latency/perceived response,
- browser/responsive check chỉ khi owner yêu cầu rõ; mặc định Codex dùng static/focused check và owner tự kiểm UI/tương tác,
- screenshot chỉ khi owner yêu cầu bằng command có từ `screenshot`.

## 11. Empty/loading/error states

Mỗi màn hình hoặc block có data fetching phải có:

- Loading state: skeleton hoặc spinner phù hợp layout.
- Empty state: nói rõ chưa có dữ liệu và CTA tiếp theo nếu có.
- Error state: message dễ hiểu và retry nếu hợp lý.
- Disabled state: action chưa dùng được phải có lý do hoặc tooltip/helper text.

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
- Không text tràn, overlap, button cắt chữ hoặc layout nhảy mạnh.
- Không hard-code khác API contract nếu API đã có trong `docs/05-api-contract.md`.
- Không thêm tính năng ngoài MVP.
- Theo preference của owner, Codex không tự kiểm browser/Playwright/responsive thật trừ khi owner yêu cầu rõ; mặc định dùng kiểm tĩnh/focused và để owner tự kiểm UI/tương tác trên app.
- Chỉ chụp/lưu screenshot khi owner yêu cầu bằng command có từ `screenshot`, ví dụ `/task-ui screenshot M3.4`. Khi chụp để owner review, lưu vào `.codex/screenshots/<subtask-or-screen>-<viewport>.png`.

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
