## 2026-07-25

### Tính năng mới / Cải thiện
- Cải thiện UX trên thiết bị di động: Ẩn hoàn toàn nút Tắt/Bật âm lượng vì trình duyệt di động (iOS/Android) chặn JavaScript can thiệp vào âm lượng phần cứng của thiết bị.
- Bổ sung các Safety Checks (kiểm tra `typeof ... === 'function'`) trước khi gọi các hàm API nội bộ của YouTube Iframe (`mute`, `unMute`, `setVolume`, `unloadModule`...) để ngăn chặn triệt để lỗi crash `TypeError` khi mạng lag hoặc khi Iframe chưa kịp render các module điều khiển.
- Cải thiện thao tác cảm ứng trên Mobile: Chạm vào video khi đang ẩn thanh công cụ sẽ chỉ hiển thị thanh công cụ (thay vì Tạm dừng video), giống với trải nghiệm người dùng trên app YouTube.
- Bổ sung chức năng Bật/Tắt Phụ đề (CC - Closed Captions) trên thanh điều khiển.
- Cấu hình ép buộc ẩn Phụ đề (CC) mặc định cho mọi video (ghi đè cài đặt tài khoản cá nhân của người xem) nhằm giữ giao diện học tập gọn gàng ban đầu.
- Fix lỗi crash ứng dụng (`TypeError: seekTo is not a function`) khi người dùng ấn nút "Bắt đầu học" quá nhanh trước khi Youtube Iframe khởi tạo xong.
- Nâng cấp UI ở chế độ Toàn màn hình: Tự động tính toán Safe Area tỷ lệ 16:9 bao bọc video để giữ Logo, Watermark và thanh điều khiển luôn bám sát vào viền video (thay vì bám vào viền màn hình và bị chèn lên khoảng đen letterbox).
- Fix icon phóng to/thu nhỏ chưa đổi trạng thái đúng ở chế độ Toàn màn hình.
- Fix triệt để tính năng Fullscreen của `CustomYoutubePlayer` trên thiết bị di động (đặc biệt là iOS). Xây dựng cơ chế fallback dùng CSS (`rotate-90`, `fixed`) cho Safari, trong khi vẫn kích hoạt Native Fullscreen mượt mà cho Android/Desktop.
- Bổ sung cơ chế khóa cuộn trang (`overflow-hidden` trên body) khi bật chế độ giả lập toàn màn hình để ngăn người dùng thao tác nhầm bên ngoài video.
- Tạm thời vô hiệu hóa Auth Guard cho các tính năng Admin (Layout và API Lessons/Quiz) để hỗ trợ thao tác kiểm thử trực tiếp trên điện thoại mà không cần đăng nhập.
- Cải tiến hàm lấy Base URL của API (`api-client.ts`) để tự động map IP mạng LAN (Network IP) từ trình duyệt thay cho `localhost`, giúp điện thoại có thể truy cập backend.
- Cập nhật Prisma schema: Thêm trường `customVideoSettings` (Kiểu Json) vào `Lesson` model để hỗ trợ cấu hình video nâng cao.
- Triển khai API, DTO, Selectors và Serializers cho `Lesson` để hỗ trợ `customVideoSettings`.
- Phát triển Admin UI cho Quản lý Bài học (Lessons) và Bài tập (Quiz) bao gồm việc tích hợp custom youtube player.
- Refactor `ChapterLessonPanel` và cập nhật các API mappers, types liên quan đến bài học trên giao diện admin.
- Bổ sung bộ tests cho Milestone 6 (Quiz CRUD): validate schema quiz, tiptap schema và integration tests cho Quiz API.
- Thêm script sửa DB `fix-db.ts` và kiểm tra zod (`test-zod.ts`).
- Cập nhật `AGENTS.md` (Thêm rule restart worker khi sửa code).

### File thay đổi
- `AGENTS.md`
- `apps/api/src/modules/learning-paths/controllers/admin-lessons.controller.ts`
- `apps/api/src/modules/quiz/controllers/admin-quiz.controller.ts`
- `apps/web/app/(admin)/layout.tsx`
- `apps/web/features/admin/lessons/hooks/use-admin-lesson.ts`
- `apps/web/lib/api-client.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/learning-paths/dto/update-lesson.dto.ts`
- `apps/api/src/modules/learning-paths/selectors/lesson.selects.ts`
- `apps/api/src/modules/learning-paths/serializers/lesson.serializers.ts`
- `apps/api/src/modules/learning-paths/services/lessons.service.ts`
- `apps/api/src/modules/learning-paths/types/lesson.types.ts`
- `apps/api/src/modules/learning-paths/utils/learning-path.helpers.ts`
- `apps/web/app/globals.css`
- `apps/web/features/admin/courses/admin-courses-data.ts`
- `apps/web/features/admin/courses/api/admin-lessons-api.ts`
- `apps/web/features/admin/courses/mappers/admin-course-api-mappers.ts`
- `apps/web/features/admin/courses/screens/admin-course-detail-manager/components/chapter-lesson-panel.tsx`
- `apps/web/features/admin/courses/types/admin-course-api-types.ts`
- `apps/web/features/student/courses/screens/purchased-courses-screen/components/student-learning-greeting-panel.tsx`
- `packages/shared/src/types/index.ts`
- `packages/shared/src/types/custom-video-settings.ts` (Mới)
- `apps/api/fix-db.ts` (Mới)
- `apps/api/src/common/types/` (Mới)
- `apps/api/src/common/validation/decorators/` (Mới)
- `apps/api/src/common/validation/zod-schemas/` (Mới)
- `apps/api/src/modules/quiz/` (Mới)
- `apps/api/test/m6.1-quiz-schema.test.ts` (Mới)
- `apps/api/test/m6.1-tiptap-schema.test.ts` (Mới)
- `apps/api/test/m6.2-quiz-crud.int.test.ts` (Mới)
- `apps/web/app/(admin)/admin/lessons/` (Mới)
- `apps/web/components/shared/custom-youtube-player.tsx` (Mới)
- `apps/web/features/admin/lessons/` (Mới)
- `apps/web/features/admin/quiz/` (Mới)
- `apps/web/test-zod.mjs` (Mới)
- `apps/web/test-zod.ts` (Mới)

### Fixes
- Đổi màu nền thanh Header (`student-courses-header.tsx`) thành màu đặc hoàn toàn (không dùng `backdrop-blur` và `color-mix` trong suốt) để UI video (các dropdown) không bị hiện mờ đè lên Header khi cuộn trang.
- Sửa lỗi video không xoay ngang trong Fullscreen trên điện thoại (đặc biệt là Android) bằng cách ép bỏ qua Native Fullscreen khi đang ở chế độ dọc (`isPortrait`), từ đó giúp CSS `rotate-90` (chế độ giả lập Fullscreen) luôn được kích hoạt.
- Thêm `relative z-0` vào container của video để nhốt các Tooltip (`z-50`) bên trong video không cho đè lên thanh Header (`z-40`) hay Sidebar.
- Đổi các class `sm:` thành `lg:` đối với Logo Watermark trong video ở chế độ toàn màn hình để ngăn logo bị phóng to quá mức (scale-125) khi xem trên thiết bị di động nằm ngang.

