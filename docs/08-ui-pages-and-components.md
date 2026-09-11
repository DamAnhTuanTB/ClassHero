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

| Màn/nhóm màn                              | Task UI                                                    | Task API                                                          | Task DB                                                                 | Task worker/integration                       | Ghi chú                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public landing, public course list/detail | `M3.5`                                                     | `M3.3`                                                            | `M1.3`                                                                  | -                                             | Tạm hoãn sang pass sau; pass hiện tại của `M3.5` ưu tiên student browsing trước. CTA mua/học thử nối thật ở `M8.4`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Login/register/forgot/reset password      | `M2.4`                                                     | `M2.2`, `M2.3`                                                    | `M1.2`                                                                  | -                                             | Gồm session UI, form validation và forgot/reset flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Student course list/detail                | `M3.5`                                                     | `M3.3`                                                            | `M1.3`                                                                  | -                                             | Chỉ browse/detail và trạng thái học thử/enrollment nếu API `M3.3` trả; CTA/payment thật nối ở `M8.4`, không kéo `M8.2`/`M8.3` vào `M3.5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Student lesson page                       | `M7.1-M7.5`                                                | `M7.1-M7.5`, `M6.5`                                               | `M1.3`, `M1.4`                                                          | `M4.4`, `M5.x` khi có tài liệu/AI             | Core learning Done; tab Bài học mở summary, có previous/next và panel Quiz/Flashcard/Test dùng API thật.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Quiz runner                               | `M7.2`                                                     | `M7.2`                                                            | `M1.4`                                                                  | `M9.5` nếu có giải thích AI                   | Done; hint/check local tức thì không gọi API từng câu, batch submit, explanation chủ động, review/retry tất cả hoặc câu sai.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Flashcard deck                            | `M7.3`                                                     | `M7.3`                                                            | `M1.4`                                                                  | `M9.5` nếu có giải thích AI                   | Done; panel vào bài dùng CTA Bắt đầu/Tiếp tục/Xem lại, runner và kết quả toàn màn hình đồng nhất Quiz, progress/favorite, review tất cả/chưa thuộc/yêu thích.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Test runner/review                        | `M7.4-M7.5`                                                | `M7.4-M7.5`                                                       | `M1.4`                                                                  | -                                             | Done; prerequisite gate, timer, review, auto-completion khi submit đạt và Top 5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Student dashboard                         | `M7.7`                                                     | `M7.5`, `M10.1`, `M13.1`                                          | `M1.3`, `M1.4`, `M1.5`                                                  | `M10.5`, `M13.1`                              | Notification/XP thật phụ thuộc `M10.x`, `M13.x`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Student notes/private comments            | `M7.6`                                                     | `M7.6`                                                            | `M1.4`                                                                  | -                                             | Comment là private dưới video, không phải chat realtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Student smart video learning              | `M15.1-M15.7`                                              | `M15.1-M15.7`                                                     | `M15.1-M15.3`, `M15.7`                                                  | `M3.8`, `M5.x`, `M9.x`                        | Ưu tiên sau core lesson/quiz/test. Gồm resume, watched progress, timestamp note, checkpoint/mastery, contextual AI, semantic search và adaptive review; không đổi completion rule `M7.5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| AI chat panel                             | `M9.6`                                                     | `M9.6`                                                            | `M1.5`                                                                  | `M4.4`, `M5.x`, `M9.1`                        | Chat chỉ theo context lesson bằng RAG.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Student profile                           | `M13.3`, `M13.4`                                           | `M13.3`, `M13.4`                                                  | `M1.2`                                                                  | `M4.1` cho avatar upload                      | Profile base/auth user nằm ở `M2.3`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Student leaderboard                       | `M13.2`                                                    | `M13.2`                                                           | `M1.5`                                                                  | `M13.1`                                       | XP event/level tính trước ở `M13.1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Notification bell/list/page               | `M10.2`                                                    | `M10.1`                                                           | `M1.5`                                                                  | `M10.3`, `M10.5`, `M10.6`                     | `M10.2` chỉ UI đọc danh sách; realtime/email/Zalo tách task.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Parent child link/selection               | `M11.1`                                                    | `M11.1`                                                           | `M1.2`                                                                  | -                                             | Một student chỉ liên kết một parent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Parent dashboard                          | `M11.2`                                                    | `M11.2`, `M7.5`                                                   | `M1.2`, `M1.3`, `M1.4`                                                  | -                                             | Dữ liệu tiến độ lấy theo selected child.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Parent course/payment pages               | `M11.3`, `M8.4`                                            | `M11.3`, `M8.2`, `M8.3`                                           | `M1.3`, `M1.5`                                                          | payOS trong `M8.2`, `M8.3`                    | Parent thanh toán cho con đã liên kết.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Parent notifications/news                 | `M11.4`, `M12.5`                                           | `M10.1`, `M12.4`, `M12.5`                                         | `M1.5`                                                                  | `M10.3`, `M10.6`                              | News/event/livestream public cho student/parent.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Admin dashboard                           | `M13.5`                                                    | `M13.5` hoặc API module liên quan                                 | `M1.x` theo metric                                                      | `M4.3`, `M10.5` nếu hiển thị job/notification | Cho phép placeholder với metric chưa có API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Admin video learning analytics            | `M15.8`                                                    | `M15.8`                                                           | `M15.1`, `M15.3`, `M15.7`                                               | aggregate pipeline tùy volume                 | Chỉ hiện metric tổng hợp theo lesson/chapter với ngưỡng riêng tư; không hiển thị raw surveillance log từng student.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Admin course/chapter/lesson management    | `M3.4`                                                     | `M3.1`, `M3.2`                                                    | `M1.3`                                                                  | -                                             | Quản lý lộ trình, chương học tổng quan và buổi học. Modal khóa học có `Ngày bắt đầu`/`Ngày kết thúc` date-only tùy chọn, cùng khoảng `Số buổi học từ`/`Số buổi học đến` tùy chọn (1-500); các giá trị kết thúc không được nhỏ hơn giá trị bắt đầu, số buổi là kế hoạch chứ không phải counter thực tế. Modal lesson có select `Loại buổi học` mặc định `Học cơ bản`; chọn `Học live` mới hiện input `Link học live` optional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Admin lesson document upload/status       | `M4.5`                                                     | `M4.2`                                                            | `M1.2`, `M1.3`                                                          | `M4.1`, `M4.3`, `M4.4`                        | Course quản lý nhiều source PDF ngang hàng theo thứ tự upload cũ đến mới và hiện badge readiness. Modal lesson có nhiều khối `Tài liệu trích xuất` + range và nhiều file nền tảng trực tiếp; source select chỉ chứa nguồn đã xác nhận hết trang in, mặc định phần tử hợp lệ đầu tiên, hiển thị tên kèm tổng số trang, chặn realtime khi `Từ trang in` hoặc `Đến trang in` vượt số trang in lớn nhất, cùng-source range được validate không giao nhau realtime/API, thứ tự UI bám thứ tự thao tác. Tài liệu bổ sung và bài tập về nhà đều cho thêm nhiều file bằng cùng pattern dòng upload.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Admin quiz/flashcard/test CRUD UI         | `M6.2`, `M6.3`, `M6.4`                                     | `M6.2`, `M6.3`, `M6.4`                                            | `M1.4`                                                                  | `M6.1` content schema                         | Rich text/LaTeX dùng schema chung.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Admin AI generation panel                 | `M9.8` + reopened `M9.2` + `M9.3` + `M9.7` + `M9.17-M9.18` | Summary/Video Summary/StemFigure + shared Quiz/Test figure review | `lesson_video_summaries`, `stem_figures`, `quiz_figures`, jobs, AI logs | OpenAI, TeX Live sandbox, R2                  | Năm card generation theo thứ tự `Video`, `Kiến thức`, `Quiz`, `Flashcard`, `Test`; card Video thuộc M9.7 và dùng readiness video + transcript độc lập. Modal Summary có checkbox dùng crop SGK trực tiếp và bỏ qua Stage 2 cho cả lượt; mặc định vẫn AI redraw. Figure compile + validator thành công tự `SUCCEEDED`; mọi figure có xóa/thay ảnh/sinh lại, figure TeX còn có preview-to-source. Figure raster SGK thành công có icon cây đũa mở modal lazy-load; chỉ chọn một tool mỗi lần, làm nét tự preview khi chọn; xóa tự hiển thị `Sau chỉnh sửa` sau mỗi nét, đồng thời giữ canvas/cọ active trên ảnh kết quả để tô liên tiếp, dọn lớp nét đỏ sau mỗi preview và giữ mask tích lũy riêng cho apply; không có nút preview riêng. `Áp dụng` commit riêng lượt hiện tại, giữ modal mở, reset preview/mask và dùng revision vừa tạo làm input; làm nét bỏ chọn tool còn xóa giữ cọ active để tô nhiều lượt liên tiếp. Nhãn tổng figure ẩn khi Summary Phase 1 còn chờ/đang chạy; sau Phase 1, nhãn mở modal xem nhanh toàn bộ ảnh theo thứ tự, không crop asset và theo dõi trạng thái từng ảnh realtime. Lưu/phát hành chỉ chặn placeholder lỗi/initial render; student chỉ nhận R2 asset. Card review Quiz/Test hiển thị asset shared `quiz_figures` và poll nhanh khi figure còn active; Flashcard giữ text-only. |
| Admin Cài đặt AI và OCR                   | `M9.11`, `M9.12`, `M9.19`, `M9.20`, `M9.7`                 | `M9.10`, `M9.12`, `M9.19`, `M9.20`, `M9.7`                        | provider operations                                                     | `M9.9`, `M4.6`, `M9.12`, `M9.19`, `M9.20`     | Route `/admin/ai-settings`; `Thiết lập mặc định` quản lý riêng `Phase 1 - tạo text` và `Phase 2 - tạo ảnh` cho từng Summary/Quiz/Flashcard/Test, gồm model chính/dự phòng và giới hạn token input/output của từng phase. `M9.7` thêm nhóm `Tóm tắt Video` chỉ có cấu hình text, không dựng tab ảnh giả. `Quản lý model` chỉ quản lý metadata model và bảng giá, không hiển thị giới hạn kỹ thuật/trần token. Không hiển thị secret. Hard-stop tuyệt đối phải phân biệt đã dùng/đang giữ/còn lại, trạng thái đã chặn và lỗi thân thiện.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Admin report moderation                   | `M12.2`                                                    | `M12.2`                                                           | `M1.5`                                                                  | -                                             | Student tạo report ở `M12.1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Admin AI unreviewed content               | `M12.3`                                                    | `M12.3`                                                           | `M1.5`                                                                  | `M9.2`, `M9.3`                                | Duyệt nội dung AI trước khi dùng chính thức nếu cần.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Admin discount codes                      | `M8.5`                                                     | `M8.1`                                                            | `M1.5`                                                                  | -                                             | Validation discount server-side trong `M8.1`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Admin manual notifications                | `M10.4`                                                    | `M10.4`                                                           | `M1.5`                                                                  | `M10.3`, `M10.6`                              | In-app lưu DB; realtime/email/Zalo là kênh bổ sung.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Admin news/events/livestream              | `M12.4`                                                    | `M12.4`                                                           | `M1.5`                                                                  | -                                             | Student/parent xem ở `M12.5`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

Riêng các control Reasoning Effort của màn Cài đặt AI: modal catalog luôn liệt
kê đủ `none | minimal | low | medium | high | xhigh | max` theo thứ tự tăng dần
để admin tự chọn capability cho từng model; các select ở `Thiết lập mặc định`
và modal generation chỉ hiển thị tập đã chọn, cũng theo đúng thứ tự này.

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
- Màn tất cả lộ trình có filter theo đối tượng khối và lĩnh vực; mặc định cả hai chọn `Tất cả`.
- Khi `Khối lớp = Tất cả` (không phụ thuộc lựa chọn `Môn học`), các dải ruy-băng lần lượt là `Khóa học đã mua`, `Khóa học phù hợp với bạn`, `Dành cho khối 12`, `Dành cho khối 11`, `Dành cho khối 10`, `Dành cho toàn khối THPT`, `Dành cho khối 9`, `Dành cho khối 8`, `Dành cho khối 7`, `Dành cho khối 6`, `Dành cho toàn khối THCS`, `Dành cho khối 5`, `Dành cho khối 4`, `Dành cho khối 3`, `Dành cho toàn khối Tiểu học`, `Dành cho toàn khối học sinh`, `Dành cho Người đi làm`; nhóm không có khóa học được ẩn. Khóa đã mua chỉ xuất hiện một lần và bị loại khỏi toàn bộ nhóm phía dưới. `Khóa học phù hợp với bạn` gồm khóa chưa mua có đối tượng đúng khối học sinh, đúng cấp học của khối đó hoặc `Toàn khối`; các khóa này vẫn xuất hiện lại trong nhóm đối tượng tương ứng. Mỗi card chỉ mang nhãn của đối tượng khiến nó xuất hiện trong nhóm hiện tại.
- Ruy-băng `Khóa học đã mua` dùng xanh lá, `Khóa học phù hợp với bạn` dùng xanh dương; các nhóm khối dùng tone riêng tương ứng với màu nhãn khối và không trùng nhau. Trên mobile, tất cả ruy-băng có cùng chiều dài, thân ribbon vừa khít tiêu đề và mũi nhọn, không để khoảng trống phải dư thừa; cỡ chữ tiêu đề giữ như thiết kế gốc. Badge lĩnh vực lấy màu/icon theo domain để Toán, Tiếng Anh, Vật lý, Hóa học có nhận diện khác nhau.
- Hai filter student giữ tiêu đề thân thiện `Khối lớp` và `Môn học`, nhưng option được lấy từ catalog admin `target_audiences` và `domains` theo `sortOrder`; filter dùng ID ổn định thay vì tên hiển thị.

- `/admin/domains`: admin quản lý catalog Lĩnh vực, kéo-thả bằng cùng pattern tay nắm/đích thả của chương và buổi học để lưu thứ tự hiển thị; modal khóa học và bộ lọc danh sách khóa học dùng đầy đủ select `Lĩnh vực`/`Đối tượng hướng đến` theo đúng thứ tự catalog. Modal tạo/sửa khóa học chỉ cho chọn đúng một `Đối tượng hướng đến`.
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
- Mọi CTA/link trực tiếp tới một buổi học (`Vào học`, `Học thử`, `Học tiếp`,
  tên lesson có quyền truy cập) dùng transition toàn màn hình random trước khi
  mở lesson. Transition hiển thị `Học thông minh - Vững tương lai`, tránh lặp
  biến thể gần nhất và chạy song song với route/API prefetch.

### 4.4. Trang buổi học student

Layout đề xuất:

```txt
Header: lesson title + breadcrumb
Main content:
  - Video bài giảng
  - Smart video toolbar: tiếp tục học, watched progress, ghi chú timestamp
  - Transcript/chapter panel: search, active cue, checkpoint, chapter mastery
  - Contextual actions: Hỏi đoạn này, Em chưa hiểu, xem lại đề xuất
  - Tab Bài học mở phần Kiến thức với ba sub-tab `Video`, `Lý thuyết`, `Bài tập`;
    `Video` là mặc định và hiển thị Tổng quan video đã được admin phát hành.
  - Quiz section
  - Flashcard section
  - Test section
  - AI chat panel
Sidebar:
  - Lesson navigation
  - Progress
  - Top 5 test leaderboard
```

Rules:

- Video bài giảng là nội dung chính luôn nằm trước thanh tab
  Bài học/Quiz/Flashcard/Kiểm tra; tab `Bài học` chỉ quyết định phần nội dung
  summary bên dưới, không được làm mất video.
- Khi video YouTube đang phát, `ArrowLeft`/`ArrowRight` dùng cùng bước tua lùi/tới
  với control của player, chặn scroll ngang mặc định và giữ nguyên hành vi con trỏ
  khi focus ở input, textarea, select, MathLive hoặc vùng editable. Khi video dừng,
  player không bắt hai phím này.
- Trong panel Kiến thức, sub-tab `Video` là mặc định và render bản Video Summary
  `APPROVED`, chưa xóa, không stale bằng cùng block renderer; nếu chưa có bản đủ
  điều kiện thì hiển thị empty state. Tab này ẩn tiêu đề bài học và Mục lục trùng
  lặp. Tab có segmented control `Tất cả`/`Từng phần`: `Tất cả` render toàn bộ nội
  dung; `Từng phần` chỉ render khối kiến thức/ví dụ đang hoạt động theo thời gian
  phát, tính từ `startSeconds` của khối đến trước mốc khối kế tiếp. Trước mốc đầu
  tiên hiển thị trạng thái chờ; badge thời gian vẫn tua và phát video từ đúng mốc.
  Khi video bị cắt, cả `Tất cả` và `Từng phần` đánh lại số các khối `Ví dụ`
  còn thuộc cửa sổ phát từ 1 theo thứ tự thời gian; không giữ số trong video gốc.
  `Lý thuyết` và `Bài tập` tiếp tục tách nội dung Lesson Summary như hiện tại.
- Nút bài trước/bài tiếp theo cũng dùng cùng transition toàn màn hình và
  prefetch lesson đích ngay khi click. Chỉ điều hướng sau khi transition che
  kín và dữ liệu lesson cốt lõi đã sẵn trong cache; transition mở ra sau khi
  route đích commit.
- Luôn render đủ hai ô điều hướng lesson, kể cả ở đầu/cuối lộ trình hoặc khi
  bài thi chưa đạt. Ở bài đầu tiên, ô trái là link `Trở về` dẫn về chi tiết
  khóa học; từ bài thứ hai, ô này là `Bài học trước` và dùng
  `navigation.previous`. Nút không dùng được phải là button disabled có màu
  muted, không biến mất khỏi layout. Nút kế tiếp chỉ bật khi API trả
  `navigation.next` và điểm của `latestSubmittedAttempt` hiện tại đạt
  `completionMinScore`.
- Copy của transition phải bám đúng ngữ cảnh: transition điều hướng vào lesson
  dùng `Học thông minh - Vững tương lai`, còn transition mở runner nội bộ giữ
  `Đang chuẩn bị Quiz...` hoặc `Đang chuẩn bị Flashcard...`; không thay đồng
  loạt ba loại copy này.
- Trước `exam_open_at`, test section hiển thị countdown hoặc thông báo chưa mở.
- Sau giờ mở, Test vẫn khóa đến khi một Quiz đã submit và toàn bộ thẻ trong ít
  nhất một bộ Flashcard đã review. Khi đủ điều kiện, giữ lời nhắc cùng action
  quay lại ôn Quiz và Flashcard.
- Action Quiz/Flashcard trong Test section chỉ chạy transition vào runner khi
  tab đích có nội dung. Nếu chưa có set hoặc count bằng `0`, action vẫn đổi tab
  nhưng không tự bắt đầu attempt/session.
- Test section chưa có bộ đề vẫn dùng layout panel bình thường, hiển thị
  `0 câu`, ẩn thời lượng và disable action tạo lượt thi.
- Khi Test status đã có `latestSubmittedAttempt`, entry panel thay CTA
  `Bắt đầu bài thi` bằng cặp action `Xem lại bài thi` và
  `Làm bài thi mới`; action xem lại mở review toàn bộ attempt đã nộp gần nhất
  (kể cả chưa đạt). Trước `M9.4`, action làm mới dùng transition/start flow
  hiện có; sau `M9.4`, action gọi request-new reserve-first, xử lý
  `200 EXISTING`/`202 QUEUED` và chỉ mở runner khi set sẵn sàng.
- Nếu không có quyền truy cập, hiển thị paywall/trial message.
- Chat AI chỉ có input text.
- Smart video controls chỉ hiện sau khi video/lesson foundation sẵn sàng; thiếu transcript thì ẩn tính năng phụ thuộc transcript nhưng không chặn player.
- Resume/progress/checkpoint/search dùng timeline sau cắt. Nếu có vị trí
  resume hợp lệ, màn chờ player hiển thị `Bạn đã xem đến mốc thời gian
<mốc>.` và dòng riêng bên dưới `Nhấn để tiếp tục học.`; click sẽ seek
  rồi phát từ mốc đó. Chưa có tiến độ thì giữ `Nhấn để bắt đầu
học`. UI không được coi seek-to-end là hoàn thành video.
- Recommendation phải hiện lý do ngắn và có action bỏ qua.

### 4.5. Quiz runner

Component:

- Question card.
- Multiple choice/true false/text input renderer.
- Formula renderer.
- Text input có biểu tượng mở trình nhập toán trực quan dùng chung UI MathLive
  với màn admin. Preset học sinh gồm số `0-9`, dấu trừ để nhập số âm, dấu thập
  phân, phân số, căn và số mũ; vẫn giữ ô text thường cho đáp án không phải công
  thức. Khi mở bàn phím toán, vùng MathLive nằm ngay tại vị trí ô đáp án và bảng
  phím mở bên dưới; không được nhân đôi thêm một ô nhập công thức.
- Submit button.
- Nút `Gợi ý` chủ động; không tự mở hint.
- Nút `Bỏ qua` chỉ có trong Quiz và nằm cạnh `Gợi ý`. Bấm một lần sẽ khóa câu,
  hiển thị đáp án đúng và mở lời giải ngay; trạng thái này phải giữ sau resume.
  Nhãn `Đã bỏ qua` dùng màu vàng amber sáng; ô text input và thẻ của từng mệnh
  đề đúng/sai vẫn giữ nền, viền trung tính, không dùng viền đỏ hoặc nền vàng.
  Riêng lựa chọn đáp án đúng vẫn được đánh dấu xanh để học sinh xem lại.
- Mỗi chấm trong dải trạng thái là một nút điều hướng trực tiếp tới câu tương
  ứng. Giữ nguyên mã màu đúng/sai/chưa kiểm tra, biểu diễn riêng câu hiện tại và
  có nhãn truy cập mô tả số câu cùng trạng thái.
- `Kiểm tra đáp án` chỉ bật khi answer đầy đủ; feedback màu và action mở lời
  giải chỉ xuất hiện sau khi kiểm tra. Thao tác này chấm local từ grading data
  đã tải cùng attempt và không có pending network.
- `Enter` là shortcut của `Kiểm tra đáp án`; `ArrowLeft`/`ArrowRight` là shortcut
  của `Câu trước`/`Câu tiếp` khi còn câu tương ứng. Khai báo `aria-keyshortcuts`
  trên action đích, không bắt phím mũi tên khi focus đang ở field nhập text,
  MathLive hoặc control editable, và khóa shortcut trong pending/exit dialog.
- Nhãn `Đã làm` đếm các câu có answer đầy đủ theo đúng loại câu, kể cả khi chưa
  bấm `Kiểm tra đáp án`.
- Ở câu cuối, `Hoàn thành` vẫn cho bấm. Nếu còn câu chưa có answer đầy đủ và
  chưa được bỏ qua, runner không submit và hiển thị cảnh báo inline liệt kê đúng
  số thứ tự các câu cần hoàn thành; danh sách cập nhật trực tiếp theo answer hiện
  có. Nếu mọi câu đã trả lời hoặc bỏ qua, frontend gửi toàn bộ answer/marker bỏ
  qua trong một request submit để backend chấm lại và lưu chính thức. Bấm
  `Câu trước` phải đóng cảnh báo, không tự hiện lại khi quay về câu cuối.
- Nút quay lại trong runner của attempt chưa submit mở modal xác nhận
  `Bạn chưa hoàn thành xong bài Quiz. Vẫn thoát chứ?`; `Ở lại` giữ nguyên
  runner và `Vẫn thoát` mới quay về panel Quiz. Khi vào Quiz lại, frontend phải
  resume attempt `IN_PROGRESS` thay vì tạo lượt mới.
- Browser Back trong runner cũng mở modal xác nhận. Hủy thoát phải khôi phục
  history entry của runner; xác nhận thoát phải dừng ở trang chi tiết buổi học
  hiện tại, không quay về trang chi tiết khóa học.
- Refresh/F5 hoặc thoát runner rồi vào lại phải khôi phục mọi text, công thức,
  lựa chọn trắc nghiệm và trạng thái Đúng/Sai đã nhập/chọn, kể cả chưa bấm
  `Kiểm tra đáp án`, cùng feedback của câu đã kiểm tra và vị trí câu hiện tại.
  Dữ liệu được autosave theo `attemptId` ở server để tiếp tục được trên thiết bị
  khác. F5 chỉ tự mở lại runner nếu student đang đứng trong runner; sau khi đã
  xác nhận thoát về panel Quiz, F5 phải giữ nguyên panel và CTA trên panel mới
  resume attempt đang dở.
- CTA panel Quiz lấy trạng thái attempt từ server: chưa có lượt dùng `Bắt đầu`
  và luôn mở câu đầu tiên; mọi lượt `IN_PROGRESS` dùng `Tiếp tục làm` dù chưa
  kiểm tra câu nào và mở đúng câu gần nhất đã lưu local. Lượt đã submit và
  không còn lượt đang làm dùng `Xem lại`.
- Bộ Quiz có `0 câu` vẫn hiển thị count `0 câu`; CTA tạo attempt phải disabled.
- Trạng thái đã hoàn thành hiển thị thêm action `Làm bộ Quiz mới`. Trước `M9.4`,
  action dùng fallback bộ khả dụng kế tiếp; khi `M9.4` hoàn tất, action phải gọi
  request-new reserve-first, xử lý `200 EXISTING`/`202 QUEUED` và không còn quay
  vòng local. `Xem lại` mở màn kết quả của lượt submit gần nhất; student chọn
  xem lại tất cả hoặc các câu sai từ màn kết quả.
- Cạnh pill số câu có icon bánh răng. Menu có item `Các bộ Quiz đã làm`, mở
  dialog trên desktop và bottom sheet trên mobile. Lịch sử dùng tên mặc định
  `Bộ 1`, `Bộ 2`, ...; chỉ lượt hiện tại có badge `Đang làm` và summary
  `X/Y câu đã làm`. Lượt hoàn thành có `Xem lại toàn bộ`/`Làm lại bộ này`, lượt
  hiện tại có `Tiếp tục làm`.
- Khi student bấm `Xem lại toàn bộ` từ một vị trí đã cuộn trong dialog lịch sử,
  dialog phải được giữ nguyên dưới màn review thay vì unmount. Khi Back, cùng
  modal instance hiện lại tức thì ở đúng vị trí cuộn cũ, không chạy animation
  mở modal lần nữa và không đưa danh sách về đầu.
- Review mở từ lịch sử dùng tên bộ vừa chọn thay cho copy
  `Xem lại tất cả câu trả lời`. Câu đầu dùng `Trở về` thay `Câu trước`, câu cuối
  dùng `Kết thúc xem lại` thay `Câu tiếp`; hai action biên quay lại modal lịch
  sử cũ. Review mở từ result vẫn giữ copy phạm vi xem lại chung.
- F5 khi đang ở result giữ nguyên màn result bằng history marker của attempt
  gốc; dữ liệu summary vẫn được đối chiếu với server và không chạy lại confetti.
  Khi student chủ động quay về panel Quiz, marker result phải được xóa để F5 giữ
  panel.
- Result summary.
- Result không liệt kê câu sai; có xem lại/làm lại tất cả hoặc câu sai.
- `Làm lại câu sai` giữ số câu gốc trong runner. Sau khi hoàn thành, result
  summary luôn hiển thị thống kê cộng dồn của toàn bộ bài Quiz gốc; không có
  summary riêng cho lượt con.
- Mọi action xem lại/làm lại trên result dùng kết quả gốc đã cộng dồn.
  `Làm lại tất cả` mở một lượt đầy đủ mới và reset kết quả.
- Result có thêm `Làm bộ Quiz mới`; sau `M9.4`, action dùng cùng request-new flow
  với queued/polling/error/retry và mở runner ngay khi có set.
- `M9.5` thêm action `Giải thích cho tôi`; lời giải cache hiển thị inline ngay,
  còn lời giải đang tạo có queued/polling/error/retry rõ ràng.
- Report button từng câu.
- Favorite button từng câu.

### 4.6. Flashcard deck

Component:

- Card front/back.
- Flip animation.
- Buttons: đã thuộc, chưa thuộc.
- Dải chấm trạng thái là control điều hướng trực tiếp tới từng thẻ; thẻ hiện tại
  kéo dài, đã thuộc màu xanh, chưa thuộc màu đỏ và chưa đánh dấu màu xám.
- CTA dùng `Bắt đầu` khi chưa từng mở session và luôn mở thẻ đầu tiên. Session
  đã từng mở dùng `Tiếp tục học` dù chưa đánh dấu thẻ nào; vị trí thẻ gần nhất
  phải giữ qua Back, F5 và đóng/mở lại web trên cùng trình duyệt.
- Bộ Flashcard có `0 thẻ` vẫn hiển thị count `0 thẻ`; CTA `Bắt đầu` phải
  disabled.
- Chưa có bộ Flashcard cũng dùng cùng panel này với `0 thẻ`, không render một
  empty-state có bố cục khác.
- Nút `Hoàn thành` vẫn cho bấm ở thẻ cuối; nếu còn thẻ chưa đánh dấu, giữ nguyên
  runner và hiển thị alert inline liệt kê số thứ tự các thẻ cần xử lý.
- Summary: đã thuộc/chưa thuộc.
- Summary không liệt kê thẻ cần ôn; chỉ có ôn lại tất cả và ôn lại thẻ chưa
  thuộc.
- Cạnh pill số thẻ có icon bánh răng. Menu có item
  `Các bộ Flashcard đã học`, dùng dialog trên desktop và bottom sheet trên
  mobile. Mỗi session có tên `Bộ N`; chỉ session hiện tại có badge `Đang làm`.
  Session hoàn thành có `Xem lại toàn bộ`/`Học lại bộ này`, session hiện tại có
  `Tiếp tục học`.
- `Ôn lại tất cả` mở lượt mới từ thẻ đầu, reset tiến độ hiển thị, bộ đếm và nhãn
  lựa chọn của phiên; không hiển thị lại nhãn từ progress lịch sử trước khi thẻ
  được đánh dấu trong lượt mới.
- `Xem lại toàn bộ` từ modal lịch sử giữ chính modal đó mounted dưới runner,
  dùng tên bộ vừa chọn làm dòng ngữ cảnh và không chạy luồng hoàn thành session.
  Thẻ đầu dùng `Trở về`, thẻ cuối dùng `Kết thúc xem lại`, thẻ giữa giữ
  `Thẻ trước`/`Thẻ sau`; action biên hiện lại modal cũ đúng scroll, không chạy
  animation mở modal lần nữa.
- Inline explanation.
- Report/favorite từng card.
- Result có thêm `Học bộ Flashcard mới`. Trước `M9.4`, action dùng fallback bộ
  khả dụng kế tiếp; sau `M9.4`, action gọi request-new reserve-first, xử lý
  `200 EXISTING`/`202 QUEUED` và mở session khi set sẵn sàng.
- `M9.5` thêm action `Giải thích cho tôi` trên từng card, cùng inline
  cache/queued/polling/error/retry như Quiz.

### 4.7. Test runner

Component:

- Timer.
- Question navigation.
- Answer form.
- Submit confirmation.
- Result page.
- Review page.
- `M9.5` chỉ hiển thị action `Giải thích cho tôi` sau submit; cache hit mở inline
  ngay, cache miss/stale dùng queued/polling/error/retry.

Rules:

- Không hiển thị đáp án đúng trước submit.
- Không cho start trước giờ mở hoặc trước khi hoàn thành Quiz + Flashcard.
- Nếu lesson chưa có Quiz/Flashcard hợp lệ hoặc student chưa hoàn thành, panel
  hiển thị trạng thái `Chưa mở`, CTA `Làm Quiz`/`Học Flashcard` và disable nút
  `Bắt đầu bài thi`; không hiển thị `Ôn lại` hoặc `Sẵn sàng`.
- Hết giờ tự submit; câu chưa trả lời nhận 0 điểm.
- Review summary không liệt kê sẵn câu hỏi; action xem lại mới mở từng câu.
- Kết quả chưa đạt hiển thị cảnh báo làm lại và không thay
  completion/best đã có.
- Submit kết quả đạt tự động cập nhật completion/Top 5; UI không có action
  `Dùng điểm bài này`.
- Icon bánh răng nằm ngoài cùng sát mép phải của header, sau pill số câu và
  duration, mở menu `Lịch sử Bài thi`. Dialog/bottom sheet dùng cùng shell lịch
  sử Quiz/Flashcard và tải dữ liệu khi mở.
- Lịch sử luôn đánh dấu đúng một mục `Bài thi hiện tại`. Nếu mục này chưa làm,
  hiển thị `Chưa làm` và nút `Bắt đầu bài thi`; nếu đã hoàn thành, chỉ hiển thị
  `Xem lại bài thi`, không hiển thị nút làm lại trong lịch sử.
- Review mở từ lịch sử phải giữ modal lịch sử mounted bên dưới; Back quay lại
  đúng modal và vị trí cuộn cũ.
- Với lịch sử Quiz/Flashcard, khi mọi mục đều đã hoàn thành, gắn `Bộ hiện tại`
  vào đúng mục mới nhất của set đang được chọn.
- `M9.4` nối `Làm bài thi mới` vào request-new Test với trạng thái
  queued/polling/error/retry; không tạo attempt cho tới khi có set hợp lệ.

### 4.8. AI chat panel

Component:

- Message list.
- Text input.
- Formula support text.
- Context badge nếu đi từ “Chat thêm với AI”.
- Refusal message khi ngoài scope.

Không có upload file/ảnh.

Phân quyền UI theo task:

- `M9.4` sở hữu các action request-new Quiz/Flashcard/Test và mọi trạng thái
  chờ/error/retry của chúng.
- `M9.5` sở hữu action `Giải thích cho tôi`, lời giải inline và action bàn giao
  `Chat thêm với AI`.
- `M9.6` sở hữu chat panel, cả mở trực tiếp từ lesson lẫn nhận target item/lời
  giải đã lưu từ `M9.5`.
- `M9.8` chỉ sở hữu panel AI của admin trong lesson detail, không thay thế ba
  UI học sinh trên.
- Metadata của bản sinh đã hoàn tất hiển thị tổng lượt gọi và tổng chi phí thực
  tế từ usage event. Tổng tiền là một nút mở modal lịch sử của đúng generation;
  modal có tổng hợp, danh sách phân trang và mở tiếp chi tiết công thức tính của
  từng lượt giống màn `Chi phí & sử dụng`. Phần JSON chi tiết mang nhãn `Dữ liệu
usage và xử lý file`, hiển thị riêng usage nguyên bản của provider và metadata
  file do backend tạo; không gọi toàn bộ object này là raw usage. Trong lúc figure phase 2 còn hoạt động,
  metadata được refresh; khi lượt cuối kết thúc phải có một lần refetch chốt.
- Modal tạo Summary của `M9.8` cho phép cấu hình nội dung và cấu hình kỹ thuật
  theo lần chạy. Phần nâng cao cho phép admin sửa trực tiếp `System instructions`
  và `User prompt`; nội dung khác rỗng được gửi làm toàn bộ prompt hiệu lực tương
  ứng, không bị hệ thống bọc thêm contract hoặc preference. `Input đầy đủ` có
  context là dữ liệu read-only để đối chiếu; không hiển thị API key/secret. Khi
  admin không sửa một prompt, thay đổi field cấu hình phải làm prompt đó được dựng
  lại từ dữ liệu mới trước lúc generate. Preview phải ghi rõ không gọi provider
  và không tốn phí. Khu thống kê preview hiển thị riêng token text, token PDF
  vision ước tính và tổng input; admin có thể mở chi tiết các thành phần text.
  Chi phí được tách thành input ước tính, output tối đa và tổng tối đa.

### 4.9. Notes và private comments

Chưa triển khai trong pass M7 core theo yêu cầu owner; giữ scope cho `M7.6`.

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

Course detail có khu vực `Cấu trúc khóa học`:

- Header luôn có hai action ngang hàng `Thêm chương` và `Thêm buổi học`; không bắt buộc tạo chương trước.
- Khi chưa có cả chương lẫn buổi, empty state dùng copy `Chưa có nội dung khóa học`, giải thích có thể bắt đầu bằng chương hoặc buổi học và hiển thị đủ hai CTA.
- Course structure render một cây có thứ tự chung: chapter và lesson không thuộc chapter là sibling top-level và có thể xen kẽ; lesson trong chapter nằm ở vùng con của chapter.
- Admin có thể kéo lesson đến mọi drop zone hợp lệ: trong cùng chapter, chapter khác, hoặc giữa bất kỳ hai item top-level. Drop target thể hiện rõ container/vị trí sẽ nhận.
- Mobile/keyboard có action `Di chuyển` mở control chọn `Top-level`/chapter và vị trí đích; không bắt người dùng chỉ dùng drag/drop.
- Lesson có `hasStudentCompletion = true` hiển thị mốc khóa thứ tự. Move option làm lesson đứng trước bất kỳ mốc khóa nào phải disabled; drag/drop phải chạy preflight, từ chối và giải thích rõ. API conflict do dữ liệu stale hiển thị toast rồi refetch structure.
- Nếu khóa chỉ có lesson không thuộc chương, không hiển thị empty state `Chưa có chương học` như một blocker.
- Mọi state/action hỗ trợ light/dark, responsive và pending/disabled theo cùng pattern admin CRUD hiện có.

### 6.3. Chapter management

CRUD chapter:

- Title.
- Overview/short description.
- Objectives/focus points.
- Status.

Chapter không có video, tài liệu/PDF, summary, quiz, flashcard hoặc test riêng.
Chapter là nhóm tùy chọn; course không bắt buộc có chapter.

### 6.4. Lesson management

CRUD lesson:

- Optional chapter assignment; option đầu là `Không thuộc chương nào`. Khi sửa container/vị trí từ cây, dùng cùng move mutation thay vì chỉ đổi local state.
- Title.
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

Modal tạo/sửa chapter và lesson không hiển thị field thứ tự. Khi tạo, backend tự append vào cuối container và lưu dãy thứ tự chuẩn; khi cần đổi vị trí, admin dùng kéo-thả hoặc action `Di chuyển` trong cây cấu trúc.

Màn chi tiết buổi học admin:

- Route chính: `/admin/lessons/[lessonId]`.
- Đây là workspace theo từng buổi học, không phải màn cấp course/chapter.
- Vào từ danh sách buổi học thuộc chapter hoặc section `Buổi học chưa thuộc chương` trong `/admin/courses/[id]`.
- Header có action `Chỉnh sửa buổi học`. Khi bấm, UI lazy-load và mở lại đúng modal sửa lesson đang dùng ở course detail; lưu thành công phải đóng modal và refresh metadata/video của lesson detail, không duy trì một form sửa thứ hai.
- Tab `Tài liệu` lazy-load và render lại đúng ba section upload đang dùng trong modal lesson (`Tài liệu nền tảng`, `Tài liệu bổ sung`, `Bài tập về nhà`), có action `Lưu tài liệu` và dùng chung schema/mutation/document manager; không tạo bộ field upload thứ hai chỉ giống về hình thức.
- Hiển thị metadata buổi học, trạng thái tài liệu/OCR/chunk của riêng buổi đó và các khu vực Summary, Documents, Quiz, Flashcard, Test.
- Khu vực video có panel `Quản lý Mốc Thời Gian` và `Bản chép lời video`: cả hai
  hiển thị đầy đủ chapter/cue theo video gốc với hai cột `Thời gian` sau cắt và
  `Thời gian gốc`. Mục ngoài khoảng phát sau cắt vẫn giữ đúng vị trí trong danh
  sách nhưng dùng bề mặt muted, nhãn `Ngoài đoạn phát` và disabled toàn bộ control
  chỉnh sửa/xóa/phát. Mục trong khoảng phát được ánh xạ về trục bắt đầu tại `0:00`;
  cột `Thời gian` sau cắt luôn disabled/read-only, admin sửa `Thời gian gốc` và
  thấy cột sau cắt cập nhật tức thì; vẫn có thể tìm transcript, chỉnh nội dung,
  phát từ đúng mốc và lưu.
  Transcript lấy mới giữ nguyên từng cue với `offset`/`duration` gốc của YouTube;
  timestamp có thể có phần thập phân và độ dài các đoạn không cố định. Cue chứa
  thời gian player hiện tại là cue active duy nhất. Đoạn active có nền/viền primary
  và label cột đổi từ `Thời gian` sang `Đang phát`; danh sách tự cuộn nội bộ để giữ
  đoạn active gần giữa vùng nhìn, nhưng không tự cuộn lúc có từ khóa tìm kiếm. Cột
  action xếp dọc trên laptop và xếp ngang trên mobile. Khi tìm kiếm, kết quả vẫn
  giữ ngữ cảnh chapter. Hai panel dùng token/theme của dự án và responsive.
- Trên player preview của admin, tooltip chapter khi hover thanh tiến trình hiển
  thị cả thời gian sau cắt và dòng `Gốc <timestamp>` của đúng vị trí đang hover;
  hai đầu thanh tiến trình cũng có mốc gốc để đối chiếu. Player của học sinh không
  hiển thị bất kỳ nhãn thời gian gốc nào. Trong modal chỉnh sửa khối Video Summary,
  `Thời gian gốc` là field được phép sửa; `Thời gian bắt đầu` sau cắt là field
  disabled và tự cập nhật theo cùng phép quy đổi.
- Sau khi modal sửa lesson lưu một Video URL khác hoặc xóa URL, lesson detail
  refetch metadata và query Video Summary: panel mốc thời gian, transcript và tab
  `Video` trở về empty state. URL không đổi sau trim không làm mất dữ liệu.
- Khi admin tự động lấy danh sách mốc thời gian từ mô tả YouTube,
  hệ thống bỏ tiền tố thứ tự cũ và đánh lại toàn bộ tên phần liên tục từ
  `1`. Quy tắc này chỉ áp dụng cho dữ liệu vừa lấy từ YouTube; mốc admin
  nhập tay hoặc đã lưu không bị tự động đổi tên.
- `Tổng quan buổi học` tiếp tục đọc `lessons.overviewContentJson` ở khu
  vực thông tin lesson. Video Summary không còn render thành section accordion riêng
  ở khu vực này; nội dung xem/sửa/phát hành chuyển vào tab `Video`.
- Hàng tab nội dung có thứ tự `Tài liệu`, `Video`, `Kiến thức`, `Quiz`,
  `Flashcard`, `Test`. Tab `Video` dùng cùng flow review của `Kiến thức`: ba
  chế độ `Chỉ xem UI`, `Chỉ xem JSON`, `Song song`, thao tác chỉnh sửa/
  xóa/di chuyển khối và đề mục, cùng action lưu/phát hành/thu hồi/xóa.
  Tab không lặp banner tiến trình hoặc lỗi job; trạng thái này thuộc card AI.
- Panel `Tạo nội dung bằng AI` có card `Video` đứng trước card
  `Kiến thức`. Card hiển thị trạng thái chưa tạo/đang tạo/bản nháp/đã
  phát hành/thất bại theo cùng pattern của các card AI khác. Action `Tạo
mới` chỉ bật khi có video và transcript đã lưu không rỗng; thiếu chapter
  không chặn, còn transcript đang sửa dở phải lưu trước. Disabled state có lý
  do đọc được bằng tooltip/helper và không chỉ biểu đạt bằng màu.
- Modal `Tóm tắt Video bằng AI` lazy-load, tái sử dụng `EditorDialogShell`, form
  controls và bố cục responsive của modal Sinh kiến thức/Quiz. Modal có phong
  cách, độ dài/số từ, yêu cầu thêm, model cùng Temperature hoặc Reasoning Effort,
  max output tokens; action `Xem dữ liệu` hiển thị exact system prompt, user
  prompt, normalized chapter/transcript packet, request và ước tính token/chi
  phí. Đổi form/source làm preview stale; CTA pending chống submit lặp. API nhận
  job thì modal đóng, card `Video` hiện trạng thái đang tạo và đồng hồ
  thời gian thực;
  mở lại trang phải resume job hiện hành.
- Kết quả Video Summary thay nội dung cũ trong tab `Video` và
  render bằng chính `SummaryBlockRenderer`: `Các kiến thức trong bài giảng` ở đầu với
  đúng một ý chính cho mỗi section, các khối `Kiến thức`/`Ví dụ` bám trình tự
  video và không có khối `Tổng kết` riêng. Màu sắc, spacing, typography, công thức
  và cấu trúc Đề bài/Lời giải/Kết luận của Ví dụ
  giống Sinh kiến thức. Ví dụ không tự đủ dữ kiện do phụ thuộc hình video phải
  được loại. Mỗi section/khối Kiến thức/Ví dụ có nút thời gian lấy từ cue
  transcript thật. Trên admin, khối nằm trong khoảng player hiện `Bắt đầu
mm:ss · Gốc mm:ss`; khối ngoài khoảng giữ `Bị ẩn · Gốc mm:ss`. Bấm
  nút phải tua và phát video ở mốc sau cắt tương ứng. UI đồng thời hiển
  thị model, Temperature/Reasoning Effort, chi phí thực tế, tổng thời gian tạo,
  trạng thái phát hành/cũ cùng action sửa, sinh lại, xóa và Mục lục.
- Đề mục lớn hiển thị thứ tự bằng badge riêng; `displayHeading` không lặp tiền tố
  số lấy từ title chapter. Khi có chapter, thứ tự badge và heading luôn theo danh
  sách chapter đã chuẩn hóa theo timestamp, không theo metadata tự do do AI trả.
- Ba chế độ `Chỉ xem UI | Chỉ xem JSON | Song song` xuất hiện trực tiếp
  trong tab `Video`; admin sửa khối bằng Tiptap, sửa/xóa/di chuyển khối và
  đề mục giống `Kiến thức`, không cần mở modal chỉnh sửa bao ngoài. JSON của
  Video Summary chỉnh trực tiếp document hiện hành; không phụ thuộc hoặc hiển thị
  cảnh báo thiếu raw Phase 1 của flow Sinh kiến thức.
  Mọi thao tác chỉ đổi local draft; chỉ action `Lưu nội dung` mới persist phần
  chỉnh sửa. `Phát hành`/`Thu hồi phát hành` đổi review status của bản đã lưu.
  Field Tổng quan buổi học trong cả modal thêm lesson và sửa lesson dùng Tiptap,
  đọc/lưu `lessons.overviewContentJson`; không đọc/ghi Video Summary.
- Course detail vẫn là nơi upload source PDF dài và xem status tài liệu theo buổi ở dạng gọn.
- Course detail có nút `Nhập khoảng trang` mở modal gán trang hàng loạt cho nhiều lesson; không nhét toàn bộ form nhập range dài vào màn chính.
- Modal tạo/sửa lesson và lesson detail là nơi gán/điều chỉnh page range tùy chọn của một lesson cụ thể để tránh thao tác vòng khi admin upload sách trước rồi mới tạo buổi học; phần nhập trang disabled tới khi source document xử lý xong và không còn page warning.
- Là nơi admin thêm thủ công, sửa, xóa mềm, ẩn/hiện, duyệt lại quiz/flashcard/test; nội dung do AI sinh sau M9.3 cũng được quản trị tại đây.
- Tab `Quiz` hiển thị mỗi quiz set như một tab ngang có count. Trong set có thanh
  số thứ tự câu hỏi nằm ngay trên panel nội dung; chọn số nào chỉ render câu đó
  bên dưới, giữ điều hướng ngang gọn khi bộ có nhiều câu. Trong set vẫn có action
  `Thêm câu hỏi`, sửa và xóa từng câu.
- Modal tạo/sửa Quiz set chỉ có tên bộ câu hỏi. Quiz set không có
  field hoặc badge mức độ; mức độ chỉ hiển thị và chỉnh sửa ở từng câu.
- Modal xóa Quiz set phải nói rõ đây là xóa vĩnh viễn cả bộ, câu hỏi, lời giải,
  hình và lịch sử làm bài liên quan; không mô tả hoặc ngầm triển khai khôi phục
  từ soft delete.
- Modal `Tạo Quiz bằng AI` có select `Bộ câu hỏi được chọn`, liệt kê các Quiz set
  hiện có và mặc định đúng tab đang mở. Admin có thể đổi bộ đích trước khi gửi;
  preview và generate phải dùng cùng giá trị `targetQuizSetId` của form. Khi job
  hoàn tất, mọi câu hợp lệ xuất hiện như card bình thường trong bộ đã chọn; không
  dùng tên bài/số lượng câu AI làm tab Quiz mới. Modal, schema form, document
  selector, prompt preview/model configuration và readiness đều thuộc riêng
  feature Quiz; không render qua modal hoặc state của Sinh kiến thức.
- Card câu AI hiển thị đề, đáp án và lời giải text/KaTeX theo contract M9.3.
  Quiz dùng `QuizExplanationCard` và `quizExplanationBlock`, không dùng
  `LessonSummaryExampleCard`. Hard cutover không render legacy `exampleBlock`.
  Mỗi khối lời giải Quiz admin có hai action rõ nghĩa `Tinh chỉnh lời giải` và
  `Tạo lại lời giải`. Modal
  lazy-load tự dựng preview từ đề, phương án/mệnh đề, đáp án đúng và lời giải hiện
  tại; admin có ô yêu cầu bổ sung, thống kê token/chi phí và ba tab xem system
  prompt, dữ liệu đề + lời giải, request OpenAI. Action chỉ làm rõ/làm đẹp lời
  giải theo đáp án hiện tại; action tạo lại giải độc lập và có thể thay đồng bộ
  đáp án, gợi ý, lời giải.
  Khi form đổi, preview cũ bị đánh
  dấu stale; execute/poll job có loading/disabled/terminal feedback và câu hỏi được
  refresh về trạng thái cần duyệt lại.
  Test dùng cùng core và action figure/revision của Quiz. Mỗi hình Quiz/Test hiển thị cùng bộ action với hình Sinh kiến
  thức: `Chỉnh sửa bằng mã code`, `Tạo mới bằng mã code`, `Tạo mới bằng AI`,
  `Tải ảnh lên`, `Xóa ảnh`, `Chỉnh sửa caption`; implementation dùng adapter API
  riêng của Quiz thay vì import nghiệp vụ Summary.
- Với current asset Sinh kiến thức hoặc Quiz được tạo thành công qua OpenAI,
  khung hình admin hiển thị pill `OpenAI · <giá> VNĐ` ở góc dưới bên phải. Nếu
  đúng asset có `cachedInputTokens > 0`, pill `Cache OpenAI` xuất hiện ngay bên
  trái pill giá. Giá/cache lấy từ usage thực tế của đúng asset, không hiện cho
  ảnh upload/code/crop SGK hoặc provider khác; hàng pill phải đọc rõ ở cả theme
  sáng/tối và không che caption.
- Modal mã code của Sinh kiến thức và Quiz dùng chung trigger `Chỉnh nhanh` có
  helper text `Không cần sửa mã`. Panel chia ba nhóm dễ quét: `Ẩn thông tin`
  (độ dài, góc, nhãn số), `Đường nét` (xóa nét phụ đứt/chấm, mảnh/vừa/đậm) và
  `Kích thước` (thu nhỏ/phóng to) và `Cỡ chữ nhãn` (nhãn chính/nhãn phụ theo ba
  mức dễ hiểu). Mỗi action có mô tả ngắn, tự biên dịch preview và bật `Hoàn tác`.
  Panel là popover nổi đè lên body modal, không tham gia layout và không co/đẩy
  editor hoặc preview; trên màn nhỏ popover có vùng cuộn giới hạn.
- Sau khi `Áp dụng` thay đổi kích thước, phải co/phóng toàn bộ card trực quan của
  figure (ảnh, caption, badge chi phí/cache) và căn giữa. Không chỉ đổi width của
  `<img>` bên trong một card vẫn full-width vì sẽ tạo khoảng trắng lớn và làm
  admin/học sinh hiểu sai kích thước đã chọn.
- Student/admin chỉ hiển thị `solutionFigure` khi có asset role `SOLUTION` riêng;
  không render lại `questionFigure` trong khối lời giải. Asset lời giải được dựng
  độc lập và có thể khác hoàn toàn bố cục hình đề, nhưng vẫn dùng cùng component
  figure/revision hiện có.
- Modal `Tạo mới bằng AI` của hình Quiz giữ cùng UI và flow với modal hình Sinh
  kiến thức: hai lựa chọn `Tạo mới lại`/`Chỉnh sửa hình hiện tại`, cấu hình model
  capability-aware, yêu cầu bổ sung, `Xem dữ liệu`, ba tab prompt/request, chỉnh
  prompt và thống kê/ước tính chi phí. Khác biệt duy nhất là Quiz không có khối
  ảnh gốc sách giáo khoa và không gửi reference image.
- Modal `Tạo lại lời giải` có checkbox tương tự cho lời giải cũ, mặc định không
  chọn; đáp án và gợi ý cũ luôn bị ẩn. Đổi checkbox phải cập nhật preview trước
  khi nút `Thực hiện` được bật.
- Header card Quiz có icon `ImagePlus` ngay trước action sửa. Icon mở menu semantic
  gồm hai action độc lập: tạo hình đề và tạo hình lời giải; menu render qua portal
  neo theo icon để không bị card `overflow` cắt cạnh trái/dưới. Action lời giải
  nêu rõ hình được dựng mới từ lời giải, không cần hình đề, và option disabled luôn
  hiển thị nguyên nhân. Hai action cũng hiện cho câu `TRUE_FALSE` một mệnh đề để
  admin có thể chủ động tạo hình sau khi câu đã được lưu.
- Hai action header dùng lại `AdminQuizFigureAiDialog`; khi target chưa có figure,
  modal chạy question-level create/preview, còn khi đã có current cùng mode thì
  vẫn cho `Chỉnh sửa hình hiện tại`.
- Modal sinh kiến thức và sinh Quiz chia cấu hình model thành hai section rõ:
  `Phase 1 - tạo text` và `Phase 2 - tạo ảnh`. Mỗi section có lựa chọn tự động
  theo Cài đặt AI, model, capability-aware Temperature/Reasoning Effort và giới
  hạn output riêng. Không đặt hai phase trong một select chung. Nếu Summary dùng
  ảnh gốc SGK, section Phase 2 vẫn hiển thị nhưng ở trạng thái không phát sinh
  lượt gọi/chi phí trong request hiện tại.
- Tab `Thiết lập mặc định` của `/admin/ai-settings` có năm nhóm Sinh kiến thức,
  Quiz, Thẻ ghi nhớ, Bài kiểm tra và Tóm tắt Video. Bốn nhóm đầu có hai
  tab/section cấu hình độc lập cho Phase 1 text và Phase 2 ảnh, gồm model chính,
  model dự phòng, capability setting và giới hạn token. Flashcard/Test chưa gọi
  Phase 2 trong pipeline hiện tại nhưng vẫn lưu đủ cấu hình ảnh; UI không gắn
  nhãn cấu hình ảnh là dùng chung hoặc lấy từ model text. Nhóm Tóm tắt Video chỉ
  có cấu hình text và không hiển thị tab Phase 2 ảnh.
- Câu Quiz AI có `Chỉ xem UI`, `Song song` và `Chỉ xem JSON`. JSON là mutable
  working snapshot duy nhất, cho phép sửa/add/delete field và preview nội dung
  cục bộ; bấm `Lưu JSON` mới projection xuống Quiz records và ghi ngược
  `ai_generations.output_json`. Không có toggle/bản provider gốc thứ hai. Subtree
  figure khóa edit trực tiếp và chuyển sang công cụ hình riêng. Warning semantic
  hiển thị theo câu trong một banner độc lập nằm sau thanh số câu, trước bộ chuyển
  chế độ và ngoài nội dung của cả ba chế độ xem. Banner chỉ có tiêu đề, danh sách
  warning và nút `Chấp nhận`; không có câu giải thích lặp về review/blocking. Nút
  này gọi cùng item-level review của câu hiện tại, có pending state, và banner ẩn
  sau khi câu đã thành `APPROVED`.
- Câu được xác định là nguồn AI bằng `sourceMetadataJson.aiGenerationId`: ô số
  điều hướng và hàng action đầu card cùng hiển thị nhãn `AI`. Card đặt action
  `Duyệt` ngay cạnh nhãn; action chỉ duyệt câu đang xem, có trạng thái pending và
  đổi thành `Đã duyệt` khi thành công. Câu admin tạo mới không có metadata này nên
  không hiển thị nhãn hoặc action AI. Nhãn AI dùng hệ màu sky/cyan, không dùng
  màu tím.
- Thanh điều hướng Quiz đặt câu AI `NEEDS_REVIEW` ở hàng trên cùng. Câu
  `APPROVED` nằm trong bốn hàng cố định theo thứ tự Trắc nghiệm, Đúng/Sai một
  mệnh đề, Đúng/Sai nhiều mệnh đề, Nhập đáp án; duyệt xong câu tự chuyển hàng.
  Mỗi Quiz set có hàng action `Duyệt tất cả`, `Lưu` và một trong
  `Phát hành`/`Thu hồi phát hành`, đồng nhất state machine của Sinh kiến thức.
  `Duyệt tất cả` đứng trước `Lưu`, chỉ duyệt các câu AI đang chờ trong set hiện
  tại, có pending/disabled state và không tự lưu hoặc phát hành. Khi bulk review
  tạo câu đã duyệt chưa lưu, callout bên dưới hàng action nhắc admin bấm `Lưu` để
  cập nhật cho học sinh.
- Một set trộn câu thủ công và câu AI vẫn giữ `source=ADMIN`; card bộ câu hỏi chỉ
  hiển thị thông tin và action cần cho quản trị, không hiển thị bộ đếm audit lượt
  sinh `tạo ban đầu / đã xóa / còn lại`.
- Card mỗi Quiz set hiển thị `Tổng chi phí` thực tế của toàn bộ các lần sinh AI.
  Bấm chi phí mở modal lịch sử mọi lần sinh của set, gồm trạng thái, model, thời
  điểm, số lượt gọi và chi phí. Bấm một dòng lần sinh mở lại đúng modal
  `Chi tiết các lượt gọi AI` dùng ở Sinh kiến thức; trong modal này, từng dòng
  usage hiển thị tên tác vụ cụ thể, Reasoning Effort, thời gian phản hồi, chi phí
  và thời điểm; từng dòng tiếp tục mở dialog chi tiết công thức/token/đơn giá.
  Taxonomy phải phân biệt sinh nội dung, tạo/chỉnh sửa/tinh chỉnh/sửa lỗi ảnh,
  hình đề/hình lời giải Quiz và tinh chỉnh/tạo lại lời giải Quiz. Event cũ thiếu
  snapshot hiển thị fallback rõ ràng, không tự nhận là một tác vụ mới.
  Mỗi dòng còn hiển thị một dòng đích ngắn ngay dưới tên tác vụ, chẳng hạn
  `Ví dụ 2 · Hình lời giải`, `Quiz · Câu 4 · Hình đề` hoặc `Flashcard · Thẻ 2 ·
Hình lời giải`; không thêm cột mới và không đưa UUID/mô tả dài vào bảng. Quy
  tắc này áp dụng cả tạo mới, tinh chỉnh, chỉnh sửa ảnh bằng AI, sửa lỗi ảnh và
  lượt thất bại; metadata đầy đủ chỉ mở ở dialog chi tiết.
- Tab quản trị Flashcard dùng cùng cấu trúc và state machine với tab Quiz: tab
  từng bộ có số đã duyệt/chờ duyệt; summary card có tổng chi phí, tổng ảnh, tổng
  thẻ, mức độ; hàng action có `Duyệt tất cả`, `Lưu` và
  `Phát hành`/`Thu hồi phát hành`; thanh điều hướng tách `AI chờ duyệt` và
  `Đã duyệt`; phần chi tiết chỉ render thẻ đang chọn và có trước/sau. Flashcard
  chỉ có đúng một hàng nội dung `Thẻ ghi nhớ` trong mỗi nhóm trạng thái, tuyệt
  đối không hiển thị hoặc phụ thuộc bốn loại câu hỏi của Quiz.
- `Tổng chi phí` Flashcard mở lịch sử sinh độc lập của set và tiếp tục mở chi
  tiết usage; `Tổng ảnh` đếm ảnh thực tế trong Tiptap và current asset minh họa
  lời giải rồi mở overview điều hướng về đúng thẻ.
- Card AI Flashcard có ba chế độ `Chỉ xem UI | Chỉ xem JSON | Song song`, nhãn
  `AI`, action duyệt và menu tạo ảnh có đúng một lựa chọn `Tạo ảnh cho lời giải`.
  Lựa chọn mở modal cùng pattern Quiz (shell, cấu hình AI, yêu cầu, thống kê/chi
  phí, ba tab request, sticky footer). Modal luôn có `Tạo mới lại`; chỉ hiện
  `Chỉnh sửa hình hiện tại` khi current asset lời giải là `AI_TEX` có source.
  Asset và trạng thái được hiển thị trong khối lời giải, không nằm ở mặt trước
  hoặc mặt sau; orchestration vẫn thuộc riêng Flashcard.
- Form câu hỏi quiz hỗ trợ `MULTIPLE_CHOICE`, `TRUE_FALSE`,
  `MULTI_STATEMENT_TRUE_FALSE`, `TEXT_INPUT`, mức độ, gợi ý và lời giải chi
  tiết. Multiple choice dùng danh sách phương án động:
  admin có thể tạo 2, 3, 4, 5 hoặc nhiều phương án hơn, thêm/xóa từng phương án
  và chọn đáp án đúng; không hard-code bốn ô A/B/C/D. `TRUE_FALSE` giữ một cặp
  lựa chọn Đúng/Sai chung cho toàn câu. `MULTI_STATEMENT_TRUE_FALSE` dùng đề
  dẫn chung và danh sách mệnh đề động tối thiểu 2 dòng; mỗi dòng có rich
  editor, control Đúng/Sai riêng và action thêm/xóa.
- Tab `Test` tái sử dụng cùng layout, rich editor, form câu hỏi và interaction của
  tab `Quiz`. Modal bộ đề có thêm field `Thời gian làm bài (phút)`; panel bộ đề
  hiển thị thời lượng đã lưu cạnh mức độ. Select `Loại câu hỏi` có đúng bốn lựa
  chọn: `Trắc nghiệm`, `Đúng/Sai`, `Đúng/Sai nhiều mệnh đề`, `Nhập đáp án`.
  Hai lựa chọn Đúng/Sai là hai loại độc lập: loại cũ render một cặp Đúng/Sai
  cho toàn câu, loại mới render danh sách mệnh đề động. Card xem lại loại mới
  hiển thị từng mệnh đề kèm badge Đúng hoặc Sai.
- M6.6 khóa đây là reuse implementation, không chỉ reuse style: Test dùng cùng
  Assessment tab, API client/hook/schema, question editor, review/bulk review,
  generation JSON, figure menu/revision và solution refinement của Quiz. Route
  và copy có thể khác, nhưng không được tạo component/logic Test Admin độc lập.
- Modal create/edit TestSet là modal QuizSet chung với đúng một field bổ sung
  `Thời gian làm bài (phút)`. Modal AI Test phải giống hệt modal AI Quiz:
  TestSet đích (`targetTestSetId`) là tùy chọn khi lesson chưa có bộ, nút bắt đầu
  vẫn hoạt động và backend tạo `Bộ đề 1` mặc định 15 phút. Modal tuyệt đối không
  render/gửi duration; admin đổi duration riêng tại modal sửa bộ đề.

### 6.5. AI generation panel

Trong lesson detail `/admin/lessons/[lessonId]`:

- Bốn card Summary/Quiz/Flashcard/Test dùng đúng `lessonId`, readiness và durable
  job polling hiện có. Frontend không gọi provider trực tiếp.
- Card/modal Test dùng shared Quiz generation v2, preview/prompt-preview và
  durable polling. Payload Test chỉ đổi target thành `targetTestSetId`; không
  có field duration hay UI cấu hình duration trong modal AI.
- Trong tab Quiz, action `Phát hành` khả dụng khi bộ có ít nhất một câu đã duyệt,
  kể cả khi vẫn còn câu chờ duyệt. Action `Lưu` đưa các câu mới duyệt vào lượt
  phát hành gần nhất của cùng bộ và không tạo mốc phát hành mới.
- Tab Flashcard áp dụng độc lập cùng contract phát hành của Quiz: duyệt từng
  thẻ/bulk review không tự công khai; `Lưu` đưa thẻ đã duyệt vào lượt phát hành
  hiện tại; `Phát hành` công khai set khi có ít nhất một thẻ đã duyệt; `Thu hồi`
  ẩn set với học sinh.
- Modal Summary cho chọn tài liệu READY, cấu hình văn phong/độ dài/model/prompt và
  xem prompt + chi phí ước tính. Generate luôn dựng request mới nhất phía server.
- Cùng nhóm cấu hình nội dung có hai numeric text field đặt cạnh nhau trên màn
  rộng và xếp dọc trên mobile: `Số bài tập vận dụng` và
  `Số bài tập ứng dụng thực tế`. Cả hai mặc định `2`, chỉ nhận số nguyên `1..10`,
  validate realtime và được giữ lại khi mở modal sinh lại từ cấu hình gần nhất.
  Đây là mục tiêu gửi AI; kết quả thiếu/thừa vẫn được render nếu cấu trúc bài hợp
  lệ.
- Modal Summary có checkbox `Dùng ảnh gốc sách giáo khoa`, mặc định được chọn, kèm
  helper text `Giữ nguyên crop ảnh nguồn đã trích xuất và không dùng AI vẽ lại.
Hình chưa có crop chính xác sẽ cần kiểm tra thủ công.` Checkbox chỉ xuất hiện
  cho Summary, được giữ ổn định khi mở phần xem dữ liệu và được snapshot cùng
  request draft. Khi bật, preview chi phí phải nói rõ Phase 1 vẫn tính phí và
  Phase 2 có `0` lượt gọi dự kiến; không làm như thể cả lượt sinh là miễn phí.
- Ngay dưới checkbox trên, `Tự động làm nét ảnh` chỉ xuất hiện khi
  `Dùng ảnh gốc sách giáo khoa` đang được chọn và mặc định được chọn. Bỏ checkbox
  cha phải reset checkbox con về `false`. Khi bật, helper text giải thích mọi crop
  SGK được giảm nhiễu/làm nét local trước khi lưu, không tăng số lượt gọi AI.
- Bản Sinh kiến thức mở đầu bằng khối `objectives` cấp cao và render bằng cùng
  block UI của Video Summary; nhãn theo nguồn là `Kiến thức sách giáo khoa`.
  Mỗi section lý thuyết có đúng một ý cùng thứ tự, còn section `Bài tập vận dụng`
  không có ý riêng. Objective là nội dung AI viết, không bị thay bằng heading của
  section khi backend map output.
- Summary content contract version 4 render `TEX_FIGURE` tại vị trí block. Khối
  `example` dùng nhãn Ví dụ, icon play và tông xanh; khối `exercise` độc lập dùng
  nhãn `Bài tập 1`, `Bài tập 2`, ... theo thứ tự, icon sổ-bút và tông cyan xanh
  lam ngọc, không dùng sắc tím.
  Không suy `exercise` từ heading và không có fallback cho dữ liệu cũ. JSON
  admin của mỗi reference hiển thị `figureOrigin=TEXTBOOK_SOURCE` nếu hình bám
  nguồn SGK hoặc `GENERATED_FROM_BRIEF` nếu hình được đề xuất/dựng thêm từ block.
  UI lấy giá trị backend-derived từ figure API; không suy nguồn từ caption hoặc
  trạng thái render. Hai chế độ `Song song`
  và `Chỉ xem JSON` còn chiếu `sourceReferences` Phase 1 từ `planJson` vào từng
  `TEX_FIGURE`; field này chỉ để debug và bị loại trước khi lưu Summary.
- Panel “Hình STEM trong bản kiến thức” liệt kê từng figure theo block, trạng thái
  `QUEUED/RENDERING/REPAIRING/SUCCEEDED/NEEDS_REVIEW/FAILED`, source version,
  repair count và lỗi gần nhất; không có `APPROVED` cấp figure.
- Mỗi figure có current asset hiển thị nhãn gọn `Notebook` nếu asset có
  provenance sách giáo khoa, hoặc `AI` cho các nguồn còn lại. Nhãn chỉ hiển
  thị giá trị, không kèm tiền tố `Origin`; figure chưa có asset không hiển thị nhãn.
- Header bản kiến thức hiển thị dải thống kê hình theo thời gian thực gồm tổng số,
  chờ xử lý, đang xử lý (`RENDERING + REPAIRING`), thành công, cần xem lại và lỗi.
  Dải này dùng chung query figure đang poll, không tạo request/polling riêng; khi
  Summary mới hoàn tất phải thay ngay dữ liệu figure cũ mà không cần tải lại trang.
- Header có action thay hàng loạt chỉ áp dụng cho các hình còn asset thuộc revision
  `INITIAL_AI` của lượt sinh Summary ban đầu. Action bỏ qua hình đã xóa và giữ
  nguyên mọi revision do admin tạo mới bằng AI, tạo bằng mã code, upload/thay thủ
  công hoặc đã dùng ảnh SGK. Hình AI ban đầu chỉ được tự thay khi có đúng một crop
  SGK dùng trực tiếp được; hình thiếu crop, crop mơ hồ hoặc đang xử lý được giữ
  nguyên và đếm rõ trong modal xác nhận. Mỗi hình hợp lệ được promote crop rồi áp
  dụng preset làm nét local, không gọi provider trả phí.
- Figure `SUCCEEDED` dùng asset URL từ R2. Figure `FAILED` hiện placeholder tại
  đúng vị trí, error code/message rút gọn và ba action xóa/thay/sinh lại.
- Toolbar của mọi loại Summary block có menu ảnh mở bằng hover trên desktop và
  click/tap/focus trên thiết bị cảm ứng. Menu gồm `Tạo mới bằng AI`, `Tạo mới bằng
mã code`, `Tải ảnh lên` và `Xem ảnh sách giáo khoa` khi figure đích có reference
  SGK; nhiều figure bắt buộc chọn target. Action cuối và icon mở nhanh ở chính
  figure cùng mở một khung ảnh nguồn ngay trong block để đối chiếu với ảnh hiện tại.
- Với block `example`/`exercise` chưa có figure, menu thay `Tạo mới bằng AI` bằng
  `Tạo hình cho đề bài` và `Tạo hình cho lời giải`. Mỗi action mở modal có title,
  mô tả và payload target tương ứng, nhưng giữ nguyên toàn bộ control model,
  prompt/request preview, token/chi phí và pending/submit của luồng Quiz. Nếu slot
  `0` đã có hình mang reference SGK, menu vẫn giữ `Tạo mới bằng AI` để vẽ lại hình
  hiện tại và thêm `Tạo hình cho lời giải` ở slot `1`; action lời giải không dùng
  ảnh/code hình đề. Với block không có hình đề từ SGK, hai action target tiếp tục
  hiển thị sau khi một hoặc cả hai slot đã được sinh. Mỗi modal luôn có `Tạo mới
lại`; `Chỉnh sửa hình hiện tại` chỉ xuất hiện khi đúng slot target có asset hiện
  hành dạng `AI_TEX`, và bị ẩn khi slot chưa có hình, thiếu asset hoặc chỉ có raster.
  Action lời giải disabled kèm lý do khi block chưa có lời giải chữ.
- Renderer `example`/`exercise` đặt hình slot `0` trong phần đề bài và đặt
  hình slot `1` ngay sau tiêu đề `Lời giải`, trước prose lời giải. Modal
  `Toàn bộ hình minh họa` hiển nhãn `Ảnh N · Hình đề bài` hoặc
  `Ảnh N · Hình lời giải` theo slot; figure bổ sung giữ nhãn riêng.
- Toolbar của bốn block `knowledge`, `property`, `theorem`, `note` có icon
  `Chuyển đổi loại khối`. Click/tap mở menu ba type đích còn lại; icon và hover
  của từng lựa chọn dùng đúng màu chủ đạo của type đích (Kiến thức vàng, Tính
  chất teal, Định lí xanh lá, Chú ý rose). Chọn type chỉ cập nhật draft/preview
  local, không gọi API; chỉ action `Lưu nội dung`/`Phát hành` mới persist. Khi
  chuyển từ `note` sang theory chưa có title, UI điền nhãn type đích làm title
  mặc định để admin có thể sửa tiếp.
- Mọi figure có `Xóa`, `Thay bằng ảnh mới`, `Tạo mới bằng AI`, `Tạo mới bằng mã
code` và `Chỉnh sửa bằng mã code`. Action chỉnh sửa mã chỉ bật khi asset
  hiện hành có source `AI_TEX`; raster upload/SGK hiển thị disabled kèm lý do.
  Figure có asset hiện hành còn hiển thị icon `Đổi caption` ngay trên toolbar;
  icon mở modal có textarea tùy chọn và hai action `Hủy`/`Lưu caption`. Caption
  rỗng vẫn được phép lưu và được gỡ khỏi phần hiển thị dưới ảnh.
  `Tạo mới bằng AI` chỉ mở modal và chưa gọi provider; mục `1. Cách tạo hình` cho
  admin chọn `Tạo mới lại` hoặc `Sửa ảnh hiện tại`, nhập yêu cầu rồi bấm `Tạo mới`
  mới enqueue. Cách tạo mới gửi ảnh sách như Stage 2; cách sửa gửi ảnh sách cùng
  code TikZ hiện tại và không gửi ảnh render hiện tại. Khi không có ảnh nguồn, modal thông báo tạo từ nội dung block
  và vẫn cho tiếp tục, không render lựa chọn ảnh thứ ba. `Edit` mở cùng modal
  nhưng điền lại chế độ/yêu cầu của lần tạo ảnh gần nhất. Footer có nút `Xem dữ
liệu`; modal có model cùng control capability-aware cho Temperature/Reasoning
  Effort như modal Tạo kiến thức. Phần dữ liệu có thống kê token/chi phí, ba tab
  system prompt, user prompt, request JSON; hai prompt có chế độ `Xem trước` và
  `Chỉnh sửa`. JSON dùng chung viewer (`Xổ toàn bộ`/`Thu lại toàn bộ`) và hiển thị
  toàn bộ request OpenAI đã resolve, không chỉ generation brief nội bộ. Đổi nguồn
  ảnh phải đóng/xóa preview, xóa prompt đã sửa và đưa `Yêu cầu cho hình mới` về
  rỗng. Label optional dùng `FieldLabel` chung với tooltip `Không bắt buộc`, không
  dùng badge riêng. Description/caption của modal render LaTeX bằng cùng renderer
  với caption figure. Không có action dùng lại yêu cầu AI gần nhất và không hiện action
  `Retry bằng AI`; retry tự động compiler vẫn là lifecycle backend, còn UI chỉ
  có thể hiện retry hạ tầng không gọi AI khi phù hợp.
  Ảnh tham chiếu và `Yêu cầu cho hình mới` là hai authority duy nhất, ngang hàng
  theo phạm vi trong lần tạo lại: ảnh khóa baseline, field khóa đúng phần
  sửa đổi/bổ sung; mọi phần ảnh ngoài delta phải được giữ nguyên.
  Block sở hữu chỉ dùng kiểm chứng phần ảnh không quyết định. UI preview phải
  diễn đạt đúng precedence này. Khi field
  rỗng/blank, preview request không hiển thị key hay câu prompt về yêu cầu bổ sung.
- Figure có reference sách giáo khoa hiển thị icon `Xem ảnh sách giáo khoa`
  trực tiếp bên trái menu ba chấm. Icon chèn khung ảnh gốc vào ngay phía trên ảnh
  hiện tại trong cùng block để hai ảnh cùng hiển thị; không mở modal/drawer,
  không phủ ảnh hiện tại và không tạo thanh cuộn riêng. Icon là toggle: bấm lần
  đầu mở khung, bấm lại chính icon đó đóng khung. Khung này hiển thị đúng
  tỷ lệ/kích thước preview của cùng crop trong modal `Tạo mới hình bằng AI` bằng
  một component dùng chung (`max-height: 256px`, `object-contain`). Reference
  image lấy từ immutable snapshot, cho chọn crop và có footer `Hủy` / `Dùng hình này`.
  Checkbox `Tự động làm nét ảnh` nằm căn phải gần cụm action và mặc định tắt;
  chỉ khi admin tích chọn thì request mới chạy `TEXTBOOK_RASTER_CLEANUP_V2`
  trước khi promote. Ảnh toàn trang fallback vẫn xem được nhưng action dùng
  trực tiếp bị khóa; khi revision AI đang chạy, action dùng crop cũng bị khóa để
  tránh tranh chấp head. Khi bấm, CTA đổi sang `Đang áp dụng...` hoặc
  `Đang làm nét...` theo lựa chọn và chỉ đóng khung khi backend promote thành
  công. Lỗi phải giữ khung cùng ảnh hiện hành. Immutable snapshot phải được kế
  thừa khi tạo revision
  bằng mã code/upload; revision lịch sử có snapshot là fallback cho dữ liệu cũ,
  nên thay cách tạo hình không làm mất action xem nguồn sách. Thành công đóng
  khung xem và asset tại đúng vị trí figure được cập nhật, không mở một panel quản
  trị hình tách khỏi Summary.
- Editor source và preview SVG mở song song. Admin có thể bấm `Biên dịch` để tạo
  draft preview đã sanitize trước. Khi source đã thay đổi, `Áp dụng` vẫn bấm
  được; nếu chưa có draft hợp lệ thì UI tự chạy cùng bước compile/validator và
  chỉ promote revision khi kết quả là `DRAFT_READY`. Không có PDF, SyncTeX,
  click-preview-to-source hoặc kéo-thả đối tượng SVG. `Biên dịch` chỉ cập nhật
  preview và không đóng popover `Chỉnh nhanh` đang mở.
- Editor source của Summary và Quiz có bộ `Chỉnh nhanh` dùng chung. Các phép biến
  đổi source là deterministic và giới hạn theo cú pháp: node nhãn phải khớp toàn
  bộ nội dung; nét phụ chỉ xóa command có option dashed/dotted; độ đậm chỉ sửa
  stroke command; cỡ chữ chỉ sửa local `font=` của node đã phân loại chắc chắn.
  `Kích thước`, `Nhãn chính` và `Nhãn phụ` dùng slider `10%–200%`, hiển thị giá
  trị hiện tại và mốc gốc `100%`; chỉ commit khi thả/blur/Enter. Kích thước ghi
  marker `% classhero-display-scale` trong source thay vì chỉ đổi
  intrinsic SVG bị `object-contain` chuẩn hóa. Source mới tự gọi compile/validator hiện có để cập nhật
  preview; lỗi không ghi đè source đang hợp lệ. History quick action tối đa trong
  phiên cho phép `Hoàn tác`; khi admin tự gõ code, history được xóa để tránh ghi
  đè thay đổi thủ công. Tên điểm, ký hiệu nguyên tố, đơn vị khác nhóm đã chọn và
  node không xác định chắc chắn phải được giữ nguyên; current revision chỉ đổi
  khi admin bấm `Áp dụng`. Marker tỷ lệ được response admin/student hydrate thành
  `displayScale`; UI không lộ full source cho học sinh và không đổi cách hiển thị
  của asset cũ không có marker.
- Popover `Chỉnh nhanh` có section đầu `Nhãn và số đo (N)` dạng danh sách cuộn.
  Mỗi row dùng nhãn loại ngắn (`Nhãn`, `Số đo`, `Chú thích`, `Nhãn linh kiện`),
  input chứa nguyên nội dung text có thể sửa an toàn, icon áp dụng, icon cài đặt
  và icon xóa có tooltip/`aria-label` theo đúng row. Icon áp dụng nằm trước icon
  cài đặt, chỉ bật khi row có draft mới và chạy đúng một compile; mặc định
  row gọn và chỉ khi bấm mới xổ bên dưới input ba slider `Ngang (x)`/`Dọc (y)`
  (`-50pt–+50pt`, mốc `0`) và `Cỡ chữ` (`10%–200%`, mốc `100%`) của riêng row.
  Tại một thời điểm chỉ mở một row để giữ danh sách hai cột dễ quét. Cỡ chữ riêng
  nhân trên cỡ nền `Nhãn chính/Nhãn phụ`, không ghi đè hoặc làm mất tỷ lệ riêng
  khi slider nhóm đổi. Row giữ cùng thứ tự với source; nội dung trùng nhau vẫn là
  các row độc lập. Empty state ghi `Hình này không có nhãn hoặc số đo có
thể chỉnh nhanh`; nếu parser gặp text construct chưa hỗ trợ, panel báo số mục
  cần sửa trực tiếp trong mã và không tạo input giả. Input không compile ở từng
  keystroke: commit khi blur/Enter hoặc được flush trước khi bấm `Biên dịch`, với
  guard chống double event/compile; single quoted `pic` label vẫn có slider khi
  `pic text options` chứa font nền; chỉ nhiều quoted owner mới bị coi là mơ hồ. Escape hoàn
  nguyên row đang nhập. Trong lúc compile chỉ khóa row đang commit và các action
  làm đổi source; lỗi giữ input/source trước đó và đưa focus về row lỗi.
  Row angle `pic` có thêm slider `Khoảng cách cung tới đỉnh` `4pt–50pt`; slider
  đổi riêng bán kính nhóm cung của geometry đang chọn, không dịch text số đo hay
  bất kỳ text slot khác.
- Trước danh sách text slot, popover có card `Nhập góc nhanh` gồm `Tên góc`, `Số
đo`, checkbox `Tự nối hai cạnh còn thiếu` mặc định bật và hai CTA `Thêm góc`/
  `Bỏ góc`. Tên
  góc nhận `ABD`, `∠ABD` hoặc `A-B-D`; helper cố định nói rõ điểm giữa là đỉnh,
  không render dòng dự đoán/cảnh báo realtime dễ sai. Submit invalid vẫn bấm được để hiện
  lỗi inline; pending mới khóa CTA. Thành công xóa hai ô nhập, tự compile preview
  và dùng history/undo hiện có; source mơ hồ giữ nguyên và yêu cầu sửa code.
  `Bỏ góc` không yêu cầu số đo và không hiện banner cảnh báo đỏ chỉ vì admin đang
  nhập tên. Submit xóa toàn bộ `pic` cùng geometry kể cả viết đảo hai điểm ngoài,
  đồng thời xóa nhãn độ dạng `node` rời khi ownership được xác định tường minh từ
  named vertex/ba điểm; hai cạnh vẫn được giữ.
  `Thêm góc` là upsert theo geometry không phân biệt thứ tự hai điểm ngoài: góc
  chưa có thì thêm, góc đã có thì thay số đo và nhóm cung. Cùng số đo tái sử dụng
  kiểu cung; số đo khác hoặc symbolic chưa chứng minh bằng nhau lấy kiểu khác.
- Card `Chỉnh đoạn thẳng` đặt cạnh luồng nhập góc, gồm một input `Tên đoạn` nhận
  `BD`/`B-D`, trạng thái `đang được nối` hoặc `chưa được nối`, nút `Nối` và `Bỏ
nối`. Hai nút giữ handler thật, pending riêng, lỗi inline, auto preview và một
  bước undo. Cạnh nối mới kế thừa độ dày phổ biến của path hình học hiện tại.
  Không vô hiệu hóa nút chỉ vì input invalid; click phải hiện lỗi rõ.
- Card `Thêm trung điểm` đặt sau công cụ đoạn thẳng, gồm input `Đoạn thẳng` nhận
  `AB`/`A-B`, input `Tên trung điểm` và CTA `Thêm trung điểm`/`Xóa trung điểm`;
  CTA xóa chỉ yêu cầu input đoạn thẳng, không bắt admin nhớ tên midpoint.
  Submit `Thêm trung điểm` với tên mới trên đoạn đã có midpoint do tool quản lý
  thực hiện ghi đè thay vì báo trùng hoặc tạo midpoint thứ hai. Không render dòng
  preview/cảnh báo inline có thể nhấp nháy sai trong lúc source đang compile; lỗi
  thật báo qua toast. Tên nhập thường được tự viết hoa; label mới kế thừa font-size
  nhãn điểm hiện có, đặt lệch vuông góc đủ xa cạnh để không đè nét; marker dùng
  glyph đủ dài để đọc được ở tỷ lệ preview. Thành công xóa draft, auto compile
  preview và tạo một bước undo.
- Card đặt tên tâm nằm sau công cụ midpoint. Checkbox `Thêm tên tâm đường tròn`
  mặc định tắt; bật checkbox mới render input `Tên tâm` và CTA `Thêm tên tâm` bên
  cạnh. Input tự viết hoa. Thành công đặt nhãn cạnh đúng tâm đường tròn đơn, kế
  thừa font point label và không tạo thêm center dot; tên mới ghi đè block nhãn
  tâm do tool quản lý.
- Khi bấm thùng rác của text slot `Số đo` thuộc angle `pic`, UI xóa cả nhãn và
  toàn bộ cung đồng tâm cùng geometry `X--V--Y`; cạnh/ray và các nhóm góc khác
  vẫn giữ nguyên. Text slot đo góc dạng node rời không được suy diễn owner cung.
- `Tạo mới bằng mã code` dùng lại editor/compile/error panel nhưng nạp snippet
  TikZ mới. Block chưa từng có hình hoặc đã xóa hình chỉ được gắn reference sau
  khi admin apply draft thành công; đóng modal/compile lỗi không tạo placeholder.
- Thay ảnh mở file picker riêng, chỉ nhận JPEG/PNG/WebP theo giới hạn; upload
  thành công thay asset nguyên tử. Sinh lại figure thành công giữ asset cũ trong
  khi candidate chạy và chỉ swap khi candidate mới pass.
- `Lưu`/`Phát hành` disabled nếu còn placeholder `FAILED` hoặc initial figure
  chưa terminal; tooltip liệt kê block đang chặn. Cảnh báo
  `MISSING_REQUIRED_FIGURE` không disable hai nút.
- Figure luôn nằm trong surface trắng/light kể cả khi giao diện admin/student đang
  dark; không có dark variant trong giai đoạn này.
- Student chỉ thấy Summary đã phát hành và asset figure `SUCCEEDED`; không thấy
  source, reverse map, log, repair count hoặc action quản trị.
- Flashcard giữ review flow text-only riêng. Card Quiz/Test dùng review flow hiện
  tại nhưng phải hiển thị asset hình đề/hình lời giải đã dựng; khi figure còn
  `QUEUED`/`RENDERING`/`REPAIRING`, card hiển thị trạng thái và poll nhanh đến
  khi terminal. Mọi trạng thái figure vẫn giữ menu tạo code/AI/upload; edit code
  chỉ hiện khi revision hiện hành là `AI_TEX`. Caption và xóa dùng dialog theo
  theme, xóa hình đề cảnh báo và xóa luôn hình lời giải phụ thuộc. Card vẫn có CTA
  tạo thêm vào set hiện tại sau mỗi lượt thành công.
- Mọi màn có loading, empty, error, disabled state; chỉ poll nhanh khi figure/job
  active và giảm tần suất khi ở trạng thái terminal.

### 6.6. Content editors

Dùng chung editor cho:

- Summary.
- Question.
- Options.
- Explanation.
- Flashcard front/back.
- News content.

Editor cần hỗ trợ:

- Bôi chọn một phần văn bản rồi áp dụng định dạng đúng trên vùng chọn.
- Paragraph/heading, in đậm, in nghiêng, gạch chân, gạch ngang và màu chữ.
- Bullet list và numbered list.
- Căn trái, căn giữa, căn phải và căn đều.
- `Tab` thụt đoạn hiện tại sang phải, `Shift + Tab` lùi về trái; trong bullet
  hoặc numbered list, hai phím này tăng/giảm cấp list item.
- Icon chèn bảng mở modal cấu hình 1–20 hàng/cột và tùy chọn hàng tiêu đề; không
  render form cấu hình chen vào bên dưới editor. Khi focus trong bảng hiện
  context toolbar icon-only, chia nhóm thao tác cột, hàng, gộp/tách, tiêu đề và
  xóa bảng; mỗi icon có `aria-label` và tooltip xuất hiện tức thì. Độ rộng cột
  thay đổi bằng cách kéo đường biên dọc, chiều cao hàng thay đổi bằng cách kéo
  đường biên ngang; không dùng input pixel thủ công.
- Table node là nội dung cấu trúc hợp lệ kể cả khi các ô chưa có chữ: editor
  phải ẩn placeholder và validation không được báo field rỗng sau khi chèn.
- Chèn ảnh qua object storage; không nhúng base64 vào rich content. Ảnh có
  action nổi để cắt xén hoặc xóa nhanh, handle kéo ở góc để đổi độ rộng
  `20–100%` và label phần trăm kích thước. Crop dùng khung lưới một phần ba phủ
  trực tiếp trên ảnh; admin kéo vùng cắt, cạnh hoặc góc và có Hủy/Đặt lại/Áp
  dụng ngay trên preview, không dùng form slider bốn cạnh.
- Công thức Toán/Lý bằng LaTeX/KaTeX và công thức/phương trình Hóa bằng
  mhchem; hỗ trợ cả công thức trong dòng và một dòng riêng, có xem trước.
- Form Quiz dùng editor này cho câu hỏi, từng phương án, gợi ý và lời giải.
  Đáp án `TEXT_INPUT` dùng đúng một field chuỗi có công cụ LaTeX/mhchem; không
  có action thêm đáp án hoặc checkbox cấu hình so khớp vì backend tự chấm các
  cách viết tương đương.
- Editor nặng trong modal phải lazy-load theo tương tác, không kéo Tiptap,
  KaTeX và image tools vào bundle ban đầu của lesson detail.

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
