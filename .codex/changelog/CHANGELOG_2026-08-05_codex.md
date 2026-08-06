# Changelog 2026-08-05

## feat(ai): remove priority fields and fix UI flickering
- Removed `focus` and `contentSections` logic from AI prompt generation schema and API endpoint.
- Fixed UI flickering during AI configuration preview update by managing stable local state.

## fix(web): globally remove cursor-wait and unify login error
- Removed all instances of `cursor-wait` and `disabled:cursor-wait` utility classes across the web app.
- Unified login API error message in the client to clearly denote bad credentials or validation issues with a single message.
- Fixed an issue where the logout logic failed to redirect correctly by enforcing a `window.location.href` reload instead of internal Next.js transitions.
- Centered the ClassHero logo horizontally in the admin panel sidebar.

## fix(admin/ai): update AI generation panel UI and realtime behaviors
- Removed the redundant loading spinner from the AI job status badge.
- Reordered the actions to place the "Thu hồi phát hành" button after "Lưu nội dung".
- Added query invalidation logic to `updateLesson` and `createLesson` mutations to update the AI panel when course documents are modified.
- Added a 5-second polling interval to the AI panel when the lesson's background document generation is not yet fully ready, providing a realtime-like update experience.

## perf(admin/ai): optimize document processing polling
- Refactored `sourceDocumentsQuery`, `lessonDocumentsQuery`, and `useAdminAiGenerationPanel` to strictly trigger the 5-second polling cycle ONLY when there is at least one document actively in the `PROCESSING` state.
- Completely halted unnecessary background API calls (polling spam) when all documents are empty, already processed (`READY`), or encountered an error.
