## 2026-07-25

### Tính năng mới / Cải thiện
- Cập nhật Prisma schema: Thêm trường `customVideoSettings` (Kiểu Json) vào `Lesson` model để hỗ trợ cấu hình video nâng cao.
- Triển khai API, DTO, Selectors và Serializers cho `Lesson` để hỗ trợ `customVideoSettings`.
- Phát triển Admin UI cho Quản lý Bài học (Lessons) và Bài tập (Quiz) bao gồm việc tích hợp custom youtube player.
- Refactor `ChapterLessonPanel` và cập nhật các API mappers, types liên quan đến bài học trên giao diện admin.
- Bổ sung bộ tests cho Milestone 6 (Quiz CRUD): validate schema quiz, tiptap schema và integration tests cho Quiz API.
- Thêm script sửa DB `fix-db.ts` và kiểm tra zod (`test-zod.ts`).
- Cập nhật `AGENTS.md` (Thêm rule restart worker khi sửa code).

### File thay đổi
- `AGENTS.md`
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
