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

| Token | Mục đích | Gợi ý Tailwind |
| --- | --- | --- |
| `background` | Nền app chính | `slate-50` hoặc `white` |
| `foreground` | Text chính | `slate-950` |
| `muted` | Nền phụ/skeleton | `slate-100` |
| `muted-foreground` | Text phụ | `slate-500` |
| `border` | Border nhẹ | `slate-200` |
| `primary` | CTA chính/hành động học tập | `sky-600` hoặc `teal-600` |
| `primary-foreground` | Text trên primary | `white` |
| `accent` | Highlight tiến độ/streak/nhấn nhẹ | `amber-400` hoặc `emerald-500` |
| `success` | Thành công/hoàn thành | `emerald-600` |
| `warning` | Cảnh báo/chờ xử lý | `amber-500` |
| `error/destructive` | Lỗi/hành động nguy hiểm | `red-600` |

Nguyên tắc dùng màu:

- Nền chính: sáng, sạch, dễ đọc.
- Primary: xanh học tập hoặc xanh ngọc dịu, không quá gắt.
- Accent: dùng tiết chế cho trạng thái học tập, streak, progress, CTA phụ.
- Success/warning/error phải nhất quán, không dùng đỏ cho CTA thường.
- Không lạm dụng tím/xanh tím, beige, dark slate hoặc gradient làm theme chính.
- Không tạo palette một màu; mỗi màn nên có nền trung tính, primary rõ và accent vừa đủ.
- Nếu cần thêm màu mới, thêm vào theme/token trước hoặc ghi rõ lý do trong changelog.

## 4. Typography

- Ưu tiên dễ đọc trên mobile.
- Heading rõ hierarchy, không quá to trong dashboard/tool surface.
- Body text đủ line-height để đọc bài học và lời giải.
- Không dùng negative letter-spacing.
- Không scale font bằng viewport width.
- Công thức Toán/Lý/Hóa phải có khoảng thở, không chen sát text.

Scale mặc định:

| Context | Size gợi ý |
| --- | --- |
| Page title mobile | `text-2xl` |
| Page title desktop | `text-3xl` hoặc `text-4xl` nếu là public hero |
| Section title | `text-lg` hoặc `text-xl` |
| Card title | `text-base` hoặc `text-lg` |
| Body | `text-sm` hoặc `text-base` |
| Helper/caption | `text-xs` hoặc `text-sm` |

## 5. Spacing, radius, shadow

- Mobile: padding vừa đủ, không làm nội dung bị chật.
- Desktop: tận dụng chiều ngang nhưng không kéo content đọc dài quá mức.
- Card radius khoảng `8px` trừ khi shadcn mặc định khác.
- Shadow nhẹ, ưu tiên border/subtle background hơn shadow dày.
- Section không nên là card lớn lồng card; card dùng cho item, panel nhỏ, modal hoặc tool surface.

Spacing/radius mặc định:

| Pattern | Rule |
| --- | --- |
| Mobile page padding | `px-4 py-4` hoặc tương đương |
| Tablet page padding | `px-6 py-6` |
| Desktop page padding | `px-8 py-8`, content đọc nên có `max-w-*` |
| Card/panel padding | `p-4` mobile, `p-5` hoặc `p-6` desktop |
| Section gap | `gap-4` mobile, `gap-6` desktop |
| Radius | `rounded-lg` là mặc định; tránh radius quá lớn cho dashboard |
| Shadow | ưu tiên `border`; nếu cần dùng `shadow-sm` |

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
- Dialog, Drawer, Sheet, Tabs, Card, Table, Badge, Alert ưu tiên shadcn/ui.
- Icon button phải có `aria-label` hoặc tooltip nếu không hiển nhiên.
- Loading, empty, error, disabled state phải được thiết kế cùng component/màn hình.
- Không fetch dữ liệu rải rác trong component sâu; dùng feature hook/API client.
- Mock data phải đặt rõ ràng, dễ xóa khi connect API.

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

| Viewport | Pattern |
| --- | --- |
| Mobile `375px-430px` | Một cột, sticky CTA khi flow cần hành động liên tục |
| Tablet/iPad `768px-1024px` | Hai cột nhẹ hoặc sidebar phụ khi giúp đọc/học tốt hơn |
| Desktop `1366px-1440px` | Sidebar, split view, bảng/filter rõ; tránh content text quá rộng |

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
- Với quiz/flashcard/test, thao tác chính phải nằm trong tầm ngón tay; tránh bắt user cuộn quá nhiều chỉ để submit/chuyển câu.
- Khi API chậm, ưu tiên skeleton, inline progress hoặc retry thân thiện thay vì màn hình trắng.

Performance budget/checklist:

| Hạng mục | Mục tiêu |
| --- | --- |
| Core Web Vitals | Hướng tới LCP tốt, CLS thấp, INP tốt trên mobile |
| Route transition | Không trắng màn hình; có loading/skeleton nếu data chưa sẵn |
| Interaction | Button/action đổi state ngay sau thao tác |
| List dài | Có pagination/infinite/virtualization |
| Animation | Nhẹ, ngắn, không block thao tác |
| Bundle | Không thêm thư viện nặng nếu shadcn/Tailwind/native API đủ dùng |

Khi làm UI phức tạp, Codex nên ghi rõ trong final/changelog đã kiểm tra hoặc bỏ qua phần nào:

- mobile viewport,
- desktop viewport,
- loading/empty/error/disabled state,
- interaction latency/perceived response,
- screenshot hoặc browser check nếu chạy được app.

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
- Responsive cơ bản trên mobile, tablet/iPad và laptop/desktop.
- Tương tác chính trên mobile phản hồi nhanh, có pending/pressed/loading state rõ.
- Không dùng animation hoặc render list làm chậm thao tác học/chấm bài/submit.
- Có loading/empty/error/disabled state nếu màn hình có data/action.
- Không text tràn, overlap, button cắt chữ hoặc layout nhảy mạnh.
- Không hard-code khác API contract nếu API đã có trong `docs/05-api-contract.md`.
- Không thêm tính năng ngoài MVP.
- Nếu có thể chạy app, Codex chụp hoặc kiểm tra screenshot/browser ở ít nhất mobile và desktop; với layout phức tạp kiểm tra thêm tablet/iPad.
- Nếu chụp screenshot để owner review, lưu vào `.codex/screenshots/<subtask-or-screen>-<viewport>.png`.

## 13. Quy trình làm UI để giảm sửa lại

Nên làm theo thứ tự:

1. UI shell/layout nền.
2. UI từng màn hình với mock data rõ ràng.
3. Review bằng browser/screenshot.
4. Polish theo feedback cụ thể.
5. Connect API thật sau khi UI ổn.

Không nên làm cùng lúc UI lớn, API, business logic và polish nếu chưa có nền ổn.

Nếu owner đưa ảnh/reference UI:

1. Lưu hoặc ghi chú reference trong `docs/ui-references/reference-notes.md`.
2. Tách rõ phần nên học theo: layout, spacing, màu, typography, component hoặc interaction.
3. Không copy y nguyên brand/asset của sản phẩm khác nếu không có quyền.
4. Áp dụng lại theo design system của dự án và ghi changelog ngắn.

## 14. Lưu pattern UI đã được duyệt

Khi owner review UI và nói rõ kiểu như "ưng rồi", "ok rồi", "đúng ý rồi", "chốt UI này" hoặc "giữ style này", Codex phải xem đó là tín hiệu UI đã được duyệt.

Sau tín hiệu này:

1. Ghi pattern đã duyệt vào `docs/ui-references/approved-patterns.md`.
2. Ghi ngắn: context, điểm đã được duyệt, điểm cần tránh, màn hình/flow có thể tái sử dụng, screenshot/file liên quan nếu có.
3. Chỉ cập nhật `docs/11-ui-design-system.md` nếu owner chốt một nguyên tắc áp dụng rộng cho nhiều màn, ví dụ màu chủ đạo, spacing/card style chung, typography chung hoặc motion chung.
4. Không ghi mọi sở thích tạm thời thành rule toàn hệ thống.
5. Cập nhật changelog ngắn.

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
