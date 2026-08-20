# M9.2 — Xóa `visualIntent` bằng hard cutover

Trạng thái: `IMPLEMENTED_LOCAL_PENDING_DEPLOY` ngày 2026-08-19

Code, migration, docs và regression local đã được triển khai. Chưa chạy migration
trên production, chưa deploy đồng thời API/web/worker và chưa chạy paid live gate.

Mode: `Worker/Integration + API + DB migration + regression UI`

Quyết định owner: xóa hoàn toàn `visualIntent`. OpenAI dựng hình từ ảnh nguồn
cùng `problem` hoặc nội dung kiến thức của block. Hệ thống không giữ reader cũ,
không chạy dual contract, không fallback sang field cũ và không tạo field khác
có cùng chức năng dưới tên mới.

## 1. Kết quả đích

- Phase 1 chỉ quyết định block có cần figure, provenance của figure, vị trí nguồn
  và metadata hiển thị; Phase 1 không viết hướng dẫn dựng hình.
- Stage 2 có ảnh nguồn thì ảnh là baseline thị giác. Nội dung block chỉ giúp xác
  nhận đúng bài và đúng đối tượng; nó không được đổi hình quan sát được.
- Stage 2 không có ảnh nguồn thì tự thiết kế một hình từ nội dung block đã được
  rút gọn theo quy tắc cố định của backend.
- `adminInstructions`, khi có, là delta duy nhất được phép đổi baseline ảnh.
- Không gửi `solution`, `answer`, kết luận GT–KL, caption hoặc alt text vào prompt
  dựng hình để chúng không biến thành một brief ngầm hoặc bị chép lên canvas.
- Production chỉ chấp nhận `figurePlanContractVersion=3`.
- Mọi dữ liệu vận hành trước v3 phải được chuyển một lần hoặc vô hiệu hóa trước
  khi code v3 được bật. Runtime không có đường đọc v1/v2.

## 2. Contract Phase 1 v3

Figure provider output chỉ còn:

```json
{
  "figureOrigin": "TEXTBOOK_SOURCE",
  "sourceReferences": [
    {
      "packetPageNumber": 2,
      "printedPageLabel": "19",
      "figureLabel": "Hình 5.26",
      "sourceTarget": {
        "scope": "WHOLE_FIGURE",
        "locator": null
      }
    }
  ],
  "caption": "Vectơ chỉ phương của đường thẳng."
}
```

Figure do AI tự đề xuất:

```json
{
  "figureOrigin": "GENERATED_FROM_BRIEF",
  "sourceReferences": [],
  "caption": null
}
```

Invariant:

1. Schema là strict object; `visualIntent` và mọi key lạ bị reject.
2. `TEXTBOOK_SOURCE` bắt buộc có ít nhất một source reference hợp lệ.
3. `GENERATED_FROM_BRIEF` bắt buộc `sourceReferences=[]`.
4. Mỗi block có tối đa một logical figure. Nhiều crop/panel của cùng hình là
   nhiều ảnh tham chiếu cho một figure, không phải nhiều figure độc lập.
5. `sourceTarget` chỉ định phần nào của ảnh nguồn được dùng, không mô tả phải vẽ
   gì. Không đưa source target vào mode không có ảnh.
6. `caption` phục vụ display và chỉ do Phase 1 trả. `altText` không thuộc schema
   của Phase 1 hay Phase 2; backend tự tạo metadata accessibility từ caption hoặc
   ngữ cảnh block, và editor không hiển thị field nhập tay.
7. Backend cấp `localId` và stamp `figurePlanContractVersion=3`; model không tự
   trả version hoặc ID.

## 3. Projection nội dung gửi Stage 2

Backend dùng một serializer duy nhất cho preview, enqueue và worker. Serializer
không truyền nguyên block vì nguyên block có lời giải, đáp án và provenance thừa.

| Loại block                                      | Dữ liệu gửi                                                                          | Dữ liệu không gửi                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `knowledge`, `theorem`, `property`, `procedure` | `type`, `title`, `content`                                                           | figures, source pages/evidence, caption, alt text                                    |
| `note`                                          | `type`, `content`                                                                    | figures, source pages/evidence, caption, alt text                                    |
| `example`                                       | `type`, `problem`, `isGeometry`; với lớp 7–9 chỉ thêm `geometryStatement.hypotheses` | `solution`, `answer`, `geometryStatement.conclusions`, origin, source pages, figures |
| Example ghép theory                             | projection theory gồm `type`, `title`, `content`                                     | figure/provenance của theory                                                         |

Quy tắc diễn giải:

- `problem`/`content` là ngữ cảnh chuyên môn, không phải danh sách bắt buộc chép
  lên canvas.
- Với bài chứng minh, chỉ giả thiết là dữ kiện hình. Kết luận cần chứng minh không
  được biến thành marker/dữ kiện sẵn có, trừ khi ảnh nguồn đã thể hiện nó.
- Không dùng LLM hoặc regex để tạo một mô tả hình trung gian từ block. Việc đó sẽ
  tái tạo `visualIntent` dưới tên khác.
- Không thêm heuristic theo lesson, figure label, số liệu hoặc bài cụ thể.

## 4. Thứ tự thẩm quyền khi dựng hình

### 4.1. Có ảnh nguồn, không có yêu cầu admin

1. Ảnh nguồn quyết định đối tượng, topology, vị trí tương đối, nhãn, marker, nét,
   mũi tên, vùng tô, bố cục và tỉ lệ nhìn thấy.
2. `sourceTarget` chỉ chọn whole figure/subfigure/panel cần đọc.
3. Projection block chỉ kiểm tra ảnh được gắn đúng bài và giải nghĩa ký hiệu mơ
   hồ; không được thêm, bớt hoặc thiết kế lại baseline.
4. System prompt/output contract/TeX safety vẫn là ràng buộc kỹ thuật cao nhất.

### 4.2. Có ảnh nguồn và có `adminInstructions`

1. Ảnh khóa toàn bộ baseline ngoài phạm vi sửa.
2. `adminInstructions` khóa phần delta được gọi tên rõ.
3. Nếu delta xung đột với baseline, chỉ phần được gọi tên thay đổi; phần còn lại
   giữ nguyên ảnh.
4. Projection block chỉ kiểm tra tính đúng chuyên môn, không hoàn tác delta.
5. Blank/whitespace instruction bị loại khỏi JSON và prompt.

### 4.3. Không có ảnh nguồn

1. Projection block là nguồn ngữ nghĩa duy nhất.
2. Subject/grade profile và toolbox là ràng buộc trình bày/kỹ thuật.
3. Model tự chọn phép dựng và bố cục; backend không sinh visual brief thay model.
4. Mỗi block chỉ tạo một figure để tránh nhiều request có đầu vào giống nhau cho
   kết quả trùng hoặc không xác định.

## 5. Ma trận mọi mode

| Luồng                  | Ảnh                     | Nội dung block | Current source | Admin delta        | Kết quả                      |
| ---------------------- | ----------------------- | -------------- | -------------- | ------------------ | ---------------------------- |
| Auto source redraw     | crop/page đã resolve    | Có             | Không          | Không              | Dựng lại sát ảnh             |
| Auto generated         | Không                   | Có             | Không          | Không              | Tự thiết kế từ block         |
| Admin create từ SGK    | Đúng source selection   | Có             | Không          | Có thể có          | Tạo revision mới             |
| Admin create không ảnh | Không                   | Có             | Không          | Có thể có          | Tự thiết kế từ block + delta |
| Admin edit current     | Ảnh baseline đã chọn    | Có             | Có             | Bắt buộc khác rỗng | Sửa đúng delta               |
| Compiler auto-repair   | Không gửi lại ảnh/block | Không          | Source lỗi     | Không              | Chỉ sửa compile diagnostics  |
| Admin code draft       | Không gọi AI            | Không          | Source admin   | Không              | Compile local                |
| Upload raster/SVG      | Không gọi AI            | Không          | File upload    | Không              | Validate/persist asset       |
| Use source crop        | Không gọi AI            | Không          | Crop đã chọn   | Không              | Promote crop thành revision  |

Không có bất kỳ mode nào nhận `visualIntent`.

## 6. Resolve ảnh nguồn và các tình huống biên

### 6.1. Exact crop

- `figureLabel` exact-match: lấy crop khớp và vùng đệm hợp lệ.
- Nếu một logical figure bị OCR tách thành nhiều crop bổ sung, giữ tối đa bốn
  crop khác object key theo thứ tự trang/vị trí ổn định.
- Stage 2 hiểu mỗi ảnh là một panel/fragment của cùng figure, không tự gộp thành
  infographic mới.

### 6.2. Subfigure

- `SUBFIGURE` bắt buộc locator khác rỗng.
- Nếu manifest xác định được panel, chỉ gửi panel đó.
- Nếu chỉ có ảnh whole figure, gửi ảnh whole figure cùng locator để chọn panel.
- Nếu locator không thể phân biệt target, không gọi provider; chuyển
  `NEEDS_REVIEW` với mã lỗi định vị rõ ràng.

### 6.3. Full-page fallback

- Chỉ cho phép khi page và target đủ cụ thể để xác định duy nhất một hình.
- `WHOLE_FIGURE` không label trên trang có nhiều hình là mơ hồ: không gọi paid
  provider, yêu cầu admin chọn crop/target.
- `SUBFIGURE` có locator cụ thể có thể dùng full-page ở detail cao.
- Không dùng block text để rank crop; block không phải locator.

### 6.4. Source lỗi hoặc thiếu

- `TEXTBOOK_SOURCE` resolve ra zero asset: `NEEDS_REVIEW`, không âm thầm chuyển
  thành `GENERATED_FROM_BRIEF`.
- Asset hash/object key thay đổi sau enqueue: job fail closed, không lấy asset
  mới ngoài snapshot.
- Ảnh hỏng/không đọc được: lỗi reference, không retry AI.
- Nhiều reference mâu thuẫn hoặc khác logical figure: reject trước paid call.

### 6.5. Nội dung và ảnh có vẻ mâu thuẫn

- Không có AI Vision validator thứ hai trong MVP.
- Những mâu thuẫn có thể xác định bằng provenance/page/label bị chặn trước call.
- Mâu thuẫn thị giác còn lại được flag cho admin review; prompt vẫn giữ ảnh là
  baseline, không cho block text tự sửa ảnh.

## 7. Luồng sửa và repair

### 7.1. Admin regenerate/edit

- Preview và create thật phải deep-equal sau khi ẩn binary bytes.
- `CURRENT_ONLY` chỉ hợp lệ khi có current AI_TEX và baseline image hợp lệ theo
  contract UI hiện tại.
- Edit bắt buộc `adminInstructions` khác rỗng; recreate không delta được phép bỏ
  field hoàn toàn.
- Không có nút hoặc API sửa một semantic brief vì field đó không còn tồn tại.

### 7.2. Compiler repair

- Repair request chỉ nhận current TeX source, structured compiler diagnostics,
  raw compile log đã giới hạn và toolbox/profile.
- Không gửi ảnh, block, theory, alt/caption hay admin instruction cũ ở auto
  compiler repair; repair không được thiết kế lại hình.
- Validator/policy/storage/network error không gọi AI repair.

### 7.3. Metadata-only

- Sửa caption cập nhật metadata, không compile và không gọi AI; alt text do backend
  quản lý, không có field chỉnh tay.
- Thay metadata không đổi source hash, reference snapshot hoặc delivery asset.

## 8. API và UI

- Xóa `visualIntent` khỏi response Summary reference, figure detail, overview,
  prompt/request preview, raw Phase 1 editor, TypeScript types và Zod schemas.
- Raw Phase 1 editor vẫn cho sửa field còn lại của logical figure nhưng không
  cho thêm/xóa figure qua JSON.
- Request preview hiển thị đúng projection block, source target, mode, image
  metadata an toàn và admin delta; không có trường mô tả hình.
- UI không tự dựng hoặc gửi một field thay thế như `drawingBrief`,
  `semanticIntent`, `visualDescription` hay `figurePrompt`.
- API nhận payload chứa `visualIntent` phải trả lỗi validation unknown key; không
  bỏ qua âm thầm.
- Student payload chỉ nhận asset/alt/caption như hiện tại, không lộ prompt data.

## 9. Hard cutover dữ liệu

Đây là migration một chiều trước deploy, không phải reader tương thích.

### 9.1. Freeze

1. Bật maintenance gate cho Summary/figure generation.
2. Dừng enqueue mới.
3. Dừng worker sau khi cancel các job figure đang `QUEUED`, `RENDERING` hoặc
   `REPAIRING`; không cho payload v2 chạy tiếp dưới code v3.
4. Ghi danh sách figure cần regenerate sau cutover.

### 9.2. Chuyển dữ liệu

- `stem_figures.plan_json`: xóa key `visualIntent`, xác thực lại origin/reference,
  stamp version 3.
- `lesson_summaries.content_json`: xóa mọi copy `visualIntent` trong
  `TEX_FIGURE` reference.
- `ai_generations.output_json`: xóa key khỏi raw Phase 1 snapshot để raw editor
  không phát lại schema cũ; cập nhật hash/schema version tương ứng.
- `background_jobs.input_meta_json/result_json`: cancel payload đang chạy và xóa
  key khỏi record còn được UI đọc.
- `stem_figure_revisions.provider_request_snapshots_json`: purge snapshot v2 có
  field cũ thay vì giữ một request giả đã sửa; đặt hash/brief metadata liên quan
  về null hoặc trạng thái invalidated theo migration implementation.
- Cache/request draft/provider preview có schema/prompt version cũ bị invalidate,
  không rehydrate.
- Tracked fixtures/snapshots cũ bị xóa hoặc tạo lại theo v3; local paid artifacts
  không được dùng làm contract test.

Migration phải chạy trong transaction/batch an toàn tùy kích thước dữ liệu và có
preflight count. Nếu một row không chuyển được sang v3, deployment dừng; không
để runtime đoán cách đọc row đó.

### 9.3. Bật v3

1. Deploy API, web và worker trong cùng release window.
2. Chỉ register schema v3; bỏ union/literal 1/2 và mọi helper đọc fallback.
3. Restart worker bắt buộc.
4. Chạy postcondition query: không còn key `visualIntent` trong dữ liệu vận hành,
   không còn active job v1/v2 và mọi plan active có version 3.
5. Mở generation gate và regenerate danh sách đã cancel nếu admin yêu cầu.

### 9.4. Failure và rollback vận hành

- Chụp backup DB và ghi count/hash preflight trước migration; rehearsal trên bản
  sao staging dùng đúng script production.
- Lỗi trước migration: abort release, không thay đổi runtime.
- Lỗi trong migration hoặc trước khi mở gate: giữ maintenance, restore toàn bộ DB
  backup và deployment cũ như một lần khôi phục nguyên trạng; không chạy xen kẽ
  code cũ với dữ liệu v3.
- Sau khi v3 đã mở traffic: chỉ fix-forward trên v3. Không deploy lại reader v2
  để cứu một row/job cũ.
- Delivery asset đã thành công có thể giữ nguyên nếu row liên quan chuyển được;
  figure không chuyển được phải bị invalidated và regenerate, không suy contract.

## 10. Workstream implementation

### W1 — Phase 1 schema/prompt/mapper

- Xóa field khỏi provider schemas, structured output JSON Schema và prompt.
- Giới hạn `figures[]` tối đa một phần tử mỗi block.
- Mapper stamp plan v3 và không copy field vào content/raw projections.
- Xóa validator/source-neutral helper chỉ tồn tại để kiểm `visualIntent`.

### W2 — Plan/brief/provider composer

- Plan schema chỉ nhận literal 3.
- Generation brief bỏ field và dùng block projection có type rõ ràng.
- Tạo một serializer chung cho preview/create/worker.
- Bump Stage 1/Stage 2 prompt version, schema version, request hash namespace.

### W3 — Resolver/lifecycle/repair

- Resolver chỉ dùng structured source reference/target.
- Áp ambiguity gate trước paid call.
- Compiler repair tách khỏi generation context.
- Các create/regenerate/edit/ensure paths đều dùng cùng contract v3.

### W4 — API/web

- Xóa field khỏi DTO/serializer/types/schema/viewer.
- Request preview chỉ hiện dữ liệu thực sự gửi provider.
- Loại mọi copy/update/sync helper của field ở raw Phase 1 và Summary reference.

### W5 — Migration và rollout

- Viết preflight/migration/postcondition theo mục 9.
- Cancel/invalidate job và snapshot v2.
- Restart worker và kiểm tra không có process cũ.

### W6 — Docs/tests

- Supersede ADR-0017 bằng quyết định hard cutover.
- Đồng bộ AI spec, API, database, user flow, performance, M9 và coverage matrix.
- Không cập nhật changelog trước workflow commit.

## 11. Regression matrix bắt buộc

### Schema và persistence

1. Phase 1 không có field cũ thì pass.
2. Phase 1 có `visualIntent` thì strict reject.
3. Plan version 3 pass; version 1, 2 hoặc thiếu version đều reject.
4. Origin/reference invariant pass/reject đúng.
5. Hai figures trong một block bị reject.
6. Mapper/persist/API response không chứa field cũ.

### Provider request

7. Theory source: đúng ảnh + `type/title/content`, không alt/caption.
8. Example source: đúng ảnh + `problem`; không solution/answer/conclusion.
9. Geometry 7–9: gửi hypotheses, không conclusions.
10. Generated theory/example/note: không image, đúng projection.
11. Provider request không có `pairedTheory`; mỗi figure chỉ nhận projection
    của đúng block sở hữu.
12. Blank admin instruction biến mất hoàn toàn.
13. Admin delta xuất hiện đúng một lần và có precedence đúng.
14. Preview deep-equal composer của worker ngoài binary redaction.

### Source resolution

15. Một exact crop.
16. Whole figure nhiều complementary crop theo thứ tự ổn định.
17. Subfigure resolve được panel.
18. Subfigure dùng whole image + locator.
19. Full-page target duy nhất được phép.
20. Full-page mơ hồ bị chặn trước provider.
21. Missing/corrupt/hash-changed reference fail closed.
22. `TEXTBOOK_SOURCE` không tự rơi sang no-source.

### Lifecycle/UI

23. Auto generation, ensure, regenerate, current edit cùng dùng v3.
24. Compiler repair payload không có block/image/metadata thừa.
25. Metadata-only không enqueue/compile.
26. Upload, code draft và use-source-crop không gọi AI.
27. Raw JSON edit/save không phục hồi field cũ.
28. API payload cũ trả validation error.
29. Student rendering không đổi.
30. Publish vẫn chặn figure chưa có successful current revision.

### Cutover

31. Preflight đếm đủ row/job/snapshot bị ảnh hưởng.
32. Migration loại key và stamp v3 đúng.
33. Row không hợp lệ làm migration/deploy fail.
34. Job v2 bị cancel, không được worker v3 xử lý.
35. Postcondition DB không còn key trong dữ liệu vận hành.
36. Source scan không còn field trong production code/shared schemas/tests, ngoại
    trừ migration/ADR/plan ghi lại quyết định xóa.

### Phạm vi môn/lớp

Chạy fixtures đại diện Toán, Vật lý, Hóa học, General; lớp 3–6, 7–9 và 10–12;
theory, note, illustration, standard exercise và real-world exercise. Không dùng
tên bài/figure cụ thể làm production rule.

## 12. Verification và paid gate

Local gate bắt buộc:

- migration dry-run/preflight/postcondition test;
- API focused contract/lifecycle/processor tests;
- shared/API/web typecheck;
- focused lint;
- web component/unit/E2E cho preview và figure actions;
- `git diff --check`;
- scan field cũ theo phạm vi source.

Không gọi OpenAI/Mathpix trong bước plan hoặc local gate. Sau khi toàn bộ local
gate pass, live test chỉ chạy khi owner duyệt rõ số call và chi phí ước tính.
Live matrix tối thiểu đề xuất: một exact source, một multi-panel/subfigure, một
generated no-source và một admin delta.

## 13. Done khi

- Không còn `visualIntent` trong bất kỳ runtime contract/provider request/UI
  payload nào.
- Runtime chỉ chấp nhận plan v3 và không có legacy reader/fallback.
- Có ảnh: provider bám ảnh + target, block chỉ làm ngữ cảnh kiểm chứng.
- Không ảnh: provider dựng trực tiếp từ projection block.
- Example không gửi solution/answer/conclusion lên Stage 2.
- Preview/create/worker dùng cùng serializer.
- Dữ liệu/job cũ đã chuyển hoặc vô hiệu hóa trước khi v3 chạy.
- Toàn bộ local regression pass; paid test chỉ chạy sau phê duyệt chi phí.
