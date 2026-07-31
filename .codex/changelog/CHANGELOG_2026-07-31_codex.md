# 2026-07-31

## M7: Cải thiện trải nghiệm học tập của học viên
- Tách API client/server fetching (SSR & CSR) cho luồng lấy dữ liệu khoá học và bài học của sinh viên, hỗ trợ initial load nhanh hơn.
- Cải thiện `custom-youtube-player` và `lesson-video-panel`, hỗ trợ autoplay và next lesson tốt hơn.
- Bổ sung `flashcard-runner-screen`, xử lý history run/quiz của flashcard và test (quiz) trên `flashcard-runner-history.ts` và `quiz-runner-history.ts`.
- Hoàn thiện E2E test cho luồng học tập `student-learning-m7.spec.ts`.

## M2: Đăng nhập & Xác thực
- Nâng cấp luồng quản lý session bằng việc tách biệt client & server session (`auth-session-cookie-client.ts`, `server-auth-session.ts`).
- Thêm test case cho luồng hard-refresh auth `auth-hard-refresh.spec.ts`.
- Bổ sung file docs API `auth-profile.md` và note học tập `auth-basic.md`.

## M3-M6: Admin & Quản trị Nội dung
- Cải tiến tính ổn định của `pdf-page-preview` qua component client/server riêng.
- Cập nhật các bảng điều khiển `enrollment-list-panel`, `flashcard-set-panel`, v.v...
- Tách `server-admin-course-data.ts` tối ưu cho SSR của admin.
- Cập nhật test suites cho admin documents, flashcards, tests.

## Khác
- Bổ sung các utilities như `query-render-state.ts`, `server-sidebar-collapse-state.ts`.
- Cập nhật tài liệu UI Design System, Code Index, và Learning Notes.
