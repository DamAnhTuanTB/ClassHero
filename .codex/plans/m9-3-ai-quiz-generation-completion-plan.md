# Kế hoạch hoàn thiện Sinh Quiz bằng AI từ dữ liệu nguồn bài học

Ngày lập: 2026-08-10

Ngày rà soát theo toàn bộ `.codex/plans`: 2026-08-10

Trạng thái: `Chờ owner duyệt để triển khai`

Task sở hữu chính:

- `M9.3` — Admin generate quiz/flashcard/test (`Worker/Integration`).
- `M9.8` — Admin AI generation panel (`UI + API`).
- `M7.2` — Quiz attempt và submit (`UI + API`).
- `M7.4` — Test start, submit và review (`UI + API`).

Phạm vi dùng lại:

- `M9.2` — Sinh kiến thức: chọn tài liệu, cấu hình model, prompt preview,
  source context, đồng thời tái sử dụng trực tiếp lõi authoring của khối ví dụ
  để sinh đề bài, solution và diagram intent/compiler/renderer.
- `M6.2`/`M6.4` — Quiz/Test CRUD, question definition, hint, explanation,
  difficulty và review status.

## 1. Mục tiêu

Hoàn thiện một lát dọc production cho phép admin dùng AI sinh Quiz từ đúng dữ
liệu nguồn của bài học, kiểm soát model/prompt/phân bổ độ khó, review nội dung
trước khi phát hành; đồng thời bảo đảm học sinh có thể:

- Chủ động mở gợi ý của từng câu Quiz.
- Xem lời giải chi tiết của từng câu sau khi hoàn thành và vào màn review.
- Xem hình minh họa an toàn khi lời giải cần hình.
- Nhận cùng một trải nghiệm lời giải trên cả Quiz và Test.

Output AI phải được validate nghiêm ngặt trước khi phát hành. Nếu root output còn
đọc được và lỗi có thể quy về một câu hoặc một field cụ thể, hệ thống giữ nguyên
các câu hợp lệ, cô lập lỗi trong một bản nháp `NEEDS_REVIEW` và chặn approve.
Không lưu dữ liệu mồ côi/không truy vết được và không để học sinh nhìn thấy output
chưa đạt acceptance validation.

## 2. Phạm vi

### 2.1. Trong phạm vi

- Modal admin `Tạo Quiz bằng AI` có đầy đủ cấu hình tương đương modal Sinh kiến
  thức:
  - Tài liệu dùng để tạo.
  - Model.
  - Temperature hoặc Reasoning Effort theo capability của model.
  - Giới hạn token đầu ra.
  - Cách trình bày và preset.
  - Yêu cầu bổ sung.
  - Nút `Cập nhật dữ liệu gửi AI`.
  - System instructions.
  - User prompt.
  - Input JSON hoàn chỉnh.
- Chọn `Hỗn hợp` hiển thị ba field số câu `Dễ`, `Trung bình`, `Khó`.
- Tổng ba field phải bằng chính xác `Số câu hỏi`.
- AI trả nhãn độ khó cho từng câu.
- AI sinh hint cho từng câu Quiz.
- AI sinh lời giải chi tiết cho từng câu Quiz và Test.
- AI có thể trả semantic diagram intent cho lời giải cần hình.
- Worker compile diagram intent thành spec an toàn và lưu cùng explanation.
- Admin xem được hint, lời giải và hình trước khi duyệt.
- Học sinh xem hint trong Quiz và xem lời giải/hình trong review Quiz/Test.
- Test bằng mock provider; không gọi OpenAI thật trong test mặc định.

### 2.2. Không làm trong kế hoạch này

- `M9.5` — Nút AI `Giải thích cho tôi` theo yêu cầu tức thời.
- `M9.4` — Học sinh yêu cầu sinh bộ câu hỏi mới.
- `M9.6` — Chat AI theo bài học.
- Mở rộng cùng bộ field cấu hình nâng cao sang modal Sinh Test, trừ phần nâng
  output lời giải/hình của Test để đáp ứng màn review.
- Thay đổi generation Flashcard.
- Tự động gọi AI để backfill câu hỏi cũ chưa có lời giải.
- Tự động gọi provider lần hai để repair/judge/regenerate output lỗi; lần generate
  ban đầu chỉ có đúng một provider call.
- Nút tạo lại riêng từng câu bằng AI. Nếu owner bổ sung sau này, đó phải là thao
  tác thủ công, một call độc lập và có budget/approval riêng.
- Cho AI trả raw SVG, HTML thực thi hoặc URL ảnh ngoài.
- Thay đổi stack, provider chính/phụ hoặc queue architecture đã chốt.

## 3. Nguồn đã khảo sát

### 3.1. Tài liệu

- `AGENTS.md`.
- `docs/01-product-scope.md`.
- `docs/02-user-flows.md`.
- `docs/03-technical-architecture.md`.
- `docs/04-database-model.md` và các database domain liên quan.
- `docs/05-api-contract.md` và `docs/api/quiz-flashcard-tests.md`.
- `docs/06-ai-rag-spec.md`.
- `docs/07-integration-and-env.md`.
- `docs/08-ui-pages-and-components.md`.
- `docs/09-implementation-plan.md`.
- `docs/implementation/M6.md`.
- `docs/implementation/M7.md`.
- `docs/implementation/M9.md`.
- `docs/11-ui-design-system.md`.
- `docs/12-performance-and-observability.md`.
- `docs/14-source-code-structure.md`.
- `docs/ui-references/code-patterns.md` và các pattern form/state/student runner
  liên quan.
- `docs/ui-references/approved-patterns.md`.
- Toàn bộ file kế hoạch hiện có trong `.codex/plans/`:
  - `.codex/plans/codex-execution-plan.md`.
  - `.codex/plans/m9-2-classhero-authoring-v3-plan.md`.
  - `.codex/plans/m9-2-math-diagram-coverage-90-plan.md`.
  - `.codex/plans/m9-2-summary-partial-block-recovery-plan.md`.
  - `.codex/plans/m9-3-ai-quiz-generation-completion-plan.md`.
  - `.codex/plans/personalized-learning-path-plan.md`.

`codex-execution-plan.md` chỉ dùng để kiểm thứ tự/phụ thuộc lịch sử; roadmap và
docs domain hiện tại vẫn có ưu tiên cao hơn. Kế hoạch personalized learning path
không làm đổi scope M9.3; điểm liên quan duy nhất là Quiz definition đã phát hành
phải tiếp tục tương thích cơ chế deep-copy của learning path về sau.

### 3.2. Code hiện tại

- Modal và schema/payload admin AI generation.
- Prompt preview và document multi-select của Sinh kiến thức.
- Model catalog, AI route resolution và provider call service.
- Lesson content generation context/job/worker/prompt/schema/mapper.
- Quiz/Test service, admin approval và stale explanation flow.
- Student Quiz runner, Quiz/Test review và attempt serializer.
- Diagram schema, compiler, mapper và renderer đang được phát triển trong M9.2.
- Các test hiện có của M9.3, M9.8 và M7.

### 3.3. Snapshot M9.2 dùng làm đầu vào cho M9.3

Snapshot tại thời điểm rà soát, không được hard-code như trạng thái vĩnh viễn:

- Authoring v3 của example block đang là nguồn chất lượng cho đề bài, solution và
  diagram, nhưng provider contract Summary hiện vẫn tối giản dạng
  `{ problem, solution: string, answer, diagramSpec }` và chưa có `keyIdea`.
- Partial-block recovery đã hoàn tất ở M9.2 schema v40 theo hướng
  `PASS | REVIEW_REQUIRED | PARTIAL_RENDER | UNRENDERABLE`: job kỹ thuật
  `SUCCEEDED`, result có thể `SUCCEEDED_WITH_WARNINGS`, nhưng approve/publish bị
  chặn khi còn issue chưa resolve.
- Diagram ưu tiên `diagramIntent` dạng discriminated union hẹp, sau đó compiler
  deterministic/template registry tạo `diagramSpec`; raw `diagramSpec` chỉ là
  fallback cho archetype chưa hỗ trợ và luôn cần review.
- Coverage plan đang dùng mốc prompt `lesson-summary-prompt-v54` và schema/contract
  v40; có 50/50 local compiler/golden, 39/50 live evidence, 19/50 exact-page audit,
  chỉ 11/50 có đủ local + live + exact page, còn 11 archetype thiếu live evidence.
  Release vẫn `IN_PROGRESS` và chưa archetype nào được coi là `SUPPORTED`.
- Hotfix recovery đã qua 129 focused API tests, Playwright laptop/iPad/Chromium
  mobile/WebKit mobile và Live Bài 15 bằng `gpt-5.4`; đây là bằng chứng cơ chế
  recovery/renderer, không thay thế Live evidence riêng cho Quiz M9.3.
- Các con số/version trên chỉ là snapshot của plan M9.2 ngày 2026-08-10. Khi bắt
  đầu implement M9.3 phải đọc lại code, manifest, release status và worktree thật.

Vì vậy M9.3 được phép tái sử dụng pipeline M9.2 nhưng không được suy diễn rằng mọi
archetype hình đã production-ready hoặc dùng screenshot/fixture thay bằng bằng
chứng nguồn chính thống.

## 4. Hiện trạng và khoảng trống

| Yêu cầu | Hiện trạng | Khoảng trống cần xử lý |
| --- | --- | --- |
| Gợi ý Quiz | Quiz runner đã có nút `Gợi ý`, mặc định đóng | Bảo đảm AI luôn sinh hint hợp lệ, persistence/API ổn định và có regression test |
| Lời giải review | API đã có phần explanation text | Màn review chung chưa render explanation; API chưa trả diagram spec |
| Hình minh họa | Sinh kiến thức có schema/compiler/renderer an toàn | Quiz/Test explanation chưa dùng pipeline này |
| Nhãn độ khó | AI output hiện đã có difficulty | MIXED chưa kiểm soát chính xác số câu của từng mức |
| Cấu hình model | Modal Sinh kiến thức đã có | Modal Quiz hiện chỉ có cấu hình cơ bản |
| Chọn tài liệu | Sinh kiến thức đã hỗ trợ | Admin Quiz generation chưa nhận danh sách tài liệu được chọn |
| Reasoning Effort | Route/model catalog đã có dữ liệu | Provider call chưa truyền đầy đủ reasoning effort xuống OpenAI |
| Prompt preview | Sinh kiến thức đã có System/User/Input | Cần trích thành phần dùng chung và tạo preview cho Quiz |

## 5. Quyết định kỹ thuật đã chốt trong kế hoạch

### 5.1. Không migration database

Tái sử dụng các field hiện có:

- `quiz_questions.hint_json`.
- `quiz_questions.difficulty`.
- `quiz_questions.explanation_id`.
- `test_questions.difficulty`.
- `test_questions.explanation_id`.
- `ai_explanations.content_json`.
- `ai_explanations.diagram_spec_json`.
- `source_metadata_json` ở question/explanation liên quan.

Không thêm cột phân bổ độ khó vào Quiz set. Phân bổ là input của generation job;
nhãn kết quả được lưu trên từng question.

### 5.2. Tên field lời giải

Không sử dụng `overview`. Contract lời giải dùng `keyIdea` theo chuẩn camelCase:

```json
{
  "solution": {
    "keyIdea": "Ý tưởng hoặc kiến thức cốt lõi dùng để giải câu hỏi.",
    "steps": ["Bước 1", "Bước 2"],
    "finalAnswer": "Kết luận cuối cùng",
    "diagram": null
  }
}
```

Ý nghĩa:

- `keyIdea`: giúp học sinh biết phương pháp/kiến thức chính trước khi đọc các
  bước giải.
- `steps`: các bước giải theo đúng thứ tự.
- `finalAnswer`: kết luận cuối cùng và phải nhất quán với đáp án chấm điểm.
- `diagram`: semantic diagram intent hoặc `null` nếu không cần hình.

Frontend, backend, worker và test phải thống nhất dùng `keyIdea`.

### 5.3. Diagram an toàn

- Provider ưu tiên trả semantic intent theo contract của M9.2.
- Worker validate intent, compile deterministic và normalize thành diagram spec.
- Chỉ lưu JSON đã validate vào `diagram_spec_json`.
- Admin/student dùng cùng renderer của Sinh kiến thức.
- Không lưu hoặc render raw SVG/HTML/script từ provider.
- Không dùng URL ảnh OCR mờ làm lời giải học sinh.

### 5.4. Approval và stale explanation

- Generation mới tạo dữ liệu ở trạng thái `NEEDS_REVIEW`.
- Admin phải review/approve trước khi học sinh nhìn thấy.
- Khi admin sửa question/correct answer/hint liên quan, explanation cũ tiếp tục
  bị đánh dấu stale theo cơ chế hiện có.
- Student API chỉ trả explanation `APPROVED` và không stale.

### 5.5. Backward compatibility

- Explanation dạng text/Tiptap cũ vẫn được render.
- Question cũ chưa có explanation không tự gọi AI trả phí.
- UI hiển thị trạng thái nhẹ `Lời giải chi tiết đang được cập nhật` nếu dữ liệu
  cũ không có lời giải hợp lệ.

### 5.6. Tái sử dụng lõi sinh khối ví dụ của M9.2

Quiz không xây một prompt/mapper sinh bài tập hoàn toàn mới. Phần đề bài,
solution và diagram phải dùng lại trực tiếp logic authoring đang cho chất lượng
tốt ở khối ví dụ của tính năng Sinh kiến thức.

Phần dùng chung gồm:

- Prompt rules để biên soạn một đề bài mới, tự đủ dữ kiện và bám phạm vi nguồn.
- Quy tắc tạo solution đúng từng bước và nhất quán với đáp án.
- Quy tắc quyết định khi nào bài cần hình.
- Semantic diagram intent, schema, validator, compiler, normalizer và renderer.
- Kiểm tra bài phụ thuộc hình, dữ kiện thiếu, answer/solution inconsistency và
  diagram semantic sai.
- Cách làm sạch nội dung để không đưa ảnh OCR mờ, raw SVG hoặc chỉ dẫn kiểu
  `xem hình bên` vào sản phẩm học sinh.

Kiến trúc tái sử dụng phải theo dạng shared authoring core có domain adapter:

```text
Source context
  -> Shared example authoring core
       -> problem
       -> worked solution
       -> final answer
       -> semantic diagram intent
  -> Summary example adapter
       -> giữ contract/persistence hiện tại của khối ví dụ M9.2
  -> Quiz adapter
       -> prompt + correct answer
       -> options/distractors theo question type
       -> hint + difficulty
       -> solution { keyIdea, steps, finalAnswer, diagram }
```

Mục tiêu là tái sử dụng cùng prompt fragments/helper/schema/validator/compiler ở
cấp source code, không copy-paste một bản quy tắc riêng sang Quiz. Contract đầu
ra của Summary và Quiz có thể khác shape ở lớp adapter, nhưng cùng dùng một lõi
authoring để các cải tiến chất lượng đề bài/solution/diagram sau này có hiệu lực
cho cả hai flow.

Không lấy nguyên nội dung example đã persist trong lesson summary để biến thành
Quiz và không copy nguyên văn bài nguồn. Quiz tạo bài mới/biến thể mới bằng cùng
cách authoring đã được kiểm chứng của khối ví dụ.

### 5.7. Tái sử dụng hệ thống đánh giá ảnh của M9.2

Đánh giá diagram Quiz không tạo một bộ tiêu chí hoặc công cụ review riêng. Nguồn
sự thật bắt buộc là quy trình đã dùng cho Sinh kiến thức tại:

- `.codex/plans/m9-2-math-diagram-coverage-90-plan.md`, đặc biệt mục `8.4` và
  `8.4.1`.
- `docs/11-ui-design-system.md`, phần nghiệm thu visual Toán do AI sinh.
- Reference catalog/reference-golden manifest đã được source-backed của M9.2.
- Semantic review/golden fixture/compiler/renderer regression harness hiện có,
  gồm script review M9.2 trong `apps/api/test/` khi phù hợp.

Phần phải tái sử dụng trực tiếp:

- Cùng reference ID và reference hierarchy SGK/SBT/SGV Kết nối tri thức.
- Cùng comparison mode:
  `EXACT_FIGURE | SAME_ARCHETYPE | CONVENTION_ONLY`.
- Cùng decision:
  `PASS_EXACT | PASS_RESPONSIVE_ADAPTATION | NEEDS_SOURCE | FAIL`.
- Cùng checklist semantic: dữ kiện, quan hệ, primitive, marker, nhãn, trục/tick,
  tỉ lệ, đơn vị, va chạm, crop và light/dark.
- Cùng nguyên tắc tính đúng toán học đứng trước pixel similarity.
- Cùng rule chỉ golden đã tái kiểm chứng nguồn mới được dùng làm bằng chứng.
- Cùng tách ảnh `failed` và `passed`, review từng ảnh bằng mắt và lưu defect/root
  cause trước khi kết luận.

Quiz chỉ bổ sung context review nối diagram với question, hint và solution. Không
được tạo `quizDiagramPass=true` hoặc một nhánh validator nhẹ hơn để đi vòng qua
M9.2. Mọi sửa compiler/normalizer/renderer do Quiz phát hiện phải chạy lại golden
regression M9.2; không được làm Quiz mới đẹp hơn bằng cách làm giảm chất lượng
khối ví dụ Sinh kiến thức.

Ma trận UI của kế hoạch này vẫn dùng ba nhóm thiết bị theo yêu cầu owner:
mobile/iPad/laptop, mobile là core. Việc kiểm thêm Chromium/WebKit trên mobile là
cross-engine của cùng một nhóm thiết bị và không làm thay đổi nguyên tắc review
ảnh M9.2.

### 5.8. Partial recovery, pass-through và approval gate

M9.3 áp dụng cùng triết lý phục hồi cục bộ mới của M9.2 để không vứt bỏ toàn bộ
output trả phí khi chỉ một câu hoặc một field bị lỗi:

| Trạng thái câu | Cách xử lý | Có thể approve ngay? |
| --- | --- | --- |
| `PASS` | Đi qua normal mapper nguyên trạng, không sửa/normalize nội dung hợp lệ ngoài các bước deterministic đã chốt | Có, sau review nội dung bình thường |
| `REVIEW_REQUIRED` | Vẫn render an toàn nhưng còn nghi ngờ semantic/chất lượng/nguồn; lưu issue và badge | Chỉ sau khi admin đối chiếu nguồn rồi accept hoặc sửa |
| `PARTIAL_RENDER` | Giữ các phần an toàn, cô lập field/sub-element lỗi bằng placeholder đúng vị trí | Chỉ khi issue code được đánh dấu accept-safe và phần còn lại vẫn tự đủ/đúng nguồn; mặc định không |
| `UNRENDERABLE` | Không có nội dung có nghĩa hoặc không thể render an toàn; giữ slot/câu placeholder cùng issue | Không đối với nội dung/hình bắt buộc; optional visual chỉ được bỏ khi câu đã tự đủ dữ kiện |

Quy tắc bắt buộc:

- Chỉ phục hồi khi root/set/questions còn parse được và xác định chắc chắn lỗi
  thuộc câu/field nào. Mọi câu `PASS` phải có pass-through invariant test để bảo
  đảm recovery path không làm thay đổi question, answer, hint, solution hoặc
  diagram hợp lệ.
- Exact count và difficulty distribution là acceptance invariant của cả set. Một
  slot thiếu/sai nhãn được ghi thành blocking issue trong draft và làm set
  `SUCCEEDED_WITH_WARNINGS`, không nhất thiết hủy các câu hợp lệ đã sinh.
- Root JSON không đọc được, không xác định được ownership, source hash stale,
  provider/DB/queue/infra error vẫn là full job failure và không overwrite artifact
  tốt trước đó.
- Local sanitizer chỉ được loại/cô lập dữ liệu nguy hiểm; không được tự phát minh
  dữ kiện, đáp án, bước giải, nhãn difficulty hoặc hình toán học.
- Persist recovery metadata theo cơ chế M9.2 đã chạy thật: `reviewIssues[]` đặt ở
  đúng question/solution/diagram hoặc set metadata, gồm `id`, `code`, `path`,
  `message`, `suggestion`, `technicalDetails`, target `fingerprint` và `accepted`.
- Warning hiển thị tiếng Việt theo cấu trúc `Vấn đề:` và `Gợi ý sửa:`. Path/error
  kỹ thuật chỉ xuất hiện trong `Chi tiết kỹ thuật` đã sanitize.
- Draft có warning vẫn mở, sửa và lưu được. CTA approve/publish bị chặn khi
  `blockingIssueCount > 0`; student API tuyệt đối không trả các câu chưa đạt.
- Admin có thể accept issue render-safe sau khi review nguồn mà không gọi AI.
  Backend phải kiểm target fingerprint; nếu question/answer/solution/diagram đích
  thay đổi thì acceptance cũ tự mất hiệu lực và validate lại khi lưu.
- Không có issue code nào được cho phép accept nếu thiếu/sai correct answer,
  grading, `keyIdea`, bước giải/final answer cốt lõi, difficulty distribution hoặc
  required diagram khiến đề không tự đủ dữ kiện. Các trường hợp đó phải sửa, xóa
  hoặc thay thế trước approve.
- Generation ban đầu chỉ gọi provider đúng một lần; không tự repair, judge,
  fallback model/provider hoặc retry để tìm output đẹp hơn.
- Trước khi code, kiểm chứng các JSON field hiện có có đủ khả năng lưu
  `reviewIssues[]`/job result. Nếu không đủ, báo owner và cập nhật database/API
  docs; không âm thầm thêm migration. Ưu tiên `source_metadata_json`,
  question/explanation JSON và job result hiện có để giữ quyết định “không
  migration”; không tăng wrapper/version chỉ vì thêm metadata optional nếu
  backward-compatible parser đã đủ.

Transaction vẫn nguyên tử ở cấp database: hoặc lưu trọn một draft nhất quán gồm
câu hợp lệ + issue/placeholder cục bộ, hoặc rollback toàn transaction khi lỗi DB.
“Nguyên tử” không còn đồng nghĩa một field lỗi làm mất toàn bộ provider output.

### 5.9. Capability guard cho diagram

- `diagramIntent` là đường chính. Compiler/template registry, semantic validator,
  label/layout solver, normalizer và renderer phải import trực tiếp cùng
  implementation M9.2 để các quy tắc line/ray/segment, point/tick/marker, trục,
  graph, parabola, bảng/đồng hồ, nhãn và crop luôn đồng bộ; không copy checklist.
- Lưu compiler/template version hoặc fingerprint trong diagnostics/source metadata
  khi schema hiện có cho phép, để screenshot/live artifact tái hiện được.
- Difficulty của câu hỏi `EASY | MEDIUM | HARD` và độ phức tạp diagram
  `SIMPLE | MEDIUM | HARD | VERY_COMPLEX` là hai trục độc lập, không map đồng nhất.
- Raw `diagramSpec` fallback hoặc archetype chưa đủ evidence luôn
  `REVIEW_REQUIRED` và không được student-publish trước source-backed review.
- `VERY_COMPLEX` đang ngoài coverage: phải rewrite câu thành tự đủ dữ kiện mà
  không phụ thuộc hình hoặc ghi unresolved/block approval; không ép compiler sinh
  một hình kém chất lượng rồi coi là đạt.
- Với câu hình học phụ thuộc hình, diagram là bắt buộc. Với môn/chủ đề khác chỉ
  thêm hình khi giúp lời giải; không được lặng lẽ bỏ hình mà question/solution còn
  câu kiểu `xem hình bên`.

## 6. Luồng kỹ thuật mục tiêu

```text
Admin mở modal Sinh Quiz bằng AI
  -> Chọn tài liệu + số câu + loại câu + phân bổ độ khó
  -> Chọn model/temperature hoặc reasoning/max output tokens
  -> Nhập cách trình bày + yêu cầu bổ sung
  -> Cập nhật dữ liệu gửi AI
  -> Backend dựng context/prompt/source hash và trả preview, không gọi provider
  -> Admin kiểm tra/chỉnh System instructions và User prompt
  -> Submit generation
  -> API validate DTO + snapshot model route/source/prompt
  -> BullMQ worker dựng prompt/schema từ shared example authoring core
  -> Quiz adapter bổ sung yêu cầu question type/options/hint/difficulty
  -> AiProvider trả structured đề bài/solution/diagram và dữ liệu Quiz
  -> Transport schema xác định root/item ownership
  -> Quiz adapter map các câu hợp lệ + cô lập lỗi cục bộ
  -> Acceptance schema + semantic validation ở cấp câu và cấp set
  -> Compile diagram intent
  -> Transaction lưu draft nhất quán + warning/blocking issues nếu có
  -> Admin review và approve
  -> Student Quiz runner mở hint khi bấm
  -> Student Quiz/Test review hiển thị lời giải + hình
```

## 7. Contract request đề xuất

```json
{
  "questionCount": 16,
  "difficulty": "MIXED",
  "difficultyCounts": {
    "easy": 5,
    "medium": 8,
    "hard": 3
  },
  "questionTypes": ["SINGLE_CHOICE", "MULTIPLE_CHOICE"],
  "documentIds": ["document-id-1", "document-id-2"],
  "model": "selected-model",
  "temperature": 0.2,
  "reasoningEffort": null,
  "maxOutputTokens": 12000,
  "presentationInstructions": "Trình bày ngắn gọn, phù hợp học sinh lớp 7.",
  "extraInstructions": "Ưu tiên câu hỏi vận dụng thực tế.",
  "systemInstructions": "...",
  "userPrompt": "..."
}
```

Quy tắc:

- `difficultyCounts` chỉ bắt buộc khi `difficulty=MIXED`.
- Cả ba giá trị là số nguyên không âm.
- `easy + medium + hard === questionCount`.
- Khi difficulty cố định, bỏ `difficultyCounts` và mọi output question phải có
  đúng nhãn cố định đó.
- ASSUMPTION hiện tại: cho phép một mức có giá trị `0` vì owner mới yêu cầu tổng
  khớp. Nếu owner muốn MIXED bắt buộc có đủ ba mức, đổi validation thành mỗi mức
  tối thiểu một câu trước khi triển khai.
- `temperature` và `reasoningEffort` không được cùng có hiệu lực; UI/backend chọn
  theo capability của model.
- Model, reasoning effort và token limit phải được validate bằng model catalog,
  không tin chuỗi tùy ý từ client.

## 8. Contract output đề xuất

Các field đáp án đặc thù theo loại câu tiếp tục dùng schema hiện tại. Phần chung
của một question được nâng thành:

```json
{
  "difficulty": "EASY",
  "prompt": {},
  "answer": {},
  "hint": "Gợi ý ngắn và không tiết lộ trực tiếp đáp án.",
  "solution": {
    "keyIdea": "Áp dụng định luật bảo toàn năng lượng.",
    "steps": [
      "Viết biểu thức cơ năng tại vị trí ban đầu.",
      "Viết biểu thức cơ năng tại vị trí cần tìm.",
      "Cho hai biểu thức bằng nhau và giải phương trình."
    ],
    "finalAnswer": "Vận tốc của vật là 10 m/s.",
    "diagram": null
  },
  "sourceChunkIds": ["chunk-id"]
}
```

Quy tắc output:

- `difficulty` luôn bắt buộc và chỉ nhận `EASY | MEDIUM | HARD`.
- Quiz luôn có `hint`; Test không thêm hint nếu contract Test hiện tại không cho
  phép gợi ý trong lúc làm bài.
- Quiz và Test đều có `solution`.
- `keyIdea`, ít nhất một phần tử `steps` và `finalAnswer` phải có nội dung.
- `finalAnswer` phải khớp với correct answer/grading rule.
- `sourceChunkIds` chỉ được trỏ tới context đã gửi provider.
- `diagram=null` khi câu không cần hình.
- Nếu câu bắt buộc phụ thuộc hình mà output thiếu/không hợp lệ, câu đó phải thành
  `PARTIAL_RENDER`/`UNRENDERABLE` và chặn approve; chỉ full job fail khi root/
  ownership không còn đọc được hoặc có lỗi provider/DB/infra.
- Contract transport cho phép giữ item lỗi có ownership; contract acceptance chỉ
  nhận `PASS` hoặc item đã được admin sửa/accept theo đúng policy.

## 9. Kế hoạch triển khai theo giai đoạn

### Giai đoạn 0 — Bảo vệ baseline và dependency M9.2

- Ghi nhận `git status --short` trước khi code.
- Không revert hoặc sửa mất các thay đổi M9.2 hiện có của owner.
- Snapshot contract/prompt/schema version, compiler/template fingerprint,
  archetype manifest và release status M9.2 đang thực sự có; không giả định kế
  hoạch coverage đã hoàn tất.
- Xác định contract diagram/compiler nào đủ bằng chứng để Quiz/Test tiêu thụ và
  capability nào phải giữ `REVIEW_REQUIRED`/`NEEDS_SOURCE`.
- Nếu cần trung lập hóa tên module `lesson-summary-*`, chỉ extract phần generic
  sang common AI diagram layer; Summary và Assessment cùng sử dụng, không tạo
  diagram contract thứ hai.
- Không chạy OpenAI thật ở bước baseline.

### Giai đoạn 1 — Shared contract và schema

- Đọc lại contract/prompt/mapper/validator hiện hành của example block M9.2 và
  xác định chính xác các phần tạo chất lượng tốt cần giữ nguyên.
- Extract các prompt fragments, authoring rules, semantic validators và diagram
  pipeline dùng chung thành shared example authoring core; không duplicate một
  bộ quy tắc riêng cho Quiz.
- Giữ Summary adapter tương thích contract/persistence hiện tại để tránh làm suy
  giảm chất lượng tính năng Sinh kiến thức đang ổn. Không ép Summary thêm
  `keyIdea`; chỉ Quiz adapter yêu cầu/map structured solution mới.
- Tạo Quiz adapter bổ sung question type, options/distractors, hint và difficulty
  trên kết quả problem/solution/diagram của core.
- Nâng prompt/schema version cho Quiz/Test generation.
- Thêm schema `difficultyCounts`.
- Thêm structured `solution` với `keyIdea`, `steps`, `finalAnswer`, `diagram`.
- Chia rõ provider input type, transport schema, acceptance schema, normalized
  domain type và persisted/recovery type.
- Giữ parser/mapper tương thích explanation cũ.
- Thêm pure validator cho:
  - Tổng số câu.
  - Phân bổ difficulty.
  - Question type.
  - Answer/solution consistency.
  - Source chunk ownership.
  - Diagram semantic validity.
- Thêm pass-through invariant: mọi output M9.2/Quiz đã hợp lệ phải giữ nguyên qua
  normal mapper; recovery path chỉ đụng item/field lỗi.

### Giai đoạn 2 — Backend prompt preview và context tài liệu

- Mở rộng `GenerateQuizDto` với các field mới.
- Tạo endpoint prompt preview cạnh endpoint Quiz generation hiện tại.
- Tái sử dụng selected-document context loader của Sinh kiến thức:
  - Tài liệu phải thuộc đúng lesson.
  - Trạng thái tài liệu phải sẵn sàng.
  - Phải có chunk hợp lệ.
  - Context bị giới hạn theo token budget.
  - Giữ source IDs để kiểm chứng output.
- Trả về:
  - System prompt.
  - User prompt.
  - Input prompt/JSON.
  - Model/provider đã resolve.
  - Số tài liệu/chunk/token ước tính.
  - Max output tokens.
  - Chi phí tối đa ước tính nếu có bảng giá.
- Preview không gọi provider và không phát sinh chi phí OpenAI.
- Submission phải dựng/validate lại context ở server, không tin preview client.
- Dùng source hash để phát hiện dữ liệu thay đổi sau preview.

### Giai đoạn 3 — AI route và provider plumbing

- Snapshot model route/capability vào generation job.
- Truyền đầy đủ model, temperature hoặc reasoning effort và max output tokens từ
  request đến worker/provider.
- Sửa shared provider call để `reasoningEffort` thật sự đi vào OpenAI request.
- OpenAI Responses request dùng đúng shape:

```json
{
  "reasoning": {
    "effort": "medium"
  }
}
```

- Không dùng pseudo field top-level `reasoning_effort` trong Input preview.
- Tạo serializer dùng chung để Input tab và provider call không lệch shape.
- Migrate modal Sinh kiến thức sang serializer dùng chung nếu cần, nhưng không
  thay đổi nghiệp vụ hoặc layout đã được owner chốt.

### Giai đoạn 4 — Worker generation và persistence

- Dùng shared example authoring core làm nguồn sinh `problem`, worked solution,
  final answer và diagram cho từng câu; không viết lại từ đầu logic sinh ba phần
  này trong Quiz worker.
- Nâng system instructions với invariant bắt buộc:
  - Chỉ dùng kiến thức trong nguồn bài học.
  - Đúng tổng số câu và phân bổ độ khó.
  - Đúng question types.
  - Mỗi Quiz có hint không lộ đáp án.
  - Mỗi Quiz/Test có lời giải chi tiết.
  - Answer, `finalAnswer` và các bước giải nhất quán.
  - Hình chỉ dùng semantic diagram intent.
  - Trả source chunk IDs hợp lệ.
- Ghép presentation/extra instructions nhưng không cho chúng vô hiệu hóa
  invariant nghiệp vụ.
- Sau provider response, validate kỹ thuật và semantic trước khi map.
- Compile diagram intent bằng pipeline M9.2.
- Mapper chuyển solution thành Tiptap JSON có cấu trúc:
  - `keyIdea`.
  - Danh sách bước giải theo thứ tự.
  - Kết luận cuối cùng.
- Lưu `contentJson`, `diagramSpecJson`, difficulty, source metadata,
  `reviewIssues[]` và compiler fingerprint bằng các JSON/job-result field hiện có
  nếu phù hợp.
- Với root parseable, map `PASS` nguyên trạng; cô lập câu/field lỗi thành
  `REVIEW_REQUIRED`, `PARTIAL_RENDER` hoặc `UNRENDERABLE` và tạo draft
  `NEEDS_REVIEW`/`SUCCEEDED_WITH_WARNINGS` có `blockingIssueCount`.
- Persistence dùng transaction nguyên tử cho toàn draft nhất quán. Lỗi DB rollback
  toàn bộ; lỗi validation cục bộ không được làm mất các câu hợp lệ.
- Không tự gọi provider repair/judge/fallback/retry. Queue chỉ được retry tự động
  nếu lỗi xảy ra chắc chắn trước provider call; nếu request đã gửi hoặc kết quả
  billing còn mơ hồ, phải dừng để kiểm cache/log/budget và xin approval trước lần
  gọi mới.
- Giữ active-job dedupe, retry/idempotency và status/error reporting hiện có.
- Bổ sung regression test bảo đảm việc extract/reuse core không làm thay đổi bất
  lợi output của example block M9.2.

### Giai đoạn 5 — Modal admin Sinh Quiz bằng AI

- Tách/cấu trúc lại modal theo feature layer, tránh tiếp tục làm file dialog đơn
  khối quá lớn.
- Tái sử dụng component của Sinh kiến thức cho:
  - Document multi-select.
  - Presentation preset/instructions.
  - Extra instructions.
  - Model select.
  - Temperature/Reasoning Effort.
  - Max output tokens.
  - Prompt preview metrics/tabs/copy.
- Khi chọn `Hỗn hợp`, render ba field:
  - Dễ.
  - Trung bình.
  - Khó.
- Numeric field dùng text input chuẩn, `inputMode=numeric`, không dùng spinner
  native.
- Zod `superRefine` kiểm tra tổng difficulty counts.
- Validation message chỉ hiện sau touched/dirty hoặc submit attempt theo form
  pattern của repo.
- Khi đổi tài liệu/count/difficulty/type/model/style/instructions, đánh dấu prompt
  preview là cũ.
- Nút `Cập nhật dữ liệu gửi AI` gọi preview endpoint.
- Tabs:
  - System instructions: editable.
  - User prompt: editable.
  - Input đầy đủ: derived/read-only, hiển thị request thật và có copy.
- Submit button có pending/disabled feedback phù hợp nhưng không dùng disabled để
  che toàn bộ validation error.
- Đảm bảo modal giữa viewport, body scroll riêng, mobile/tablet/laptop và cả
  light/dark theme.

### Giai đoạn 6 — Admin review AI output

- Hiển thị tổng quan `Đã tạo, có N câu cần review`, số blocking issue và CTA đi
  tới câu lỗi đầu tiên.
- Hiển thị badge độ khó từng question.
- Hiển thị hint của Quiz.
- Hiển thị `keyIdea`, steps và final answer.
- Render diagram ngay dưới lời giải khi có spec.
- Dùng cùng renderer với Sinh kiến thức.
- Không thêm diagram editor trong scope này.
- Giữ approve/reject/edit flow hiện có.
- Question card hiển thị `Vấn đề:`/`Gợi ý sửa:` và badge recovery; chi tiết kỹ
  thuật sanitize nằm trong vùng mở rộng riêng. Issue render-safe có action
  `Chấp nhận` local; action này không gọi provider và phải lưu audit theo flow
  review hiện có.
- Draft còn warning vẫn edit/save được; approve/publish bị khóa khi còn blocking
  issue. Sau mỗi save backend validate lại target: issue hết thì tự gỡ, issue còn
  thì cập nhật fingerprint/copy. Nội dung bắt buộc không render/không đúng phải
  sửa/xóa/thay thế, không được accept để đi vòng acceptance invariant.
- Khi question/answer/hint thay đổi, explanation cũ bị stale và không đưa cho
  student cho tới khi được cập nhật/duyệt lại.

### Giai đoạn 7 — Student API và UI Quiz/Test

- Mở rộng Quiz/Test attempt serializer để select/return `diagramSpecJson` cùng
  explanation hợp lệ.
- Không trả explanation chưa duyệt hoặc stale.
- Test start/resume tuyệt đối không trả correct answer/explanation trước submit.
- Tạo shared `AssessmentExplanationPanel` trong student learning feature:
  - `keyIdea`/ý tưởng chính.
  - Các bước giải.
  - Final answer.
  - Diagram renderer.
  - Legacy explanation fallback.
- Quiz runner:
  - Giữ nút `Gợi ý` hiện có.
  - Hint đóng mặc định.
  - Bấm mới mở; có `aria-expanded`/keyboard support.
  - Reuse explanation panel sau khi kiểm tra đáp án theo behavior hiện có.
- Quiz/Test review:
  - Tự hiển thị explanation panel ở mỗi question.
  - Không yêu cầu một lần bấm thứ hai để xem lời giải sau khi đã vào review.
  - Hình responsive, không overflow, đúng contrast light/dark.
- Question cũ thiếu lời giải hiển thị fallback trung tính, không bịa lời giải.

### Giai đoạn 8 — Docs, verification và handoff

- Cập nhật AI/RAG spec, API contract, user flow và UI page/component docs.
- Cập nhật M7/M9 và feature coverage matrix theo behavior thực tế.
- Cập nhật code index nếu tạo shared entrypoint quan trọng.
- Không cập nhật changelog; changelog chỉ thuộc workflow `/commit`.
- Chạy đầy đủ focused test, integration, E2E, typecheck, lint và build.
- Sau khi sửa worker, nhắc/restart dev worker bằng `pnpm dev`.
- Sau khi toàn bộ check local/mock đạt, chuẩn bị và thực hiện Live acceptance
  gate bắt buộc theo mục 14.
- Trước khi gọi provider thật phải trình owner model, phạm vi, token budget và
  chi phí ước tính; chỉ gọi sau khi owner xác nhận chi phí ngay tại bước đó.
- Sau mỗi Live output phải render trên ứng dụng thật, chụp screenshot, tự mở và
  đánh giá từng ảnh theo rubric nội dung/UI/diagram và nguồn chính thống.
- Nếu còn defect, sửa nguyên nhân gốc, kiểm tra lại và chụp lại; lặp cho tới khi
  đạt exit criteria mục 14.10 mới được kết thúc task.

## 10. File/module dự kiến thay đổi

### 10.1. Frontend admin

- `apps/web/features/admin/ai-generation/components/ai-generation-config-dialog.tsx`.
- Prompt preview component hiện tại hoặc bản generic được extract.
- Document/model/config field components dùng chung.
- `apps/web/features/admin/ai-generation/schemas/*`.
- `apps/web/features/admin/ai-generation/types/*`.
- `apps/web/features/admin/ai-generation/api/*` và hooks liên quan.
- Admin Quiz/Test question review/editor components để đọc solution/diagram.

### 10.2. Frontend student

- Quiz runner screen.
- Shared Quiz/Test review screen.
- Assessment question card hoặc explanation panel mới.
- Student lesson/assessment types và API mapping.
- Shared safe diagram renderer chỉ được tái sử dụng, không tạo raw SVG renderer.

### 10.3. Backend/API

- Quiz generation DTO/controller/service.
- Prompt preview service/serializer.
- Lesson content generation context/job service.
- AI model route/provider call service và AI text input type.
- Student Quiz/Test attempt selects/serializers/services.
- Module registration nếu extract service dùng chung.

### 10.4. Worker/AI

- Lesson content generation types/schema.
- Quiz/Test prompt builder.
- Output validator.
- Mapper từ provider output sang Tiptap/explanation/diagram spec.
- Worker orchestration/persistence.
- Diagram intent/compiler modules của M9.2 chỉ sửa khi cần extract generic và
  phải bảo toàn các thay đổi hiện có.

### 10.5. Tests

- `apps/api/test/m9.3-content-generation-schema.test.ts`.
- `apps/api/test/m9.3-content-generation.int.test.ts`.
- `apps/api/test/m7-student-learning-flow.int.test.ts`.
- Focused provider-routing/reasoning tests.
- Diagram schema/compiler tests liên quan.
- `apps/web/tests/admin-ai-generation-m9-8.spec.ts`.
- `apps/web/tests/student-learning-m7.spec.ts`.

## 11. Validation nhiều lớp

### 11.1. Frontend

- Integer/range cho question count và từng difficulty count.
- Tổng phân bổ chính xác.
- Document selection required.
- Model capability và temperature/reasoning exclusivity.
- Max output token range.
- Prompt fields required sau khi preview.

### 11.2. Backend request

- DTO/class-validator cho field đơn.
- Service validation cho cross-field và lesson/document ownership.
- RBAC admin.
- Error envelope chuẩn qua common error factory.

### 11.3. Worker output

- Transport schema bảo toàn root/question ownership kể cả khi một field lỗi.
- Acceptance schema cho item và set đã đủ điều kiện approve.
- Exact count và exact difficulty distribution là blocking acceptance invariant.
- Type-specific answer validation.
- Hint/solution completeness.
- Answer/solution consistency.
- Source chunk membership.
- Diagram semantic/compiler validation.
- Duplicate question guard.
- Recovery classification, deterministic issue copy và pass-through invariant.

Ba lớp phải độc lập; không xem validation frontend là security boundary.

## 12. Test case bắt buộc

### 12.1. Admin form và preview

- Fixed difficulty không hiện ba field phân bổ.
- MIXED hiện đủ Dễ/Trung bình/Khó.
- `5 + 8 + 3 = 16` hợp lệ.
- Tổng thiếu/thừa hiển thị lỗi đúng field/nhóm field.
- Số âm, số thập phân và chuỗi không hợp lệ bị chặn.
- Thay đổi question count làm preview stale.
- Reasoning model hiện Reasoning Effort và không gửi Temperature.
- Non-reasoning model hiện Temperature.
- Input tab phản ánh đúng System/User/model/reasoning/max token/context.
- Preview không enqueue job và không gọi provider.

### 12.2. Worker

- Fixed EASY sinh đủ câu EASY.
- MIXED `5/8/3` sinh đúng chính xác từng nhãn.
- Thiếu/thừa một slot khi root vẫn đọc được tạo draft
  `SUCCEEDED_WITH_WARNINGS`, exact-count issue và chặn approve.
- Sai distribution khi root vẫn đọc được tạo blocking issue dù tổng đúng.
- Thiếu hint, `keyIdea`, steps hoặc final answer chỉ cô lập đúng field/question;
  normalized domain object của các câu `PASS` khác phải deep-equal trước/sau
  recovery layer.
- Final answer mâu thuẫn correct answer luôn là blocking issue; có thể render dưới
  badge `REVIEW_REQUIRED` để admin sửa/đối chiếu, nhưng không được auto-accept hoặc
  tự sửa đáp án.
- Source chunk lạ thành blocking `NEEDS_SOURCE`; student không nhận item đó.
- Diagram intent hợp lệ được compile/persist.
- Diagram sai semantic được cô lập, không persist như spec hợp lệ và chặn approve.
- Root JSON unreadable/ownership không xác định/source stale/provider-DB-infra lỗi
  làm full job fail, không overwrite artifact tốt trước đó.
- Transaction rollback toàn bộ khi persistence fail; lỗi item cục bộ lưu thành
  draft nhất quán thay vì loại bỏ mọi câu hợp lệ.
- Không có automatic repair/judge/fallback provider call.
- Retry không tạo duplicate set/questions/explanations.
- Raw `diagramSpec`, archetype thiếu evidence và `VERY_COMPLEX` đi đúng capability
  guard; question difficulty không bị nhầm với diagram complexity.
- Mọi valid Summary example/Quiz question/diagram qua recovery layer không bị
  thay đổi ngoài normalizer deterministic đã được chốt.
- `reviewIssues[]` gắn đúng question/field, copy tiếng Việt deterministic, technical
  details được sanitize và `blockingIssueCount` khớp số issue chưa resolve.
- Accept local không gọi provider; target fingerprint đổi làm acceptance cũ mất
  hiệu lực và backend tạo/gỡ issue đúng sau lần save kế tiếp.
- Draft warning vẫn edit/save được; approve bị reject khi còn issue không
  accept-safe hoặc chưa resolve, nhưng student API không lộ draft.

### 12.3. Student API/UI

- Hint ẩn ban đầu và hiện sau click.
- Hint của question hiện đúng, không lẫn question khác.
- Quiz review hiển thị key idea/steps/final answer.
- Test review hiển thị cùng panel sau submit.
- Test chưa submit không nhận answer/explanation.
- Diagram render đúng trong review.
- Explanation chưa duyệt/stale không được student API trả về.
- Legacy explanation text vẫn hiển thị.
- Missing explanation dùng fallback, không crash.
- Mobile/tablet/laptop và light/dark không overflow hoặc mất contrast.

## 13. Verification dự kiến

```bash
pnpm --filter @learning-path/shared typecheck
pnpm --filter @learning-path/api typecheck
pnpm --filter @learning-path/web typecheck
pnpm --filter @learning-path/api exec vitest run test/m9.3-content-generation-schema.test.ts test/m9.3-content-generation.int.test.ts test/m7-student-learning-flow.int.test.ts
pnpm --filter @learning-path/web exec playwright test tests/admin-ai-generation-m9-8.spec.ts tests/student-learning-m7.spec.ts
pnpm --filter @learning-path/api lint
pnpm --filter @learning-path/web lint
pnpm --filter @learning-path/shared build
pnpm --filter @learning-path/api build
pnpm --filter @learning-path/web build
git diff --check
```

Nếu package script thực tế khác, dùng script tương đương đang được khai báo trong
`package.json`; không cài test runner mới nếu harness hiện tại đã đủ.

Sau khi chỉnh worker:

```bash
pnpm dev
```

## 14. Kiểm soát provider, chi phí và Live acceptance gate

### 14.1. Nguyên tắc chung

- Unit/integration/E2E trước Live gate dùng mock provider.
- `Cập nhật dữ liệu gửi AI` chỉ dựng preview, không gọi OpenAI.
- Preview hiển thị document/chunk/token estimate và chi phí tối đa nếu có giá.
- Không gọi OpenAI trong lúc code/check lặp lại.
- Không dùng Live test thay thế unit/integration/E2E; Live test chỉ chạy sau khi
  toàn bộ check local liên quan đã đạt.
- Không tự chạy lại paid provider nếu lần gọi trước đã tạo artifact/cache hợp lệ.
- Generation ban đầu chỉ có đúng một provider call; không tự chuyển model/provider
  hoặc gọi thêm judge/repair. Reservation/hard-stop phải dùng cơ chế budget M9.12.
- Cache key tối thiểu gồm model snapshot, reasoning/temperature, prompt + contract
  version, fixture/source hash và selected-document hash. Thay đổi compiler,
  validator, layout hoặc renderer phải reprocess/re-render từ raw/normalized output
  đã cache, không tạo paid call mới.

### 14.2. Live acceptance gate bắt buộc

Live test là tiêu chí nghiệm thu bắt buộc của task này, nhưng là bước
approval-gated vì có chi phí thật. Trước khi gọi, Codex phải trình owner:

- Lesson và tài liệu được chọn.
- Model/provider thực tế.
- System instructions, user prompt và input estimate đã preview.
- Input token ước tính.
- `max_output_tokens`.
- Số lần gọi tối đa.
- Chi phí tối đa ước tính bằng USD/VND nếu bảng giá cho phép.
- Prompt/contract version, source hash và cache-hit/miss dự kiến.

Chỉ thực hiện sau khi owner xác nhận rõ ngay tại Live gate. Việc owner duyệt kế
hoạch hoặc ra lệnh bắt đầu implement không tự động được coi là duyệt chi phí cho
lần gọi provider thật.

### 14.3. Kịch bản Live test tối thiểu

Chạy một generation end-to-end trên một lesson nhỏ có tài liệu READY/cache hợp
lệ và có kiến thức phù hợp để tạo ít nhất một câu cần hình. Ưu tiên lesson/
archetype đã có exact-page reference và live evidence M9.2; không chọn capability
đang thiếu nguồn chỉ để ép Live case PASS:

```json
{
  "questionCount": 3,
  "difficulty": "MIXED",
  "difficultyCounts": {
    "easy": 1,
    "medium": 1,
    "hard": 1
  },
  "extraInstructions": "Tạo ít nhất một câu có lời giải cần diagram minh họa."
}
```

Live flow phải đi qua đúng đường production:

```text
Admin prompt preview
  -> generate API
  -> BullMQ queue
  -> worker
  -> dựng request bằng shared example authoring core + Quiz adapter
  -> OpenAI thật
  -> transport validation + Quiz adapter/recovery mapping
  -> acceptance/semantic validation
  -> diagram compiler
  -> transaction persistence của draft nhất quán
  -> admin review
  -> student Quiz review renderer
```

Không gọi thẳng provider bằng script bỏ qua queue/service/persistence, trừ một
diagnostic riêng đã được owner đồng ý; diagnostic đó không thay thế Live gate.

### 14.4. Tiêu chí pass Live test

- Job hoàn thành qua đúng queue/worker/provider route.
- Persist đúng ba question và đúng `1 EASY + 1 MEDIUM + 1 HARD`.
- Mỗi question có nhãn difficulty, đáp án hợp lệ và hint không lộ trực tiếp đáp
  án.
- Mỗi explanation có `keyIdea`, ít nhất một bước giải và `finalAnswer` nhất quán
  với correct answer.
- Có ít nhất một question chứa diagram intent hợp lệ, compile/persist thành
  `diagramSpecJson` và render được ở admin/student review.
- Mọi `sourceChunkIds` thuộc đúng context tài liệu đã chọn.
- Không có record mồ côi hoặc duplicate. Nếu Live output có recovery warning thì
  chứng minh các câu hợp lệ được giữ nguyên, issue được cô lập và approve bị chặn;
  tuy nhiên bộ Live dùng để nghiệm thu cuối phải được sửa/review tới khi đủ đúng
  ba câu và phân bổ `1/1/1`.
- Artifact giữ trạng thái `NEEDS_REVIEW` cho tới khi admin chủ động duyệt.
- Ghi nhận model/provider, số question, input/output tokens, số lần gọi, trạng
  thái cache, job/artifact ID, raw + normalized output, prompt/contract/compiler
  fingerprint, reference IDs và chi phí thực tế/ước tính.

### 14.5. Xử lý khi Live test fail

- Không tự động forced rerun chỉ để tìm output đẹp hơn.
- Phân loại nguyên nhân theo taxonomy:
  `PROVIDER_CONTENT_OR_INTENT | TRANSPORT_SCHEMA | ACCEPTANCE_SCHEMA | COMPILER |
  SEMANTIC_VALIDATOR | LABEL_LAYOUT | RENDERER | RESPONSIVE_THEME | API_UI |
  SOURCE_REFERENCE | PROVIDER_TRANSIENT`.
- Ưu tiên dùng artifact/output lỗi đã có để debug và bổ sung test mock/regression.
- Các lỗi từ `TRANSPORT_SCHEMA` trở xuống phải thử fix/reprocess từ cache trước.
  Chỉ `PROVIDER_CONTENT_OR_INTENT` hoặc provider transient mới có thể cần paid
  rerun; không tự động đổi provider/model.
- Trước lần gọi paid thứ hai, báo lại nguyên nhân, thay đổi đã thực hiện, token
  budget và chi phí ước tính; chờ owner xác nhận lần nữa.
- Nếu owner chưa duyệt Live call, báo trạng thái `Implementation/check local đã
  xong, Live acceptance gate đang chờ duyệt chi phí`; không tuyên bố task đã
  nghiệm thu hoàn toàn.

### 14.6. Vòng screenshot review bắt buộc sau Live test

Live job thành công về kỹ thuật chưa đủ để PASS. Sau mỗi paid Live output phải
chạy đầy đủ vòng sau:

```text
paid live output
  -> lưu response đã chuẩn hóa + job/artifact ID + usage/cost
  -> render bằng component thật trên runtime thật
  -> chụp screenshot đủ state/viewport/theme
  -> Codex tự mở và xem từng screenshot, không chỉ kiểm file tồn tại
  -> chạy cùng semantic visual review/golden harness của M9.2
  -> đối chiếu từng question với nguồn chính thống
  -> đánh giá toàn bộ đề bài/đáp án/hint/solution/diagram/UI
  -> PASS hoặc tạo defect có severity + evidence + root cause
  -> sửa prompt/schema/validator/compiler/mapper/API/UI theo root cause
  -> chạy focused regression
  -> render lại + chụp lại + tự đánh giá lại
  -> lặp cho tới khi đạt exit criteria
```

Quy tắc vòng lặp:

- Lỗi UI/layout/renderer/compiler phải ưu tiên sửa và render lại từ chính
  persisted/cache artifact; không gọi lại OpenAI nếu intent/content không sai.
- Lỗi provider content/intent hoặc prompt contract chỉ được kiểm chứng bằng paid
  rerun sau khi đã bổ sung mock/regression test và owner duyệt chi phí lần gọi
  tiếp theo.
- Không sửa tay duy nhất artifact Live để che lỗi hệ thống. Fix phải nằm ở
  prompt/schema/validator/compiler/mapper/UI phù hợp để generation sau cũng đúng.
- Mỗi vòng review phải ghi screenshot cũ, defect, file/root cause đã sửa, check đã
  chạy, raw/normalized artifact, compiler fingerprint, reference ID và screenshot
  mới.
- Không giới hạn số vòng sửa/render miễn không phát sinh paid call mới. Mỗi paid
  call bổ sung vẫn cần approval riêng theo mục 14.5.

### 14.7. Ma trận screenshot bắt buộc

Phải chụp từ dữ liệu Quiz Live thật, không dùng mock thay thế:

Admin:

- Modal cấu hình và Input preview trước generation.
- Job hoàn thành và Quiz set được tạo.
- Review từng question, gồm difficulty, answer, hint, solution và diagram.

Student:

- Quiz runner khi hint đang đóng.
- Quiz runner sau khi bấm mở hint.
- Màn review của cả ba question.
- Màn Test review dùng explanation/diagram đã approve để xác nhận shared review
  panel không chỉ đúng ở Quiz.
- Ảnh riêng/crop đủ lớn cho từng solution và từng diagram, không chỉ một ảnh
  full-page quá nhỏ để đọc.

Nghiệm thu UI dùng đúng ba nhóm thiết bị:

1. Mobile `390x844` — thiết bị cốt lõi và quality gate ưu tiên cao nhất.
2. iPad `834x1112`.
3. Laptop `1440x1000`.

Cả ba thiết bị phải được chụp ở light và dark theme, tức tối thiểu sáu screenshot
cho mỗi state/case cần review. Riêng mobile phải kiểm trên cả Chromium và WebKit
ở cùng viewport `390x844` đối với runner, hint, review và mọi diagram; đây là hai
browser engine của cùng nhóm mobile, không tính thành thiết bị thứ tư.

Quy tắc mobile-core:

- Mọi state/action chính phải PASS mobile trước khi kết luận iPad/laptop đạt.
- Ưu tiên sửa layout, typography, touch target, modal scroll, công thức và diagram
  cho mobile trước; sau đó chạy lại iPad/laptop để phát hiện regression.
- Không chấp nhận phương án chỉ đẹp trên laptop nhưng phải thu nhỏ chữ, cuộn
  ngang, crop diagram hoặc che action trên mobile.
- Admin modal dù có nghiệp vụ laptop-first vẫn phải hoàn thành đầy đủ trên mobile;
  body scroll riêng, header/footer/action không bị mất hoặc che bàn phím.
- Student runner/review phải ưu tiên tốc độ, độ đọc và thao tác một cột trên
  mobile; iPad/laptop là các lớp responsive mở rộng từ baseline này.

Screenshot vòng lặp lưu tạm theo cấu trúc:

```text
.codex/screenshots/m9-3-quiz-live/<run-id>/<iteration>/
  failed/
  passed/
  review.md
```

Không trộn ảnh chưa duyệt vào thư mục `passed`. Ngay khi toàn bộ flow đạt exit
criteria, tự động lưu bộ ảnh cuối theo rule repo vào:

```text
docs/final-screen-ui/{laptop,ipad,mobile}/{admin,student}/{route-path}/
```

Không commit ảnh/crop nguyên trang SGK/SBT/SGV có bản quyền. Reference page chỉ
dùng nội bộ cho review khi có quyền truy cập hợp pháp.

### 14.8. Nguồn chính thống dùng để đánh giá

Mỗi question và mỗi diagram chỉ được PASS khi có reference record. Thứ tự ưu
tiên:

1. Trang/bài/figure chính xác trong tài liệu SGK hoặc SBT Kết nối tri thức đã gắn
   với lesson và được admin chọn làm source.
2. Bản điện tử SGK/SBT/SGV Kết nối tri thức đúng môn, lớp, tập và bài từ cổng
   chính thức của Nhà xuất bản Giáo dục Việt Nam.
3. Tài liệu tập huấn, tài liệu giới thiệu sách, kế hoạch bài dạy hoặc slide chính
   thức của nhà xuất bản.
4. Chương trình Giáo dục phổ thông và tài liệu chính thức của Bộ GDĐT.
5. Tài liệu từ nhà xuất bản, trường đại học, cơ sở giáo dục hoặc tổ chức chuyên
   môn chính thống khác để kiểm chéo quy ước/kiến thức.

Blog, video, diễn đàn, trang giải bài tập hoặc ảnh tìm kiếm không rõ nguồn chỉ
được dùng để tìm manh mối; không đủ làm bằng chứng PASS.

Reference record tối thiểu:

```text
referenceId, sourceKind, title, publisher, series, subject,
grade, volume, lesson, page, figure, urlOrLocalSource,
accessedAt, localArtifactHash, comparisonClaims,
copyrightUse=REVIEW_ONLY, status
```

Review record của mỗi question:

```text
questionId, screenshotPaths, referenceIds,
comparisonMode=EXACT_FIGURE|SAME_ARCHETYPE|CONVENTION_ONLY,
sourceScopeDecision, questionDecision, answerDecision,
hintDecision, solutionDecision, difficultyDecision,
diagramDecision=PASS_EXACT|PASS_RESPONSIVE_ADAPTATION|NEEDS_SOURCE|FAIL,
semanticDifferences, notationDifferences, layoutDifferences,
responsiveAdaptations, uiDecision, defects, reviewerNotes
```

Nếu thiếu nguồn đủ mạnh, dùng `NEEDS_SOURCE`; không được tự kết luận PASS. Với
câu mới do AI biên soạn, không yêu cầu giống nguyên bài mẫu, nhưng kiến thức,
phương pháp, ký hiệu và diagram convention phải được kiểm bằng source cùng bài
hoặc cùng archetype trong đúng lớp.

Với diagram complexity `HARD`, review phải có thêm kiểm chéo SGV/tài liệu tập
huấn/golden exact-page phù hợp khi tồn tại. Golden cũ hoặc ảnh trong thư mục
`passed` chỉ là bằng chứng khi manifest chứng minh đã source-backed; tên thư mục
hoặc một test pass đơn thuần không đủ để kết luận.

### 14.9. Rubric đánh giá toàn bộ Quiz

Đánh giá phải bao phủ “mọi thứ đã ổn chưa”, không chỉ solution hoặc hình vẽ.

#### A. Phạm vi nguồn và cấp học

- Câu hỏi chỉ dùng kiến thức nằm trong lesson/source đã chọn.
- Không thêm định lý, kỹ thuật hoặc thuật ngữ vượt cấp/lệch chương trình.
- Ngôn ngữ, ký hiệu và cách trình bày phù hợp đúng lớp/tập/bài.
- Source chunk metadata và reference record truy vết được.

#### B. Đề bài

- Đề bài mới, rõ nghĩa, tự đủ dữ kiện và có đúng một cách hiểu hợp lý.
- Không copy nguyên văn bài nguồn, không phụ thuộc câu `xem hình bên` hoặc ảnh OCR.
- Không thừa/thiếu dữ kiện, không mâu thuẫn giữa text và diagram.
- Loại câu hỏi phù hợp nội dung và mục tiêu học tập.
- Không trùng hoặc chỉ thay số máy móc giữa ba câu.

#### C. Đáp án, phương án nhiễu và grading

- Correct answer đúng theo nguồn và phép tính/suy luận độc lập.
- Single choice chỉ có một đáp án đúng; multiple choice có đúng tập đáp án.
- Distractor hợp lý, phản ánh lỗi sai thường gặp nhưng không mơ hồ hoặc vô lý.
- Không có dấu hiệu hình thức làm lộ đáp án như độ dài/cách viết khác biệt rõ.
- Grading rule nhất quán với question type và final answer.

#### D. Độ khó

- Nhãn `EASY|MEDIUM|HARD` phản ánh số bước, mức suy luận và độ phức tạp thực tế.
- Đúng phân bổ `1/1/1` của Live case.
- Câu HARD vẫn nằm trong phạm vi nguồn/cấp học, không tạo độ khó bằng dữ kiện mơ
  hồ hoặc kiến thức ngoài bài.

#### E. Hint

- Gợi đúng kiến thức/bước khởi đầu, có ích khi học sinh bị kẹt.
- Không nói trực tiếp đáp án hoặc thay học sinh thực hiện toàn bộ lời giải.
- Không mâu thuẫn với `keyIdea`, steps, final answer hoặc diagram.
- UI mặc định đóng và mở đúng sau thao tác của học sinh.

#### F. Solution

- `keyIdea` nêu đúng phương pháp/kiến thức cốt lõi, không phải bản sao final
  answer và không đưa phương pháp sai.
- Từng phần tử `steps` đúng toán học, đúng thứ tự, đủ dữ kiện và không nhảy bước
  quan trọng đối với cấp học đó.
- Ký hiệu, đơn vị, LaTeX, thuật ngữ và phép biến đổi chính xác.
- `finalAnswer` đúng và khớp tuyệt đối với correct answer/grading.
- Lời giải dễ học, không dài dòng, không suy luận vòng tròn và không hallucinate
  dữ kiện không có trong đề.
- Đối chiếu được với lời giải/phương pháp chính thống; nếu có nhiều cách giải,
  cách được chọn vẫn phải hợp chương trình và phù hợp cấp học.

#### G. Diagram

- Bắt buộc đi qua cùng semantic review/reference/golden process của M9.2; không
  dùng một checklist rút gọn riêng cho Quiz.
- Hình biểu diễn đúng đề, dữ kiện, incidence, số đo và quan hệ toán học.
- Primitive, marker, tick, trục, tỉ lệ, điểm dựng và đơn vị đúng quy ước SGK.
- Diagram và solution mô tả cùng một bài; không có điểm/số đo/quan hệ thừa hoặc
  mâu thuẫn.
- Nhãn ở vùng trống gần đối tượng, không đè nét/marker/text khác.
- Không cắt hình/chữ; đọc được trên mobile, iPad và laptop.
- Light/dark đủ tương phản và không làm thay đổi ý nghĩa hình.
- Không yêu cầu giống pixel hình SGK; tính đúng toán học và ý nghĩa sư phạm đứng
  trước, responsive adaptation được phép nếu giữ nguyên quan hệ.

#### H. UI/UX và flow

- Mobile là core: đánh giá và sửa mobile trước, sau đó xác nhận iPad/laptop không
  có regression.
- Nội dung không tràn, overlap, nhảy layout hoặc bị modal che/cắt.
- Text, công thức, options, hint, solution và diagram có thứ bậc dễ đọc.
- Mobile không có horizontal scroll ngoài vùng được thiết kế riêng; touch target,
  sticky/footer action, modal keyboard/scroll và diagram đều sử dụng được.
- Loading, pending, disabled, error, success và review states hoạt động đúng.
- Keyboard/accessibility cơ bản đúng; hint có trạng thái mở/đóng rõ.
- Admin nhìn đủ dữ liệu để review trước khi approve.
- Student không thấy explanation chưa duyệt/stale; Test không lộ đáp án trước
  submit.
- Runtime không có hydration error, console error hoặc request lỗi liên quan.

#### I. End-to-end và dữ liệu lưu

- Job, source hash, route snapshot, question count và difficulty counts đúng.
- Database lưu đúng hint, difficulty, explanation, diagram spec và source
  metadata.
- Cache key, prompt/contract/compiler fingerprint và usage đủ để tái hiện output.
- Retry không tạo duplicate; persistence failure không để dữ liệu mồ côi.
- Recovery cục bộ giữ nguyên mọi câu hợp lệ, cô lập issue đúng ownership và chặn
  approve/student exposure cho tới khi resolved.
- Admin approve/stale behavior và student serializer đúng contract.

### 14.10. Severity và exit criteria

Severity:

- `BLOCKER`: sai kiến thức/đáp án, diagram sai quan hệ, lời giải dẫn tới kết quả
  sai, lộ đáp án Test, dùng nguồn ngoài phạm vi hoặc lỗi khiến flow không chạy.
- `MAJOR`: đề mơ hồ, thiếu bước quan trọng, hint lộ đáp án, difficulty sai rõ,
  diagram khó/không đọc được, UI che mất nội dung hoặc không thao tác được.
- `MINOR`: copy, spacing, wording hoặc chi tiết trình bày không làm đổi kiến thức
  nhưng vẫn làm giảm chất lượng học tập/UI.

Chỉ kết thúc vòng Live screenshot review khi:

- Không còn `BLOCKER` hoặc `MAJOR` đã biết.
- Không còn `MINOR` đã biết trong phạm vi Live screenshot; defect nhìn thấy phải
  được sửa và chụp lại, không đóng task bằng cách ghi nhận rồi bỏ qua.
- Cả ba question PASS toàn bộ rubric A-I.
- Mobile PASS toàn bộ state ở light/dark và Chromium/WebKit trước; iPad và laptop
  sau đó PASS cùng flow mà không tạo regression.
- Có đủ bằng chứng screenshot của đúng ba nhóm thiết bị mobile/iPad/laptop; không
  được dùng ảnh laptop để thay cho đánh giá mobile-core.
- Mọi screenshot được Codex mở và đánh giá thủ công; không dùng test pass thay
  cho visual/content review.
- Mỗi question/diagram có reference record hợp lệ từ nguồn chính thống.
- Tất cả screenshot cuối nằm trong `passed`, không lẫn ảnh lỗi.
- Regression của shared example authoring core và golden diagram M9.2 vẫn pass.
- M9.2 Summary adapter giữ nguyên contract/output hợp lệ; Quiz adapter thêm
  `keyIdea` mà không buộc Summary đổi schema.
- Review record dùng đúng comparison mode/decision chuẩn M9.2; không có diagram
  được PASS bằng đánh giá riêng ngoài hệ thống đó.
- Review report cuối liệt kê rõ nguồn, ảnh, lỗi đã sửa, vòng lặp đã chạy và lý do
  kết luận PASS.
- Nếu còn mục chưa kiểm chứng hoặc thiếu source, task phải báo `NEEDS_SOURCE` hoặc
  blocker tương ứng; không dùng nhận xét chủ quan `trông có vẻ ổn` để đóng task.

## 15. Docs dự kiến cập nhật khi triển khai

- `docs/02-user-flows.md`.
- `docs/05-api-contract.md` nếu index cần đổi.
- `docs/api/quiz-flashcard-tests.md`.
- `docs/06-ai-rag-spec.md`.
- `docs/08-ui-pages-and-components.md`.
- `docs/implementation/M7.md`.
- `docs/implementation/M9.md`.
- `docs/implementation/feature-coverage-matrix.md`.
- `.codex/context/code-index.md` nếu tạo/di chuyển entrypoint quan trọng.

Khi triển khai phải sửa rõ mâu thuẫn hiện có trong docs M9.3 giữa câu chữ “output
invalid không lưu/rollback toàn set” và policy partial recovery mới: DB transaction
vẫn atomic, nhưng một draft nhất quán có localized issue được phép lưu với
`SUCCEEDED_WITH_WARNINGS` và không được approve. API/AI spec phải mô tả riêng
transport validation, acceptance validation và student visibility boundary.

Không dự kiến cập nhật:

- Prisma/database docs, vì không cần migration hoặc field mới.
- Env docs, trừ khi phát hiện config provider hiện tại thiếu contract đã được
  docs quy định.
- Changelog, vì chưa có lệnh commit.
- Execution plan chính, trừ khi trong lúc implement phát hiện dependency mới.

## 16. Tiêu chí nghiệm thu

Task được coi là hoàn thành khi:

1. Quiz dùng chung lõi sinh đề bài, solution và diagram của example block M9.2;
   không tồn tại một bản prompt/validator/compiler copy riêng dễ bị lệch.
2. Regression test xác nhận khối ví dụ của Sinh kiến thức vẫn giữ contract và
   chất lượng kỹ thuật sau khi extract phần dùng chung.
3. Diagram Quiz dùng đúng reference catalog, semantic review, comparison mode,
   decision và golden regression harness của M9.2; không có evaluator riêng.
4. Admin chọn đúng tài liệu nguồn và xem được prompt/input trước khi gọi AI.
5. Admin điều khiển được model, temperature hoặc reasoning effort, max output
   tokens, cách trình bày và yêu cầu bổ sung.
6. MIXED `5/8/3` với tổng 16 tạo đúng 16 câu và đúng từng số lượng.
7. Mỗi câu sinh ra có nhãn độ khó hợp lệ.
8. Mỗi Quiz có hint, nhưng học sinh chỉ thấy khi bấm nút gợi ý.
9. Mỗi Quiz/Test AI mới có lời giải gồm `keyIdea`, steps và final answer.
10. Câu cần hình có diagram được compile/render an toàn.
11. Admin xem và duyệt được toàn bộ hint/lời giải/hình.
12. Student review Quiz/Test hiển thị lời giải của từng câu.
13. Test không lộ answer/explanation trước submit.
14. Explanation chưa duyệt hoặc stale không được hiển thị cho học sinh.
15. Root/provider/DB/infra failure không tạo dữ liệu mồ côi hoặc duplicate; lỗi
    cục bộ có ownership tạo draft nhất quán, giữ nguyên câu hợp lệ và chặn approve.
16. Typecheck, focused tests, E2E, lint và build liên quan pass.
17. Live acceptance gate chạy qua OpenAI thật và đạt toàn bộ tiêu chí mục 14.4
    sau khi owner duyệt chi phí.
18. Vòng screenshot review đạt exit criteria mục 14.10 trên đúng ba nhóm thiết
    bị mobile/iPad/laptop, trong đó mobile là core gate và đã kiểm cả
    Chromium/WebKit ở light/dark.
19. Mỗi question/solution/diagram có reference record từ nguồn chính thống và
    không còn trạng thái `NEEDS_SOURCE`.
20. Transport/acceptance schema, recovery states, `reviewIssues[]`, target
    fingerprint/acceptance invalidation, `blockingIssueCount`, issue copy và
    student visibility boundary có unit/integration/E2E coverage.
21. Initial generation chỉ gọi provider một lần; cache/reprocess và paid rerun
    tuân thủ M9.12 cùng approval chi phí riêng.
22. Diagram capability guard phân biệt question difficulty với diagram complexity;
    raw fallback, archetype thiếu evidence và `VERY_COMPLEX` không được auto-pass.
23. Docs contract và milestone phản ánh đúng behavior đã triển khai.

## 17. Rủi ro và cách giảm thiểu

### 17.1. M9.2 đang có thay đổi chưa commit

Diagram compiler/schema/renderer đang được owner chỉnh trong worktree. Khi triển
khai phải đọc lại diff, không revert và tránh chỉnh chồng. Nên ổn định interface
M9.2 trước khi extract phần dùng chung.

### 17.2. Output quá lớn

Nhiều câu kèm lời giải/hình có thể vượt context/output limit. Cần preview token,
hard max tokens, compact diagram intent và lỗi rõ ràng. Nếu provider vẫn trả thiếu
câu nhưng root đọc được, giữ câu hợp lệ trong draft warning và chặn approve thay
vì mất toàn bộ output; bộ cuối cùng vẫn phải đủ exact count trước phát hành.

### 17.3. Prompt admin chỉnh mâu thuẫn invariant

System/User prompt cho phép chỉnh để đáp ứng nghiệp vụ, nhưng exact count,
difficulty, schema, source scope và diagram safety vẫn được validator cưỡng chế.

### 17.4. Preview stale

Source hash và server-side rebuild ngăn trường hợp tài liệu/prompt route thay đổi
sau khi admin đã xem preview.

### 17.5. Lộ đáp án Test

Test start/resume serializer phải giữ security boundary; lời giải và correct
answer chỉ xuất hiện trong review sau submit.

### 17.6. Legacy question thiếu lời giải

Không tự phát sinh chi phí backfill. UI fallback an toàn; nếu owner muốn backfill
thì lập task/provider budget riêng.

### 17.7. Thiếu quyền truy cập nguồn chính thống

Nếu không có đúng SGK/SBT/SGV hoặc nguồn chính thống tương đương để kiểm chứng,
case phải giữ `NEEDS_SOURCE`. Chỉ dùng tài liệu owner đã cung cấp hoặc nguồn có
quyền truy cập hợp pháp; không tải/commit bản scan lậu để hoàn thành review.

### 17.8. Nhầm mức trưởng thành của diagram M9.2

M9.2 coverage hiện `IN_PROGRESS`, chưa thể coi 50 archetype là release-ready.
M9.3 phải snapshot manifest/evidence lúc implement, chọn Live case có exact-page
evidence và giữ raw fallback/archetype chưa đủ bằng chứng ở `REVIEW_REQUIRED`.

### 17.9. Recovery làm biến đổi output hợp lệ

Recovery sanitizer/mapper có thể vô tình sửa câu đúng. Phải tách normal mapper và
recovery mapper, thêm pass-through invariant test cho Summary example, Quiz
question và diagram; recovery chỉ được chạm đúng field đã ownership lỗi.

## 18. Assumption và điểm cần giữ khi triển khai

- `keyIdea` là tên field chính thức; không dùng `overview` hoặc `keyIDea`.
- Đề bài, solution và diagram của Quiz phải đi qua shared example authoring core
  được trích từ khối ví dụ M9.2; chỉ lớp Quiz-specific mới tạo distractor, hint,
  difficulty và grading shape.
- Summary adapter giữ provider contract hiện tại; `keyIdea` là contract riêng của
  Quiz/Test explanation adapter, không phải lý do sửa output schema M9.2 đã ổn.
- MIXED hiện cho phép một difficulty count bằng `0`; tổng vẫn phải khớp.
- Input tab là dữ liệu derived/read-only; System instructions và User prompt cho
  phép admin chỉnh như modal Sinh kiến thức.
- Admin Quiz generation dùng chính các tài liệu admin chọn. Không âm thầm trộn
  chunk từ document không được chọn.
- Test chỉ được nâng structured solution/diagram phục vụ review; chưa thêm bộ
  cấu hình nâng cao vào modal Sinh Test.
- Không có migration database trong kế hoạch hiện tại.
- Nếu kiểm chứng schema cho thấy existing JSON/job result không biểu diễn được
  recovery issue/placeholder an toàn, phải dừng và báo owner trước khi đổi DB.
- Một local item error không tự động làm fail toàn job: ưu tiên coherent draft
  `SUCCEEDED_WITH_WARNINGS`; full failure chỉ dùng cho root/ownership/source stale/
  provider/DB/infra như mục 5.8.
- Không có provider call trả phí khi chưa có xác nhận riêng.
- Screenshot review bắt buộc trên mobile/iPad/laptop; mobile là core quality gate.
- Mỗi kết luận PASS về kiến thức, solution hoặc diagram phải có reference record
  chính thống; nhận xét thị giác chủ quan không đủ để nghiệm thu.
- Diagram review bắt buộc dùng lại evaluator/reference/golden process của M9.2;
  không được tạo evaluator Quiz riêng hoặc tiêu chí nhẹ hơn.

## 19. Approval gate

File này là kế hoạch bổ sung cho các subtask đã có trong roadmap, không tự thay
đổi trạng thái Done của M7/M9 và không được xem là lệnh triển khai.

Codex chỉ bắt đầu sửa FE/BE/worker sau khi owner xác nhận rõ bằng lời như:

```text
ok, bắt đầu đi
```
