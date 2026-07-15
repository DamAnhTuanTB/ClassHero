# Basic Auth API

## Tính năng này giải quyết gì?

`M2.2` thêm nền đăng ký và đăng nhập cho Student/Parent. `M2.3` bổ sung lớp bảo vệ API bằng JWT/RBAC, API xem/sửa hồ sơ cơ bản và luồng quên/đặt lại mật khẩu.

## Bức tranh tổng thể

Auth trong repo tách thành 2 loại token:

- Access token là JWT dùng về sau cho header `Authorization: Bearer ...`; TTL mặc định hiện tại là 30 ngày theo env.
- Refresh token là chuỗi ngẫu nhiên, TTL mặc định hiện tại cũng là 30 ngày. Backend chỉ lưu hash, không lưu raw token.
- Reset password token cũng là chuỗi ngẫu nhiên. Backend chỉ lưu SHA-256 hash trong `password_reset_tokens`.

Register chỉ tạo tài khoản và profile. Login mới cấp cặp access/refresh token.

`M2.4` thêm lớp UI auth và đã nối với API thật. UI vẫn giữ layout đã duyệt, nhưng phần submit dùng API client, TanStack Query mutation và session store thay cho mock handler.

## Luồng code end-to-end

1. Request đi vào `AuthController` ở route `/api/v1/auth/...`.
2. DTO trong `modules/auth/dto` validate body bằng `class-validator`.
3. `AuthService` chuẩn hóa email/username/phone, kiểm tra duplicate và hash password.
4. Prisma ghi `users`, `student_profiles` hoặc `parent_profiles`.
5. Khi login, service verify password rồi ký JWT access token.
6. Refresh token raw được sinh bằng `crypto.randomBytes`, hash SHA-256 rồi lưu vào `refresh_tokens`.
7. Khi refresh, backend tìm token hash, kiểm tra chưa revoke/chưa hết hạn, revoke token cũ và tạo token mới.
8. API cần đăng nhập đi qua `JwtAuthGuard`: verify JWT, kiểm tra user còn active trong database, rồi gắn `request.user`.
9. API cần role cụ thể đi qua `RolesGuard` và `@Roles(...)`; sai role trả `403`.
10. Response đi qua global API envelope thành `{ data, meta }`.
11. Với UI `M2.4`, route Next.js render từng form public, React Hook Form validate bằng Zod, rồi TanStack Query mutation gọi API thật qua `apiRequest`.
12. Login thành công lưu access token, refresh token và user vào Zustand store, đồng thời persist vào `localStorage` hoặc `sessionStorage` theo lựa chọn "Ghi nhớ đăng nhập".
13. Register student/parent gọi endpoint tạo tài khoản thật; khi thành công UI hiển thị toast rồi redirect về `/login`. Forgot password gửi tên đăng nhập/số điện thoại, họ tên và khối lớp; nếu 3 thông tin khớp database thì API trả reset token để UI chuyển ngay sang bước đổi mật khẩu, còn mismatch trả lỗi cho toast. Reset password dùng token đó hoặc token từ URL/email nếu có.

## Front-end

Các route UI auth hiện có:

- `/login`: form identifier + password cho Student/Parent/Admin.
- `/register/student`: form tạo tài khoản học sinh theo body `POST /auth/register/student`.
- `/register/parent`: form tạo tài khoản phụ huynh theo body `POST /auth/register/parent`.
- `/forgot-password`: form giữ đủ các ô đã duyệt gồm tên đăng nhập/số điện thoại, họ tên và khối lớp; submit gửi cả 3 field vào API, thông tin khớp thì chuyển sang form "Đổi mật khẩu", không khớp thì hiển thị toast lỗi.
- `/reset-password`: form token + mật khẩu mới, đọc token từ query email reset nếu có, gọi API thật và quay lại login sau khi đổi mật khẩu.

UI tách thành:

- route/page trong `apps/web/app/(auth)/...`,
- layout chung trong `apps/web/app/(auth)/layout.tsx`, với implementation visual/form frame ở `apps/web/features/auth/layout/`,
- form client cấp màn hình trong `apps/web/features/auth/screens/`, export qua `apps/web/features/auth/index.ts`,
- field/helper/option nội bộ lần lượt nằm trong `apps/web/features/auth/components/`, `apps/web/features/auth/utils/`, `apps/web/features/auth/data/`,
- Zod schema trong `apps/web/features/auth/schemas/`,
- auth API wrappers trong `apps/web/features/auth/api/`,
- auth session store trong `apps/web/features/auth/session/`,
- protected route guard dùng chung trong `apps/web/features/auth/components/authenticated-route-guard.tsx` và hook `useAuthGuard`,
- guest route guard trong `apps/web/features/auth/components/guest-route-guard.tsx` để chặn user đã đăng nhập quay lại login/register/forgot/reset,
- API envelope/error parser dùng chung trong `apps/web/lib/api-client.ts`,
- TanStack Query provider trong `apps/web/app/providers.tsx`.

Parent register không hiển thị email theo UI đã duyệt. API nhận `phone`, `password`, `fullName` là phần bắt buộc; `email` optional cho client tương lai nhưng không được dùng để ép UI hiện tại đổi flow.

## Back-end/API

Các endpoint thuộc `M2.2`:

- `POST /auth/register/student`
- `POST /auth/register/parent`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Các endpoint/lớp thuộc `M2.3`:

- `GET /me`
- `PATCH /me/student-profile`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser`

## Database

Các bảng dùng lại từ `M1.2`:

- `users`: role, identifier, password hash, trạng thái tài khoản.
- `student_profiles`: grade và `child_code` để phụ huynh liên kết con.
- `parent_profiles`: hồ sơ phụ huynh nền.
- `refresh_tokens`: chỉ lưu `token_hash`, `expires_at`, `revoked_at`.
- `password_reset_tokens`: chỉ lưu `token_hash`, trạng thái used/revoked và thời hạn ngắn.
- `audit_logs`: ghi lại request reset password, reset hoàn tất và cập nhật profile.

## Worker/AI/Integration

M2.3 chưa thêm worker email riêng. Với UI quên mật khẩu đã duyệt, API xác minh 3 field rồi trả reset token raw một lần cho client để đổi mật khẩu inline; database chỉ lưu hash của token. Luồng email qua Resend vẫn có helper trong service cho trường hợp sau này cần khôi phục qua email, nhưng không được dùng để đổi UI hiện tại.

## Kỹ thuật cần nhớ

- API response luôn qua envelope `{ data, meta }`, nên front-end dùng `apiRequest<T>()` để lấy đúng `data` và chuyển error envelope thành `ApiRequestError`.
- Auth mutation dùng TanStack Query để có pending/error state rõ. Không optimistic UI cho auth vì đây là flow bảo mật và cần server xác nhận.
- Login token raw chỉ nên lưu phía client sau khi API trả thành công. Store hiện tại dùng Zustand cho state runtime và browser storage cho persistence theo lựa chọn ghi nhớ đăng nhập.
- Khi `/task-connect` một UI đã được owner duyệt, API/client phải thích nghi với UI đó. Không tự thêm field hoặc xóa field trên form chỉ vì DTO hiện tại chưa khớp; nếu contract thiếu thì sửa contract/API hoặc map payload rõ ràng.
- Password không được lưu plain text; repo dùng `scrypt` với salt riêng khi tạo tài khoản mới.
- Seed dev cũ cũng dùng format `scrypt`, nên AuthService vẫn verify được user seed.
- Refresh token raw chỉ trả cho client một lần. DB chỉ giữ SHA-256 hash để nếu DB lộ cũng không dùng trực tiếp được token.
- Refresh token rotation giúp token cũ bị vô hiệu hóa ngay sau khi đổi token mới.
- Reset password token raw cũng không lưu DB. Khi reset thành công, backend set `used_at` và revoke toàn bộ refresh token cũ của user.
- Với forgot password dùng họ tên để xác minh, backend chuẩn hóa tên bằng trim, gộp khoảng trắng, chuẩn Unicode và lower-case tiếng Việt trước khi so sánh. Vì vậy user nhập sai hoa/thường vẫn hợp lệ, nhưng thiếu dấu hoặc sai ký tự vẫn bị từ chối.
- RBAC phải nằm ở backend guard/service, không được chỉ ẩn nút trên UI.
- Protected route trên client không được tự vá từng màn. Dùng `AuthenticatedRouteGuard` ở route-group layout cho role lớn như admin/student/parent, và dùng `useAuthGuard({ allowedRoles, authError })` trong hook màn hình khi cần bắt thêm lỗi API 401/403 từ TanStack Query.
- Phân biệt lỗi auth trên client: thiếu session hoặc 401/token hết hạn thì clear session vì token không dùng được nữa; sai role/403 thì redirect khỏi route không hợp lệ, nhưng không nhất thiết xóa token nếu session vẫn hợp lệ cho role khác.
- `apps/web/app/providers.tsx` có QueryCache/MutationCache bắt lỗi 401 hết hạn token ở mức toàn cục. Nhờ vậy mutation như tạo/sửa/xóa cũng không phải tự viết logic clear session riêng.
- Auth route cũng cần guard ngược. `GuestRouteGuard` bọc toàn bộ `(auth)` nên user đã đăng nhập không quay lại `/login`, `/register/student`, `/register/parent`, `/forgot-password` hoặc `/reset-password`; guard gọi `GET /me` để xác thực token với backend trước khi redirect theo role.
- Không chỉ tin vào việc browser storage có token. Client có thể đọc `exp` trong JWT để clear token hết hạn sớm, nhưng token còn hạn vẫn phải được backend xác nhận qua `/me` khi dùng nó để quyết định chuyển khỏi màn auth.
- Với NestJS chạy bằng `tsx` trong dev, không nên phụ thuộc hoàn toàn vào `design:paramtypes` metadata cho DTO validation hoặc dependency injection. Auth controller dùng `createDtoValidationPipe(DtoClass)` để truyền DTO class trực tiếp cho `ValidationPipe`, còn guard/service/controller dùng `@Inject(...)` cho dependency quan trọng.
- Với auth form trên mobile/iOS, không nên tự dựng dropdown bằng `button + listbox` nếu thư viện UI đã có control tương ứng. Ưu tiên shadcn/Radix Select để có hành vi focus, portal, keyboard và touch ổn định hơn. Nếu Safari iOS không kích hoạt `click` ổn định trên trigger custom, giữ Radix Select nhưng điều khiển `open` chủ động bằng touch/pointer handler; không quay về giao diện native khi owner đã chốt custom UI.
- Nếu text input vẫn nhập được nhưng checkbox/select custom/validate/submit đều không chạy và form bị reload, cần nghi ngờ client JS chưa hydrate trên thiết bị đó. Với Next dev local trên iPhone, ưu tiên chạy webpack dev server thay vì Turbopack dev để giảm rủi ro chunk dev/HMR không chạy trên iOS; đây là vấn đề dev runtime, không phải lỗi riêng từng form control.
- Khi test Next dev từ iPhone qua IP LAN, nếu terminal báo chặn `/_next/webpack-hmr` từ IP của máy dev, thêm IP LAN vào `allowedDevOrigins` trong `next.config.ts` và restart dev server. Repo đang tự lấy IPv4 LAN của máy khi server khởi động để tránh lỗi này khi đổi Wi-Fi/IP.
- Nếu Safari ổn nhưng Chrome/Google iOS hiện Next dev overlay `A tree hydrated...` trong khi tương tác vẫn chạy, cần kiểm tra browser có chèn attribute lạ vào HTML trước hydration hay không. Với auth form ở local dev, repo dùng một dev-only hydration boundary để không SSR form controls ban đầu; production vẫn render bình thường.
- Nút hành động chính trong auth form phải là submit button thật (`type="submit"`) để phím Enter trong input một dòng đi cùng luồng như click CTA. Không gắn handler global cho Enter; ô nhiều dòng `textarea` phải giữ hành vi Enter để xuống dòng, không kích hoạt submit.

## Luồng lỗi thường gặp

- Nếu request auth thiếu field bắt buộc trả `500` thay vì `400 VALIDATION_ERROR`, kiểm tra controller đã dùng `createDtoValidationPipe(DtoClass)` chưa. Khi DTO validation không chạy, body thiếu field có thể đi thẳng vào service và gây lỗi kiểu `undefined.trim()`.
- Nếu route có `RolesGuard` trả `500` với lỗi `getAllAndOverride` trên `undefined`, kiểm tra guard có inject `Reflector` bằng `@Inject(Reflector)` chưa. Trong dev runtime thiếu metadata, constructor DI không explicit có thể nhận `undefined`.
- Nếu màn protected hiện error state như "Chưa tải được danh sách" sau khi để máy lâu, kiểm tra access token đã hết hạn chưa. Đúng flow là Query/Mutation nhận 401, provider clear session, route guard đưa về `/login`; không để từng feature tự kiểm `statusCode === 401` rải rác.
- Nếu đã đăng nhập mà browser Back hoặc gõ tay `/login`/`/register/...` vẫn thấy form auth, thiếu guard ở `(auth)/layout.tsx`. Đúng flow là auth layout kiểm session, gọi `/me`, rồi redirect user hợp lệ về màn theo role.

## File quan trọng

- `apps/api/src/common/validation/validation-error.ts`
- `apps/api/src/common/auth/roles.guard.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/profile.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/dto/*.ts`
- `apps/api/src/common/auth/*.ts`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/(auth)/layout.tsx`
- `apps/web/app/(auth)/register/student/page.tsx`
- `apps/web/app/(auth)/register/parent/page.tsx`
- `apps/web/app/(auth)/forgot-password/page.tsx`
- `apps/web/app/(auth)/reset-password/page.tsx`
- `apps/web/features/auth/screens/`
- `apps/web/features/auth/api/`, `components/`, `data/`, `schemas/`, `session/`, `layout/`, `utils/`
- `apps/web/features/auth/components/authenticated-route-guard.tsx`
- `apps/web/features/auth/components/guest-route-guard.tsx`
- `apps/web/features/auth/session/use-auth-guard.ts`
- `apps/web/features/auth/session/auth-session-errors.ts`
- `apps/web/lib/api-client.ts`
- `apps/web/app/providers.tsx`
- `docs/api/auth-profile.md`

## Task liên quan

- `M2.2`: Register, login, refresh và logout.
- `M2.3`: RBAC, `GET /me`, profile base và forgot/reset password.
- `M2.4`: Auth UI login/register/forgot/reset password.
