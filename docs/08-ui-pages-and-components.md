# 08. UI Pages and Components - Màn hình và component

Tài liệu này mô tả danh sách màn hình và component chính cần có ở phía public, student, parent và admin.

Gu thiết kế, token UI, responsive rules và checklist nghiệm thu nằm ở `docs/11-ui-design-system.md`. Cấu trúc source code front-end nằm ở `docs/14-source-code-structure.md`. Khi làm UI, Codex phải đọc cả file này, `docs/11-ui-design-system.md` và `docs/14-source-code-structure.md`.

Trang public có mục tiêu xuất hiện trên Google phải đọc thêm `docs/13-seo-and-content-discovery.md`.

Nếu đã có pattern được owner chốt, Codex phải đọc thêm `docs/ui-references/approved-patterns.md`.

Front-end dùng Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query, Zustand, React Hook Form, Zod, Tiptap, KaTeX và mhchem.

---

## 1. Nguyên tắc UI

- UI phải tách theo role: public, student, parent, admin.
- Backend vẫn phải enforce permission, không chỉ dựa vào UI guard.
- Dữ liệu server dùng TanStack Query.
- Form dùng React Hook Form + Zod.
- State local nhỏ dùng Zustand.
- Rich text dùng Tiptap.
- Công thức Toán/Lý/Hóa render bằng KaTeX + mhchem.
- Các màn học nên ưu tiên rõ ràng, ít nhiễu, phù hợp học sinh.
- Ưu tiên viewport theo role: admin dùng laptop-first trước, sau đó đảm bảo tablet/iPad và mobile vẫn dùng được; public/student/parent dùng mobile-first trước, sau đó mở rộng layout cho tablet/iPad và laptop/desktop.
- Tablet/iPad phải có layout trung gian hợp lý, không chỉ phóng to mobile hoặc ép dùng desktop layout.
- Laptop/desktop vẫn phải dễ dùng: tận dụng chiều ngang cho sidebar, bảng, split view hoặc panel phụ khi phù hợp.
- Không tạo layout chỉ hoạt động tốt ở một nhóm thiết bị; các CTA, form, quiz, flashcard, test và payment phải dùng tốt trên mobile, tablet/iPad và laptop/desktop.

### 1.1. UI direction

Xem `docs/11-ui-design-system.md`.

### 1.2. Mobile-first responsive patterns

Xem `docs/11-ui-design-system.md`.

### 1.3. Component and state rules

Xem `docs/11-ui-design-system.md`.

### 1.4. UI acceptance checklist

Xem `docs/11-ui-design-system.md`.

### 1.5. Cách owner nên giao task UI

Để Codex code đúng gu nhanh hơn, prompt UI nên có:

```txt
Màn hình/component: <tên màn hình>
Người dùng chính: <student/parent/admin/public>
Mục tiêu: <người dùng cần làm gì>
Dữ liệu hiển thị: <các trường/chỉ số chính>
Hành động chính: <CTA hoặc workflow>
Cảm giác UI: <ví dụ: sáng, gọn, học tập, tin cậy>
Ưu tiên responsive: mobile-first, desktop vẫn đủ rộng/dễ quét
Thiết bị cần ổn: mobile, tablet/iPad, laptop/desktop
Không làm: <những thứ ngoài MVP hoặc không muốn>
```

---

## 2. Route structure đề xuất

```txt
apps/web/app/
├── (public)/
│   ├── page.tsx
│   ├── courses/page.tsx
│   └── courses/[id]/page.tsx
├── (auth)/
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── register/student/page.tsx
│   ├── register/parent/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── (student)/student/
│   ├── dashboard/page.tsx
│   ├── courses/page.tsx
│   ├── explore/page.tsx
│   ├── courses/[id]/page.tsx
│   ├── lessons/[lessonId]/page.tsx
│   ├── notifications/page.tsx
│   ├── profile/page.tsx
│   └── leaderboard/page.tsx
├── (parent)/parent/
│   ├── children/page.tsx
│   ├── dashboard/page.tsx
│   ├── courses/page.tsx
│   ├── courses/[id]/page.tsx
│   ├── payments/[paymentId]/page.tsx
│   └── notifications/page.tsx
└── (admin)/admin/
    ├── dashboard/page.tsx
    ├── courses/page.tsx
    ├── courses/[id]/page.tsx
    ├── lessons/[lessonId]/page.tsx
    ├── reports/page.tsx
    ├── discounts/page.tsx
    ├── notifications/page.tsx
    └── news/page.tsx
```

ASSUMPTION: URL có thể điều chỉnh theo design final, nhưng cần giữ rõ route theo role.

---

## 2.1. Screen implementation coverage

Các màn UI chính phải được map về task theo từng lớp để tránh thiếu UI/API/DB/worker. Khi owner giao một màn cụ thể, Codex dùng bảng này để xác định task UI, task API, task database và task integration liên quan.

| Màn/nhóm màn                              | Task UI                | Task API                          | Task DB                   | Task worker/integration                       | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------- | ---------------------- | --------------------------------- | ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public landing, public course list/detail | `M3.5`                 | `M3.3`                            | `M1.3`                    | -                                             | Tạm hoãn sang pass sau; pass hiện tại của `M3.5` ưu tiên student browsing trước. CTA mua/học thử nối thật ở `M8.4`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Login/register/forgot/reset password      | `M2.4`                 | `M2.2`, `M2.3`                    | `M1.2`                    | -                                             | Gồm session UI, form validation và forgot/reset flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Student course list/detail                | `M3.5`                 | `M3.3`                            | `M1.3`                    | -                                             | Chỉ browse/detail và trạng thái học thử/enrollment nếu API `M3.3` trả; CTA/payment thật nối ở `M8.4`, không kéo `M8.2`/`M8.3` vào `M3.5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Student lesson page skeleton              | `M7.1`                 | `M7.1`, `M6.5`                    | `M1.3`, `M1.4`            | `M4.4`, `M5.x` khi có tài liệu/AI             | Chỉ skeleton lesson; quiz/flashcard/test/AI tách task riêng.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Quiz runner                               | `M7.2`                 | `M7.2`                            | `M1.4`                    | `M9.5` nếu có giải thích AI                   | CRUD câu hỏi admin ở `M6.2`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Flashcard deck                            | `M7.3`                 | `M7.3`                            | `M1.4`                    | `M9.5` nếu có giải thích AI                   | CRUD flashcard admin ở `M6.3`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Test runner/review                        | `M7.4`                 | `M7.4`                            | `M1.4`                    | -                                             | CRUD đề kiểm tra admin ở `M6.4`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Student dashboard                         | `M7.7`                 | `M7.5`, `M10.1`, `M13.1`          | `M1.3`, `M1.4`, `M1.5`    | `M10.5`, `M13.1`                              | Notification/XP thật phụ thuộc `M10.x`, `M13.x`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Student notes/private comments            | `M7.6`                 | `M7.6`                            | `M1.4`                    | -                                             | Comment là private dưới video, không phải chat realtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Student smart video learning              | `M15.1-M15.7`          | `M15.1-M15.7`                     | `M15.1-M15.3`, `M15.7`    | `M3.8`, `M5.x`, `M9.x`                        | Ưu tiên sau core lesson/quiz/test. Gồm resume, watched progress, timestamp note, checkpoint/mastery, contextual AI, semantic search và adaptive review; không đổi completion rule `M7.5`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| AI chat panel                             | `M9.6`                 | `M9.6`                            | `M1.5`                    | `M4.4`, `M5.x`, `M9.1`                        | Chat chỉ theo context lesson bằng RAG.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Student profile                           | `M13.3`, `M13.4`       | `M13.3`, `M13.4`                  | `M1.2`                    | `M4.1` cho avatar upload                      | Profile base/auth user nằm ở `M2.3`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Student leaderboard                       | `M13.2`                | `M13.2`                           | `M1.5`                    | `M13.1`                                       | XP event/level tính trước ở `M13.1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Notification bell/list/page               | `M10.2`                | `M10.1`                           | `M1.5`                    | `M10.3`, `M10.5`, `M10.6`                     | `M10.2` chỉ UI đọc danh sách; realtime/email/Zalo tách task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Parent child link/selection               | `M11.1`                | `M11.1`                           | `M1.2`                    | -                                             | Một student chỉ liên kết một parent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Parent dashboard                          | `M11.2`                | `M11.2`, `M7.5`                   | `M1.2`, `M1.3`, `M1.4`    | -                                             | Dữ liệu tiến độ lấy theo selected child.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Parent course/payment pages               | `M11.3`, `M8.4`        | `M11.3`, `M8.2`, `M8.3`           | `M1.3`, `M1.5`            | payOS trong `M8.2`, `M8.3`                    | Parent thanh toán cho con đã liên kết.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Parent notifications/news                 | `M11.4`, `M12.5`       | `M10.1`, `M12.4`, `M12.5`         | `M1.5`                    | `M10.3`, `M10.6`                              | News/event/livestream public cho student/parent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Admin dashboard                           | `M13.5`                | `M13.5` hoặc API module liên quan | `M1.x` theo metric        | `M4.3`, `M10.5` nếu hiển thị job/notification | Cho phép placeholder với metric chưa có API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Admin video learning analytics            | `M15.8`                | `M15.8`                           | `M15.1`, `M15.3`, `M15.7` | aggregate pipeline tùy volume                 | Chỉ hiện metric tổng hợp theo lesson/chapter với ngưỡng riêng tư; không hiển thị raw surveillance log từng student.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Admin course/chapter/lesson management    | `M3.4`                 | `M3.1`, `M3.2`                    | `M1.3`                    | -                                             | Quản lý lộ trình, chương học tổng quan và buổi học. Modal lesson có select `Loại buổi học` mặc định `Học cơ bản`; chọn `Học live` mới hiện input `Link học live` optional.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Admin lesson document upload/status       | `M4.5`                 | `M4.2`                            | `M1.2`, `M1.3`            | `M4.1`, `M4.3`, `M4.4`                        | Course quản lý nhiều source PDF ngang hàng theo thứ tự upload cũ đến mới và hiện badge readiness. Modal lesson có nhiều khối `Tài liệu trích xuất` + range và nhiều file nền tảng trực tiếp; source select chỉ chứa nguồn đã xác nhận hết trang in, mặc định phần tử hợp lệ đầu tiên, hiển thị tên kèm tổng số trang, chặn realtime khi `Từ trang in` hoặc `Đến trang in` vượt số trang in lớn nhất, cùng-source range được validate không giao nhau realtime/API, thứ tự UI bám thứ tự thao tác. Tài liệu bổ sung và bài tập về nhà đều cho thêm nhiều file bằng cùng pattern dòng upload. |
| Admin quiz/flashcard/test CRUD UI         | `M6.2`, `M6.3`, `M6.4` | `M6.2`, `M6.3`, `M6.4`            | `M1.4`                    | `M6.1` content schema                         | Rich text/LaTeX dùng schema chung.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Admin AI generation panel                 | `M9.8`                 | `M9.2`, `M9.3`                    | `M1.4`, `M1.5`            | `M5.x`, `M9.1`                                | Front-end không gọi AI trực tiếp.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Admin report moderation                   | `M12.2`                | `M12.2`                           | `M1.5`                    | -                                             | Student tạo report ở `M12.1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Admin AI unreviewed content               | `M12.3`                | `M12.3`                           | `M1.5`                    | `M9.2`, `M9.3`                                | Duyệt nội dung AI trước khi dùng chính thức nếu cần.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Admin discount codes                      | `M8.5`                 | `M8.1`                            | `M1.5`                    | -                                             | Validation discount server-side trong `M8.1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Admin manual notifications                | `M10.4`                | `M10.4`                           | `M1.5`                    | `M10.3`, `M10.6`                              | In-app lưu DB; realtime/email/Zalo là kênh bổ sung.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Admin news/events/livestream              | `M12.4`                | `M12.4`                           | `M1.5`                    | -                                             | Student/parent xem ở `M12.5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Nếu thêm màn mới vào file này, phải cập nhật bảng trên, `docs/09-implementation-plan.md` và `docs/implementation/Mx.md` tương ứng.

---

## 3. Public pages

### 3.1. Trang chủ

Mục tiêu:

- Giới thiệu hệ thống học theo lộ trình.
- Dẫn đến danh sách lộ trình.
- Dẫn đến đăng nhập/đăng ký.

Component chính:

- Hero section.
- Course category preview.
- Benefits section.
- CTA đăng ký/học thử.
- Metadata-friendly content structure: một `h1`, section heading rõ, text thật dễ crawl.

### 3.2. Danh sách lộ trình public

Hiển thị:

- Lộ trình published.
- Filter theo môn/lớp.
- Card gồm tên, môn, lớp, giá, ảnh, trạng thái học thử.
- Chỉ index URL chính; filter/sort không tạo nhiều URL trùng nội dung nếu chưa có chiến lược canonical.

### 3.3. Chi tiết lộ trình public

Hiển thị:

- Tên lộ trình.
- Mô tả.
- Giá gốc/giá sau khuyến mãi.
- Danh sách chương học và buổi học metadata.
- CTA mua lộ trình hoặc học thử buổi đầu.
- Metadata, canonical, Open Graph và structured data nếu dữ liệu đủ rõ.

### 3.4. Đăng nhập/đăng ký/quên mật khẩu

Form:

- Login identifier + password.
- Register student.
- Register parent.
- Forgot/reset password.

Validation bằng Zod.

---

## 4. Student pages

### 4.1. Student dashboard

Hiển thị:

- Lộ trình đang học.
- Tiến độ gần đây.
- Bài học sắp tới.
- Thông báo mới.
- XP/level.

### 4.2. Danh sách lộ trình student

Hiển thị:

- `/student/courses`: chỉ hiển thị lộ trình học sinh đã mua/đang có enrollment, ưu tiên tiến độ, buổi tiếp theo và CTA vào học.
- `/student/explore`: hiển thị tất cả lộ trình published để học sinh khám phá thêm; route này là sibling của `/student/courses`, không lồng trong `courses`.
- Màn tất cả lộ trình có filter theo lớp và môn. Mặc định lớp chọn theo lớp của student, môn học chọn `Tất cả`.
- Trạng thái: chưa mua, đã mua/đang học, sắp hết hạn, học thử.
- CTA mua/học thử/vào học hoặc xem chi tiết theo trạng thái.

### 4.3. Chi tiết lộ trình student

Hiển thị:

- Tổng quan lộ trình.
- Enrollment status.
- Hạn còn lại nếu đã mua.
- Danh sách chương học và buổi học theo thứ tự.
- Trạng thái từng buổi: chưa học, đang học, hoàn thành, bị khóa.
- Nếu enrollment đang dùng bản cá nhân, hiển thị badge nhỏ `Lộ trình cá nhân`; URL/course card vẫn đại diện cho khóa gốc đã mua.
- Không hiển thị công cụ quản trị, source clone ID hoặc private slug cho student.

### 4.4. Trang buổi học student

Layout đề xuất:

```txt
Header: lesson title + breadcrumb
Main content:
  - Video bài giảng
  - Smart video toolbar: tiếp tục học, watched progress, ghi chú timestamp
  - Transcript/chapter panel: search, active cue, checkpoint, chapter mastery
  - Contextual actions: Hỏi đoạn này, Em chưa hiểu, xem lại đề xuất
  - Phiếu tài liệu trước buổi học
  - Tóm tắt bài học
  - Quiz section
  - Flashcard section
  - Test section
  - Notes section
  - Private video comments
  - AI chat panel
Sidebar:
  - Lesson navigation
  - Progress
  - Top 5 test leaderboard
```

Rules:

- Trước `exam_open_at`, test section hiển thị countdown hoặc thông báo chưa mở.
- Nếu không có quyền truy cập, hiển thị paywall/trial message.
- Chat AI chỉ có input text.
- Smart video controls chỉ hiện sau khi video/lesson foundation sẵn sàng; thiếu transcript thì ẩn tính năng phụ thuộc transcript nhưng không chặn player.
- Resume/progress/checkpoint/search dùng timeline sau cắt. UI không được coi seek-to-end là hoàn thành video.
- Recommendation phải hiện lý do ngắn và có action bỏ qua.

### 4.5. Quiz runner

Component:

- Question card.
- Multiple choice/true false/text input renderer.
- Formula renderer.
- Submit button.
- Result summary.
- Buttons: làm lại tất cả, làm lại câu sai, làm bộ khác.
- Inline explanation block.
- Report button từng câu.
- Favorite button từng câu.

### 4.6. Flashcard deck

Component:

- Card front/back.
- Flip animation.
- Buttons: đã thuộc, chưa thuộc.
- Summary: đã thuộc/chưa thuộc.
- Buttons: ôn lại tất cả, ôn lại câu chưa thuộc, học bộ khác.
- Inline explanation.
- Report/favorite từng card.

### 4.7. Test runner

Component:

- Timer.
- Question navigation.
- Answer form.
- Submit confirmation.
- Result page.
- Review page.
- Inline explanation chỉ sau submit.

Rules:

- Không hiển thị đáp án đúng trước submit.
- Không cho start trước giờ mở.
- Nếu hết giờ, TODO: chốt auto-submit hay cảnh báo. ASSUMPTION: MVP auto-submit khi hết giờ nếu answer state còn ở client.

### 4.8. AI chat panel

Component:

- Message list.
- Text input.
- Formula support text.
- Context badge nếu đi từ “Chat thêm với AI”.
- Refusal message khi ngoài scope.

Không có upload file/ảnh.

### 4.9. Notes và private comments

- Notes: rich text + ảnh.
- Private video comments: comment riêng của student trong lesson video.
- Không hiển thị comment của học sinh khác.

### 4.10. Profile

Student được đổi:

- Avatar.
- Username hiển thị/display name.
- Địa chỉ nhà.

Không được đổi:

- Ngày sinh.
- Họ tên.
- Giới tính.
- Số điện thoại.
- Email.

---

## 5. Parent pages

### 5.1. Children selection

Nếu parent có nhiều con:

- Hiển thị danh sách con.
- Parent chọn một con.
- Lưu selected child vào Zustand.

Nếu chỉ có một con, có thể tự chọn mặc định.

### 5.2. Link child page

Form:

- Nhập mã con.
- Submit link.

Error cases:

- Mã con không tồn tại.
- Học sinh đã có parent khác.
- User không phải student.

### 5.3. Parent dashboard

Hiển thị theo con đang chọn:

- Tiến độ lộ trình.
- Buổi học gần đây.
- Điểm bài kiểm tra tốt nhất.
- XP/level.
- Thông báo mới.

### 5.4. Parent course/payment pages

Parent xem lộ trình giống student nhưng context là con đang chọn.

Payment flow:

1. Chọn lộ trình.
2. Nhập mã giảm giá nếu có.
3. Xem số tiền.
4. Hiển thị QR/checkout.
5. Sau webhook paid, hiển thị enrollment đã mở khóa.

Nếu người con đang chọn học theo bản cá nhân, parent course/progress view hiển thị cùng cây nội dung hiệu lực và badge `Lộ trình cá nhân`; parent không có quyền chỉnh sửa.

---

## 6. Admin pages

### 6.1. Admin dashboard

Hiển thị:

- Số lộ trình.
- Số học sinh/phụ huynh.
- Payment gần đây.
- AI jobs gần đây.
- Reports đang mở.
- Worker/job status nếu có.

### 6.2. Course management

CRUD learning path:

- Tên.
- Môn.
- Lớp.
- Giá.
- Ảnh đại diện.
- Mô tả.
- Trial enabled.
- Status.

Course detail có khu vực `Học sinh đã mua`:

- Search/pagination enrollment của khóa.
- Hiển thị trạng thái `Đang học khóa gốc`, `Đang tạo bản cá nhân` hoặc `Đang học bản cá nhân`.
- Action `Tạo bản cá nhân` hoặc `Mở bản cá nhân`; không có action quay lại khóa gốc sau activation.
- Tạo bản cá nhân dùng confirmation modal nêu rõ bản mới không tự nhận thay đổi tương lai từ khóa gốc.
- Clone chạy nền có pending/progress/error/retry state; admin không được vào editor trước khi clone sẵn sàng.
- Editor bản cá nhân reuse course detail/chapter/lesson editor hiện có và luôn có banner riêng tư kèm tên học sinh, khóa nguồn và action quay lại enrollment.
- Bản cá nhân đang gắn enrollment không có action archive/delete root; admin sửa trực tiếp nội dung bên trong.

### 6.3. Chapter management

CRUD chapter:

- Title.
- Order index.
- Overview/short description.
- Objectives/focus points.
- Status.

Chapter không có video, tài liệu/PDF, summary, quiz, flashcard hoặc test riêng.

### 6.4. Lesson management

CRUD lesson:

- Title.
- Order index.
- Short description.
- Scheduled/exam open time.
- Video URL.
- Completion min score.
- Materials/documents.
- Optional source document page range nếu course đã có tài liệu nguồn: chọn source document, nhập page start/end, xem preview trang/text ngắn và cảnh báo range. Bỏ trống để chỉ lưu metadata buổi học trước; khóa input page range khi tài liệu nguồn chưa sẵn sàng hoặc còn trang cần xác nhận.
- Summary.
- Quiz.
- Flashcard.
- Test.

Màn chi tiết buổi học admin:

- Route chính: `/admin/lessons/[lessonId]`.
- Đây là workspace theo từng buổi học, không phải màn cấp course/chapter.
- Vào từ danh sách buổi học trong `/admin/courses/[id]`.
- Header có action `Chỉnh sửa buổi học`. Khi bấm, UI lazy-load và mở lại đúng modal sửa lesson đang dùng ở course detail; lưu thành công phải đóng modal và refresh metadata/video của lesson detail, không duy trì một form sửa thứ hai.
- Tab `Tài liệu` lazy-load và render lại đúng ba section upload đang dùng trong modal lesson (`Tài liệu nền tảng`, `Tài liệu bổ sung`, `Bài tập về nhà`), có action `Lưu tài liệu` và dùng chung schema/mutation/document manager; không tạo bộ field upload thứ hai chỉ giống về hình thức.
- Hiển thị metadata buổi học, trạng thái tài liệu/OCR/chunk của riêng buổi đó và các khu vực Summary, Documents, Quiz, Flashcard, Test.
- Khu vực video có panel `Bản chép lời video`: admin lấy caption công khai từ YouTube đã được lọc theo khoảng phát thực tế và ánh xạ về trục phát bắt đầu tại `0:00` sau khi cắt đầu/đuôi, xem rõ khoảng nguồn đang áp dụng, tìm trong transcript, thấy header `Tên chapter · timestamp`, chỉnh mốc thời gian/nội dung, bấm action phát để tua player tới đúng mốc sau cắt và lưu. Transcript lấy mới giữ nguyên từng cue với `offset`/`duration` gốc của YouTube; timestamp có thể có phần thập phân và độ dài các đoạn không cố định. Cue chứa thời gian player hiện tại là cue active duy nhất. Đoạn active có nền/viền primary và label cột đổi từ `Thời gian` sang `Đang phát` mà không thêm badge làm vỡ layout; danh sách tự cuộn nội bộ để giữ đoạn active gần giữa vùng nhìn, nhưng không tự cuộn lúc có từ khóa tìm kiếm. Cột action xếp dọc trên laptop và xếp ngang trên mobile. Khi tìm kiếm, kết quả vẫn giữ ngữ cảnh chapter. Panel dùng token/theme của dự án và responsive trên mobile.
- Course detail vẫn là nơi upload source PDF dài và xem status tài liệu theo buổi ở dạng gọn.
- Course detail có nút `Nhập khoảng trang` mở modal gán trang hàng loạt cho nhiều lesson; không nhét toàn bộ form nhập range dài vào màn chính.
- Modal tạo/sửa lesson và lesson detail là nơi gán/điều chỉnh page range tùy chọn của một lesson cụ thể để tránh thao tác vòng khi admin upload sách trước rồi mới tạo buổi học; phần nhập trang disabled tới khi source document xử lý xong và không còn page warning.
- Là nơi admin thêm thủ công, sửa, xóa mềm, ẩn/hiện, duyệt lại quiz/flashcard/test; nội dung do AI sinh sau M9.3 cũng được quản trị tại đây.

### 6.5. AI generation panel

Trong lesson detail `/admin/lessons/[lessonId]`, admin có panel/nút:

- Generate summary.
- Generate quiz.
- Generate flashcard.
- Generate test.
- Mỗi action dùng `lessonId` hiện tại và chỉ sinh từ OCR/chunks của đúng buổi học đó.
- Nếu OCR/chunk/embedding chưa sẵn sàng, nút phải disabled hoặc hiện trạng thái cần xử lý tài liệu trước.
- Xem job status.
- Xem output.
- Sửa output.
- Duyệt/ẩn.

### 6.6. Content editors

Dùng chung editor cho:

- Summary.
- Question.
- Options.
- Explanation.
- Flashcard front/back.
- News content.

Editor cần hỗ trợ:

- Text.
- Image insert.
- Math/chem formula.
- Basic formatting.

### 6.7. Report moderation

Hiển thị:

- Danh sách report.
- Filter theo status/target type.
- Target preview.
- Reporter.
- Reason/description.
- Action: sửa, ẩn, khôi phục, đánh dấu đã xử lý, reject.

### 6.8. AI unreviewed content

Admin xem các quiz/flashcard/test do AI tạo chưa duyệt.

Actions:

- Xem.
- Sửa.
- Duyệt.
- Ẩn.

### 6.9. Discount codes

CRUD mã giảm giá:

- Code.
- Type.
- Value.
- Start/end.
- Max uses.
- Active.

### 6.10. Manual notifications

Form:

- Title.
- Body.
- Recipient search/select.
- Channels.
- Send.

### 6.11. News/events/livestream

CRUD:

- Type.
- Title.
- Content.
- Cover.
- Starts/ends.
- Livestream URL.
- Status.

---

## 7. Source and shared component structure

Chi tiết bắt buộc nằm ở `docs/14-source-code-structure.md`. Tóm tắt cho UI:

- Route/page trong `apps/web/app` chỉ compose screen/layout; không chứa nhiều subcomponent/helper/schema/mock data.
- Feature UI đặt trong `apps/web/features/<feature>/` với các folder trách nhiệm như `screens/`, `hooks/`, `api/`, `data/`, `schemas/`, `types/`, `utils/`; component local nằm trong `screens/<screen>/components`.
- Component dùng lại nhiều màn đặt ở `apps/web/components`; component chỉ dùng riêng một màn đặt cạnh screen tương ứng.
- Mỗi file `.tsx` chỉ có một component implementation chính. Tránh tạo file barrel `index.ts` chỉ để re-export; import thẳng file thật khi có thể.
- Form/input/select/checkbox/button pattern đã được owner duyệt phải được tái sử dụng hoặc nâng thành shared component trước khi tạo biến thể mới.
- Mock data, option list, mapper/formatter/helper và schema phải tách khỏi JSX khi màn hình không nhỏ.
- Import nội bộ trong `apps/web` dùng `@/...`.

## 8. Shared components

```txt
AppShell
RoleGuard
AuthForm
CourseCard
LessonList
LessonStatusBadge
PaymentQRCode
DiscountCodeInput
NotificationBell
NotificationList
RichTextEditor
RichTextRenderer
FormulaRenderer
FileUploader
ImagePicker
VideoPlayer
QuizRunner
FlashcardDeck
TestRunner
AIExplanationBox
AIChatPanel
ReportDialog
FavoriteButton
TopTestLeaderboard
ProgressBar
XPLevelBadge
AdminDataTable
JobStatusBadge
```

---

## 9. Data fetching conventions

- Tạo API client wrapper trong `apps/web/lib/api-client.ts`.
- Dùng TanStack Query hooks theo feature:
  - `useLearningPaths`.
  - `useLesson`.
  - `useQuizSets`.
  - `useStartTestAttempt`.
  - `useNotifications`.
- Mutation phải invalidate query liên quan.
- Không gọi fetch rải rác trong component sâu nếu có thể tách hook.

---

## 10. Form conventions

- Mỗi form có Zod schema.
- Schema có thể đặt trong `packages/shared` nếu backend/frontend dùng chung.
- Error message tiếng Việt.
- Submit button có loading state.
- Hiển thị lỗi API rõ.

---

## 11. UI TODO

- TODO: Bổ sung pattern responsive riêng cho các màn hình phức tạp sau khi có UI thật.
- TODO: Chốt copywriting final theo từng role khi sản phẩm đi vào polish.
