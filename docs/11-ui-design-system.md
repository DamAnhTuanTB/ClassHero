# UI Design System

Tài liệu này là nguồn gu thiết kế chính thức cho Codex khi làm UI. Mục tiêu là biến chữ "đẹp đúng ý" thành rule cụ thể để giảm vòng sửa lại.

Hiệu năng UI/mobile nằm ở file này; hiệu năng toàn hệ thống như API, database, worker, AI/RAG và observability nằm ở `docs/12-performance-and-observability.md`.

SEO cho landing, course public và các trang public indexable nằm ở `docs/13-seo-and-content-discovery.md`.

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

### Parent

- Gọn, tin cậy, ít nhiễu.
- Ưu tiên tiến độ con, thanh toán, thông báo, khóa học liên quan.
- Không dùng style quá trẻ con.

### Admin

- Utilitarian, dense vừa phải, dễ quét.
- Sidebar trái, header trên, bảng/filter/action rõ.
- Không dùng hero/marketing layout trong admin.

## 7. Component rules

- Button dùng shadcn/ui `Button`.
- Form dùng React Hook Form + Zod; nếu đã setup shadcn Form thì dùng shadcn Form.
- Mọi ô input nhập liệu phải tắt gợi ý trình duyệt/autofill bằng cấu hình input chung; không dùng `autoComplete` semantic như `username`, `name`, `tel`, `street-address` hoặc `new-password` trong UI trừ khi owner yêu cầu rõ.
- Dialog, Drawer, Sheet, Tabs, Card, Table, Badge, Alert ưu tiên shadcn/ui.
- Icon button phải có `aria-label` hoặc tooltip nếu không hiển nhiên.
- Loading, empty, error, disabled state phải được thiết kế cùng component/màn hình.
- Toast/notification ngắn hạn phải dùng thư viện toast chung của web app, hiện là `sonner`; không hand-roll toast cục bộ trong từng form/page.
- Toast phải giữ màu chủ đạo theo trạng thái trên nền/border/text, không chỉ ở icon: success dùng xanh lá, error dùng đỏ, warning dùng vàng/cam, info dùng xanh dương; icon phải có vùng/cột riêng và không được đè chữ; close button không được nổi lệch ra ngoài khối toast, không dùng biểu tượng trùng lặp với icon trạng thái và không làm toast quá thưa.
- Toast ngắn hạn chỉ hiển thị toast mới nhất; khi có toast mới, các toast cũ phải biến mất ngay thay vì xếp chồng bên dưới.
- Không fetch dữ liệu rải rác trong component sâu; dùng feature hook/API client.
- Mock data phải đặt rõ ràng, dễ xóa khi connect API.

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

UI của dự án là mobile-first nhưng phải ổn trên 3 nhóm:

- Mobile: `375px-430px`.
- Tablet/iPad: `768px-1024px`.
- Laptop/desktop: `1366px-1440px`.

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
Thiết bị cần ổn: mobile, tablet/iPad, laptop/desktop
Ưu tiên hiệu năng: mượt trên mobile, phản hồi nhanh, độ trễ thấp
Phạm vi: chỉ UI với mock data / connect API / polish UI
Không làm: <những thứ ngoài MVP hoặc không muốn>
```
