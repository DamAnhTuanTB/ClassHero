# Kế hoạch hard-cutover Test Admin sang dùng chung Quiz Admin

Trạng thái: hoàn tất implementation, deterministic verification và realtime
visual/live-provider smoke ngày 2026-09-09

Task đề xuất: `M6.6`

Mode thực tế: `Full-stack (UI + API + DB + Worker/Integration)`

Phạm vi milestone: mở rộng quyết định của `M6.4`; không sửa lại lịch sử hoàn thành
`M6.4` và không đổi thứ tự các task cũ.

## 1. Quyết định của owner

Phần quản trị Test không phải một tính năng độc lập với Quiz.

- Quiz Admin là source of truth về UI, form, validation, CRUD, review, publish,
  AI generation, JSON review, figure và solution refinement.
- Test Admin dùng nguyên flow và implementation chung của Quiz Admin.
- Khác biệt nghiệp vụ duy nhất trong Admin là bộ Test có thêm thời gian làm bài
  tại modal tạo/sửa bộ Test.
- Modal tạo Test bằng AI dùng nguyên modal Quiz và tuyệt đối không chứa/gửi field
  thời gian; backend đọc `durationSeconds` từ bộ Test đích rồi snapshot vào job.
- Không giữ một bản sao Test rồi tiếp tục sửa song song với Quiz.
- Code Test Admin cũ phải được xóa sau khi mọi call site đã chuyển sang core chung.

Contract mục tiêu:

```ts
type AdminAssessmentKind = "quiz" | "test";

type AdminAssessmentSetInput = {
  title: string;
  durationSeconds?: number;
};
```

Invariant:

- `quiz`: không gửi `durationSeconds`.
- `test`: bắt buộc gửi `durationSeconds` hợp lệ.
- Ngoài field thời gian tại set editor và copy hiển thị `Quiz/Test`, không được có
  nhánh nghiệp vụ riêng cho Test trong component, hook, schema hoặc service dùng
  chung.

## 2. Phạm vi chính xác

### 2.1. Trong phạm vi

- Tab Test trong trang chi tiết lesson của Admin.
- Danh sách bộ, chọn bộ, tạo/sửa/xóa bộ.
- Danh sách câu hỏi, tạo/sửa/xóa, duyệt từng câu và duyệt hàng loạt.
- Bốn loại câu hỏi, rich text, hint, đáp án, lời giải và validation giống Quiz.
- UI/JSON/Split review, generation metadata và history giống Quiz.
- Figure câu hỏi/lời giải, upload, sửa code, tạo/tinh chỉnh AI và xóa giống Quiz.
- Solution refinement giống Quiz.
- Query key, cache update, polling, error/loading/empty/pending state giống Quiz.
- Admin API/DTO/service cần thiết để Test cung cấp cùng contract cho UI chung.
- Xóa code Test Admin cũ sau hard-cutover.

### 2.2. Ngoài phạm vi

- Student Test runner, đồng hồ đếm ngược và auto-submit.
- Start/resume/submit/review Test attempt.
- Best attempt, top 5, lesson completion và prerequisite mở bài Test.
- Hợp nhất toàn bộ bảng Quiz/Test hoặc migration lịch sử Test attempt.
- Thay đổi cách tính điểm đang phục vụ student.
- Xóa `StudentTestAttemptsService`, student controller hoặc các model Test đang
  được student flow sử dụng.

Việc xóa trong task này chỉ áp dụng cho implementation Admin Test bị trùng. Không
xóa dữ liệu Test, bảng Test hoặc code student Test.

## 3. Hiện trạng đã đối chiếu

### 3.1. Frontend

`AdminTestsTab` đã render `AdminAssessmentTab` với `assessmentKind="test"`, nhưng
core hiện tại chưa thật sự dùng chung hoàn toàn:

- `AdminAssessmentTab` import đồng thời hook/API Quiz và Test rồi rẽ nhánh theo
  `isTest`.
- Set editor của Quiz và Test là hai component riêng.
- Question editor gọi hai bộ mutation riêng.
- Figure upload chỉ render cho Quiz.
- Bulk review, generation JSON, history, solution refinement và một số action
  nâng cao bị vô hiệu hóa cho Test.
- Test có explanation renderer riêng.
- Kiểu Test bổ sung `difficulty`, `difficultyRatioJson`, `totalScore`, `points`
  và `effectivePoints`, làm UI tiếp tục có contract khác Quiz.

Các file lớn hiện tại:

- `admin-assessment-tab.tsx`: khoảng 2.314 dòng.
- `admin-assessment-question-editor-dialog.tsx`: khoảng 1.009 dòng.
- `use-admin-quiz.ts`: khoảng 588 dòng.
- `admin-quiz-api.ts`: khoảng 563 dòng.

Không tiếp tục thêm `if (isTest)` vào hai component lớn này. Task hard-cutover phải
tách orchestration và transport trước khi xóa code cũ.

### 3.2. Backend

Admin Test hiện có controller/service/DTO/validator riêng. API mới chỉ tương đồng
Quiz ở CRUD cơ bản và review từng câu; chưa có toàn bộ capability của Quiz như:

- prompt preview đầy đủ;
- review hàng loạt;
- cập nhật generation JSON;
- figure lifecycle;
- solution refinement.

Vì vậy chỉ thay màn hình Test bằng JSX của Quiz sẽ tạo các action không có backend
xử lý. Hard-cutover phải hoàn thành API parity trước khi bật toàn bộ UI Quiz cho
Test.

## 4. Kiến trúc mục tiêu

```text
AdminQuizTab ── kind=quiz ──┐
                            ├── AdminAssessmentTab
AdminTestsTab ─ kind=test ──┘        │
                                     ├── useAdminAssessment(kind)
                                     ├── AssessmentSetEditor
                                     ├── AssessmentQuestionEditor
                                     ├── Quiz review/figure/refinement UI chung
                                     └── adminAssessmentTransport(kind)
                                                    │
                         ┌──────────────────────────┴─────────────────────────┐
                         │                                                    │
                    Quiz admin routes                                   Test admin routes
                         │                                                    │
                         └──────── Assessment Admin application core ────────┘
                                              │
                               Quiz/Test persistence adapters
```

Quy tắc ownership:

- `features/admin/assessments` sở hữu toàn bộ UI, hook, schema, type và transport
  dùng chung.
- `features/admin/quiz` chỉ giữ capability thật sự gắn với tên route/provider
  Quiz trong thời gian chuyển tiếp; sau cutover, component chung phải được chuyển
  về `features/admin/assessments`.
- `features/admin/tests` chỉ được giữ screen entry mỏng nếu route lazy-loading
  hiện tại còn cần nó.
- Backend application logic Admin đặt trong một core dùng chung; controller Quiz
  và Test chỉ map route/DTO sang core.
- Repository/persistence adapter được phép khác nhau vì schema Quiz/Test hiện tại
  chưa hợp nhất. Khác biệt persistence không được rò lên UI hoặc application rule.
- Publication/review và figure enrichment là shared services được cả Quiz/Test
  gọi trực tiếp; Test không tự publish set khi duyệt câu cuối.

## 5. Contract Admin chung

### 5.1. Set

Shape chung mà UI sử dụng:

```ts
type AdminAssessmentSet = {
  id: string;
  lessonId: string;
  title: string;
  source: string;
  reviewStatus: string;
  questionCount: number;
  sortOrder: number;
  pendingReviewQuestionCount?: number;
  unpublishedApprovedQuestionCount?: number;
  aiGenerations?: AdminAssessmentGenerationSummary[];
  aiGeneration?: AdminAssessmentGenerationSummary | null;
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
};
```

Test Admin không dùng các field sau để điều khiển UI riêng:

- `difficultyRatioJson`;
- `totalScore`;
- difficulty cấp set;
- points/effectivePoints cấp câu.

Các cột này có thể tiếp tục tồn tại tạm thời trong database/serializer student để
không ảnh hưởng flow làm bài. Chúng không còn là khác biệt của Admin UI và không
được tạo form/action riêng.

### 5.2. Question

UI chung dùng một `AdminAssessmentQuestion` dựa nguyên trên contract Quiz:

- `questionType`;
- `difficulty`;
- `questionJson`;
- `optionsJson`;
- `correctAnswerJson`;
- `hintJson`;
- `gradingConfigJson`;
- `explanation`;
- `sourceMetadataJson`;
- `generationQuestionJson`;
- `reviewStatus`;
- `figures`.

Khác biệt `quizSetId`/`testSetId` phải được normalize thành `setId` tại transport
hoặc serializer. Component không cast qua lại giữa `AdminQuizQuestion` và
`AdminTestQuestion`.

### 5.3. Transport

Một bảng route theo `kind` cung cấp cùng operation:

```ts
type AdminAssessmentTransport = {
  getSets(...): Promise<AdminAssessmentSet[]>;
  createSet(...): Promise<AdminAssessmentSet>;
  updateSet(...): Promise<AdminAssessmentSet>;
  deleteSet(...): Promise<void>;
  getQuestions(...): Promise<AdminAssessmentQuestion[]>;
  createQuestion(...): Promise<AdminAssessmentQuestion>;
  updateQuestion(...): Promise<AdminAssessmentQuestion>;
  deleteQuestion(...): Promise<void>;
  reviewQuestion(...): Promise<AdminAssessmentQuestion>;
  reviewAllPending(...): Promise<AdminAssessmentBulkReviewResult>;
  updateGenerationJson(...): Promise<AdminAssessmentQuestion>;
};
```

Figure/refinement operations cũng phải dùng interface chung hoặc target descriptor
`{ kind, questionId }`; component không tự ghép `/quiz-*` hoặc `/test-*` route.

## 6. Kế hoạch triển khai theo batch

### Batch 1 — Khóa regression baseline

Mục tiêu: ghi nhận hành vi Quiz Admin đang ổn trước khi refactor.

- Bổ sung/chuẩn hóa test cho các flow Quiz Admin quan trọng.
- Chụp contract response của Quiz sets/questions, generation metadata và figures.
- Liệt kê tất cả action đang hiển thị ở Quiz Admin.
- Tạo parameterized fixture `kind=quiz|test`; ban đầu Test được phép fail để thể
  hiện gap hiện tại.

Completion gate:

- Có test chứng minh Quiz baseline.
- Có capability matrix Quiz/Test; mọi ô Test phải đạt trước khi xóa code cũ.

### Batch 2 — Tạo Assessment Admin contract dùng chung

Mục tiêu: component không biết model/route riêng của Quiz hoặc Test.

Frontend dự kiến:

```text
apps/web/features/admin/assessments/
├── api/admin-assessment-api.ts
├── hooks/use-admin-assessment.ts
├── schemas/assessment-set-form-schema.ts
├── types/admin-assessment.types.ts
├── utils/admin-assessment-adapter.ts
└── components/
    ├── admin-assessment-tab.tsx
    ├── admin-assessment-question-editor-dialog.tsx
    └── admin-assessment-set-editor-dialog.tsx
```

- Chuyển type chung từ `admin-quiz-api.ts` sang assessment types.
- Query key bắt buộc chứa `kind` để cache Quiz/Test không đè nhau.
- Hook duy nhất nhận `kind`, `lessonId`, `setId` và gọi transport tương ứng.
- Normalize `quizSetId`/`testSetId` thành `setId` tại boundary.
- Giữ support `initialQuizData` bằng initial-data contract chung; Test có thể chưa
  cần SSR initial data nhưng component không được rẽ nhánh business logic.

Completion gate:

- `AdminAssessmentTab` không import file dưới `features/admin/tests`.
- CRUD Quiz chạy qua hook/transport chung và không đổi behavior.

### Batch 3 — Một set editor, Test chỉ thêm duration

Mục tiêu: xóa modal bộ Test riêng.

- Đổi `AdminQuizSetEditorDialog` thành `AdminAssessmentSetEditorDialog`.
- Reuse nguyên layout, validation, focus, pending state và copy của Quiz.
- Khi `kind=test`, render thêm đúng một `TextField` thời gian theo phút.
- Convert phút sang `durationSeconds` tại submit boundary.
- Validate integer từ 1 đến 240 phút, không dùng native number spinner.
- Không render difficulty cấp set.
- Create/edit title, default sequential title và auto-select set mới phải dùng
  cùng implementation cho hai kind.

Completion gate:

- So sánh DOM/interaction: form Test bằng form Quiz cộng đúng một field duration.
- Xóa được `admin-test-set-editor-dialog.tsx` và `test-set-form-schema.ts`.

### Batch 4 — Một question editor và renderer

Mục tiêu: Test dùng nguyên question editor của Quiz.

- Xóa nhánh chọn `useAdminTestQuestionMutations` trong editor.
- Editor gọi duy nhất `useAdminAssessmentQuestionMutations(kind, ...)`.
- Figure upload fields render cho cả Quiz và Test.
- Dùng cùng rich editor, options/statements/text-input mapping và validation.
- Dùng cùng explanation renderer/normalizer; không giữ Test explanation card riêng.
- Toast/error/pending state không rẽ nhánh theo kind.

Completion gate:

- Cùng một test suite tạo/sửa bốn loại câu hỏi cho Quiz và Test.
- Figure draft/upload/delete của Test có backend contract tương ứng.
- Xóa được `admin-test-explanation-content.tsx`.

### Batch 5 — Backend Admin application core

Mục tiêu: Test controller không duy trì một bản nghiệp vụ CRUD/review riêng.

Backend dự kiến:

```text
apps/api/src/modules/assessments/
├── assessments.module.ts
├── dto/
│   ├── assessment-set.dto.ts
│   └── assessment-question.dto.ts
├── services/assessment-admin.service.ts
├── repositories/
│   ├── quiz-assessment-admin.repository.ts
│   └── test-assessment-admin.repository.ts
├── serializers/assessment-admin.serializer.ts
├── types/assessment-admin.types.ts
└── utils/assessment-question-content.ts
```

- Tách validation/normalization question đang ổn của Quiz xuống core.
- Tách review/publish/generation projection thành operation dùng chung.
- Quiz/Test repository chỉ chịu trách nhiệm Prisma model và tên foreign key.
- `AdminQuizController` và `AdminTestsController` giữ route hiện tại nhưng chỉ
  truyền `kind` và DTO vào `AssessmentAdminService`.
- DTO Test set kế thừa contract set chung và bắt buộc `durationSeconds`.
- Admin service không xử lý student timer, attempts hoặc best score.

Completion gate:

- Không còn duplicate create/update/delete/review question trong
  `TestsService` và Quiz service.
- Test Admin routes trả response đã normalize giống Quiz, cộng duration ở set.
- Student Test service vẫn build và test nguyên trạng.

### Batch 6 — Parity các capability nâng cao của Quiz Admin

Mục tiêu: loại bỏ toàn bộ điều kiện đang tắt tính năng với Test.

API Test phải có cùng operation với Quiz cho:

- prompt preview/generate AI;
- review toàn bộ câu pending;
- update generation JSON;
- generation history và usage/cost;
- question/solution figure lifecycle;
- solution refinement preview/queue/status.

Modal AI Test dùng cùng form/schema/prompt preview với Quiz, chỉ thay target từ
`targetQuizSetId` sang `targetTestSetId`. Cả hai target đều được bỏ trống khi
lesson chưa có set; với Test, server tạo `Bộ đề 1` có duration mặc định 15 phút
trước khi enqueue. Modal không render hoặc gửi `durationSeconds`; preview/queue
resolve duration từ TestSet hoặc giá trị mặc định trên server.

Nguyên tắc:

- Reuse application service, validator, UI component và worker orchestration của
  Quiz khi invariant thật sự giống nhau.
- Provider routing có thể giữ label `TEST` để accounting riêng, nhưng không giữ
  một UI/service flow khác.
- Khi sinh Test, cơ chế chống trùng phải chạy nguyên đường lấy/serialize câu Quiz
  hiện có, sau đó nối thêm câu Test hiện có cùng lesson. Không tạo prompt hay
  serializer chống trùng riêng cho Test và không lọc câu theo review status.
- Nếu figure persistence hiện chỉ gắn `QuizQuestion`, bổ sung target abstraction
  hoặc quan hệ Test phù hợp. Không giả lập figure trong UI và không hard-code ID.
- Không gọi provider trả phí trong test; dùng mock/cache/fixture.

Completion gate:

- Mọi action hiển thị ở Quiz Admin cũng xuất hiện và chạy được ở Test Admin.
- Trong UI chung không còn `if (isTest) return`, `!isTest && ...` để tắt capability.
- Chỉ còn condition hợp lệ cho duration trong set editor, copy và route transport.

### Batch 7 — Hard-cutover và xóa code Test Admin cũ

Chỉ chạy batch này sau khi Batch 1–6 pass.

Các file frontend dự kiến xóa:

```text
apps/web/features/admin/tests/api/admin-tests-api.ts
apps/web/features/admin/tests/hooks/use-admin-tests.ts
apps/web/features/admin/tests/schemas/test-set-form-schema.ts
apps/web/features/admin/tests/components/admin-test-explanation-content.tsx
apps/web/features/admin/tests/screens/admin-tests-tab/components/admin-test-set-editor-dialog.tsx
```

File giữ lại:

```text
apps/web/features/admin/tests/screens/admin-tests-tab/index.tsx
```

Screen entry này chỉ được phép render:

```tsx
<AdminAssessmentTab kind="test" lessonId={lessonId} />
```

Backend dự kiến xóa hoặc rút về adapter:

- Xóa `tests.service.ts` sau khi toàn bộ Admin controller dùng
  `AssessmentAdminService`; không xóa `student-test-attempts.service.ts`.
- Xóa `test-question-content.ts` khi validation đã chuyển sang core.
- Xóa DTO CRUD question Test trùng; giữ DTO set extension chứa duration nếu cần.
- Giữ `admin-tests.controller.ts` dưới dạng route adapter để không phá API contract.
- Giữ `tests.module.ts` để wire student Test và adapter Admin trong giai đoạn này.

Sau xóa:

- Chạy `rg` bảo đảm không còn import file đã xóa.
- Chạy `rg` trên `AdminAssessmentTab` và question editor; mọi branch Test phải
  thuộc whitelist `duration/copy/transport`, không phải capability.
- Không để compatibility file chỉ re-export code cũ.

### Batch 8 — Docs và code index

Sau khi code đã đạt acceptance criteria:

- Cập nhật `docs/01-product-scope.md`: Admin Test giống Quiz, thêm duration.
- Cập nhật Test flow trong `docs/02-user-flows.md`; không đổi student flow.
- Cập nhật `docs/implementation/M6.md` bằng task mới `M6.6`.
- Cập nhật API Test Admin trong `docs/api/quiz-flashcard-tests.md`.
- Cập nhật UI ownership trong `docs/08-ui-pages-and-components.md`.
- Cập nhật coverage matrix và dependency graph nếu status/dependency thay đổi.
- Cập nhật `.codex/context/code-index.md` vì module/hook/API ownership thay đổi.
- Không cập nhật changelog; changelog chỉ ghi khi `/commit` tạo commit thật.

## 7. Thứ tự file ownership khi triển khai

Không chỉnh tất cả trong một patch lớn. Thứ tự an toàn:

1. Shared assessment types/API transport.
2. Shared assessment hooks/query keys.
3. Shared set editor.
4. Shared question editor và tab orchestration.
5. Backend Assessment Admin core và Test adapters.
6. Capability nâng cao: generation/figure/refinement.
7. Test regression/parity.
8. Xóa code Test Admin cũ.
9. Docs/code index.

Trong suốt quá trình, Quiz phải tiếp tục chạy qua core mới trước; Test chỉ cutover
sau khi Quiz regression pass. Không duy trì hai implementation sau khi Test đã
cutover.

## 8. Test plan

### 8.1. Frontend unit/component

Chạy cùng fixture với `kind=quiz` và `kind=test`:

- load nhiều set, thứ tự tăng dần và chọn set;
- tạo set và tự chọn set mới;
- sửa/xóa set;
- tạo/sửa/xóa bốn loại câu hỏi;
- correct answer, hint, solution và rich content round-trip;
- review từng câu và review hàng loạt;
- UI/JSON/Split mode;
- generation history/status/cost;
- figure upload/create/edit/refine/delete;
- solution refinement;
- loading/empty/error/pending/disabled states.

Test riêng cho Test:

- duration bắt buộc;
- min 1 phút, max 240 phút;
- create/update đổi phút sang giây chính xác;
- mở lại modal hiển thị đúng số phút;
- form Test khác snapshot Quiz đúng một field duration và copy domain.

Riêng modal AI generation, snapshot Test phải giống Quiz về toàn bộ field và
không có duration/difficulty ratio; payload Test chỉ thay target set/kind.

### 8.2. API integration

Parameterized contract suite cho Quiz/Test:

- CRUD set/question;
- validation bốn question type;
- review/publish/bulk review;
- generation JSON projection;
- figure/refinement lifecycle;
- RBAC Admin;
- lesson ownership và not-found/conflict mapping.

Test riêng cho Test set duration; không chạy lại student Test integration dưới
dạng parameterized Quiz vì student flow nằm ngoài scope.

### 8.3. Regression và build

```bash
pnpm --filter @learning-path/shared typecheck
pnpm --filter @learning-path/api typecheck
pnpm --filter @learning-path/web typecheck
pnpm --filter @learning-path/api lint
pnpm --filter @learning-path/web lint
pnpm --filter @learning-path/api build
pnpm --filter @learning-path/web build
```

Chạy thêm focused Vitest/integration test cho M6.2, M6.4 và Assessment Admin mới;
sau đó chạy Playwright cho lesson Admin Quiz/Test.

Kết quả live smoke ngày 2026-09-09:

- modal bộ Test hiển thị duration 15 phút;
- modal tạo Test bằng AI không có field/name duration;
- chạy thật 1 câu `TRUE_FALSE`, không hình, hoàn tất realtime và đưa câu vào trạng
  thái chờ duyệt;
- chi phí thực tế 506 VNĐ, dưới giới hạn 5.000 VNĐ của owner;
- review-all và Save dùng cùng publication action bar với Quiz.

Nếu batch capability nâng cao sửa worker, phải restart worker/dev process sau khi
triển khai:

```bash
pnpm dev
```

## 9. Acceptance criteria

- Test Admin có cùng layout, state, action và capability với Quiz Admin.
- Modal bộ Test bằng modal bộ Quiz cộng đúng một field thời gian.
- Chưa có TestSet vẫn bấm bắt đầu tạo AI được; backend tự tạo `Bộ đề 1` mặc định
  15 phút như Quiz tự tạo bộ đầu tiên.
- `AdminAssessmentTab` và question editor không import Test hook/API/component.
- Không có business branch Test để tắt figure, review, JSON, history hoặc
  refinement.
- Quiz/Test dùng cùng component, schema, hook và application rule.
- Khác biệt route/model database bị cô lập trong transport/repository adapter.
- Code Test Admin cũ trong deletion manifest đã bị xóa, không để re-export giả.
- `AdminTestsTab` chỉ còn là entry wrapper truyền `kind="test"`.
- Student Test runner/attempt/timer không thay đổi trong task.
- Dữ liệu Test hiện tại không bị xóa hoặc migration phá hủy.
- Quiz regression, Test Admin parity, typecheck, lint và build đều pass.

## 10. Rủi ro và cách kiểm soát

### 10.1. Test API chưa đủ capability Quiz

Không bật action UI trước khi endpoint tương ứng chạy được. Hoàn thành Batch 5–6
rồi mới xóa condition capability.

### 10.2. Figure đang gắn chặt với QuizQuestion

Đây là gap kỹ thuật lớn nhất nếu yêu cầu parity bao gồm figure. Phải tạo target
abstraction/persistence hợp lệ; không copy nguyên QuizFigure service rồi đổi tên
thành TestFigure service.

### 10.3. Xóa nhầm code student Test

Deletion manifest là allowlist. Mọi file student attempt/controller/serializer và
Prisma Test attempt nằm ngoài allowlist, không được xóa.

### 10.4. Worktree đang có thay đổi khác của owner

Hiện có thay đổi ở student Test panel và Playwright student-learning cùng các file
multi-agent chưa track. Task triển khai phải giữ nguyên, không revert và không gom
chúng vào patch/commit của M6.6.

## 11. Assumption cần owner duyệt cùng plan

- “Giống hệt Quiz ở Admin” bao gồm toàn bộ capability Admin Quiz hiện tại, không
  chỉ CRUD câu hỏi cơ bản.
- `durationSeconds` là khác biệt nghiệp vụ duy nhất được nhìn thấy trong modal
  tạo/sửa bộ Test; không xuất hiện trong modal tạo Test bằng AI.
- Field score/difficulty-ratio/points cũ được giữ tạm dưới database/student layer
  để tránh mở rộng sang migration student trong task này, nhưng bị loại khỏi Admin
  UI và Admin application rule.
- Route Test hiện tại được giữ dưới dạng adapter để tránh phá contract; mục tiêu
  là xóa implementation trùng, không nhất thiết xóa URL có chữ `test`.

## 12. Lệnh triển khai đề xuất

Sau khi owner duyệt file plan này:

```text
/task-full M6.6
```

Mode: `UI + API` — hard-cutover Test Admin sang Quiz Admin core, hoàn thành parity,
xóa code Test Admin cũ và giữ nguyên student Test.
