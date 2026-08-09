# Kế hoạch M9.2 — ClassHero lesson-summary authoring contract v3

Trạng thái: `Đã triển khai và kiểm thử trên codex/m9-2-classhero-authoring-v3; chờ owner nghiệm thu thủ công trên FE`

Task sở hữu: `M9.2` — Admin generate lesson summary

Mode triển khai: `Worker/Integration`, có phần nối `Admin UI` và `Student UI` để review/render contract mới

Baseline rollback: commit `776a69c1` trên contract
`lesson-summary-prompt-v22` / `lesson-summary-schema-v19` / persisted
`lesson_summary_blocks.version=1`

Contract hiện tại: `lesson-summary-prompt-v33` (lấy prompt master làm baseline) /
`lesson-summary-schema-v25` / persisted `lesson_summary_blocks.version=2`

Quyết định đơn giản hóa của owner ngày 2026-08-09 thay thế các cơ chế audit
trước đó: generation mới không trả `sourceAssessment`, `origin`, candidate ID,
heading decision/reason, `alignment`, `verification`, `visual.kind=NONE`,
`warnings` hoặc `warningDetails`. Các field cũ chỉ còn được parser chấp nhận để
đọc dữ liệu đã sinh trước khi đổi contract.

## 1. Mục tiêu sản phẩm đã chốt

Chuyển phần sinh kiến thức từ cách “chọn và chép bài trong OCR” sang cách biên soạn có căn cứ nguồn của ClassHero:

- Tài liệu nguồn quyết định **phạm vi kiến thức**, **các đề mục lớn**, khái niệm, tính chất, định lí và phương pháp phải dạy.
- ClassHero quyết định **cách dạy**: chia block vừa đọc, cách diễn đạt phù hợp học sinh, ví dụ minh họa, bài tập và sơ đồ sạch.
- Không được sáng tác thêm đề mục lớn hoặc kiến thức ngoài nguồn.
- Ví dụ luôn đứng ngay sau block lý thuyết mà nó minh họa.
- Không dùng ảnh OCR mờ của sách làm nội dung học sinh.
- Bài tập/ví dụ có thể tham khảo nguồn hoặc do AI biên soạn, nhưng output không
  cần khai báo nguồn gốc và phải nằm trong phạm vi kiến thức của bài.
- Section cuối luôn là `Bài tập vận dụng`, gồm đúng hai bài theo thứ tự: một bài thông thường và một bài toán thực tế đời sống.
- Output đúng JSON/schema được lưu thành bản nháp `NEEDS_REVIEW`; admin sửa trực
  tiếp nội dung, không hiển thị panel mã cảnh báo kỹ thuật.

## 2. Những quyết định không được diễn giải lại

### 2.1. Đề mục lớn

- `displayHeading` phải là chính đề mục lớn trong tài liệu nguồn sau khi AI chủ
  động sửa sạch lỗi OCR/chính tả, sai dấu, mất chữ, dính/tách từ hoặc ký tự rác.
- Giữ nguyên số thứ tự, ý nghĩa và phạm vi đề mục; không viết lại cho hay hơn và
  không tự tạo đề mục mới.
- Output chỉ trả `sourceTopicId` và `displayHeading` đã sửa. Không trả heading
  decision, repair reason hoặc source assessment.
- Mapper dùng trực tiếp heading đã sửa của AI, không ép quay về chuỗi OCR lỗi.

### 2.2. Cặp lý thuyết — ví dụ

- Giữ `theorySections[].units[]`.
- Mỗi unit có đúng một block `theory`, tiếp ngay sau là đúng một block `illustration`, rồi mới đến `notes` nếu có.
- Bỏ `illustrationPlacement`; không còn `BEFORE_THEORY`.
- `illustration` chỉ được dùng kiến thức đã xuất hiện trong chính block theory ngay trước nó và các kiến thức nền cấp lớp thấp hơn thực sự cần thiết.
- Không được gom nhiều theory liên tiếp rồi mới gom nhiều example liên tiếp.
- `knowledge`, `property`, `theorem`, `procedure` không chứa đề bài, ví dụ hoặc lời giải trong content.
- `note.content` vẫn là ngoại lệ: được và phải có ví dụ ngắn ngay trong note theo ý đồ hiện tại.
- Không áp giới hạn máy móc “1–3 ý/block”. Ranh giới tách block là một tiểu chủ đề hoặc mục tiêu học tập mạch lạc; khi đổi mục tiêu thì tách unit.

### 2.3. Section cuối

- Chỉ có đúng một section bài tập và section đó luôn ở cuối.
- `displayHeading` là literal `Bài tập vận dụng`.
- Có đúng hai example block:
  1. `STANDARD_EXERCISE` — bài toán thông thường;
  2. `REAL_WORLD_EXERCISE` — bài toán có ngữ cảnh đời sống.
- Không sinh thêm `Bài tập`, `Luyện tập`, `Vận dụng`, `Bài tập củng cố` hoặc section tương đương.
- Hai bài cuối phải kiểm tra trực tiếp kiến thức của lesson, có đề tự đủ dữ kiện, lời giải theo bước và đáp án cụ thể.

### 2.4. Ảnh và sơ đồ

- Không đưa Markdown image/URL ảnh OCR nguồn vào output học sinh.
- Không gọi model sinh ảnh raster cho flow này.
- Model trả `diagramSpec` có cấu trúc; ứng dụng validate và render deterministic.
- Với bài Hình học, mọi theory block và mọi example/exercise bắt buộc có đúng một
  `diagramSpec`; không cho phép null.
- Với bài không thuộc Hình học, nội dung yêu cầu vẽ, đọc hoặc suy luận từ đồ thị,
  trục số, mặt phẳng tọa độ, bảng, biểu đồ hoặc sơ đồ cũng bắt buộc có spec.
- Tia/đường/đoạn/hình kín dùng đúng `RAY`/`LINE`/`SEGMENT`/`POLYGON`; đồ thị cong
  dùng `POLYLINE` qua đủ điểm đúng tỉ lệ.
- Bài phụ thuộc hình nguồn được xử lý bằng một trong hai cách:
  - viết lại thành bài tự đủ dữ kiện, không cần hình; hoặc
  - tạo bài/sơ đồ mới tương đương về kỹ năng bằng `diagramSpec`.
- Hình mới không cần giống bố cục hình sách, nhưng không được làm đổi kiến thức hoặc độ khó mục tiêu.

## 3. Luồng kỹ thuật mục tiêu

```text
Lesson-scoped OCR chunks
  -> Source blueprint + T/C hints
  -> Một OpenAI structured-output call
  -> Zod/JSON Schema technical validation
  -> Mapper giữ heading đã sửa + diagramSpec safety
  -> lesson_summary_blocks v2 / NEEDS_REVIEW
  -> Admin xem nội dung/sơ đồ và chỉnh sửa trực tiếp
  -> Admin phát hành
  -> Student renderer hiển thị nội dung sạch, không hiện metadata nội bộ
```

Không thêm semantic repair call hoặc judge call bắt buộc. Model tự kiểm tra nội
dung trước khi trả nhưng không xuất field báo cáo tự kiểm tra.

## 4. Source blueprint và vai trò của T/C

### 4.1. Backend extraction

Backend tiếp tục trích:

- `Txx`: gợi ý đề mục lớn/source topic;
- `Cxxx`: gợi ý ví dụ, bài tập hoặc hoạt động trong OCR;
- quan hệ gần nhất giữa C và T;
- dấu hiệu bài thực tế, nhiều ý, thiếu dữ kiện hoặc phụ thuộc hình.

Đây là heuristic hint, không phải dữ kiện tuyệt đối.

### 4.2. Dữ liệu hint nên đổi tên rõ nghĩa

Mỗi topic/candidate gửi model nên thể hiện độ không chắc chắn:

```json
{
  "id": "C003",
  "relatedTopicIdHint": "T01",
  "kindHint": "ILLUSTRATION",
  "completenessHint": "REQUIRES_FIGURE",
  "sourceChunkId": "uuid",
  "problem": "..."
}
```

Không dùng tên field khiến model hiểu backend đã phân loại chắc chắn.

### 4.3. Model dùng hint nội bộ

Model đối chiếu T/C với nội dung OCR để hiểu context nhưng không trả trạng thái
audit, source assessment hoặc candidate ID. T/C không xuất hiện trong summary.

### 4.4. Heading blueprint

Source topic cần có tối thiểu:

```json
{
  "id": "T01",
  "sourceChunkId": "uuid",
  "sourceHeadingRaw": "1 CỘNG, TRỪ HAI SỐ HỮU TỈ",
  "headingQualityHint": "CLEAN"
}
```

`headingQualityHint` chỉ hỗ trợ model; quyết định cuối vẫn phải có bằng chứng trong raw chunk.

## 5. Provider contract v3 hiện tại

Giữ cấu trúc cấp cao `theorySections` và tối giản example:

```json
{
  "title": "Bài 2. Cộng, trừ, nhân, chia số hữu tỉ",
  "objectives": ["..."],
  "theorySections": [
    {
      "sourceTopicId": "T01",
      "displayHeading": "1 CỘNG, TRỪ HAI SỐ HỮU TỈ",
      "sourceChunkIds": ["uuid"],
      "units": [
        {
          "theory": {
            "type": "knowledge",
            "title": "Cộng hai số hữu tỉ",
            "content": "...",
            "sourceChunkIds": ["uuid"]
          },
          "illustration": {
            "type": "example",
            "exampleKind": "ILLUSTRATION",
            "problem": "...",
            "solution": "...",
            "answer": "...",
            "diagramSpec": null
          },
          "notes": []
        }
      ]
    }
  ],
  "applicationExercises": {
    "displayHeading": "Bài tập vận dụng",
    "standardExercise": { "...": "cùng contract example" },
    "realWorldExercise": { "...": "cùng contract example" }
  }
}
```

### 5.1. Example tối giản

- Mỗi example chỉ trả `type`, `exampleKind`, `problem`, `solution`, `answer` và
  `diagramSpec` nullable.
- Khi `diagramSpec=null`, mapper không persist field visual.
- Không trả origin, candidate/source chunk ID, source assessment, alignment hoặc
  verification cho example.
- Đề phải tự đủ dữ kiện, không chứa `xem hình bên`, `quan sát hình dưới` hoặc phụ
  thuộc ảnh OCR nguồn.
- Bài tính thuần túy trình bày trực tiếp từng ý và chuỗi biến đổi, không chèn các
  heading thao tác như `Nhóm các số hạng thuận tiện`.

### 5.2. Contract heading

- Provider chọn đúng `sourceTopicId` và trả `displayHeading` đã sửa chính tả/OCR.
- Mapper giữ `sourceHeadingRaw` nội bộ để tương thích nhưng luôn hiển thị
  `displayHeading` do model đã sửa.
- Không trả hoặc hiển thị audit metadata của quá trình sửa heading.

### 5.3. Contract theory

- Chỉ nhận `knowledge | property | theorem | procedure` trong `theory`.
- Content bám source chunks, không có `Ví dụ`, `Luyện tập`, đề bài hay lời giải.
- Cho phép Markdown xuống dòng/bullet và LaTeX hiện có.
- Không ép số câu/số bullet; semantic linter chỉ cảnh báo paragraph quá dài hoặc unit chứa nhiều mục tiêu khác nhau.

## 6. `diagramSpec` v1

### 6.1. Mục tiêu

Tạo sơ đồ Toán học sạch, chỉnh được, hiển thị ổn ở admin/student, không phụ thuộc ảnh OCR và không cho model chèn mã thực thi.

### 6.2. Shape đề xuất

`visual` là discriminated union:

```json
{ "kind": "NONE" }
```

hoặc:

```json
{
  "kind": "DIAGRAM_SPEC",
  "spec": {
    "version": 1,
    "coordinateSystem": "CARTESIAN",
    "viewBox": { "minX": -1, "minY": -1, "width": 12, "height": 9 },
    "toScale": true,
    "points": [
      { "id": "A", "x": 1, "y": 1, "label": "A", "labelPosition": "BOTTOM_LEFT" },
      { "id": "B", "x": 1, "y": 6, "label": "B", "labelPosition": "TOP_LEFT" },
      { "id": "C", "x": 8, "y": 1, "label": "C", "labelPosition": "BOTTOM_RIGHT" }
    ],
    "primitives": [
      { "id": "AB", "type": "SEGMENT", "from": "A", "to": "B", "style": "SOLID" },
      { "id": "AC", "type": "SEGMENT", "from": "A", "to": "C", "style": "SOLID" },
      { "id": "BC", "type": "SEGMENT", "from": "B", "to": "C", "style": "SOLID" },
      { "type": "POLYGON", "pointIds": ["A", "B", "C"], "fill": "NONE" },
      { "type": "ARC", "center": "A", "radius": 0.8, "startAngle": 0, "endAngle": 90 }
    ],
    "markers": [
      { "type": "RIGHT_ANGLE", "vertex": "A", "armPointIds": ["B", "C"] },
      { "type": "EQUAL_LENGTH", "segmentIds": ["AB", "AC"], "markCount": 1 }
    ],
    "labels": [{ "text": "90^\\circ", "anchorPointId": "A", "position": "TOP_RIGHT" }],
    "caption": "Hình minh họa, không nhất thiết vẽ đúng tỉ lệ."
  }
}
```

Danh sách primitive v1 chỉ gồm nhu cầu Toán THCS đã biết:

- `SEGMENT`, `LINE`, `RAY`, `POLYGON`, `CIRCLE`, `ARC`, `AXIS`, `GRID`;
- marker `RIGHT_ANGLE`, `EQUAL_LENGTH`, `PARALLEL`, `ANGLE`;
- point/label hữu hạn.

### 6.3. Safety và giới hạn

- Không nhận raw SVG/HTML/CSS, URL, data URI, event handler hoặc script.
- Label chỉ là plain text/LaTeX đã sanitize bằng renderer hiện có.
- Mọi ID phải unique; reference tới point/segment phải tồn tại.
- Tọa độ/radius/viewBox phải hữu hạn, nằm trong giới hạn cấu hình.
- Giới hạn số point, primitive, marker và label để tránh payload/render quá nặng.
- Màu/style lấy từ enum semantic của app, không nhận chuỗi CSS tùy ý.
- Renderer dùng SVG component do ClassHero kiểm soát; hỗ trợ light/dark, responsive và accessibility caption.
- `toScale` luôn là `true`. Tọa độ phải đúng tỉ lệ dữ kiện và các marker
  hình học phải khớp quan hệ thực; không render sơ đồ ước lệ.
- Các kiểm tra hình học đơn giản có thể xác minh bằng tọa độ; quan hệ khó hoặc mâu thuẫn chỉ tạo warning, không chặn lưu bản nháp.

### 6.4. Nơi persist/render

- Persist `diagramSpec` ngay trong example block của `lesson_summary_blocks.version=2`.
- Không cần thêm cột database cho summary vì `content_json` đã là JSON.
- Dùng một shared Zod schema và một renderer chung cho admin/student để tránh hai cách hiểu khác nhau.
- Không lưu ảnh render trừ khi sau này có yêu cầu export; v1 render trực tiếp từ spec.

## 7. Thay đổi theo layer

### 7.1. Shared/provider types

Các file trọng tâm:

- `apps/api/src/modules/ai/types/lesson-summary.types.ts`
- shared schema/type mới nếu admin và student cùng dùng `diagramSpec`

Thực hiện:

- tăng prompt/schema version;
- giữ `theorySections[].units[]`;
- bỏ `illustrationPlacement`;
- provider section chỉ giữ source topic, heading đã sửa, units và source chunks;
- provider example chỉ giữ problem, solution, answer và diagramSpec nullable;
- thêm persisted schema version 2 nhưng giữ parser/renderer version 1.

### 7.2. Source candidate/blueprint

File trọng tâm:

- `apps/api/src/modules/ai/utils/lesson-summary-source-candidates.ts`

Thực hiện:

- đổi relation thành hint;
- giữ raw heading trước mọi normalize;
- thêm `headingQualityHint`, `visualDependencyHint` và lý do heuristic;
- không chuyển `\\includegraphics` thành ảnh Markdown dùng cho student;
- vẫn gửi raw chunk để model có thể audit heuristic;
- candidate phụ thuộc hình vẫn được gửi làm nguồn tham khảo, không được persist nguyên ảnh.

### 7.3. Prompt/input

File trọng tâm:

- `apps/api/src/modules/ai/utils/lesson-summary-prompt.ts`
- `apps/api/src/modules/ai/utils/ai-prompt.ts`
- provider preview/payload path hiện tại

Thực hiện:

- giữ system prompt gốc về vai trò, tính sư phạm, block nhỏ và cách trình bày;
- bổ sung các luật v3 theo thứ tự ưu tiên rõ ràng;
- ghi rõ source facts và source major headings là hard ground;
- ghi rõ exercise/example không cần khai báo nguồn gốc;
- yêu cầu ví dụ luôn sau theory;
- yêu cầu tự sửa lỗi OCR/chính tả heading trước khi trả JSON;
- không gửi lời nhắc mâu thuẫn kiểu “mọi đề phải lấy nguyên văn nguồn”;
- preview FE phải phản ánh đúng system instructions, user prompt, input, metadata và JSON Schema thật.

### 7.4. Mapper

File trọng tâm:

- `apps/api/src/modules/ai/utils/lesson-summary-mapper.ts`
- `apps/api/src/workers/services/lesson-summary-generation.service.ts`

Thực hiện:

- mapper luôn flatten `[theory, illustration, ...notes]`;
- giữ problem model sinh và loại câu tham chiếu ảnh nguồn dạng `(xem hình bên)`;
- loại toàn bộ ảnh Markdown nguồn khỏi persisted problem;
- validate/sanitize `diagramSpec` trước persist;
- không persist warnings/warningDetails cho generation mới;
- chỉ provider JSON/schema/Zod, hạ tầng hoặc payload không thể persist mới fail job;
- persist `lesson_summary_blocks.version=2`, `NEEDS_REVIEW`.

### 7.5. Admin UI

File trọng tâm:

- Summary editor/renderer hiện có trong `apps/web/features/admin/ai-generation/`
- schema FE của admin generation

Thực hiện:

- đọc được cả version 1 và version 2;
- không hiển thị warning kỹ thuật, provenance hoặc heading audit;
- preview `diagramSpec` và cho admin sửa JSON/block theo cơ chế editor hiện có;
- lỗi diagram spec hiển thị trạng thái không thể render, không làm hỏng toàn summary.

### 7.6. Student UI

File trọng tâm:

- `apps/web/features/student/lessons/.../summary-block-renderer`
- shared diagram renderer

Thực hiện:

- render version 1 như cũ;
- render version 2 theo đúng thứ tự theory rồi illustration;
- render diagram responsive, light/dark, caption và accessible text;
- không hiển thị source ID, provenance, warning nội bộ hoặc heading repair audit;
- không render ảnh OCR nguồn trong example mới.

### 7.7. API/database

- Không đổi endpoint generate, preview, GET/PUT summary.
- Request generation hiện tại giữ nguyên.
- Response `contentJson` bổ sung version 2 và field mới; API docs phải mô tả backward compatibility.
- Không cần Prisma migration nếu toàn bộ field mới nằm trong `lesson_summaries.content_json`.
- Summary v1 cũ không tự migrate và không bị overwrite; chỉ lần generate/save mới tạo v2.

## 8. Thứ tự triển khai

### Giai đoạn 0 — bảo toàn baseline

1. Kiểm tra toàn bộ diff contract v2 hiện tại.
2. Chạy focused test/typecheck đã chốt cho v2.
3. Commit baseline trên `codex/m9-2-summary-contract-v2`.
4. Tạo nhánh mới `codex/m9-2-classhero-authoring-v3` từ commit đó.

Không bắt đầu v3 trước bước này để bảo đảm có thể quay lại v2 nguyên vẹn.

### Giai đoạn 1 — khóa contract bằng test

1. Viết fixture v3 cho Đại số và Hình học.
2. Viết schema tests cho heading đã sửa, example tối giản và diagramSpec.
3. Viết mapper tests cho ordering, loại ảnh/câu tham chiếu hình nguồn.
4. Chưa đổi prompt cho tới khi các test đỏ thể hiện đủ behavior mới.

### Giai đoạn 2 — schema và source blueprint

1. Tạo provider schema v3.
2. Tạo persisted schema v2 và compatibility parser v1/v2.
3. Nâng source topic/candidate thành hint có audit metadata.
4. Thêm shared `diagramSpec` schema.

### Giai đoạn 3 — prompt và mapper

1. Viết lại phần invariant, giữ hàm ý sư phạm tốt của system prompt cũ.
2. Bỏ `BEFORE_THEORY` và candidate bắt buộc cho mọi ví dụ.
3. Bỏ origin/sourceAssessment/candidate metadata khỏi provider output.
4. Triển khai corrected heading, image/reference stripping và mapper.

### Giai đoạn 4 — renderer và editor

1. Tạo shared deterministic diagram renderer.
2. Nối admin preview/editor đơn giản, không panel warning/provenance.
3. Nối student renderer v2.
4. Kiểm tra responsive và dark/light.

### Giai đoạn 5 — local verification

1. API schema/unit/integration tests.
2. Worker persistence/idempotency/backward compatibility.
3. FE component/E2E cho summary v1/v2.
4. TypeScript, lint phù hợp phạm vi, `git diff --check`.
5. Restart worker sau mọi thay đổi worker trước manual FE test.

### Giai đoạn 6 — live evaluation trả phí

Chỉ chạy sau khi local test pass và đã báo trước chi phí ước tính:

- 3 bài Số/Đại số;
- 3 bài Hình học;
- ít nhất một model thế hệ cũ và hai model chất lượng cao thế hệ mới còn được provider hỗ trợ;
- output budget bắt đầu `8.000`, tăng khi `incomplete` thay vì hạ chất lượng;
- cùng một rubric và cùng lesson source scope để so sánh công bằng.

Không gọi image generation provider vì diagram được render từ spec.

### Giai đoạn 7 — manual FE acceptance và rollout

1. Admin tự generate/review cả 6 bài trên FE.
2. Kiểm tra heading với PDF/OCR, nội dung theory, ví dụ, lời giải, xuống dòng và hình.
3. Chỉ chốt model/default prompt sau semantic audit.
4. Giữ v1 renderer ít nhất một chu kỳ release.
5. Merge v3 khi manual review đạt; rollback bằng branch/commit v2, không cần data rollback.

## 9. Ma trận test bắt buộc

### 9.1. Structural/schema

- Có ít nhất một `theorySection`.
- Mỗi unit có đúng theory + illustration; không có placement.
- Mapper luôn tạo theory trước illustration.
- Không có ví dụ trong content của theory block.
- `note.content` có ví dụ ngắn.
- Chỉ có một section cuối `Bài tập vận dụng` và đúng hai bài đúng thứ tự.
- Ba origin khóa đúng field bắt buộc/cấm.
- Mọi source ID thuộc input.
- `diagramSpec` không nhận raw SVG/URL/script/CSS.

### 9.2. Heading

- OCR sạch: output giữ từng ký tự của heading nguồn.
- Heading khác cách viết nhưng cùng nghĩa: bị warning và mapper ưu tiên nguồn, không coi là sửa hợp lệ.
- OCR mất dấu/mất chữ/ký tự rác: cho `OCR_REPAIRED`, phải có reason và raw/resolved.
- Model bịa thêm section lớn: warning; admin nhìn thấy rõ trước publish.
- Heuristic T sai: model được `CORRECTED` nhưng source chunk vẫn phải chứng minh heading.

### 9.3. Grounding và sư phạm

- Mỗi theory claim có source chunk hỗ trợ.
- Không thêm khái niệm/định lí ngoài lesson.
- Mỗi illustration liên quan trực tiếp theory ngay trước.
- Không dùng kiến thức xuất hiện ở section sau để giải ví dụ hiện tại.
- Theory dài phải chia theo mục tiêu và xuống dòng/bullet hợp lý, không ép số ý.
- Solution chia bước, dùng từ phù hợp học sinh lớp 7, answer cụ thể.
- Công thức và dấu toán học đúng.

### 9.4. Example/exercise

- Không persist ảnh nguồn hoặc câu `xem hình bên`.
- Example nằm trong kiến thức nguồn, không bịa đề mục/khái niệm.
- Bài tính thuần túy không chèn heading mô tả thao tác giữa các phép tính.
- Hai bài cuối không trùng illustration và không trùng nhau.
- Bài thực tế có ngữ cảnh, dữ kiện, đơn vị và kết luận hợp lý.

### 9.5. Diagram

- Geometry diagram cơ bản render đúng light/dark và responsive.
- Reference ID thiếu tạo warning/placeholder, không crash trang.
- Tọa độ NaN/vô hạn, primitive quá số lượng hoặc label nguy hiểm bị schema từ chối kỹ thuật trước persist.
- Quan hệ right angle/equal length/parallel tham chiếu đúng entity.
- `toScale=true` là bắt buộc; equal-length/right-angle/parallel marker phải
  khớp tọa độ trong sai số render cho phép.
- Bài Đại số không bị ép sinh diagram không cần thiết.

### 9.6. Compatibility/operations

- Summary v1 cũ vẫn GET, edit và render được.
- Summary v2 mới persist/read/update được.
- Prompt preview và provider request giống nhau field-by-field.
- Structured output hợp lệ được lưu `SUCCEEDED` + `NEEDS_REVIEW` để admin sửa.
- JSON/schema hỏng vẫn fail rõ ràng.
- Job dedupe, source hash, budget reservation và usage không thay đổi.
- Worker mới đã restart trước live/manual test.

## 10. Rubric live/manual cho 6 bài

Mỗi output được chấm độc lập theo thang pass/fail và ghi nhận lỗi:

1. Heading lớn trung thành nguồn và đã sửa sạch lỗi OCR/chính tả.
2. Coverage kiến thức cốt lõi.
3. Không bịa kiến thức.
4. Granularity/readability của theory.
5. Theory-example luôn đan xen đúng quan hệ.
6. Ví dụ tự đủ dữ kiện và không phụ thuộc ảnh nguồn.
7. Solution đúng toán, đủ bước, xuống dòng hợp lý.
8. Đúng một section cuối và đúng hai bài.
9. Bài thực tế hợp lý về ngữ cảnh/đơn vị/kết quả.
10. Diagram đúng logic, rõ và không gây hiểu nhầm.
11. Ngôn ngữ phù hợp học sinh lớp 7.
12. Output không chứa metadata kỹ thuật hoặc panel warning rườm rà.

Một JSON đúng schema không được tính là pass semantic. Admin/manual audit vẫn là cổng cuối trước phát hành.

## 11. Tiêu chí nghiệm thu

Implementation chỉ được coi là hoàn thành khi:

- [x] Baseline v2 đã commit và v3 nằm ở nhánh riêng.
- [x] Docs contract/API/UI/M9 phản ánh v3 và backward compatibility.
- [x] `theorySections[].units[]` được giữ, `illustrationPlacement` bị loại bỏ.
- [x] 100% unit persist theo thứ tự theory -> illustration.
- [x] Heading giữ nguyên đề mục nguồn và được AI sửa lỗi OCR/chính tả.
- [x] Theory chỉ chứa kiến thức được nguồn hỗ trợ.
- [x] Example tối giản, không origin/sourceAssessment/candidate metadata.
- [x] Không có ảnh OCR nguồn trong output v2.
- [x] `diagramSpec` schema + safe renderer dùng chung admin/student hoạt động.
- [x] `diagramSpec.toScale=true`; tọa độ và marker hình học được kiểm tra trước khi render.
- [x] Section cuối đúng literal và đúng hai bài.
- [x] Technical invalid vẫn fail; output hợp lệ được lưu để admin sửa.
- [x] Admin sửa được mọi block và xem được diagram, không panel warning kỹ thuật.
- [x] Student render v1/v2 không lộ metadata nội bộ.
- [x] Focused API/worker/web tests pass.
- [x] Live matrix 3 Đại số + 3 Hình học hoàn tất và có báo cáo semantic/manual.
- [x] Worker đã restart trước manual FE acceptance.

## 12. Rủi ro và cách kiểm soát

| Rủi ro                             | Kiểm soát                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Model sửa heading quá tay          | Mặc định exact; repair phải có evidence; mapper warning/fallback                        |
| T/C backend phân loại sai          | Chỉ coi là hint; model audit `CONFIRMED/CORRECTED/UNCERTAIN`                            |
| AI-authored exercise sai toán      | verification field + semantic lint + live/manual review; luôn `NEEDS_REVIEW`            |
| Diagram đẹp nhưng logic sai        | schema reference check, geometry check đơn giản, warning và admin preview               |
| Prompt quá dài/tốn tiền            | chỉ một provider call, không gửi ảnh binary, đo token preview, giữ context cap hiện tại |
| V2/v3 lẫn dữ liệu                  | persisted version 2, dual renderer/parser, không migration phá dữ liệu cũ               |
| Admin hiểu verification là bảo đảm | không hiện như chứng nhận; UI ghi rõ nội dung AI cần duyệt                              |
| Worker chạy code cũ                | restart worker bắt buộc sau thay đổi worker                                             |

## 13. Ngoài phạm vi lần sửa này

- Không thay đổi page-range assignment hoặc OCR provider.
- Không làm AI image generation/raster generation.
- Không thêm semantic judge call bắt buộc.
- Không tự publish output AI.
- Không migration/rewrite hàng loạt summary v1 cũ.
- Không đổi flow quiz/flashcard/test của M9.3.
- Không thêm block type lý thuyết mới ngoài các block hiện có.

## 14. ASSUMPTION đã dùng

- Dữ liệu source của mỗi lesson luôn đã được admin gán đúng page range và có nội dung bài thực tế như owner xác nhận.
- Rule `note.content` có ví dụ nội bộ được giữ nguyên.
- `diagramSpec` chủ yếu phục vụ Hình học; Đại số chỉ dùng khi thật sự giúp hiểu bài.
- Admin là người duyệt cuối; mục tiêu là output tốt và dễ sửa, không hứa hẹn hoàn hảo 100%.
- Tên prompt/schema version chính xác chỉ được chốt khi code để tránh tài liệu báo nhầm version đang production.
