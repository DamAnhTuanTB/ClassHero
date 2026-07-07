# 08. UI Pages and Components - Màn hình và component

Tài liệu này mô tả danh sách màn hình và component chính cần có ở phía public, student, parent và admin.

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
- Thiết kế UI theo mobile-first: ưu tiên trải nghiệm trên điện thoại trước, sau đó mở rộng layout cho laptop/desktop.
- Laptop/desktop vẫn phải dễ dùng: tận dụng chiều ngang cho sidebar, bảng, split view hoặc panel phụ khi phù hợp.
- Không tạo layout chỉ hoạt động tốt ở desktop; các CTA, form, quiz, flashcard, test và payment phải dùng tốt trên mobile.

---

## 2. Route structure đề xuất

```txt
apps/web/app/
├── (public)/
│   ├── page.tsx
│   ├── courses/page.tsx
│   ├── courses/[id]/page.tsx
│   ├── login/page.tsx
│   ├── register/student/page.tsx
│   ├── register/parent/page.tsx
│   └── forgot-password/page.tsx
├── (student)/student/
│   ├── dashboard/page.tsx
│   ├── courses/page.tsx
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

### 3.2. Danh sách lộ trình public

Hiển thị:

- Lộ trình published.
- Filter theo môn/lớp.
- Card gồm tên, môn, lớp, giá, ảnh, trạng thái học thử.

### 3.3. Chi tiết lộ trình public

Hiển thị:

- Tên lộ trình.
- Mô tả.
- Giá gốc/giá sau khuyến mãi.
- Danh sách buổi học metadata.
- CTA mua lộ trình hoặc học thử buổi đầu.

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

- Lộ trình theo lớp, ưu tiên lớp của student.
- Trạng thái: chưa mua, đã mua, hết hạn, học thử.
- CTA mua/học thử/vào học.

### 4.3. Chi tiết lộ trình student

Hiển thị:

- Tổng quan lộ trình.
- Enrollment status.
- Hạn còn lại nếu đã mua.
- Danh sách buổi học theo thứ tự.
- Trạng thái từng buổi: chưa học, đang học, hoàn thành, bị khóa.

### 4.4. Trang buổi học student

Layout đề xuất:

```txt
Header: lesson title + breadcrumb
Main content:
  - Video bài giảng
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

### 6.3. Lesson management

CRUD lesson:

- Title.
- Order index.
- Short description.
- Scheduled/exam open time.
- Video URL.
- Completion min score.
- Materials/documents.
- Summary.
- Quiz.
- Flashcard.
- Test.

### 6.4. AI generation panel

Trong lesson detail, admin có panel:

- Generate summary.
- Generate quiz.
- Generate flashcard.
- Generate test.
- Xem job status.
- Xem output.
- Sửa output.
- Duyệt/ẩn.

### 6.5. Content editors

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

### 6.6. Report moderation

Hiển thị:

- Danh sách report.
- Filter theo status/target type.
- Target preview.
- Reporter.
- Reason/description.
- Action: sửa, ẩn, khôi phục, đánh dấu đã xử lý, reject.

### 6.7. AI unreviewed content

Admin xem các quiz/flashcard/test do AI tạo chưa duyệt.

Actions:

- Xem.
- Sửa.
- Duyệt.
- Ẩn.

### 6.8. Discount codes

CRUD mã giảm giá:

- Code.
- Type.
- Value.
- Start/end.
- Max uses.
- Active.

### 6.9. Manual notifications

Form:

- Title.
- Body.
- Recipient search/select.
- Channels.
- Send.

### 6.10. News/events/livestream

CRUD:

- Type.
- Title.
- Content.
- Cover.
- Starts/ends.
- Livestream URL.
- Status.

---

## 7. Shared components

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

## 8. Data fetching conventions

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

## 9. Form conventions

- Mỗi form có Zod schema.
- Schema có thể đặt trong `packages/shared` nếu backend/frontend dùng chung.
- Error message tiếng Việt.
- Submit button có loading state.
- Hiển thị lỗi API rõ.

---

## 10. UI TODO

- TODO: Design system final: màu, typography, spacing.
- TODO: Chi tiết breakpoint/pattern responsive cho từng nhóm màn hình.
- TODO: Empty states và skeleton loading final.
- TODO: Nội dung copywriting final.
