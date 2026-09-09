# ADR-0029 - Test Admin là timed Quiz/Assessment mode

Date: 2026-09-09

Status: Accepted

## Context

Quiz và Test Admin đã có cùng editor, question shape, review, AI generation,
figure và refinement nhưng được phát triển qua các path Test độc lập. Hai path
tạo drift về capability, prompt/version, validation và UI. Owner chốt Test Admin
phải dùng lại Quiz thay vì sinh một bản độc lập; thời gian làm bài chỉ được thiết
lập riêng cho bộ Test.

## Decision

- Admin Test là `kind=TEST` của shared Assessment/Quiz core. Route `/admin/test-*`
  được giữ để tương thích nhưng chỉ là adapter; không thêm CRUD service, hook,
  schema, dialog, component, worker pipeline hoặc AI prompt Test Admin riêng.
- TestSet editor dùng cùng UI/logic QuizSet, thêm đúng `durationSeconds`. Đây là
  nơi duy nhất admin cấu hình thời gian.
- Modal AI Test giống modal AI Quiz. Request v2 chỉ đổi target tùy chọn thành
  `targetTestSetId`; modal/payload/prompt/output không có `durationSeconds`.
  Backend authorize target rồi tự resolve duration từ TestSet. Nếu lesson chưa
  có TestSet, backend tạo `Bộ đề 1` với mặc định 15 phút trước khi enqueue;
  admin đổi thời gian tại set editor. ValidationPipe từ chối `durationSeconds`
  hoặc `targetQuizSetId` trong request AI Test.
- Quiz figure persistence mở rộng một target XOR Quiz/Test; figure revision,
  rendering và solution refinement dùng core chung. `AiGenerationType.TEST`
  vẫn giữ nguyên cho routing, quota, usage và accounting.
- Test generation tái sử dụng nguyên cơ chế chống trùng của Quiz cho toàn bộ câu
  Quiz còn tồn tại trong lesson rồi chỉ bổ sung toàn bộ câu Test còn tồn tại.
  Cả hai nguồn gồm mọi review status; câu/set đã xóa mềm bị loại. Quiz generation
  không đọc ngược câu Test.
- Không gộp bảng Quiz/Test hoặc student attempts trong ADR này. Test giữ
  soft-delete persistence và M7 timer, scoring, prerequisite,
  completion/leaderboard policy; riêng publication Admin dùng đúng shared
  watermark/state machine của Quiz. Các khác biệt persistence không được kéo
  ngược vào implementation Admin độc lập.

## Cutover

1. Đưa shared Assessment adapters, v2 generation và dual figure target vào trước.
2. Giữ legacy `/admin/test-*` contract trong compatibility window; job legacy đã
   enqueue được phép hoàn tất theo version cũ.
3. Chuyển UI Test sang shared components/hook/schema rồi xóa implementation Test
   admin trùng lặp.
4. Chỉ xóa fallback legacy sau khi migration, parity test, worker restart và
   realtime visual smoke pass.

## Consequences

- Capability mới của Quiz Admin tự có cho Test qua shared core; test parity phải
  bảo vệ điều này.
- Duration không thể ảnh hưởng prompt hay bị client giả mạo ở AI flow.
- Deploy worker phải restart trước khi smoke test. Unit/integration mặc định
  mock provider; nếu owner cho phép live test, ngân sách tổng tối đa 5.000 VND.
