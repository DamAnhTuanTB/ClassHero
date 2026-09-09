# API Quiz Flashcard Tests

Chi tiết tách từ `docs/05-api-contract.md`. File index chính vẫn là `docs/05-api-contract.md`.

---

## 10. Quiz API

### 10.1. Admin quiz set

#### `GET /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

Behavior:

- Trả các bộ đang tồn tại theo `sortOrder`, rồi `createdAt` tăng dần để giữ ổn
  định thứ tự tạo của dữ liệu cũ. Điều kiện `deletedAt = null` chỉ loại dữ liệu
  legacy từng bị soft delete; endpoint xóa Quiz set mới dùng hard delete.
- Mỗi bộ trả `aiGenerations` theo `createdAt` giảm dần, gồm toàn bộ trạng thái
  `QUEUED`/`RUNNING`/`SUCCEEDED`/`FAILED`. Mỗi lần sinh có model, thời điểm,
  `totalCostVnd` thực tế và `usageEventCount` được aggregate server-side từ
  provider usage events; không tải toàn bộ event vào response danh sách.
- Admin dùng tổng `totalCostVnd` của các lần sinh để hiển thị chi phí cấp bộ.
  Khi chọn một lần sinh, chi tiết từng lượt gọi tiếp tục lazy-load qua API usage
  theo `aiGenerationId` và giữ phân trang hiện có.

#### `POST /admin/lessons/:lessonId/quiz-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Quiz cơ bản"
}
```

Behavior:

- Server tự gán `sortOrder` tiếp theo trong lesson.
- Quiz set không nhận/trả `difficulty`; mức độ thuộc từng question và
  request sinh Quiz bằng AI.

#### `POST /admin/lessons/:lessonId/quiz-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "targetQuizSetId": "uuid",
  "documentIds": ["uuid"],
  "questionCount": 10,
  "difficulty": "MIXED",
  "difficultyCounts": { "easy": 3, "medium": 4, "hard": 3 },
  "questionTypes": [
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "MULTI_STATEMENT_TRUE_FALSE",
    "TEXT_INPUT"
  ],
  "model": "model-phase-1-optional",
  "figureModel": "model-phase-2-optional"
}
```

Response: `202 Accepted` với `jobId`.

Trước khi enqueue, client phải gọi
`POST /admin/lessons/:lessonId/quiz-sets/prompt-preview`. Preview trả
`requestDraftId`/`requestHash`, system prompt, user prompt, JSON Schema và biểu
diễn request OpenAI. Lệnh generate gửi lại hai hash này; worker chỉ dùng immutable
draft đã preview, không tự ghép lại input khác.

`model`, `temperature`, `reasoningEffort`, `maxOutputTokens` là override Phase 1
tạo câu. `figureModel`, `figureTemperature`, `figureReasoningEffort`,
`figureMaxOutputTokens` là override Phase 2 tạo hình. Tất cả đều optional; khi bỏ
trống backend resolve lần lượt `(QUIZ, TEXT)` và `(QUIZ, IMAGE)` từ Cài đặt AI.
Preview/draft/hash/job phải snapshot riêng hai route. Quiz figure worker và action
tạo lại hình chỉ dùng route ảnh, không kế thừa model tạo câu.

Side effects:

- Tạo `background_jobs` queue `AI_GENERATION`.
- Tạo `ai_generations` type `QUIZ`.
- Enqueue AI job.
- `targetQuizSetId` phải thuộc đúng lesson. Khi lesson đã có Quiz set, client lấy
  giá trị từ select `Bộ câu hỏi được chọn` và phải gửi cùng một ID cho preview và
  generate; select mặc định là tab đang mở. Chỉ khi lesson chưa có set, client bỏ
  field này để backend tạo duy nhất `Bộ câu hỏi 1`.
- Worker append item vào set đích, không tạo Quiz set/tab mới. Câu AI có
  `reviewStatus=NEEDS_REVIEW`; set thủ công hiện có không bị đổi thành `source=AI`.
- Mỗi question dùng contract riêng của Quiz. `sourceMetadataJson` chỉ lưu
  `aiGenerationId`, `generationQuestionIndex` và `quizExplanationBlock` có
  `type=quizExplanation`; Quiz không lưu `sourceChunkIds`, `sources` hoặc
  `sourceHash` ở cấp câu vì nguồn chỉ là context để AI biên soạn bài tập mới.
  `ai_explanations` giữ projection Tiptap của Quiz.
- Source gửi provider là canonical raw PDF packet của đúng tài liệu/page range
  đã chọn (`input_file`, `detail=high`), không phải OCR text. Chấp nhận PDF scan
  thuần và PDF có text layer; OCR readiness không phải precondition riêng của
  Quiz. Manifest/hash/ID nguồn vẫn được lưu trong draft để audit và kiểm stale,
  nhưng không được nối thành text gửi provider.
- Preview đồng thời nối index chống trùng của toàn bộ câu Quiz còn tồn tại trong
  lesson, không lọc `reviewStatus` và không giới hạn ở set đích. Index chỉ gồm
  loại câu, đề bài plain text và nội dung phương án/mệnh đề nếu có; không gửi đáp
  án, hint, lời giải, hình, ID, trạng thái hay metadata. Câu đã xóa mềm, set
  legacy đã xóa mềm hoặc set đã hard delete bị loại; nội dung trùng hệt sau
  chuẩn hóa whitespace chỉ gửi một lần. Khối này nằm
  sau prompt-cache breakpoint và được khóa trong immutable preview draft.
- JSON Schema preview/worker phải được dựng theo đúng request: chính xác
  `questionCount`, chỉ các `questionTypes` đã chọn và đúng difficulty cố định khi
  không phải `MIXED`. Output root chỉ có `questions`; không có `title` bị bỏ qua.
- Bốn loại câu được định nghĩa trong system prompt; user prompt chỉ giữ cấu hình
  động. `TEXT_INPUT` AI là một phép tính có đúng một yêu cầu và một kết quả số
  chuẩn duy nhất trong `correctAnswer`, không phải câu văn/tự luận, câu hỏi ghép
  hay danh sách các cách viết tương đương. Kết quả hữu tỉ dùng số nguyên hoặc
  phân số tối giản; kết quả vô tỉ buộc `problem` yêu cầu làm tròn đến một chữ số
  thập phân và `correctAnswer` chỉ giữ số đã làm tròn với dấu `.`. Backend lưu
  đáp án AI thành mảng một phần tử và lưu `gradingConfigJson=null`. Bộ chấm
  so sánh giá trị số chính xác, nên dữ liệu học sinh nhập như `1/2`, `2/4`,
  `0.5`, `0.50`, `0,5` và `\frac{1}{2}` được coi là cùng một đáp án; mẫu số bằng
  `0` không hợp lệ.
- Với `TRUE_FALSE`, provider vẫn trả `explanation.solution` nhưng lời giải phải
  nêu căn cứ và kết thúc bằng một câu liên kết tự nhiên xác nhận mệnh đề đúng hay
  sai; không chấp nhận kết luận cụt kiểu “Mệnh đề đúng.” đứng tách khỏi lập luận.
- Với `MULTI_STATEMENT_TRUE_FALSE`, raw provider question không có một
  `explanation.solution` chung mà trả
  `explanation.statementSolutions[] = { statementId, solution }[]`, đúng một
  phần và đúng thứ tự cho mỗi statement. `statements[].id` và `statementId` chỉ
  nhận chuỗi liên tiếp `a`, `b`, `c`, ...; `S1/S2`, số, chữ hoa hoặc ID tùy ý bị
  provider schema từ chối. Raw explanation không có `answer`; lớp trình bày lấy
  `statements[].value` để dựng đáp án thành từng dòng `a) Đúng.`, `b) Sai.`,
  đồng thời mapper ghép lời giải thành các đoạn mang cùng nhãn trong
  `quizExplanationBlock.solution`. Sai chuỗi nhãn hoặc coverage/order được ghi
  cảnh báo `STATEMENT_ID_SEQUENCE_MISMATCH` hoặc
  `STATEMENT_SOLUTION_COVERAGE_MISMATCH`.
- Lời giải từng câu con bám phong cách SGK phù hợp với dạng bài: câu tính/biến
  đổi lấy công thức và ký hiệu làm phần chính, văn xuôi chỉ nêu căn cứ/nối bước;
  câu lý thuyết không cần tính dùng lập luận ngắn theo đúng khái niệm. Có thể dùng
  lại câu chữ policy của Sinh kiến thức khi hoàn cảnh tương đương, nhưng không
  sao chép máy móc contract field hoặc hành vi mapper khác domain.
- Prompt/schema Quiz dùng cùng invariant dấu câu có chức năng của Sinh kiến
  thức: câu dẫn trực tiếp sang danh sách hoặc display ở dòng sau có dấu `:`.
  Với `aligned`/`split`, không căn `&` trước toán tử suy luận/tương đương đầu dòng
  (`\Rightarrow`, `\Leftrightarrow`, dạng dài/ngược, `\implies`, `\impliedby`,
  `\iff`); dấu căn đặt tại quan hệ chính như `=`.
- Prompt và provider schema bắt buộc mọi môi trường LaTeX trong `$$...$$` có cặp
  `\begin{X}`/`\end{X}` đúng tên và đúng thứ tự lồng. Backend tự chuẩn hóa toàn
  bộ chuỗi trong câu ngay sau provider rồi chạy lại trước persistence: bổ sung
  thẻ đóng còn thiếu, sửa delimiter `$$` đặt trước thẻ đóng, đóng nesting sai
  thứ tự và bỏ thẻ đóng mồ côi. Đây là recovery deterministic, idempotent,
  không ném lỗi, không tạo cảnh báo admin và không hồi tố câu đã lưu trước đó.
- Sau khi output đã qua provider schema, semantic validator không xóa câu hoặc
  chặn persistence. Sai lệch về phân bổ, option ID hoặc statement ID được lưu
  vào `generationIssues` dưới dạng cảnh báo `REVIEWABLE`; câu AI vẫn ở trạng
  thái `NEEDS_REVIEW` để admin kiểm tra.
- Quiz AI không nhận hoặc persist `explanation.answer`/
  `quizExplanationBlock.answer`. Dữ liệu chấm là nguồn đáp án duy nhất:
  `correctOptionId`, `correctAnswer` hoặc `statements[].value` theo loại câu.
  Renderer dựng nội dung sau nhãn `Đáp án:` từ nguồn này; solution kết luận rồi
  dừng và card không chèn thêm tiêu đề `Lời giải` bên trong. API đọc dữ liệu lịch
  sử phải loại legacy `answer` trước khi trả UI.
- Quiz Toán chỉ persist `isGeometry` trong `quizExplanationBlock`; provider,
  mapper và API không nhận/trả `geometryStatement`, `hypotheses` hoặc
  `conclusions` cho bất kỳ khối lớp nào. Key cũ nếu còn trong JSON lịch sử không
  được project ra response và bị loại khi câu AI được lưu lại. Quyết định tạo
  figure vẫn độc lập với `isGeometry`. Contract GT–KL của Summary không đổi.
- Figure không có quota và chỉ được tạo nếu thật sự cần. Phase 1 chỉ trả hai
  boolean độc lập `requiresQuestionFigure` và `solutionFigure`; không có mode hay
  figure plan. Nếu `solutionFigure=true`, Phase 2 dựng một source hoàn chỉnh mới
  từ `problem` và `solution`, ưu tiên authority `solution > problem`, không nhận
  hoặc phụ thuộc source/asset/revision hình đề. Problem/solution vẫn phải tự đủ
  nghĩa khi không tải hình.
- Current revision hình Quiz có thể chứa marker `% classhero-display-scale`.
  Backend parse/clamp marker và trả `displayScale` trong figure asset admin,
  `questionFigure` và `solutionFigure` student; không trả full `latexSource` cho
  student. Thiếu marker giữ nguyên layout cũ.
- Hard cutover: API không đọc/ghi `exampleBlock`, không trả
  `explanationExampleBlock` và không có fallback dữ liệu Quiz cũ theo shape Sinh
  kiến thức. Student response dùng `explanationBlock`.
- `GET /admin/lessons/:lessonId/quiz-sets` trả thêm
  `pendingReviewQuestionCount`, `unpublishedApprovedQuestionCount` và
  `aiGenerations[]` theo set để UI duyệt/audit nhiều lượt sinh trong cùng một
  bộ. Admin hiển thị hàng câu AI chờ duyệt trước, sau đó bốn hàng câu đã duyệt
  theo `MULTIPLE_CHOICE → TRUE_FALSE → MULTI_STATEMENT_TRUE_FALSE → TEXT_INPUT`.
- Xóa câu AI cập nhật `generationAudit` của đúng `aiGenerationId`. Xóa 2 trong
  lượt 10 làm audit lượt đó còn 8, không tính câu thủ công/lượt AI khác.

#### `PATCH /admin/quiz-sets/:quizSetId`

Role: `ADMIN`.

Body: `{ "title": "Bộ câu hỏi ôn tập" }`. Endpoint không nhận
`difficulty`.

#### `DELETE /admin/quiz-sets/:quizSetId`

Role: `ADMIN`.

Behavior: hard delete, không soft delete và không thể khôi phục.

- Thực hiện trong một transaction: xóa toàn bộ `quiz_attempts`/answer phụ thuộc,
  xóa `quiz_sets` để cascade câu hỏi/hình/revision/render attempt, rồi xóa các
  `ai_explanations` của những câu vừa bị xóa.
- Mọi delivery file của figure không còn được figure nào khác tham chiếu được
  đánh dấu xóa trong transaction, sau đó xóa object khỏi MinIO/R2 và hard-delete
  metadata `files`. File còn được figure khác dùng không bị xóa.
- Giữ `ai_generations`, provider usage và `audit_logs` để bảo toàn lịch sử chi
  phí/vận hành; audit action là `QUIZ_SET_PERMANENT_DELETED`.
- Response:

```json
{
  "success": true,
  "deletedQuestionCount": 10,
  "deletedAttemptCount": 3,
  "deletedExplanationCount": 10,
  "deletedFileCount": 6,
  "pendingFileCleanupCount": 0
}
```

Nếu storage tạm lỗi, metadata file giữ tombstone `DELETED` để không được tái sử
dụng và `pendingFileCleanupCount` phản ánh số object chưa dọn xong.

#### `POST /admin/quiz-sets/:quizSetId/review`

Role: `ADMIN`.

Body:

```json
{ "reviewStatus": "APPROVED", "action": "PUBLISH" }
```

`action` của Quiz có ba giá trị và dùng cùng state machine UI của Sinh kiến thức:

- `SAVE`: giữ nguyên `reviewStatus` của bộ và đánh dấu mọi câu `APPROVED` hiện
  tại là đã lưu sang bản học sinh. Nếu bộ đã có lượt phát hành, các câu này dùng
  đúng timestamp của lượt phát hành gần nhất; thao tác `SAVE` không tạo lượt
  phát hành mới. Cho phép vẫn còn câu AI đang chờ duyệt.
- `PUBLISH`: chỉ yêu cầu có ít nhất một câu `APPROVED`, không bị chặn bởi các câu
  còn chờ duyệt. Action tạo mốc phát hành mới cho toàn bộ câu `APPROVED` hiện tại
  và chuyển riêng bộ Quiz này sang `APPROVED`; câu chưa duyệt tiếp tục có
  `publishedAt=null` và không hiển thị cho học sinh.
- `WITHDRAW`: chuyển riêng bộ Quiz này sang `HIDDEN`; các mốc câu đã phát hành
  được giữ để có thể phát hành lại.

UI luôn có `Lưu`; cạnh đó là `Phát hành` khi bộ chưa phát hành hoặc
`Thu hồi phát hành` khi bộ đang phát hành. `Phát hành` khả dụng ngay khi có ít
nhất một câu đã duyệt. Duyệt câu không tự phát hành bộ.

#### `POST /admin/quiz-sets/:quizSetId/questions/review-all-ai`

Role: `ADMIN`.

- Không nhận body. Endpoint duyệt trong một transaction toàn bộ câu
  `NEEDS_REVIEW` có lineage AI thuộc đúng Quiz set và chuyển lời giải liên quan
  sang `APPROVED`.
- Câu vừa duyệt giữ `publishedAt=null`; admin vẫn phải dùng `SAVE`/`PUBLISH` của
  set trước khi học sinh nhận các câu mới.
- Không duyệt nhầm câu thủ công đang chờ trong set `source=ADMIN`. Response trả
  `approvedQuestionCount` và `pendingReviewQuestionCount`; gọi lại khi không còn
  câu phù hợp là idempotent và trả count duyệt bằng `0`.

### 10.2. Admin quiz question item-level CRUD

#### `GET /admin/quiz-sets/:quizSetId/questions`

Role: `ADMIN`.

- Với câu Quiz do AI sinh, response có thêm `generationQuestionJson`: object
  câu hỏi hiện tại trong mutable structured output, lấy từ
  `ai_generations.output_json.questions[generationQuestionIndex]`.
- Khi admin sửa thành công một câu AI, backend ghi nội dung câu hỏi, phương án/mệnh
  đề, đáp án, gợi ý, lời giải và độ khó hiện tại trở lại đúng vị trí trong
  `output_json`, giữ các field provider-only chưa được CRUD chạm tới, rồi tính lại
  `outputHash`. Refetch vì vậy trả JSON khớp UI mà không cần field hoặc bản lưu
  `currentQuestionJson` riêng.
- `generationQuestionJson` là `null` với câu thủ công, generation cũ không còn
  output hoặc lineage không hợp lệ. Trường này chỉ phục vụ panel admin và không
  được trả qua API học sinh.
- Mỗi phần tử `figures[]` trả thêm `openAiGenerationCostVnd: number | null` và
  `openAiCachedInputTokens: number | null`.
  Field là tổng `cost_vnd` của các usage event OpenAI `SUCCEEDED` thuộc đúng job
  đã tạo delivery asset hiện hành; backend dedupe theo usage event, giữ được giá
  khi revision mới chỉ đổi caption trên cùng file. Ảnh upload/code, provider
  khác hoặc asset chưa có usage tương ứng trả `null`. Cached token cũng được
  cộng/dedupe trên cùng tập event; UI chỉ gắn nhãn cache khi giá trị lớn hơn `0`.
- Đây là raw JSON ở mức structured payload đã được SDK parse và schema validate,
  không phải toàn bộ HTTP response envelope, token usage hoặc chuỗi byte JSON ban
  đầu của provider. Sau lần admin sửa đầu tiên, nó là working snapshot mới nhất,
  không còn là bản provider bất biến.

#### `PATCH /admin/quiz-questions/:questionId/generation-json`

Role: `ADMIN`.

Body: `{ "generationQuestionJson": { ... } }`.

- Chỉ áp dụng cho câu có lineage AI hợp lệ. Backend validate transport shape,
  normalize LaTeX deterministic, map lại Quiz/explanation và ghi đè đúng câu
  trong mutable `ai_generations.output_json` trong cùng transaction.
- Semantic mismatch chỉ cập nhật `generationIssues` với `blocking=false`; câu
  trở về `NEEDS_REVIEW` và vẫn được lưu để admin tiếp tục sửa/duyệt.
- Không cho sửa subtree `figure` qua endpoint này; hình dùng workflow revision và
  asset chuyên dụng để tránh JSON lệch delivery hiện hành.

#### `POST /admin/quiz-sets/:quizSetId/questions`

Role: `ADMIN`.

Body:

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "questionJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "2 + 2 bằng bao nhiêu?" }]
      }
    ]
  },
  "optionsJson": [
    {
      "id": "option-a",
      "richText": {
        "type": "doc",
        "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "3" }] }]
      }
    },
    {
      "id": "option-b",
      "richText": {
        "type": "doc",
        "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "4" }] }]
      }
    }
  ],
  "correctAnswerJson": ["option-b"],
  "hintJson": null,
  "explanationJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Cộng hai đơn vị với hai đơn vị được bốn đơn vị." }
        ]
      }
    ]
  },
  "difficulty": "EASY"
}
```

- `optionsJson` là mảng động, tối thiểu 2 phần tử và không có giới hạn cố định 4 phương án.
- Mỗi option có `id` duy nhất; mọi ID trong `correctAnswerJson` phải tồn tại trong `optionsJson`.
- Với `TRUE_FALSE`, `optionsJson` là `null` hoặc không gửi và
  `correctAnswerJson` là một boolean chung:

```json
{
  "questionType": "TRUE_FALSE",
  "questionJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [{ "type": "text", "text": "Số 2 là số nguyên tố." }]
      }
    ]
  },
  "optionsJson": null,
  "correctAnswerJson": true,
  "difficulty": "EASY"
}
```

- Với `MULTI_STATEMENT_TRUE_FALSE`, `questionJson` là đề dẫn chung;
  `optionsJson` là danh sách tối thiểu 2 mệnh đề và `correctAnswerJson` ánh xạ
  Đúng/Sai cho từng mệnh đề:

```json
{
  "questionType": "MULTI_STATEMENT_TRUE_FALSE",
  "questionJson": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "text", "text": "Xác định tính đúng sai của các mệnh đề sau." }
        ]
      }
    ]
  },
  "optionsJson": [
    {
      "id": "statement-a",
      "richText": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "Mệnh đề thứ nhất" }]
          }
        ]
      }
    },
    {
      "id": "statement-b",
      "richText": {
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [{ "type": "text", "text": "Mệnh đề thứ hai" }]
          }
        ]
      }
    }
  ],
  "correctAnswerJson": [
    { "statementId": "statement-a", "value": true },
    { "statementId": "statement-b", "value": false }
  ],
  "difficulty": "MEDIUM"
}
```

- ID mệnh đề phải duy nhất. `correctAnswerJson` phải chứa đúng một entry cho mọi
  ID trong `optionsJson`, không thiếu, không thừa và không trùng.
- `TRUE_FALSE` và `MULTI_STATEMENT_TRUE_FALSE` là hai contract riêng; API không
  tự chuyển boolean thành danh sách mệnh đề hoặc ngược lại.
- Với `TEXT_INPUT`, `correctAnswerJson` là mảng chứa đúng một chuỗi đáp án
  canonical. Client không gửi cấu hình so khớp; `gradingConfigJson` cũ được bỏ
  qua và bản ghi mới/cập nhật lưu `null`. Backend tự so sánh giá trị số chính
  xác trước (`0.5`, `0,5`, `1/2`, `2/4`, `\\frac{1}{2}` tương đương), rồi
  fallback về chuỗi đã chuẩn hóa Unicode/khoảng trắng và không phân biệt hoa
  thường khi hai phía không cùng là số hợp lệ.
- `hintJson` và `explanationJson` nhận Tiptap JSON hoặc `null`. `explanationJson`
  chỉ chứa phần lời giải, không chứa dòng `Đáp án:` vì dữ liệu chấm ở
  `correctAnswerJson` là nguồn đáp án duy nhất. Lời giải chi tiết thủ công được
  lưu trong `ai_explanations` với `source=ADMIN` và trả về qua relation
  `explanation`.
- `questionJson`, `optionsJson[*].richText`, `hintJson` và
  `explanationJson` cùng nhận cây Tiptap rich content. Contract cho phép
  `heading`, `paragraph`, `bulletList`, `orderedList`, `listItem`; marks
  `bold`, `italic`, `underline`, `strike`, `textStyle.color`; thuộc tính
  `textAlign`, `indent` (số nguyên từ `1` đến `8`) trên paragraph/heading;
  node `inlineMath`/`blockMath` với `attrs.latex`; node `image` với
  `attrs.fileId`, `src`, `alt`, `title`, `alignment` (`left|center|right`),
  `baseWidthPercent`, `widthPercent`, `sourceWidth`, `sourceHeight`, `cropTop`,
  `cropRight`, `cropBottom`, `cropLeft`; và node
  `table`, `tableRow`, `tableHeader`, `tableCell` theo table schema của Tiptap.
  Cell giữ `colspan`, `rowspan`, `colwidth` và `cellHeight` để bảo toàn resize
  cột, chiều cao hàng và trạng thái merge/split khi đọc lại.
- Ảnh câu hỏi phải upload trước qua `POST /files/upload` với
  `purpose=QUESTION_IMAGE`; payload rich content không nhận ảnh base64.
- Crop ảnh là non-destructive và dùng phần trăm bốn cạnh trong khoảng hợp lệ;
  `baseWidthPercent` là độ rộng khung ảnh ở scale gốc, còn `widthPercent` là mức
  resize hiển thị cho người dùng và nằm trong `20–100`. Ảnh mới bắt đầu tại
  `widthPercent=100`; node cũ thiếu `baseWidthPercent` mặc định dùng `100` để
  không đổi cách hiển thị. Xóa node ảnh khỏi rich content không đồng nghĩa xóa
  file storage ở endpoint câu hỏi.
- Với `TEXT_INPUT`, phần tử duy nhất của `correctAnswerJson` là string canonical
  dùng để chấm; string có thể chứa LaTeX hoặc mhchem như
  `\frac{1}{2}`/`\ce{H2O}`.
- Server tự gán `sortOrder` tiếp theo trong quiz set.

#### `PATCH /admin/quiz-questions/:questionId`

Role: `ADMIN`.

Behavior:

- Cập nhật câu hỏi với cùng contract nội dung như create; cho phép đổi loại câu hỏi và xóa gợi ý/lời giải bằng `null`.
- Quiz nhận tùy chọn `quizExplanationBlock` theo schema riêng
  `type=quizExplanation`, chỉ gồm `problem`, `solution`, `isGeometry?` và
  `origin?`; block không nhận `answer`. Endpoint không nhận `exampleBlock`. Source trace cấp
  câu vẫn bị loại theo contract M9.3. Figure AI được quản lý bằng resource riêng;
  ảnh admin tự tải dùng endpoint figure upload, không nhúng base64 vào block.

#### `POST /admin/quiz-questions/:questionId/figures/admin-upload`

Role: `ADMIN`.

- Gắn file ảnh admin đã upload vào role `QUESTION` hoặc `SOLUTION` của câu Quiz.
- Đây là đường ảnh raster duy nhất của Quiz; AI chỉ sinh TeX/TikZ mới và không
  dùng ảnh gốc/crop sách giáo khoa.
- AI figure Phase 2 dùng output tối giản `{ latexSource }` cho cả hình đề và
  hình lời giải. Không còn `extensionLatex`, mode, semantic checklist hay figure
  plan trong provider contract; Zod strict reject mọi field ngoài schema.
- Call figure dùng profile môn chuyên vẽ, schema strategy `auto` và prompt cache
  `in_memory`. Worker lưu request trace (prompt/schema version, strategy
  requested/resolved, schema bytes và token text/ảnh/tổng ước tính) vào
  `BackgroundJob.inputMeta` để audit, không gọi thêm provider để tạo preview.
- Khi gửi `explanationJson`, service tạo mới hoặc cập nhật `ai_explanations` nguồn `ADMIN`; nội dung rỗng/`null` gỡ lời giải khỏi câu hỏi.
- Nếu nội dung/correct answer/hint thay đổi, mark explanation liên quan stale hoặc xóa `explanation_id` theo AI/RAG spec.
- Ghi audit log.

#### `POST /admin/quiz-questions/:questionId/solution-refinement/preview`

Role: `ADMIN`.

Body nhận `mode`, optional `adminInstructions` tối đa 2.000 ký tự và
`includeCurrentSolutionAsRejected` mặc định `false`.

- Đọc đề bài, phương án/mệnh đề, đáp án đúng và lời giải hiện tại của đúng câu.
- Resolve subject/khối lớp và route `(QUIZ, TEXT)`, dựng đúng một structured
  request theo mode. `REFINE` gửi đáp án/lời giải hiện tại làm authority;
  `REGENERATE` luôn ẩn đáp án/hint cũ; chỉ khi checkbox bật mới gửi lời giải cũ
  như rejected candidate. Preview trả `requestHash`, system/user prompt, request OpenAI, token
  và chi phí tối đa của một call.
- Không gọi provider, không enqueue và không sửa dữ liệu.

#### `POST /admin/quiz-questions/:questionId/solution-refinement`

Role: `ADMIN`. Response: `202 Accepted` với `jobId`/`status`.

Body dùng cùng checkbox với preview và thêm `requestHash` SHA-256.

- Rebuild request và từ chối `AI_INPUT_SNAPSHOT_STALE` nếu đề/lời giải/config
  không còn khớp preview. Một câu chỉ có một refinement job active.
- Enqueue `AI_GENERATION`, resource type `QUIZ_SOLUTION_REFINEMENT`, tối đa một
  provider attempt và đúng một provider call. Worker kiểm hash lời giải trước
  paid call và trước persist.
- `REFINE` chỉ trả một nhánh lời giải `solution` hoặc `statementSolutions[]`;
  đáp án hiện tại là authority bị khóa. `REGENERATE` trả đáp án mới theo đúng
  loại câu, hint và một nhánh lời giải; ID phương án/mệnh đề phải thuộc tập hiện
  có. Worker persist atomically đúng phạm vi mode, đồng bộ mutable generation
  JSON, ghi audit và chuyển câu về `NEEDS_REVIEW`, `publishedAt=null`.
- Hint không được gửi vào request và không phải nguồn để model dựng lời giải.
  `REFINE` không nhận field sửa đề, đáp án, hint hay hình. `REGENERATE` không sửa
  đề/phương án/mệnh đề/hình nhưng được thay đáp án, hint và lời giải.

#### Admin quản lý revision hình Quiz

Role: `ADMIN`.

- `POST /admin/quiz-questions/:questionId/figures/create-ai/preview` nhận
  `targetMode=QUESTION|SOLUTION`, `mode`, `baseRevisionId` và cùng bộ override
  của modal hiện có. Preview validate đúng điều kiện execute, trả exact
  prompt/request/token/chi phí nhưng không enqueue và không gọi provider.
- `POST /admin/quiz-questions/:questionId/figures/create-ai` dùng cùng body,
  upsert figure theo role khi chưa tồn tại, tạo pending revision
  `ADMIN_REGENERATE` và trả `202 { jobId, status }`. Target `SOLUTION` chỉ dùng
  `problem` và `solution`, không yêu cầu hoặc gửi hình/code hình đề.
- Response admin của figure đang chạy trả thêm `pendingAiTargetMode` lấy từ
  immutable job `planSnapshot`. UI dùng field này để gắn trạng thái “đang xử lý”
  cho đúng role `QUESTION` hoặc `SOLUTION`.
- Response danh sách câu Quiz phải hydrate URL truy cập của current delivery
  asset. Nếu storage local/R2 chưa có `FILE_PUBLIC_BASE_URL`, API trả signed URL
  ngắn hạn trong `currentRevision.deliveryFile.publicUrl`; trạng thái
  `SUCCEEDED` không được hiển thị thành lỗi chỉ vì cột `File.publicUrl` là null.
- Hai endpoint question-level này nhận đủ bốn loại câu Quiz, gồm `TRUE_FALSE` một
  mệnh đề. Quy tắc không tự sinh hình cho `TRUE_FALSE` chỉ thuộc Phase 1/Phase 2
  của lượt sinh Quiz tự động, không chặn thao tác tạo hình chủ động của admin.

- `POST /admin/quiz-questions/:questionId/figures/:figureId/drafts/compile` biên
  dịch TeX cục bộ, tạo revision `DRAFT_READY` và trả `previewSvg`; không gọi AI.
- `POST /admin/quiz-questions/:questionId/figures/:figureId/drafts/apply` áp dụng
  đúng draft đã biên dịch với optimistic guard `baseRevisionId`.
- `POST /admin/quiz-questions/:questionId/figures/:figureId/create-new-ai` tạo
  revision `ADMIN_REGENERATE`, enqueue `QUIZ_FIGURE_RENDERING`. Body có đúng hai
  mode `REGENERATE` (`Tạo mới lại`) và `EDIT_CURRENT` (`Chỉnh sửa hình hiện
tại`); mode edit yêu cầu revision hiện hành là `AI_TEX` và gửi source TikZ hiện
  tại cho model để sửa tối thiểu. Optional `adminInstructions`, model,
  Temperature/Reasoning Effort và prompt override được snapshot trong job input.
- `POST /admin/quiz-questions/:questionId/figures/:figureId/create-new-ai/preview`
  không enqueue job và không gọi provider; endpoint trả đúng system prompt, user
  prompt, Responses API payload, model đã resolve, token và chi phí ước tính để
  modal `Xem dữ liệu` dùng chung ngôn ngữ với Sinh kiến thức.
- `POST /admin/quiz-questions/:questionId/figures/:figureId/refine-ai` nhận
  `{ baseRevisionId, adminInstructions? }`, trong đó `adminInstructions` tùy
  chọn, tối đa 2.000 ký tự và được trim trước khi snapshot vào job. Endpoint chỉ
  chấp nhận current revision `SUCCEEDED`, `AI_TEX` có delivery SVG, tạo candidate
  revision `AI_REFINEMENT`, resolve route `QUIZ/IMAGE`, enqueue
  `QUIZ_FIGURE_RENDERING` và trả `202 { jobId, status }`.
  Worker gửi current source + PNG raster hóa từ SVG hiện tại + figure plan gốc.
  Đây là action `Tinh chỉnh` duy nhất: figure plan là authority, còn source và
  ảnh current là candidate để đánh giá. Model sửa cả lỗi semantic, topology,
  quan hệ, nhãn, số đo, bố cục và khả năng đọc; được dựng lại toàn bộ source khi
  candidate sai hoặc vô lý nhưng không được phát minh dữ kiện ngoài authority.
  `adminInstructions` chỉ ưu tiên phần cần kiểm tra/cách thể hiện, không được ghi
  đè authority, đổi lời giải hoặc làm lộ đáp án; refinement vẫn đánh giá toàn bộ
  hình thay vì chỉ sửa phần admin nhắc tới.
  Mỗi role gửi đúng một PNG candidate và luôn nhận full `latexSource`; refinement
  hình lời giải vẫn dùng authority `solution > problem` và không đọc hình đề.
  Current revision không đổi nếu provider, policy, compile, validator hoặc
  storage thất bại.
- `POST /admin/quiz-questions/:questionId/figures/:figureId/refine-ai/preview`
  dùng cùng optimistic guard, route, source, plan, `adminInstructions` và đúng
  một PNG như request thật nhưng chỉ resolve schema/token/chi phí, tuyệt đối
  không gọi provider hoặc enqueue.
  Response trả ảnh PNG để modal hiển thị; provider JSON thay bytes base64 bằng
  placeholder an toàn, trong khi token ảnh vẫn được ước tính từ PNG thật.
- `PATCH /admin/quiz-questions/:questionId/figures/:figureId/caption` tạo revision
  metadata mới, không mutate mất lịch sử revision cũ.
- `DELETE /admin/quiz-questions/:questionId/figures/:figureId` chỉ xóa mềm đúng
  resource được chọn. Xóa hình đề không xóa hình lời giải và ngược lại.
- Mọi mutation dùng `baseRevisionId`; conflict yêu cầu UI tải lại thay vì ghi đè
  revision mới hơn. Quiz không gọi service/private schema của Summary.

#### `POST /admin/quiz-questions/:questionId/review`

Role: `ADMIN`.

Body:

```json
{ "reviewStatus": "APPROVED" }
```

Behavior:

- Chỉ cập nhật `reviewStatus` của câu Quiz được chỉ định và lời giải liên kết;
  không duyệt các câu còn lại trong cùng bộ.
- UI dùng chính endpoint này cho nút `Chấp nhận` trong banner warning của câu.
  Khi response trả `APPROVED`, banner của câu được ẩn; endpoint không xóa hoặc
  sửa `generationIssues` vì metadata này vẫn cần cho audit lượt sinh.
- Ghi audit log `QUIZ_QUESTION_REVIEWED`.
- Câu vừa duyệt có `publishedAt=null`; nếu bộ đã phát hành, học sinh vẫn chỉ thấy
  bản câu đã được `Lưu`/`Phát hành` trước đó. Admin phải bấm `Lưu` của đúng bộ để
  đưa các câu mới duyệt hoặc mới tạo vào lượt phát hành gần nhất cho học sinh.
- Endpoint không tự chuyển bộ sang `APPROVED`.

#### `DELETE /admin/quiz-questions/:questionId`

Role: `ADMIN`.

Behavior: soft delete.

### 10.3. Student quiz

#### `GET /student/lessons/:lessonId/quiz-sets`

Role: `STUDENT`.

Behavior:

- Yêu cầu lesson đã publish và student có enrollment active còn hạn cho khóa
  gốc/bản cá nhân hiệu lực, hoặc lesson bật trial.
- Chỉ trả set chưa xóa, `APPROVED`, không phải reserve; question phải đồng thời
  `APPROVED` và có `publishedAt`.
- Câu được nhóm ổn định theo thứ tự `MULTIPLE_CHOICE → TRUE_FALSE →
MULTI_STATEMENT_TRUE_FALSE → TEXT_INPUT`; trong cùng loại vẫn giữ thứ tự
  `sortOrder → createdAt → id`. Runner, resume và review dùng cùng thứ tự này.
- Question chỉ gồm `questionJson`, `optionsJson`, `hintJson`, loại, độ khó và thứ
  tự; không trả `correctAnswerJson`, `gradingConfigJson`, `explanation` hoặc dữ
  liệu chấm điểm nội bộ.
- Attempt/progress và chấm bài thuộc `M7.2`.

#### `GET /student/lessons/:lessonId/quiz-history`

Role: `STUDENT`.

Behavior:

- Trả tối đa 50 attempt gốc hiện hành/đã hoàn thành của chính student trong
  lesson; không đưa retry attempt vào danh sách.
- Mỗi lượt có `id`, `setId`, `displayName` dạng `Bộ N`, `state`,
  `startedAt`, `completedAt` và summary điểm. Cùng một `setId` vẫn có thể xuất
  hiện nhiều lần khi bộ được tái sử dụng.
- `state=IN_PROGRESS` là lượt hiện hành để UI hiển thị nhãn `Đang làm`, action
  `Tiếp tục làm` và `answeredCount/totalCount câu đã làm`. `state=COMPLETED` có
  action xem lại toàn bộ hoặc làm lại bộ đó.
- Lượt đang dở cũ hơn lần submit gần nhất và lượt `CANCELLED` không xuất hiện.

#### `POST /student/quiz-sets/:quizSetId/attempts`

Role: `STUDENT`.

Body:

```json
{
  "scope": "ALL",
  "sourceAttemptId": null
}
```

Behavior:

- `scope=ALL` không có `sourceAttemptId` tạo lượt làm đủ câu và trở thành kết
  quả gốc mới. `scope=ALL` có `sourceAttemptId` tạo lượt phụ gồm toàn bộ câu
  của kết quả nguồn.
- `scope=INCORRECT` bắt buộc `sourceAttemptId` thuộc chính student, là attempt
  đã submit và chỉ lấy những câu sai của chính attempt nguồn.
- `sourceAttemptId` luôn là attempt cha trực tiếp. Backend lần theo chuỗi
  cha-con để tìm attempt gốc dùng cho kết quả cộng dồn của toàn bộ bài.
- Tạo sẵn answer placeholder cho đúng tập câu của attempt để server không tin
  danh sách question ID do client gửi về sau. Các placeholder này đồng thời là
  snapshot membership và thứ tự đánh số của lượt làm: câu được admin thêm hoặc
  xóa rồi lưu/phát hành sau thời điểm start chỉ ảnh hưởng attempt mới, không làm
  đổi `totalCount`, `originalTotalCount` hoặc `questionNumber` của attempt đang
  dở. Câu bị soft-delete vẫn thuộc attempt cũ để student hoàn thành nhất quán.
- Tập câu chỉ lấy các câu `APPROVED` có `publishedAt`; câu admin vừa duyệt/tạo
  nhưng chưa bấm `Lưu` hoặc `Phát hành` không được đưa vào attempt mới.
- Response trả nội dung runner, hint, `correctAnswerJson`, `gradingConfigJson`
  và `explanationJson` đã duyệt để frontend chấm tức thì mà không chờ endpoint
  chấm riêng; request autosave progress chỉ lưu answer/cờ checked. Đây là đánh
  đổi đã chốt để ưu tiên tốc độ; dữ liệu chấm có thể được xem bằng DevTools.
- Mỗi question có `questionNumber` theo vị trí trong bộ Quiz gốc; response có
  `originalTotalCount` để runner retry hiển thị đúng dạng `Câu hỏi 4/9` thay vì
  đánh số lại thành `1/4`.

#### `GET /student/quiz-sets/:quizSetId/attempts/current`

Role: `STUDENT`.

Behavior:

- Trả lượt `IN_PROGRESS` mới nhất của chính student trong bộ Quiz, hoặc `null`
  nếu không có lượt đang làm.
- Response trả lại danh sách câu theo đúng attempt đã tạo, gồm dữ liệu chấm và
  lời giải giống response start, `savedAnswers` gồm mọi đáp án đã autosave,
  `checkedAnswers` gồm các câu đã bấm kiểm tra và `currentQuestionIndex` là vị
  trí gần nhất.
- Resume/review dựng thứ tự và số câu từ placeholder của attempt gốc, không từ
  danh sách question hiện hành của Quiz set. Vì vậy câu được admin thêm hoặc xóa
  rồi bấm `Lưu` trong lúc student đang làm không chen vào hoặc biến mất khỏi lượt
  cũ; thay đổi chỉ áp dụng cho attempt bắt đầu sau đó.
- Frontend dùng endpoint này để khôi phục runner sau refresh/F5 hoặc khi
  student đã thoát runner rồi vào Quiz lại, không tạo attempt mới khi vẫn còn
  lượt `IN_PROGRESS`.
- `Bắt đầu` của attempt mới luôn dùng index `0`; mọi lần vào lại attempt
  `IN_PROGRESS` dùng CTA `Tiếp tục làm` và đúng index đã lưu ở server, kể cả
  chưa có câu nào được kiểm tra hoặc student đổi thiết bị.
- Response có `scope`, `sourceAttemptId`, `originalTotalCount` và
  `questionNumber` để khôi phục đúng ngữ cảnh của runner retry câu sai.

#### `GET /student/quiz-sets/:quizSetId/attempts/status`

Role: `STUDENT`.

Behavior:

- Trả trạng thái entry của bộ Quiz theo chính student:
  `NOT_STARTED`, `IN_PROGRESS` hoặc `COMPLETED`.
- Chỉ lượt `IN_PROGRESS` được tạo sau lần submit gần nhất mới được ưu tiên và
  response trả `currentAttemptId`, `answeredCount` và `checkedCount` đã lưu ở
  server. CTA chỉ
  dựa vào trạng thái lượt: `NOT_STARTED` dùng `Bắt đầu`, mọi `IN_PROGRESS` dùng
  `Tiếp tục làm` dù `checkedCount=0`. `checkedCount` vẫn phục vụ metadata tiến
  độ, không quyết định nhãn CTA. Lượt đang dở cũ hơn lần submit gần nhất phải
  bị bỏ qua để sau F5 không che mất kết quả đã hoàn thành.
- Attempt có `sourceAttemptId` là lượt phụ nên không che trạng thái
  `COMPLETED`/kết quả tích lũy của attempt gốc trên panel Quiz. Nếu F5 ngay
  trong runner lượt phụ, frontend vẫn khôi phục lượt phụ bằng history marker
  và endpoint `current`.
- Nếu không có lượt đang làm nhưng đã submit, response trả
  `latestSubmittedAttempt` gồm `id`, `correctCount`, `wrongCount`,
  `totalCount`, `accuracyPercent` để panel mở lại kết quả gần nhất.
- Endpoint chỉ trả metadata nhẹ, không trả nội dung câu hỏi hoặc đáp án.
- Khi tạo attempt gốc mới, backend chuyển attempt gốc `IN_PROGRESS` khác của
  student trong cùng lesson sang `CANCELLED`; khi submit, backend tiếp tục dọn
  các lượt đang dở dư của cùng student/bộ Quiz. Lịch sử vì vậy chỉ có một bộ
  hiện hành mang nhãn `Đang làm`.

#### `PATCH /student/quiz-attempts/:attemptId/progress`

Role: `STUDENT`.

Body:

```json
{
  "currentQuestionIndex": 1,
  "answer": {
    "questionId": "uuid",
    "answerJson": ["option-a"]
  }
}
```

Behavior:

- Autosave vị trí câu và tùy chọn một đáp án nháp của attempt `IN_PROGRESS`
  thuộc chính student. Answer có thể chưa đầy đủ với câu nhiều mệnh đề/text.
- Quiz chấp nhận marker `{ "__unanswered": true }` kèm `isChecked=true` khi
  student bấm `Bỏ qua`. Server lưu marker, giữ `isAnswered=false`, đặt
  `isChecked=true`; response resume/review trả feedback `isSkipped=true`. Câu
  không thể bị ghi đè bởi autosave đáp án khác sau đó.
- Server validate question thuộc attempt, shape đáp án và biên index; endpoint
  không hiển thị đáp án đúng hoặc feedback.
- Response trả `attemptId`, `currentQuestionIndex`, `answeredCount` và
  `checkedCount`. Request chỉ đổi vị trí được phép bỏ `answer`.
- Lựa chọn button gửi ngay; text/formula input debounce ngắn. Client flush bản
  nháp đang chờ khi đổi câu hoặc thoát runner.

#### `POST /student/quiz-attempts/:attemptId/questions/:questionId/check`

Role: `STUDENT`.

Body:

```json
{ "answerJson": {} }
```

Behavior:

- Endpoint tương thích cho client cũ; UI hiện hành không gọi endpoint này.
- Client hiện hành chấm local từ dữ liệu đã trả khi start/resume và chỉ ghi
  answer lên server ở endpoint submit.

#### `POST /student/quiz-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [
    {
      "questionId": "uuid",
      "answerJson": {}
    }
  ]
}
```

Behavior:

- Nhận toàn bộ answer trong một request. Backend không tin danh sách question ID
  từ client: phải khớp chính xác các placeholder đã tạo cho attempt, không trùng
  và không thiếu câu.
- Backend validate answer theo loại câu; marker `{ "__unanswered": true }`
  được chấm sai với 0 điểm mà không qua validator answer đầy đủ. Backend chấm
  lại authoritative, lưu answers và submit attempt trong một transaction.
- Ở runner, frontend dùng answer đầy đủ làm căn cứ cho `Đã làm`/cảnh báo thiếu
  câu; marker bỏ qua không tăng `Đã làm` nhưng loại câu đó khỏi cảnh báo thiếu.
  Student không bắt buộc bấm nút kiểm tra ở từng câu.
- Trả summary của chính attempt vừa submit gồm `id`, `sourceAttemptId`,
  `correctCount`, `wrongCount`, `totalCount`, `accuracyPercent` để backend giữ
  được lịch sử chi tiết của từng lượt làm.
- Response đồng thời có `aggregateResult`, là summary của attempt gốc sau khi
  đã cộng các câu sửa đúng từ lượt phụ. Frontend luôn dùng `aggregateResult`
  cho màn kết quả, trạng thái panel và mọi action xem lại/làm lại; không hiển
  thị summary riêng của lượt con.
- Với attempt phụ, server lưu kết quả riêng của lượt đó vào lịch sử và chỉ nâng
  các answer đang sai của attempt gốc thành đúng; câu đã đúng không bị hạ thành
  sai. Với attempt gốc `ALL`, `aggregateResult` chính là kết quả attempt vừa
  submit và không cộng dồn dữ liệu từ kết quả gốc cũ.

#### `GET /student/quiz-attempts/:attemptId/review?scope=ALL|INCORRECT`

Role: `STUDENT`.

Behavior:

- Chỉ owner của attempt đã submit được xem lại.
- `ALL` trả toàn bộ câu; `INCORRECT` chỉ trả câu sai.
- Response có answer của student, đáp án đúng, kết quả từng mệnh đề và lời giải
  đã duyệt.
- Review dùng thống kê và tập câu của chính attempt được yêu cầu; đồng thời trả
  `questionNumber` và `originalTotalCount` theo bộ Quiz gốc để lượt con không bị
  đánh số lại từ 1.

#### `POST /student/lessons/:lessonId/quiz-sets/request-new`

Role: `STUDENT`.

Behavior:

- Kiểm tra bộ dự phòng phù hợp.
- Nếu còn, trả bộ có sẵn.
- Nếu hết, enqueue AI generate bộ mới.

Response nếu có bộ dự phòng:

```json
{
  "data": {
    "mode": "EXISTING",
    "setId": "uuid"
  }
}
```

Response nếu phải tạo AI job: `202 Accepted`.

```json
{
  "data": {
    "mode": "QUEUED",
    "jobId": "uuid",
    "status": "QUEUED"
  }
}
```

---

## 11. Flashcard API

### 11.1. Admin flashcard set

#### `GET /admin/lessons/:lessonId/flashcard-sets`

Role: `ADMIN`.

Behavior:

- Trả các bộ chưa bị xóa mềm theo `sortOrder`, rồi `createdAt` tăng dần.
- `cardCount` phản ánh số flashcard chưa bị xóa mềm.
- Mỗi set kèm `pendingReviewCardCount`, `unpublishedApprovedCardCount` và
  `aiGenerations`; từng generation có số usage event và tổng chi phí VNĐ để UI
  hiển thị tổng chi phí/lịch sử độc lập với Quiz.
- Lượt tạo/tạo lại hình lời giải thủ công của Flashcard AI kế thừa
  `aiGenerationId` từ metadata của card. Vì vậy usage operation
  `FLASHCARD_SOLUTION_FIGURE_GENERATION` được tính vào đúng lần sinh, tổng chi
  phí cấp bộ và modal chi tiết giống lượt tạo hình tự động.

#### `POST /admin/lessons/:lessonId/flashcard-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Flashcard công thức",
  "difficulty": "MEDIUM",
  "cards": [
    {
      "frontJson": {},
      "backJson": {},
      "explanationJson": {},
      "difficulty": "MEDIUM"
    }
  ]
}
```

Behavior:

- Chỉ tạo cho lesson tồn tại.
- Bộ thủ công dùng `source=ADMIN`, `reviewStatus=APPROVED`.
- Server tự gán `sortOrder` tiếp theo và ghi audit log.

#### `POST /admin/lessons/:lessonId/flashcard-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "requestDraftId": "uuid",
  "requestHash": "sha256",
  "targetFlashcardSetId": "uuid",
  "documentIds": ["uuid"],
  "cardCount": 20,
  "difficulty": "MIXED",
  "difficultyCounts": { "easy": 10, "medium": 6, "hard": 4 },
  "style": "student_friendly",
  "model": "gpt-5.6-luna",
  "maxOutputTokens": 12000,
  "figureModel": "gpt-5.6-luna",
  "figureMaxOutputTokens": 4000
}
```

Response: `202 Accepted` với `jobId`.

Behavior:

- Flashcard AI sinh `front`, `back`, `solution`, difficulty và provenance;
  không sinh/ghi `hintJson` legacy.
- `front` là câu hỏi, `back` là đáp án trực tiếp, còn `solution` là phần diễn giải
  đầy đủ cho chính câu hỏi đó. Mọi thẻ phải neo vào kiến thức hoặc công thức có
  trong PDF nguồn; tình huống thực tế chỉ hợp lệ khi thật sự cần kiến thức neo.
- Bắt buộc dùng immutable draft từ endpoint preview. Nếu lesson đã có bộ,
  `targetFlashcardSetId` phải là bộ còn tồn tại trong đúng lesson; output được
  append vào bộ đó. Chỉ tự tạo `Bộ flashcard 1` khi lesson chưa có bộ nào.
- Lượt tạo nội dung trả một cờ `requiresSolutionFigure`; sau khi lưu card, backend
  chỉ enqueue một job hình lời giải khi cờ này bằng `true`.

#### `POST /admin/lessons/:lessonId/flashcard-sets/prompt-preview`

Role: `ADMIN`.

Body dùng cùng cấu hình như generate nhưng chưa cần `requestDraftId`/`requestHash`.

Behavior:

- Ghép đúng lesson documents/khoảng trang thành packet PDF xác định, dựng
  prompt/schema/request có `input_file` PDF trực tiếp, ước tính token và chi phí;
  không gọi embedding hoặc text/image provider.
- Trả `requestDraftId`, `requestHash`, prompt, OpenAI request preview, source
  context, model resolution và estimated cost để generate xác nhận đúng snapshot.

#### `POST /admin/flashcards/:flashcardId/figures/create-ai/preview`

Role: `ADMIN`. Body gồm `mode=REGENERATE|EDIT_CURRENT` (mặc định
`REGENERATE`), model/temperature/reasoning effort, yêu cầu admin và prompt
override. Endpoint dựng đúng request tạo hình lời giải, token/cost estimate và
không gọi provider. `EDIT_CURRENT` bị từ chối nếu chưa có current revision
`AI_TEX` thành công với source hợp lệ.

#### `POST /admin/flashcards/:flashcardId/figures/create-ai`

Role: `ADMIN`. Body giống preview. Response `202 Accepted` gồm `jobId`,
`figureId`, `revisionId`, `role=SOLUTION`, `mode`, `status`. Backend tạo/phục hồi
logical figure theo `(flashcardId, SOLUTION)`, tạo revision mới và enqueue queue
`FLASHCARD_FIGURE_RENDERING`. Preview, submit và worker dùng cùng request builder
với authority `solution > front`; `back` không được gửi tới model tạo hình.

Response danh sách Flashcard của admin và học sinh phải hydrate URL truy cập của
current delivery asset. Nếu storage local/R2 chưa có `FILE_PUBLIC_BASE_URL`, API
trả signed URL ngắn hạn trong `currentRevision.deliveryFile.publicUrl`; card và
modal chỉnh sửa không được hiển thị trạng thái `SUCCEEDED` nhưng để trống ảnh chỉ
vì cột `File.publicUrl` là `null`.

#### `POST /admin/flashcards/:flashcardId/figures/admin-upload`

Role: `ADMIN`. Body gồm `fileId`, `altText`, `caption?`.

- Gắn một file ảnh đã upload với purpose `QUESTION_IMAGE` vào resource Flashcard
  duy nhất role `SOLUTION`.
- Backend tạo hoặc phục hồi logical figure `(flashcardId, SOLUTION)`, tạo revision
  `ADMIN_UPLOAD` thành công và promote ngay; không gọi provider hoặc worker. Upload
  mới thay current revision nhưng không xóa lịch sử revision cũ.

#### `DELETE /admin/flashcards/:flashcardId/figures/:figureId`

Role: `ADMIN`.

- Chỉ xóa mềm resource role `SOLUTION` thuộc đúng Flashcard. File vật lý giữ
  lifecycle độc lập; upload sau đó có thể phục hồi resource và tạo revision mới.

#### `PATCH /admin/flashcard-sets/:setId`

Role: `ADMIN`.

Behavior: cập nhật title/difficulty và ghi audit log.

#### `DELETE /admin/flashcard-sets/:setId`

Role: `ADMIN`.

Behavior: soft delete và ghi audit log.

#### `POST /admin/flashcard-sets/:setId/review`

Role: `ADMIN`.

Body:

```json
{
  "reviewStatus": "APPROVED",
  "action": "PUBLISH"
}
```

Behavior:

- `action` nhận `SAVE | PUBLISH | WITHDRAW`; fallback từ `reviewStatus` chỉ giữ
  tương thích client cũ.
- `SAVE` gắn các card `APPROVED` chưa phát hành vào mốc phát hành gần nhất;
  `PUBLISH` yêu cầu ít nhất một card đã duyệt, công khai set và gắn mốc phát
  hành; `WITHDRAW` ẩn set. Mọi action ghi audit log.

### 11.2. Admin flashcard item-level CRUD

#### `POST /admin/flashcard-sets/:setId/cards`

Role: `ADMIN`.

Body:

```json
{
  "frontJson": {},
  "backJson": {},
  "solutionJson": {},
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

Rules:

- `frontJson` và `backJson` là Tiptap JSON có nội dung; công thức, ảnh có
  `alt`/`src` và bảng được tính là nội dung cấu trúc hợp lệ.
- `solutionJson` optional và có thể gửi `null`; đây là lời giải chi tiết cho câu
  hỏi ở `frontJson`, còn `backJson` chỉ là đáp án trực tiếp.
- `solutionJson` được lưu trực tiếp trên Flashcard và trả về cùng card; không tạo
  hoặc nối bản ghi `ai_explanations`.
- Difficulty của từng card chỉ nhận `EASY`, `MEDIUM`, `HARD`; server tự gán
  `sortOrder` tiếp theo nếu client không gửi.
- Tạo card tăng `flashcard_sets.card_count` trong cùng transaction và ghi audit
  log.

#### `PATCH /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior:

- Cập nhật flashcard.
- `solutionJson` được cập nhật độc lập; gửi `null` hoặc document rỗng sẽ gỡ lời
  giải chi tiết. Mọi sửa card đều thu hồi mốc phát hành của card đó.
- Ghi audit log.

#### `POST /admin/flashcards/:flashcardId/review`

Role: `ADMIN`.

Behavior: duyệt/ẩn riêng một Flashcard AI và ghi audit log; không tự cascade sang
card khác trong bộ. `solutionJson` dùng chung review status của card.

#### `POST /admin/flashcard-sets/:setId/cards/review-all-ai`

Role: `ADMIN`.

Behavior: duyệt toàn bộ card `NEEDS_REVIEW` có provenance AI trong đúng set,
đồng bộ explanation, giữ `publishedAt=null`, trả số đã duyệt/số còn chờ và ghi
audit log. Endpoint không tự lưu hoặc phát hành.

#### `DELETE /admin/flashcards/:flashcardId`

Role: `ADMIN`.

Behavior: soft delete.

- Giảm `flashcard_sets.card_count` trong cùng transaction.
- Ghi audit log.

### 11.3. Student flashcard

#### `GET /student/lessons/:lessonId/flashcard-sets`

Role: `STUDENT`.

Behavior:

- Yêu cầu lesson đã publish và student có enrollment active còn hạn cho khóa
  gốc/bản cá nhân hiệu lực, hoặc lesson bật trial.
- Chỉ trả set/card chưa xóa, set/card `APPROVED`, card có `publishedAt` và set
  không phải reserve.
- Response chứa front/back/difficulty, lời giải đã `APPROVED`,
  `progress`/`isFavorite` theo student và summary đã review/known/unknown.
- Mỗi card chỉ có thể kèm `solutionFigure` khi current revision role `SOLUTION`
  đã `SUCCEEDED`. Asset được chuẩn hóa thành `role`, `altText`, `caption`,
  `fileId`, `mimeType`, `url`; `url` là public URL hoặc signed URL ngắn hạn khi
  storage chưa cấu hình public base URL. Client render asset này trong phần lời
  giải chi tiết, không đọc cấu trúc revision/File nội bộ.

#### `GET /student/lessons/:lessonId/flashcard-history`

Role: `STUDENT`.

Behavior:

- Trả tối đa 50 session học toàn bộ hiện hành/đã hoàn thành của student trong
  lesson. Mỗi session có `id`, `setId`, `displayName` dạng `Bộ N`, `state`,
  thời gian và thống kê reviewed/known/unknown.
- Cùng một `setId` được phép có nhiều session và mỗi session vẫn là một mục
  lịch sử riêng khi UI phải tái sử dụng bộ cũ.
- `state=IN_PROGRESS` dùng nhãn `Đang làm` cùng action `Tiếp tục học`;
  `state=COMPLETED` có action xem lại toàn bộ hoặc học lại bộ đó.

#### `GET /student/flashcard-sessions/:sessionId`

Role: `STUDENT`.

Behavior:

- Chỉ owner có quyền đọc session thuộc lesson còn truy cập được.
- Trả snapshot session cùng danh sách item theo thứ tự đã chốt, gồm
  `flashcardId`, `isKnown` và `reviewedAt`, để tiếp tục đúng lượt đang học.
- Frontend lưu vị trí thẻ gần nhất theo `sessionId` trong local storage trên
  cùng trình duyệt. Session đã từng mở luôn dùng CTA `Tiếp tục học`, kể cả mọi
  item vẫn chưa đánh dấu; đóng/mở lại web không reset vị trí về thẻ đầu.

#### `POST /student/flashcard-sets/:setId/sessions`

Role: `STUDENT`.

Body:

```json
{
  "resumeExistingProgress": false
}
```

Behavior:

- Tạo session học toàn bộ mới và snapshot các thẻ approved hiện tại.
- Mặc định mọi item chưa được đánh dấu. `resumeExistingProgress=true` chỉ dùng
  cho tương thích progress legacy chưa có session.
- Chuyển các session `IN_PROGRESS` cũ của student trong lesson sang
  `CANCELLED`; session mới trở thành mục duy nhất có nhãn `Đang học`.

#### `PATCH /student/flashcards/:flashcardId/progress`

Role: `STUDENT`.

Body:

```json
{
  "isKnown": true,
  "sessionId": "uuid-optional"
}
```

Behavior:

- Upsert progress theo student/card, tăng `reviewCount` và cập nhật
  `lastReviewedAt`.
- Nếu có `sessionId`, đồng thời cập nhật item và thống kê session trong cùng
  transaction. Khi mọi item đã được đánh dấu, session chuyển sang hoàn thành.
- Completion prerequisite cần mỗi card của ít nhất một bộ được duyệt đã review
  một lần; `isKnown` dùng để tách nhóm đã thuộc/chưa thuộc.

#### `POST /student/favorites/toggle`

Role: `STUDENT`.

Behavior:

- Toggle favorite cho Quiz question hoặc Flashcard sau khi kiểm tra ownership,
  lesson access và target thuộc đúng lesson.

#### `POST /student/lessons/:lessonId/flashcard-sets/request-new`

Role: `STUDENT`.

Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---

## 12. Test API

### M6.6 shared Admin contract và compatibility

- Prefix route Test (`/admin/test-*`) được giữ tương thích, nhưng là adapter
  `kind=TEST` vào cùng Assessment/Quiz admin core. Test có cùng CRUD question,
  review/bulk review, generation JSON, publish/review, figure và solution
  refinement contract với Quiz; không có endpoint business logic Test độc lập.
- TestSet là nơi duy nhất cấu hình `durationSeconds` (`60..14400`). Modal AI,
  prompt preview và generate request **không có/không gửi `durationSeconds`**.
  Backend resolve duration server-side từ `targetTestSetId`; duration không được
  đưa vào prompt hoặc schema output. Request có `durationSeconds` hoặc
  `targetQuizSetId` bị từ chối bởi whitelist validation.
- Cùng request v2 của Quiz được dùng cho Test: `targetTestSetId` tùy chọn thay
  `targetQuizSetId`, cùng `documentIds`, question count, difficulty/counts,
  question types, model, figure model, request draft/hash. Khi lesson chưa có
  TestSet và target được bỏ trống, backend tạo `Bộ đề 1` với duration mặc định
  900 giây trước khi enqueue. Test gọi
  `/generate-ai/preview` hoặc `/prompt-preview` để nhận immutable draft trước
  khi enqueue.
- Các route tương ứng Quiz cho Test gồm
  `PATCH /admin/test-questions/:questionId/generation-json`, toàn bộ
  `/admin/test-questions/:questionId/figures/*`, và
  `/admin/test-questions/:questionId/solution-refinement[/preview]`; response,
  authorization, revision guard, polling và lỗi bám cùng contract Quiz với
  target kind `TEST`.

### 12.1. Admin test set

#### `GET /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

Behavior:

- Trả các bộ đề chưa bị xóa mềm theo `sortOrder`, rồi `createdAt` tăng dần để
  giữ ổn định thứ tự tạo của dữ liệu cũ.

#### `POST /admin/lessons/:lessonId/test-sets`

Role: `ADMIN`.

Body:

```json
{
  "title": "Bài kiểm tra ngắn",
  "durationSeconds": 900
}
```

Rules:

- `durationSeconds` bắt buộc, từ `60` đến `14400` giây.
- UI quản trị nhập thời gian theo phút rồi đổi sang giây trước khi gọi API.
- Server tự gán `sortOrder` tiếp theo trong lesson.
- Không nhận difficulty ratio, total score hoặc points như capability Admin Test
  riêng; difficulty thuộc question như Quiz.

#### `POST /admin/lessons/:lessonId/test-sets/generate-ai`

Role: `ADMIN`.

Body:

```json
{
  "targetTestSetId": "uuid",
  "documentIds": ["uuid"],
  "questionCount": 10,
  "difficulty": "MIXED",
  "difficultyCounts": { "easy": 3, "medium": 4, "hard": 3 },
  "questionTypes": [
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "MULTI_STATEMENT_TRUE_FALSE",
    "TEXT_INPUT"
  ]
}
```

Response: `202 Accepted` với `jobId`.

Behavior:

- Đây là Quiz generation v2 với target kind `TEST`: preview/prompt-preview tạo
  immutable request draft/hash trước, worker validate cùng bốn question shape,
  provenance, figure/refinement contract rồi append atomically vào TestSet đích.
- `durationSeconds` không nằm trong payload/UI/prompt. Backend lấy duration của
  `targetTestSetId` và snapshot nội bộ để kiểm tra target không đổi. Nếu lesson
  chưa có bộ và target bị bỏ trống, preview dùng mặc định 900 giây, còn enqueue
  tạo `Bộ đề 1` cùng giá trị đó; client không thể gửi hoặc ghi đè duration.
- `targetTestSetId` là tùy chọn duy nhất khi lesson chưa có TestSet. Nếu đã có
  ít nhất một bộ, request phải chọn rõ target để tránh append nhầm khi danh sách
  thay đổi giữa preview và enqueue.

#### `PATCH /admin/test-sets/:testSetId`

Role: `ADMIN`.

Body: một phần hoặc toàn bộ `title`, `durationSeconds`.

#### `DELETE /admin/test-sets/:testSetId`

Role: `ADMIN`.

Behavior: soft delete.

#### `POST /admin/test-sets/:testSetId/review`

Role: `ADMIN`.

Behavior giống Quiz: review câu không tự publish set; câu mới/sửa/duyệt có
`publishedAt=null`; `SAVE`/`PUBLISH` mới đóng dấu các câu `APPROVED`, còn
`WITHDRAW` ẩn set nhưng không xóa watermark cũ.

### 12.2. Admin test question item-level CRUD

#### `GET /admin/test-sets/:testSetId/questions`

Role: `ADMIN`.

Response/question contract giống Quiz. Persistence điểm lịch sử Test còn được
giữ cho M7 scoring, nhưng Admin M6.6 không cấu hình `points` riêng.

#### `POST /admin/test-sets/:testSetId/questions`

Role: `ADMIN`.

Body:

```json
{
  "questionType": "MULTIPLE_CHOICE",
  "questionJson": {},
  "optionsJson": {},
  "correctAnswerJson": {},
  "hintJson": {},
  "gradingConfigJson": {},
  "difficulty": "MEDIUM",
  "sortOrder": 1
}
```

Contract nội dung câu hỏi giống mục `10.2 Admin quiz question item-level CRUD`
và hỗ trợ đủ bốn loại `MULTIPLE_CHOICE`, `TRUE_FALSE`,
`MULTI_STATEMENT_TRUE_FALSE`, `TEXT_INPUT`.

#### `PATCH /admin/test-questions/:questionId`

Role: `ADMIN`.

Behavior:

- Cập nhật câu hỏi.
- Nếu nội dung/correct answer/hint thay đổi, mark explanation stale.

#### `POST /admin/test-questions/:questionId/review`

Role: `ADMIN`.

Body:

```json
{ "reviewStatus": "APPROVED" }
```

Behavior giống endpoint duyệt item-level của Quiz: chỉ duyệt câu Test được chỉ
định và lời giải liên kết, ghi audit log `TEST_QUESTION_REVIEWED`, đồng thời đưa
bộ về `APPROVED` khi không còn câu nào chờ duyệt.

#### `DELETE /admin/test-questions/:questionId`

Role: `ADMIN`.

Behavior: soft delete.

### 12.3. Student test

#### `GET /student/lessons/:lessonId/test-sets/status`

Role: `STUDENT`.

Response gồm:

```json
{
  "data": {
    "canStart": true,
    "examOpenAt": "2026-08-01T13:00:00.000Z",
    "evaluatedAt": "2026-08-01T13:01:00.000Z",
    "lockReason": null,
    "quiz": { "isRequired": true, "isCompleted": true },
    "flashcard": { "isRequired": true, "isCompleted": true },
    "bestAttempt": null,
    "sets": [
      {
        "id": "test-set-uuid",
        "title": "Kiểm tra cuối bài",
        "durationSeconds": 900,
        "totalScore": 10,
        "questionCount": 10
      }
    ]
  }
}
```

Behavior:

- Dùng cùng enrollment/trial access policy của lesson.
- Chỉ trả metadata set `APPROVED`, chưa xóa, không phải reserve và số câu đã
  duyệt; không trả nội dung câu hỏi hoặc đáp án.
- `canStart=true` chỉ khi có enrollment, đã tới giờ mở và prerequisite Quiz +
  Flashcard đều hoàn thành. Trial luôn bị khóa dù được đọc nội dung lesson.
- `lockReason` là `TRIAL_NOT_ALLOWED`, `BEFORE_OPEN_TIME`,
  `PREREQUISITES_INCOMPLETE` hoặc `null`.
- Không có content Quiz/Flashcard được duyệt thì prerequisite tương ứng chưa
  hoàn thành, `canStart=false` và `lockReason=PREREQUISITES_INCOMPLETE`.
  Endpoint không được coi content còn thiếu là tiến độ hoàn thành của student.
- `bestAttempt` là kết quả student đã chủ động dùng cho lesson.
- `latestSubmittedAttempt` là lượt Bài thi đã nộp gần nhất của student trong
  lesson, không phụ thuộc đạt hay chưa; UI dùng ID này để mở lại review sau khi
  quay về hoặc reload trang, đồng thời dùng `score` của lượt này để bật nút
  `Bài học kế tiếp` khi đạt `completionMinScore`.

#### `GET /student/lessons/:lessonId/test-history`

Role: `STUDENT`.

Behavior:

- Dùng cùng lesson access policy và chỉ trả dữ liệu của student hiện tại.
- Trả tối đa 50 lượt Bài thi đã nộp/đã chấm thuộc test set `APPROVED`, chưa
  xóa, không phải reserve; mỗi mục có attempt/set ID, `displayName` duy nhất
  dạng `Bộ đề N` theo thứ tự attempt trong lesson, trạng thái, thời gian, số câu
  đúng/tổng câu, điểm và duration. Nhiều lượt dùng chung một test set vẫn phải
  có số `N` khác nhau; mục `NOT_STARTED` nhận số kế tiếp.
- `currentItemId` luôn trỏ tới mục đầu danh sách để UI gắn đúng một nhãn
  `Bài thi hiện tại`: ưu tiên mục `NOT_STARTED` mới nếu response có mục này,
  nếu không thì trỏ tới lượt đã nộp gần nhất. Nếu test set được chọn cho lượt
  tiếp theo chưa có lượt hoàn thành, response thêm một mục `NOT_STARTED` tổng
  hợp từ metadata set để UI hiển thị `Bắt đầu bài thi`.
- Mục `COMPLETED` chỉ cho xem lại attempt tương ứng; API không cung cấp action
  làm lại từ lịch sử. Danh sách được tải lười khi student mở menu cài đặt.

#### `POST /student/lessons/:lessonId/test-attempts/start`

Role: `STUDENT`.

Behavior:

- Kiểm tra đã đến `exam_open_at`.
- Kiểm tra enrollment và prerequisite Quiz + Flashcard.
- Chọn bộ đề phù hợp.
- Tạo attempt.
- Trả câu hỏi không kèm đáp án đúng.

#### `POST /student/test-attempts/:attemptId/submit`

Role: `STUDENT`.

Body:

```json
{
  "answers": [{ "questionId": "uuid", "answerJson": {} }]
}
```

Behavior:

- Chấm điểm thang 10.
- Với `MULTI_STATEMENT_TRUE_FALSE`, `answerJson` là mảng
  `{ statementId, value }`. Nếu câu có `N` mệnh đề và `effectivePoints = P`,
  mỗi mệnh đề đúng nhận `P / N`, mệnh đề sai nhận 0; tổng điểm câu không dùng
  all-or-nothing.
- Lưu attempt answers.
- Trả `passed`; nếu đạt `lesson.completion_min_score`, cùng transaction sẽ
  cập nhật best attempt nếu tốt hơn và upsert lesson completion.
- Attempt chưa đạt chỉ được lưu vào lịch sử; không hủy completion, không
  đổi `completedAt` hoặc best attempt đã có.
- Client có thể gửi marker unanswered khi timer tự nộp; câu đó nhận 0 điểm.

#### `GET /student/test-attempts/:attemptId/review?scope=ALL|INCORRECT`

Role: `STUDENT`.

Behavior:

- Chỉ sau khi submit.
- Trả câu hỏi, answer của học sinh, correct answer, trạng thái đúng/sai. Với
  `MULTI_STATEMENT_TRUE_FALSE`, response có kết quả và điểm nhận được theo từng
  `statementId`; `isCorrect` của cả câu chỉ true khi mọi mệnh đề đều đúng.

#### `GET /student/lessons/:lessonId/leaderboard/top-tests`

Role: `STUDENT`.

Behavior:

- Trả tối đa 5 best result được hệ thống tự động ghi nhận, sort score giảm dần,
  duration tăng dần rồi thời điểm submit.

#### `POST /student/lessons/:lessonId/test-sets/request-new`

Role: `STUDENT`.

Behavior:

- Chỉ cho request khi test đã mở.
- Response giống quiz request-new: `200 EXISTING` hoặc `202 QUEUED`.

---
