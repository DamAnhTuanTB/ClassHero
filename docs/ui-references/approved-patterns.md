# Approved UI Patterns

File này lưu các pattern UI đã được owner xác nhận là đúng ý.

Chỉ ghi vào đây sau khi owner nói rõ kiểu như:

- "ưng rồi"
- "ok rồi"
- "đúng ý rồi"
- "chốt UI này"
- "giữ style này"

## Cách dùng

- Ghi pattern cụ thể theo màn hình, role hoặc flow.
- Không biến mọi feedback nhỏ thành design system toàn cục.
- Chỉ cập nhật `docs/11-ui-design-system.md` nếu owner chốt một nguyên tắc áp dụng rộng cho nhiều màn.
- Khi một UI được owner duyệt đồng thời tạo ra cách code có thể tái sử dụng, phải cập nhật thêm routing index `docs/ui-references/code-patterns.md` và file phù hợp trong `docs/ui-references/code-patterns/`.
- Ghi ngắn, dễ tái sử dụng cho lần làm UI sau.

## Template

```md
## <Screen/Flow> - <YYYY-MM-DD>

- Context: <public/student/parent/admin + màn hình/flow>
- Approved:
  - <điểm UI đã được owner chốt>
  - <layout/spacing/color/component/interaction đáng tái sử dụng>
- Avoid:
  - <điểm owner không thích hoặc đã sửa bỏ>
- Reuse for:
  - <màn hình/flow tương tự có thể áp dụng>
- Evidence:
  - Screenshot: `.codex/screenshots/<file>.png` nếu có
  - Files: `<path>` nếu hữu ích
```

## Auth UI Public Flow - 2026-07-09

- Context: `M2.4` public auth flow gồm đăng nhập, đăng ký học sinh, đăng ký phụ huynh, quên mật khẩu và đặt lại mật khẩu.
- Approved:
  - Desktop dùng split-screen rõ ràng: bên trái là vùng thương hiệu/visual học tập, bên phải là form sạch trên nền trắng. Không biến màn auth thành landing page dài hoặc dashboard giả.
  - Mobile dùng layout xếp dọc: brand ở đầu, headline lớn, câu phụ ngắn, hình minh họa nằm giữa vùng chào và form; form card nổi vừa đủ để dễ thao tác bằng ngón tay.
  - Tone tổng thể trẻ trung, sáng, học đường và thân thiện nhưng vẫn chuyên nghiệp; hợp cho cả học sinh và phụ huynh.
  - Mỗi flow có màu chủ đạo riêng để phân biệt vai trò/trạng thái: login dùng indigo/violet, student dùng sky/blue, parent dùng emerald/green, recovery dùng rose/orange.
  - Nền auth dùng gradient rất nhẹ kết hợp panel lớn bo góc, shadow mềm và ring mảnh; tránh nền quá đậm hoặc quá xám.
  - Brand `ClassHero` đặt nhỏ gọn nhưng rõ ở góc trên; slogan ngắn dưới brand giúp màn có tính sản phẩm thật.
  - Headline bên trái dùng display font, chữ rất đậm, 2 dòng rõ nhịp; phần keyword/role được tô màu accent cùng theme.
  - Copy phụ chỉ 1 câu ngắn theo cảm xúc/hành động, ví dụ tiếp tục học, bắt đầu hành trình, nắm tiến độ, quay lại lớp học.
  - Visual dùng minh họa học đường 3D/soft, trong suốt, cùng phong cách giữa các màn; login và student nên có cả bạn nam và bạn nữ để trung tính giới tính.
  - Hình minh họa cần căn với mảng màu loang phía dưới, không lệch khỏi nền blob; trên mobile phải giảm kích thước vừa đủ để không đè chữ/form.
  - Form dùng card trắng hoặc vùng trắng rõ ràng, ít trang trí, spacing thoáng, label đậm, input cao khoảng 54px, icon trái, border slate nhạt và focus ring theo màu theme.
  - CTA chính dùng gradient theo theme, full width, cao, chữ đậm, có shadow vừa phải; trạng thái pending/disabled phải rõ.
  - Select/checkbox/input phải là tương tác thật, có state/handler semantic rõ; ưu tiên shadcn/Radix khi ổn định, nhưng auth select trên mobile được dùng inline controlled button/listbox khi portal dropdown gây lỗi double-open.
  - Auth select chỉ mở bằng click/tap có chủ đích, không ép mở bằng `touchstart`/`pointerdown`; tap lại trigger khi đang mở phải đóng hẳn, icon mũi tên quay theo trạng thái mở/đóng.
  - Dropdown select trong auth dùng listbox nổi ngay dưới trigger, item đang chọn có nền xanh rõ vừa phải (`sky-500`) và chữ trắng; hover/focus item chưa chọn dùng xanh nhạt (`sky-100`) để không trùng selected state, mobile active có xanh nhạt đậm hơn.
  - Khi mở lại dropdown dài như năm sinh, danh sách tự cuộn nội bộ để option đang chọn xuất hiện trong khung nhìn, không kéo cả trang mobile nhảy vị trí.
  - Input/select trên mobile phải dùng font-size tối thiểu `16px` để tránh iOS tự zoom khi focus; desktop có thể thu nhỏ bằng breakpoint lớn.
  - Auth input cần chống browser suggestion/autofill chủ động bằng DOM name/id/type trung tính khi cần, không chỉ đặt `autocomplete="off"`.
  - Submit auth mock/client-side phải chặn submit HTML mặc định để không reload trang khi người dùng bấm CTA mà form chưa hợp lệ hoặc client JS chưa hydrate.
  - Validation dùng lỗi inline ngay dưới field, màu đỏ rõ nhưng không phá layout.
  - Nút phụ cạnh label trong form auth phải ngắn để không chật trên mobile; ví dụ dùng "Không có SĐT" thay vì câu dài khi ngữ cảnh đã rõ từ label.
  - Field định danh ở đăng nhập/quên mật khẩu dùng label `Tên đăng nhập/Số điện thoại`, placeholder `Vui lòng nhập`, icon trái dạng tài khoản/người dùng; icon điện thoại chỉ dùng cho ô số điện thoại riêng.
- Avoid:
  - Không dùng cùng một ảnh minh họa cho nhiều màn auth nếu người dùng dễ nhận ra bị trùng.
  - Không dùng ảnh một giới duy nhất cho login/student khi flow dành cho nhiều giới.
  - Không dùng giao diện native select cho auth nếu custom select hiện tại vẫn ổn định và đúng gu.
  - Không tự dựng dropdown custom thủ công kiểu `button + listbox` nếu chưa có lý do rõ về mobile/portal/hydration; nếu dùng custom, phải giữ semantic `listbox`/`option`, keyboard cơ bản, selected/hover/active state và auto-scroll selected item.
  - Không để màu hover trùng màu selected trong dropdown, không chỉ đổi mỗi màu chữ cho item đang chọn.
  - Không dùng text nút phụ quá dài khiến label/action trên mobile bị chật hoặc phải xuống dòng xấu.
  - Không để field ghép `Tên đăng nhập/Số điện thoại` dùng icon điện thoại thuần, vì dễ làm người dùng hiểu đây chỉ là số điện thoại.
  - Không để overlay/nền decorative bắt pointer khiến input/select/checkbox mất tương tác trên mobile.
  - Không debug lỗi mobile form bằng cách sửa từng control khi nhiều symptom cùng xuất hiện; trước hết kiểm tra hydration, dev origin và browser runtime.
  - Không để input auth dùng font-size dưới `16px` ở mobile/iOS.
  - Không để ảnh quá lớn, lệch blob, đè chữ hoặc làm form bị trôi khỏi vùng nhìn đầu tiên trên điện thoại.
  - Không đưa text kỹ thuật, roadmap, mock/API hint hoặc lời giải thích dài vào UI auth.
- Reuse for:
  - Các public onboarding flow có form ngắn/trung bình như đăng nhập, đăng ký, invite, verify account, forgot/reset password.
  - Các màn role-based entry cần cảm giác thân thiện, học đường và có visual minh họa.
  - Các UI form cần theme theo ngữ cảnh nhưng vẫn giữ chung component, spacing và interaction.
- Evidence:
  - Files: `apps/web/app/(auth)/layout.tsx`, `apps/web/components/common/auth/auth-route-layout.tsx`, `apps/web/features/auth/screens/`, `apps/web/components/common/auth/`, `apps/web/features/auth/auth-form-options.ts`, `apps/web/features/auth/auth-schemas.ts`, `apps/web/features/auth/utils/`, `apps/web/components/common/forms/`, `apps/web/components/common/ui/select/`.
  - Assets: `apps/web/public/images/auth/reference/auth-hero-login-inclusive-transparent.png`, `apps/web/public/images/auth/reference/auth-hero-student-inclusive-transparent.png`, `apps/web/public/images/auth/reference/auth-hero-recovery-transparent.png`.

## Admin Course CRUD M3.4 - 2026-07-11

- Context: `M3.4` admin learning path/chapter/lesson management, gồm danh sách lộ trình, chi tiết lộ trình, modal tạo/sửa, thùng rác/lưu trữ, xác nhận xóa và quản lý chương/buổi học.
- Approved:
  - Admin dùng layout làm việc gọn, dense vừa phải: sidebar cố định/collapsible, header rõ hành động chính, filter/list/table ở màn danh sách và detail riêng cho entity cha.
  - Flow phân cấp giữ đúng master-detail: danh sách chỉ quản lý lộ trình; trang chi tiết lộ trình hiển thị summary và quản lý chương/buổi học trong panel riêng.
  - Modal form dùng cấu trúc 3 vùng: header title-only có nút `X`, body giữa scroll, footer action luôn visible. Nút `X` phải căn giữa dọc với header.
  - Form admin dùng field primitive chung, icon trái, label đậm, validation inline, `mode: "onChange"`, không hiện lỗi pristine khi vừa mở modal.
  - Footer modal compact: mobile hai action cùng một hàng khi có hai action; desktop action co theo nội dung và canh phải. Button label luôn một dòng.
  - Màu action thống nhất theo vai trò: lưu/action chính dùng primary xanh, thêm buổi có success, xóa/destructive dùng đỏ, hủy/đóng dùng trung tính hoặc primary subtle.
  - Table/list responsive dùng row dạng grid: desktop giống bảng dễ quét, mobile chuyển thành các ô metadata có nhãn ngắn để không overflow ngang.
  - Status badge dùng component/mapping chung, không viết lại màu/label theo từng màn.
  - Summary detail dùng ảnh bên trái, metadata grid bên phải, mô tả full width bên dưới; dùng theme token để hỗ trợ light/dark.
  - Panel chương/buổi học hiển thị thứ bậc rõ: chapter là card cha, lessons nằm trong vùng con, có drag handle, selected/drop target state và action ngay tại item.
  - Empty/loading/error state viết như sản phẩm thật, có CTA hoặc retry phù hợp, không lộ chữ mock/technical.
  - Modal lưu trữ/thùng rác dùng selection state thật, bulk action footer chỉ hiện khi có item được chọn; từng item vẫn có action riêng.
- Avoid:
  - Không render form thường trực trong trang list/detail khi đây là CRUD admin; dùng modal đúng ngữ cảnh.
  - Không để toàn bộ modal scroll hoặc để footer/header trôi khỏi viewport.
  - Không top-align modal trên mobile, không để nút `X` lệch khỏi tâm header.
  - Không copy lại badge/action button với màu khác ở từng component.
  - Không đặt chỉ số entity con quá nhiều ở trang danh sách entity cha.
  - Không để button trong modal/table wrap chữ; nếu thiếu chỗ thì đổi layout/copy/padding.
  - Không dùng hard-code màu light-only trong admin M3.4; ưu tiên `theme-*` class hoặc CSS variable.
- Reuse for:
  - Các màn admin CRUD phân cấp như quiz/flashcard/test, discount, report moderation, notification/news admin.
  - Các form admin modal/drawer có upload, numeric money/order, select status hoặc destructive confirm.
  - Các detail page cần summary media + metadata grid + child entity manager.
- Evidence:
  - Files: `apps/web/features/admin/courses/screens/admin-courses-manager/index.tsx`, `apps/web/features/admin/courses/screens/admin-course-detail-manager/index.tsx`, `apps/web/components/admin/courses/editor-dialog-shell.tsx`, `apps/web/features/admin/courses/screens/admin-courses-manager/components/path-editor.tsx`, `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/chapter-editor.tsx`, `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/lesson-editor.tsx`, `apps/web/components/admin/courses/delete-confirm-dialog.tsx`, `apps/web/features/admin/courses/screens/admin-courses-manager/components/archived-paths-dialog.tsx`, `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/chapter-lesson-panel.tsx`, `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/learning-path-summary-panel.tsx`, `apps/web/features/admin/courses/screens/admin-courses-manager/components/learning-path-row.tsx`.

## Admin Lesson Document Upload - 2026-07-17

- Context: `M4.5` admin lesson document upload/status flow trong màn quản lý lộ trình/chương/buổi học.
- Approved:
  - Flow chính sau khi chốt ngày 2026-07-17: tạo buổi học bằng metadata thô trước, upload một PDF/tài liệu nguồn dài ở cấp lộ trình, rồi gán khoảng trang vào từng buổi học.
  - Hệ thống extract/OCR tài liệu nguồn theo từng trang trước; chunk theo lesson chỉ chạy sau khi admin gán page range.
  - UI gán trang hiển thị danh sách buổi học, mỗi dòng có `fromPage`/`toPage`, trạng thái xử lý và preview/warning nếu có.
  - Mỗi buổi học có hai action riêng: `Upload/Thay thế tài liệu gốc` và `Upload tài liệu bổ sung`.
  - Khi chưa có tài liệu chính, action tài liệu gốc là upload tài liệu gốc cho buổi; khi đã có tài liệu chính thì là thay thế.
  - Action `Upload tài liệu bổ sung` luôn tồn tại riêng cho mỗi buổi học để thêm phiếu bài tập, đáp án, ảnh công thức hoặc tài liệu tham khảo.
  - Upload lẻ tài liệu cho từng buổi học là supplemental document flow; không thay thế source PDF dài làm tài liệu chính.
  - Không đặt upload tài liệu trong modal tạo buổi học; tránh draft upload, file tạm, rollback và cleanup phức tạp trong MVP.
  - Có action quản lý tài liệu tổng ở cấp detail lộ trình hoặc panel chương/buổi; khi mở ra hiển thị source document, page status và mapping theo lesson.
  - Bulk upload nhiều file rồi gán mapping từng file vào buổi học không thuộc MVP hiện tại; chỉ cân nhắc sau khi source document page mapping ổn định.
- Avoid:
  - Không tạo draft upload session trong modal thêm buổi học nếu chưa có yêu cầu rõ.
  - Không upload nhiều file vào staging rồi bắt admin map file với lesson trong MVP.
  - Không chunk toàn bộ sách trước rồi đoán lesson; chunk phải theo page range đã được admin xác nhận.
  - Không trộn action upload/thay thế tài liệu gốc với action upload bổ sung; hai hành động phải có label/state/handler riêng.
  - Không để file đã upload nhưng chưa gắn lesson tồn tại âm thầm mà không có cleanup/status rõ.
  - Không để action upload nhìn bấm được nhưng thiếu pending/retry/error feedback.
- Reuse for:
  - Admin lesson document upload/status, admin quản lý tài liệu theo lesson, và các màn admin cần upload file cho entity con đã tồn tại.
- Evidence:
  - Files: `docs/implementation/M4.md`, `docs/ui-references/code-patterns/uploads.md`.

## Student Explore Courses - 2026-07-16

- Context: `M3.5` student course browsing UI, trọng tâm là màn Khám phá `/student/explore` và student shell/navigation dùng chung quanh màn này.
- Approved:
  - Màn học sinh dùng hướng mobile-first sáng, vui và rõ nhiệm vụ: nền xanh trời rất nhẹ, card trắng nổi bằng khoảng thở/border tinh tế thay vì shadow dày; dark mode vẫn có token riêng, không chỉ đảo màu thủ công.
  - Shell học sinh giữ desktop/laptop sidebar cố định và mobile bottom nav. Sidebar laptop dùng active pill xanh nhạt, icon Lucide lớn, padding item dày vừa phải, gap vừa đủ để dễ quét; mobile bottom nav dùng icon + label ngắn, trạng thái active rõ.
  - Header/search/filter đặt trước list, gồm ô tìm kiếm có icon, nút clear thật, select lớp/môn có state thật, focus ring nhẹ và không làm mobile bị zoom/nhảy layout.
  - Danh sách khóa học chia nhóm bằng ribbon section nổi bật nhưng không biến thành hero. Count hint dùng icon nhỏ và copy ngắn.
  - Course card dùng bố cục media trái, thông tin phải trên mobile; ảnh/minh họa môn học là tín hiệu thị giác chính nhưng không lấn át tên khóa học, badge môn/lớp/trạng thái.
  - Card có accent strip theo môn/khóa, badge trạng thái rõ, grade color theo lớp, title/description line-clamp, metadata bằng icon nhỏ và copy ngắn để quét nhanh.
  - Trạng thái enrolled/locked/trial/expiring có panel riêng: tiến độ + bài tiếp theo + CTA học, giá + CTA chi tiết, học thử + CTA học thử, sắp hết hạn. CTA có feedback bấm rõ, text một dòng và không giả thành công.
  - Progress dùng label, số phần trăm cùng nhịp size trên mobile, thanh progress có fill/marker sao nhẹ; animation chỉ trang trí nhỏ và có fallback khi reduced motion.
  - Empty state dùng copy sản phẩm thật và gợi ý hành động rõ, không lộ chữ mock/technical.
  - Light/dark theme phải đi qua class/token của student shell như `--student-screen-bg`, `student-soft-bold-text`, `student-mobile-border`, `student-filter-select-3d`, không hard-code một theme duy nhất trong từng component.
- Avoid:
  - Không làm màn học sinh thành dashboard SaaS xám/lạnh hoặc một màu; phải có năng lượng học tập qua icon, badge, progress, CTA và minh họa môn học.
  - Không dùng card lồng card quá nặng, shadow dày hoặc gradient quá nhiều trong list khóa học.
  - Không để filter/select/search chỉ là UI tĩnh; mọi control nhìn bấm được phải có state/handler thật.
  - Không để button CTA wrap chữ, card overflow ngang, badge chen title, hoặc progress percent mỗi card một size trên mobile.
  - Không copy y nguyên text/dữ liệu của màn Khám phá sang màn khác; chỉ reuse cấu trúc, nhịp màu, spacing, state và interaction.
- Reuse for:
  - Student course list, course detail summary, lesson entry/dashboard, leaderboard/profile learning summary và các màn học sinh cần list/filter/card/progress/CTA.
  - Parent course browsing hoặc progress summary nếu cần cảm giác thân thiện hơn, nhưng giảm độ vui và tăng độ tin cậy/gọn theo role parent.
  - Public course list/detail có thể mượn card/filter/progress direction, nhưng phải giữ SEO/crawlable text và CTA public rõ.
- Evidence:
  - Files: `apps/web/app/(student)/student-theme.css`, `apps/web/components/student/layout/student-shell.tsx`, `apps/web/features/student/explore/screens/explore-courses-screen/index.tsx`, `apps/web/features/student/explore/screens/explore-courses-screen/components/course-search-filter-panel.tsx`, `apps/web/features/student/explore/screens/explore-courses-screen/components/course-filter-select.tsx`, `apps/web/components/student/courses/explore-course-card.tsx`, `apps/web/components/student/courses/course-illustration.tsx`, `apps/web/components/student/courses/course-status-badge.tsx`, `apps/web/components/student/courses/course-subject-badge.tsx`, `apps/web/components/student/courses/course-progress-bar.tsx`, `apps/web/components/student/courses/empty-course-state.tsx`.

## Student Course Detail - 2026-07-16

- Context: `M3.5` student course detail UI tại `/student/courses/[slug]`, gồm summary khóa học, tiến độ học tập, lộ trình chương/buổi, trạng thái đang học/học thử/chưa mua và responsive mobile/laptop.
- Approved:
  - Detail course bám cùng visual system với màn Khám phá/Học tập: nền xanh trời nhẹ ở content, card trắng thoáng, gần như không dùng shadow xám, desktop/laptop giữ content `max-w-3xl` và không có right sidebar phụ.
  - Header luôn dùng cùng brand `ClassHero` đã chuẩn hóa. Mobile detail có icon back sát trái, logo/text sát icon, header full-width liền mạch không bo góc và giữ hiệu ứng trượt ẩn khi cuộn xuống, hiện lại khi cuộn lên; laptop vẫn có header sticky giống các màn học sinh khác.
  - Hero summary ưu tiên hình minh họa môn học lớn, title vừa phải, badge môn/lớp/trạng thái cùng hàng ổn định; trạng thái `Đang học` dùng icon play tròn đồng bộ màu xanh hiện tại.
  - Khóa chưa mua hiển thị badge `Chưa mua`, giá sale, giá gốc, phần trăm giảm và CTA `Mua ngay`; đồng thời ẩn card tiến độ học tập và ẩn phần trăm hoàn thành ở từng chương.
  - Card tiến độ chỉ hiện cho khóa đã có quyền học; gồm icon mục tiêu đỏ, title bớt đen đặc, phần trăm/thanh progress/marker sao đồng màu CTA, tên buổi học tách dòng riêng và không truncate.
  - Copy tiến độ đổi theo ngữ cảnh: bài đầu tiên, bài đang học, bài tiếp theo hoặc bài cuối cùng; CTA chính đổi giữa `Vào học` và `Học tiếp` theo đúng trạng thái.
  - Lộ trình dùng accordion chương có animation mượt, cho phép mở nhiều chương cùng lúc và không tự đóng chương khác. Chapter card có viền trái 3px theo màu chương; số chương nhỏ gọn, sát mép trái; icon đóng/mở sát mép phải để dành không gian cho tên chương.
  - Lesson list dùng timeline dọc nối các icon bằng gradient theo màu chương, có separator mảnh giữa các buổi, không có cột icon thừa bên phải. Icon trạng thái đặt ở đầu hàng, lesson CTA nhỏ gọn nằm bên phải chỉ cho buổi hiện tại/học thử.
  - Buổi học thử luôn có badge `Học thử`, icon play nằm trong vòng tròn và CTA `Vào học`. Trạng thái khóa chỉ xuất hiện ở buổi học, không đặt badge `Đang khóa` ở cấp chương.
  - Text dài phải wrap tự nhiên, không truncate tên buổi/tên chương quan trọng; nếu cần, đặt nhãn trạng thái ở dòng riêng và tên buổi ở dòng riêng với size lớn hơn.
- Avoid:
  - Không dựng header mobile thành card bo góc hoặc width không full; không dùng logo chữ tắt `CH` hay tự đổi màu/font brand.
  - Không đặt card phụ bên phải ở layout laptop của detail course nếu không có nhu cầu nghiệp vụ rõ.
  - Không để progress card có border xanh nhẹ hoặc box-shadow xám nặng khi màn đang theo style card phẳng.
  - Không dùng chấm tròn đen cho trạng thái học, không dùng icon radio/wifi cho bài có CTA `Vào học`; icon học phải là play trong vòng tròn.
  - Không truncate tên bài học trong card tiến độ hoặc timeline; không để CTA làm xô layout.
  - Không tự động collapse các chương khác khi mở một chương; không đặt khóa ở cấp chương khi khóa chỉ áp dụng cho buổi học.
- Reuse for:
  - Student lesson detail entry, course package detail, public/parent course detail khi cần summary + progress/price + curriculum.
  - Các màn học sinh có timeline bài học, chapter accordion, progress CTA hoặc trạng thái locked/trial/enrolled.
  - Các detail screen cần mobile header có back + brand đồng bộ và desktop sticky header trong student shell.
- Evidence:
  - Screenshot: `docs/ui-references/designs/student-course-detail/student-course-detail-mobile-v1.png`
  - Files: `apps/web/app/(student)/student/courses/[slug]/page.tsx`, `apps/web/features/student/courses/screens/student-course-detail-screen/index.tsx`, `apps/web/features/student/courses/screens/student-course-detail-screen/components/student-course-mobile-brand-bar.tsx`, `apps/web/features/student/courses/screens/student-course-detail-screen/components/student-course-detail-progress-card.tsx`, `apps/web/features/student/courses/screens/student-course-detail-screen/components/student-course-chapter-card.tsx`, `apps/web/features/student/courses/screens/student-course-detail-screen/components/student-course-lesson-row.tsx`, `apps/web/features/student/shared/student-courses-data.ts`, `apps/web/app/(student)/student-theme.css`.
