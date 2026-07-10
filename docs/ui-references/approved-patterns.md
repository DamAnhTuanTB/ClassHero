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
  - Files: `apps/web/app/(auth)/layout.tsx`, `apps/web/features/auth/layout/`, `apps/web/features/auth/screens/`, `apps/web/features/auth/components/`, `apps/web/features/auth/data/`, `apps/web/features/auth/utils/`, `apps/web/components/forms/`, `apps/web/components/ui/select/`.
  - Assets: `apps/web/public/images/auth/reference/auth-hero-login-inclusive-transparent.png`, `apps/web/public/images/auth/reference/auth-hero-student-inclusive-transparent.png`, `apps/web/public/images/auth/reference/auth-hero-recovery-transparent.png`.
