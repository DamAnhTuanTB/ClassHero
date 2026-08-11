# M9.16 — Harden contract System/User prompt Sinh kiến thức và phủ lớp 3–12

Trạng thái: `PLANNED` ngày 2026-08-11

Mode: `Worker/Integration + UI`

Quyết định owner ngày 2026-08-11: giữ quyền sửa trực tiếp prompt hiệu lực. Nếu
admin gửi `systemInstructions` hoặc `userPrompt` khác rỗng, backend phải dùng
nguyên nội dung đó cho lớp prompt tương ứng; không được tự bọc base prompt,
contract hay preference. Chỉ field rỗng mới dùng prompt mặc định.

Guard an toàn bổ sung theo feedback owner ngày 2026-08-11: tối ưu kích thước
Structured Output schema phải là corrective pass độc lập, không triển khai chung
với refactor prompt, learner profile, mapper, recovery hoặc diagram compiler.
Pass đầu chỉ được đổi cách serialize cùng một Zod transport contract từ inline
sang `$defs/$ref`; không đổi key, required/nullability, union, description,
acceptance schema hay persisted output. Phải có cờ rollback về inline và không
gọi provider trả phí trước khi equivalence test local pass.

Phạm vi chính: `M9.2` Sinh kiến thức, `M9.8` prompt preview và phần EXAMPLE dùng
chung với `M9.3` Quiz/Test. Đây là corrective pass không thêm nghiệp vụ ngoài MVP,
không thêm database migration và mặc định không gọi provider trả phí.

## 1. Mục tiêu

- Mỗi hard contract chỉ xuất hiện đúng một lần trong system prompt hiệu lực.
- Prompt System/User do admin sửa thay thế toàn bộ prompt mặc định tương ứng và
  không bị ghép lặp.
- User prompt chỉ chứa dữ liệu thay đổi theo lần chạy: bài học, đối tượng/văn phong,
  độ dài và yêu cầu bổ sung.
- Hỗ trợ đúng học sinh lớp 3–12, gồm THPT; bài chứng minh Hình học chính thức lớp
  7–12 dùng bảng GT–KL và mạch suy luận phù hợp cấp học.
- Preview và generate dùng cùng một builder, cùng context, schema và cấu hình;
  không thể generate bằng preview đã stale.
- Giảm token đầu vào, tăng khả năng audit và giữ EXAMPLE của Summary/Quiz/Test
  cùng một nguồn quy tắc.

## 2. Baseline và lỗi phải sửa

### 2.1. System prompt

- `LESSON_SUMMARY_SYSTEM_PROMPT` đã chứa toàn bộ structure invariant nhưng nhánh
  custom system lại nối invariant lần hai. Baseline đo được: prompt mặc định
  `19.366` ký tự/một contract; có custom system thành `35.574` ký tự/hai contract.
- Resolved system prompt cũ thiếu marker hiện hành bị nối nguyên contract mới vào
  cuối prompt cũ, có thể để hai phiên bản quy tắc cùng tồn tại và mâu thuẫn.
- Quy tắc `note`, theory–illustration, văn phong solution, ký hiệu góc và không lặp
  kết luận đang xuất hiện ở nhiều section.
- Câu “chỉ đổi”, “tiếp tục” và tham chiếu số “quy tắc 9–9a” không tự đứng độc lập.
- Điều kiện example có hình “khi thật sự cần” chưa nêu ngoại lệ Hình học bắt buộc
  có hình.
- Contract `INTENT` yêu cầu không tự tính tọa độ nhưng các yêu cầu `RAW_SPEC` về
  primitive, point, sample, marker và anchor chưa được đặt dưới phạm vi fallback
  rõ ràng.
- Các rule diagram lớn đang gom quá nhiều ý trong một dòng, khó review và dễ bỏ
  sót phần cuối.
- Lõi EXAMPLE dùng chung đang chọn rule bằng vị trí mảng (`index >= 4`, loại một
  index cụ thể), nên chỉ cần chèn/sắp xếp rule là Quiz/Test có thể lệch Summary.

### 2.2. User prompt và preview/generate

- Resolved user prompt chỉ được nhận diện bằng heading. Khi admin đổi grade/style/
  length/word count sau preview mà không refresh, backend vẫn có thể dùng nguyên
  prompt cũ.
- Docs nói base user prompt luôn được giữ và custom prompt chỉ append, nhưng code
  cho phép chuỗi bắt đầu bằng heading thay thế toàn bộ base prompt.
- User prompt lặp hard rule đã có ở system: phân loại context, cặp
  theory–illustration, phong cách lời giải theo môn và không nhắc prompt/chunks.
- Dòng “Không có preference bổ sung của admin” là meta noise; thuật ngữ
  `preference` trộn tiếng Anh–Việt không cần thiết.
- `targetWordCount` chưa nói rõ áp dụng cho phần nào của structured output; tổ hợp
  như `detailed + 50 từ` chưa có quy tắc ưu tiên hoặc cảnh báo.
- Khi không xác định grade, câu “không tự thêm GT–KL nếu không chắc” vẫn giao việc
  suy đoán cho model.
- Chuẩn hóa dấu câu mới bỏ dấu chấm cuối, có thể tạo `!.` hoặc `?.` khi ghép câu.

### 2.3. Phạm vi THPT

- Product/user flow đã bao phủ lớp 3–12 nhưng prompt, mapper và reviewer chỉ bắt
  buộc `geometryStatement` cho lớp 7–9.
- `diagramIntent.grade` mới nhận `3..9` dù job/summary schema nhận `1..12`.
- Target audience nhóm `HIGH_SCHOOL` có `grade=null`; context hiện chỉ lấy grade
  số thấp nhất nên khóa học gắn nhãn THPT có thể bị rơi về văn phong trung tính.
- `sourceHash` hiện chỉ chứa một `targetGrade`; thay đổi giữa group audience có
  `grade=null` có thể không làm hash thay đổi đúng ý nghĩa người học.
- Prompt Quiz/Test dùng core EXAMPLE của Summary nhưng vẫn có câu riêng giới hạn
  chứng minh Hình học ở lớp 7–9.

## 3. Kiến trúc đích đã chọn

### 3.1. Prompt mặc định và prompt do admin thay thế

Backend luôn dựng prompt hiệu lực theo đúng thứ tự ưu tiên:

```txt
systemInstructions khác rỗng -> dùng nguyên systemInstructions
systemInstructions rỗng      -> dùng canonical system prompt mặc định

userPrompt khác rỗng         -> dùng nguyên userPrompt
userPrompt rỗng              -> dựng runtime user prompt mặc định

context JSON untrusted boundary (server only)
```

- Preview trả `systemPrompt`, `userPrompt`, `inputPrompt` hiệu lực để xem; hai
  field System/User tiếp tục editable, còn request có context là read-only.
- Backend không nhận diện heading, không suy đoán prompt đã resolve và không nối
  thêm bất kỳ đoạn nào quanh prompt khác rỗng do admin gửi.
- Admin chịu trách nhiệm giữ các contract cần thiết khi thay toàn bộ prompt. UI có
  thể giải thích rủi ro này nhưng không được âm thầm sửa nội dung admin.
- Context JSON vẫn do server nối ở boundary riêng sau user prompt; đây không phải
  một phần của nội dung textarea User prompt.

### 3.2. Prompt fingerprint và chống stale

- Preview trả `requestFingerprint`, tạo từ prompt/schema version, normalized
  learner profile, source hash/document IDs, effective system/user prompt, style,
  length, target word count, model route, temperature/reasoning/max token và JSON
  Schema provider.
- Generate gửi lại `requestFingerprint`; server dựng lại request và so hash trước
  khi enqueue. Không khớp trả lỗi conflict chuẩn `AI_PROMPT_PREVIEW_STALE`, không
  tạo job và không gọi provider.
- UI đánh dấu preview stale ngay khi bất kỳ field ảnh hưởng request thay đổi và
  disable submit đến khi refresh thành công.
- Preview và worker dùng chung hàm compose; không có builder song song ở service
  hoặc frontend.

### 3.3. Cấu trúc system prompt mới

System prompt được tách thành các constant có tên, không chọn rule bằng array index:

1. Vai trò, phạm vi nguồn và chống instruction trong context.
2. Heading/topic và ranh giới kiến thức nguồn.
3. Structured content: theory, illustration, note, application exercises.
4. Presentation contract:
   - bài tính Số học/Đại số;
   - chứng minh/dựng hình;
   - grade matrix 3–12;
   - GT–KL và ký hiệu góc.
5. Diagram decision:
   - khi nào bắt buộc có diagram;
   - `INTENT` là đường mặc định;
   - `RAW_SPEC` chỉ là fallback và toàn bộ primitive/coordinate/anchor rule chỉ
     áp dụng trong nhánh này;
   - semantic rule theo family/archetype.
6. Self-check và output contract.

Mỗi yêu cầu chỉ có một bản canonical. `LESSON_SUMMARY_EXAMPLE_AUTHORING_INVARIANTS`
được compose từ các nhóm constant được gọi tên rõ, không filter theo index.

### 3.4. Learner profile lớp 3–12

Tạo normalized learner profile dùng chung cho Summary và Quiz/Test:

```ts
type AiLearnerProfile = {
  minGrade: number | null;
  maxGrade: number | null;
  gradeBand: "ELEMENTARY" | "MIDDLE_SCHOOL" | "HIGH_SCHOOL" | "MIXED" | "UNKNOWN";
  audienceCodes: string[];
  displayLabel: string;
};
```

- Grade cụ thể giữ đúng grade; nhiều grade dùng cả khoảng thay vì chỉ lấy grade
  thấp nhất.
- `PRIMARY_SCHOOL`, `SECONDARY_SCHOOL`, `HIGH_SCHOOL` lần lượt resolve thành
  `3..5`, `6..9`, `10..12`; `HIGH_SCHOOL` không được thành `UNKNOWN`.
- Profile normalized được đưa vào source hash/job metadata và prompt preview.
- `ALL_STUDENTS`/`WORKING_ADULT`/không có audience dùng văn phong trung tính, không
  tự suy đoán GT–KL.

Grade presentation matrix:

- Lớp 3–4: câu ngắn, trực quan, quan sát/nhận biết/vẽ; mẫu `Bài giải`–`Đáp số`.
- Lớp 5–6: mạch ngắn `Ta có`–`Do đó`–`Vậy`; không dùng bảng GT–KL.
- Lớp 7–9: văn phong SGK THCS; chứng minh Hình học chính thức dùng GT–KL.
- Lớp 10–12: văn phong toán học THPT chặt chẽ; chứng minh Hình học chính thức
  dùng GT–KL, phép biến đổi Số học/Đại số vẫn trình bày trực tiếp.
- `geometryStatement` bắt buộc cho formal Geometry proof từ lớp 7 đến lớp 12;
  lớp 3–6, bài không phải Hình học và bài không yêu cầu chứng minh trả `null`.

Tạo một helper duy nhất quyết định formal proof/GT–KL để prompt-related tests,
mapper và review reconciliation không dùng ba điều kiện khác nhau.

### 3.5. User prompt tối giản

User prompt hiệu lực chỉ còn dạng:

```txt
### NHIỆM VỤ SINH KIẾN THỨC
- Bài học: Số hữu tỉ.
- Đối tượng và văn phong: học sinh lớp 7; học thuật, chặt chẽ, có cấu trúc rõ ràng và dùng thuật ngữ chính xác.
- Độ dài toàn bộ nội dung học sinh đọc được: chi tiết; mục tiêu khoảng 350 từ, được phép dao động để bảo đảm đủ nội dung bắt buộc.
- Yêu cầu bổ sung: Dùng câu ngắn.
```

- Bỏ hẳn dòng yêu cầu bổ sung nếu trống.
- Không lặp grade-specific hard rule, context classification, theory–illustration
  contract hoặc security rule trong user prompt.
- Số từ áp dụng cho tổng text sư phạm học sinh nhìn thấy; không tính JSON key,
  schema metadata và diagram coordinate/primitive metadata.
- `targetWordCount` là mục tiêu mềm. Khi xung đột, structured contract và nội dung
  cốt lõi thắng số từ; UI hiện warning không chặn nếu số từ có vẻ không phù hợp
  mức `short|standard|detailed`.
- Chuẩn hóa toàn bộ dấu kết câu trước khi ghép, không chỉ dấu chấm.

### 3.6. Schema compaction không đổi semantics

- Baseline local hiện tại: JSON Schema inline khoảng `329.484` ký tự; bảy vị trí
  output inline cùng `diagramSpec`, làm schema input ước tính khoảng `274.644`
  token.
- Zod 4 hỗ trợ `reused: "ref"`; OpenAI Structured Outputs hỗ trợ `$defs/$ref`.
  Prototype local sau `toStrictJsonSchema` còn khoảng `33.232` ký tự và `27.694`
  token schema.
- Khi expand mọi `$ref`, compact schema phải deep-equal inline schema hiện tại,
  ngoại trừ metadata draft `$schema`; mismatch bất kỳ field nào phải fail test.
- `buildAiStructuredTextFormat` giữ inline làm mặc định. Summary mới opt-in qua
  option/strategy riêng; Quiz/Test/provider khác không bị đổi ngoài phạm vi.
- Preview và worker phải dùng cùng strategy và cùng schema hash. Runtime vẫn parse
  `output_parsed` bằng chính Zod transport schema, rồi đi qua recovery, mapper và
  acceptance hiện tại.
- Rollout dùng feature flag mặc định off. Một live canary nhỏ chỉ chạy sau khi
  owner duyệt chi phí; tăng schema-invalid, refusal, recovery issue hoặc thiếu hình
  phải rollback ngay về inline, không sửa prompt để bù trong cùng pass.

## 4. Thay đổi theo layer

### 4.1. Backend prompt/schema

- Refactor `lesson-summary-prompt.ts` thành các contract section có tên và composer
  đảm bảo mỗi section đúng một lần.
- Tách helper learner profile/presentation/GT–KL để Summary context, prompt,
  mapper, reviewer và Quiz/Test cùng dùng.
- Bỏ `isResolvedLessonSummarySystemPrompt` và
  `isResolvedLessonSummaryUserPrompt`; builder chọn trực tiếp custom prompt khác
  rỗng hoặc default prompt, không có nhánh bọc/append compatibility.
- Giữ `systemInstructions` và `userPrompt` trong job input; bổ sung request
  fingerprint khi triển khai stale guard mà không đổi semantics hai field này.
- Mở `diagramIntent.grade` lên `3..12`; audit compiler/semantic validator để không
  còn assumption dừng ở lớp 9.
- Cập nhật schema description, prompt/schema version: Summary dự kiến `v58/v43`,
  Lesson Content dự kiến `v5/v5`; tại thời điểm code phải lấy số kế tiếp nếu version
  đã thay đổi.
- Đồng bộ câu GT–KL lớp 7–12 trong Quiz/Test system prompt và mọi EXAMPLE adapter.

### 4.2. API/service/worker

- DTO preview/generate tiếp tục dùng `systemInstructions`, `userPrompt`; giá trị
  khác rỗng là toàn bộ prompt hiệu lực tương ứng. Có thể thêm
  `requestFingerprint` mà không đổi hai field này.
- Validate giới hạn độ dài nhưng không từ chối marker/heading và không sửa hoặc
  nối nội dung admin.
- Preview response giữ effective prompt editable, request đầy đủ read-only và có
  thể thêm fingerprint + trạng thái version.
- Generate rebuild request authoritative, so fingerprint và chỉ enqueue khi khớp.
- Worker nhận normalized learner profile/job snapshot; source hash gồm profile.
- Không đổi endpoint chính, database schema, one-provider-attempt, budget guard,
  recovery hoặc review/publish flow.
- Khi triển khai phải restart API worker/dev process để prompt mới có hiệu lực.

### 4.3. Admin UI

- System prompt và User prompt tiếp tục editable; OpenAI request có context là
  preview read-only. Copy giải thích rõ custom prompt sẽ thay thế toàn bộ default.
- Theo dõi riêng việc admin chủ động sửa từng prompt. Khi refresh/generate, prompt
  đã sửa được giữ nguyên; prompt chưa sửa được dựng lại theo field hiện tại.
- Có thể hiển thị badge/cảnh báo “Dữ liệu xem trước đã cũ”, nhưng nút cập nhật
  preview không được trở thành điều kiện khiến thay đổi form bị bỏ qua khi tạo.
- Thay đổi style preset, custom style, length, word count, documents, extra
  instructions, prompt, model, temperature, reasoning hoặc max tokens đều làm
  preview stale.
- Khi target audience/lesson source đổi từ server, preview cũ cũng phải bị từ chối
  bởi fingerprint dù frontend chưa biết thay đổi.
- Giữ responsive và light/dark cho loading, stale, error và disabled state.

### 4.4. Docs

- Đồng bộ `docs/06-ai-rag-spec.md` và API contract prompt-preview/generate.
- Ghi rõ phạm vi grade 3–12, group `HIGH_SCHOOL`, quy tắc GT–KL 7–12 và word-count
  scope.
- Cập nhật M9 roadmap/dependency/coverage/execution context. Không ghi changelog
  cho đến workflow `/commit`.

## 5. Thứ tự triển khai

1. Tách schema compaction thành corrective pass đầu tiên; đóng băng transport
   contract hiện tại và lưu inline schema hash/size làm baseline.
2. Viết equivalence test expand `$ref` rồi so deep-equal inline schema; thêm budget
   test cho schema compact và test preview/worker dùng cùng schema hash.
3. Thêm strategy opt-in chỉ cho Summary, feature flag mặc định off và rollback
   về helper inline hiện hành; không sửa prompt/recovery/mapper/compiler.
4. Chạy toàn bộ fixture schema/recovery/diagram hiện có với cached provider output;
   chỉ sau khi pass mới đề nghị một live canary có phê duyệt chi phí.
5. Sau khi compact pass ổn định mới tiếp tục các hạng mục M9.16 khác. Viết unit
   characterization test cho behavior hiện tại và test đỏ cho các lỗi:
   duplicate contract, stale prompt, grade 10–12, HIGH_SCHOOL group.
6. Tạo learner-profile và formal-proof helper dùng chung; mở grade schema 3–12.
7. Refactor named system contract, deduplicate và tách INTENT/RAW_SPEC.
8. Rút gọn user prompt, làm rõ word-count scope và chuẩn hóa dấu câu.
9. Giữ DTO System/User hiện tại, thêm authoritative fingerprint mà không đổi
   semantics custom prompt thay thế nguyên văn.
10. Nối preview service và worker vào cùng composer; bảo đảm preview không gọi
   provider và custom prompt không bị bọc lại.
11. Giữ System/User editor, theo dõi prompt nào admin đã sửa và bổ sung stale guard.
12. Đồng bộ Quiz/Test EXAMPLE core và grade 7–12.
13. Chạy regression local, render UI, restart worker rồi kiểm tra preview → enqueue
   bằng provider mock/cache.
14. Chỉ thực hiện live provider smoke nếu owner xác nhận riêng sau khi xem ước
    tính chi phí; live run không thuộc điều kiện bắt buộc của corrective local.

## 6. Ma trận test bắt buộc

### Backend unit/contract

- System prompt mặc định có đúng một canonical contract heading.
- System/User custom khác rỗng phải bằng chính xác nội dung admin gửi và không có
  base heading/contract được chèn thêm.
- Không còn duplicate canonical cho note, angle notation, solution style và final
  answer; context security warning vẫn tồn tại ở hai boundary có chủ đích.
- Custom prompt có hoặc không có canonical marker đều được giữ nguyên, không bị
  nhận diện rồi biến đổi theo hình dạng nội dung.
- User prompt chỉ có một mục đối tượng/văn phong, một mục độ dài và không có dòng
  “không có yêu cầu bổ sung”.
- Custom text kết thúc bằng `.`, `!`, `?`, `:` không tạo dấu câu kép.
- Word count có/không có giá trị và tổ hợp bất thường đều nêu đúng precedence.
- INTENT rule không chứa yêu cầu model tự dựng coordinate; RAW_SPEC fallback mới
  nhận primitive/anchor/reference rule.

### Grade/GT–KL

- Grade `3, 4, 5, 6, 7, 9, 10, 11, 12`, group `HIGH_SCHOOL` và `UNKNOWN` đều có
  snapshot prompt đúng.
- Formal Geometry proof lớp 7–12 thiếu GT–KL tạo
  `MISSING_GEOMETRY_STATEMENT`; lớp 3–6 không tạo issue này.
- Bài Số học/Đại số có từ “chứng minh” nhưng không phải Hình học không bị nhận
  nhầm; bài Hình học không chứng minh vẫn để `geometryStatement=null`.
- Summary mapper và persisted review reconciliation dùng cùng helper và cho cùng
  kết quả.
- `diagramIntent.grade=10|11|12` parse/compile/validate được; grade ngoài `3..12`
  bị từ chối.

### Preview/generate integration

- Compact schema expand `$ref` phải deep-equal inline schema hiện tại; schema
  compact có `$defs`, có reference và nằm dưới budget ký tự/token đã chốt.
- Feature flag off phải tạo byte-equivalent inline request hiện tại; flag on chỉ
  đổi `text.format.schema`, không đổi instructions/input/model/config.
- Cùng cached raw output phải cho kết quả Zod parse, recovery, mapper, review issue
  và persisted content giống hệt giữa hai strategy.
- Preview và request worker tạo cùng effective system/user/input/schema khi config
  và source không đổi.
- Đổi từng field ảnh hưởng request làm fingerprint đổi.
- Fingerprint stale trả conflict trước create generation/job/provider call.
- Context/source hash đổi cũng làm preview stale.
- Job đã queue vẫn parse được; request mới giữ đúng snapshot System/User đã chọn.

### Web/E2E

- System/User prompt editable và được gửi đúng nguyên nội dung đã nhập.
- Thay đổi form rồi bấm generate không cần bấm preview trước vẫn dùng dữ liệu mới.
- Error refresh không làm mất prompt admin đã nhập.
- Desktop, iPad, Chromium mobile, WebKit mobile; light/dark; loading/error/disabled
  đều pass.

### Regression M9.3

- Quiz/Test vẫn dùng một EXAMPLE authoring core, không drift solution/diagram/GT–KL.
- Grade 10–12 được truyền qua content generation context và job snapshot.

## 7. Lệnh kiểm tra dự kiến

```bash
pnpm --filter @learning-path/api test -- m9.2-lesson-summary-schema.test.ts
pnpm --filter @learning-path/api test -- m9.2-lesson-summary-context.test.ts
pnpm --filter @learning-path/api test -- m9.2-lesson-summary.int.test.ts
pnpm --filter @learning-path/api test -- m9.2-diagram-compiler.test.ts
pnpm --filter @learning-path/api test -- m9.3-content-generation-schema.test.ts
pnpm --filter @learning-path/api test -- m9.3-content-generation.int.test.ts
pnpm --filter @learning-path/api typecheck
pnpm --filter @learning-path/web typecheck
pnpm --filter @learning-path/web exec playwright test tests/admin-ai-generation-m9-8.spec.ts
pnpm exec eslint <scoped-files>
git diff --check
```

Nếu root scripts khác thực tế, dùng script tương đương trong `package.json`; không
gọi OpenAI/Gemini/Mathpix trong test mặc định.

## 8. Tiêu chí Done

- [ ] Schema compaction được triển khai độc lập, có feature flag rollback; không
      đổi transport/acceptance/persisted output contract.
- [ ] Compact schema sau expand deep-equal inline schema; cached regression cho
      cùng parse/recovery/mapper/compiler result và preview/worker cùng schema hash.
- [ ] Token schema giảm theo budget đã đo mà không dùng live provider làm vòng
      debug; live canary chỉ chạy khi owner duyệt riêng.
- [ ] Prompt mặc định có đúng một hard contract; prompt custom khác rỗng được dùng
      nguyên vẹn và không bị bọc thêm.
- [ ] Không còn stale resolved prompt sau khi thay đổi cấu hình/source/model.
- [ ] Admin sửa trực tiếp System/User; frontend giữ đúng prompt đã sửa và chỉ
      rebuild prompt chưa sửa.
- [ ] System prompt không còn các nhóm lặp đã liệt kê và không còn tham chiếu mơ
      hồ theo lịch sử/số rule.
- [ ] INTENT và RAW_SPEC có ranh giới rõ; điều kiện diagram bắt buộc không mâu thuẫn.
- [ ] User prompt tối giản, grade/style và length/word count mỗi nhóm đúng một mục.
- [ ] Learner profile xử lý đúng lớp 3–12 và group THPT; source hash phản ánh đúng
      audience profile.
- [ ] Formal Geometry proof lớp 7–12 dùng GT–KL nhất quán ở prompt, schema,
      mapper, reviewer, Summary và Quiz/Test.
- [ ] Prompt/schema version được bump; preview/generate/worker dùng cùng version.
- [ ] Không có database migration, không đổi paid-call retry/budget policy và
      không gọi provider trả phí trong verification mặc định.
- [ ] API/Web focused tests, typecheck, scoped lint, responsive light/dark E2E và
      `git diff --check` pass; worker đã được restart trước smoke local.

## 9. Rủi ro và rollout

- Custom prompt có thể bỏ contract bắt buộc và làm chất lượng output giảm; UI cần
  giải thích rõ đây là thao tác thay thế toàn bộ, còn backend không được tự sửa.
- Prompt ngắn hơn có thể thay đổi style output dù contract không đổi; cần snapshot
  local và review một số artifact cache trước khi cân nhắc live smoke.
- Mở grade 10–12 cho schema không đồng nghĩa đã đạt 90% coverage mọi dạng hình
  THPT. M9.16 bảo đảm pipeline/prompt/validator không loại THPT và có representative
  regression; inventory coverage toàn bộ SGK THPT phải được đo riêng trước khi
  tuyên bố coverage định lượng.
- Fingerprint phải dựa trên dữ liệu canonical, không hash JSON có thứ tự key không
  ổn định và không log prompt/context thô.
- Không xóa defense-in-depth ở boundary context khi deduplicate nội dung sư phạm.

## 10. Ngoài phạm vi

- Không thay retrieval/OCR, database summary content, renderer/student UI hoặc
  review workflow ngoài phần GT–KL grade 10–12.
- Không thêm môn học, loại block, provider hay model mới.
- Không chạy full paid matrix hoặc tự retry provider.
- Không cam kết toàn bộ taxonomy diagram THPT đạt coverage 90% trong chính task
  này nếu chưa có inventory/reference source tương ứng.
