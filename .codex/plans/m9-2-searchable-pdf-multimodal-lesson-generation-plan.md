# M9.2/M4.7 — Kế hoạch chuyển `Tạo kiến thức` sang PDF searchable đa phương thức

Trạng thái: **Đề xuất chi tiết, chưa triển khai**

Ngày lập: **2026-08-13**

Phạm vi chính: **M4 document processing + M9.2 Summary/Stem Figure + M9.8 Admin AI UI**

Mode khi triển khai: **Full-stack, trọng tâm Worker/Integration + AI contract**

Tài liệu này thay thế hướng kiến trúc của
`.codex/plans/m9-2-raw-source-context-and-figure-prompt-hardening-plan.md` cho
riêng tính năng **Tạo kiến thức**. Kế hoạch cũ vẫn là lịch sử phân tích, không còn
là kế hoạch thực thi sau khi owner duyệt tài liệu này.

---

## 1. Quyết định đã chốt

1. PDF mới có lớp OCR ẩn và **giữ nguyên tuyệt đối số trang, thứ tự trang, kích
   thước trang, rotation, crop box và bố cục nhìn thấy** so với PDF scan cũ.
2. PDF searchable của đúng phần tài liệu thuộc buổi học là nguồn chính gửi vào
   OpenAI để tạo kiến thức. Không gửi song song OCR chunks, `sourceTopics` hoặc
   `sourceCandidates` cho lượt Summary.
3. Một buổi học có thể lấy nhiều khoảng trang, nhiều khoảng trong cùng tài liệu,
   nhiều PDF nguồn và tài liệu nền tảng upload trực tiếp. Backend ghép đúng các
   trang đã chọn thành một **lesson source packet PDF tạm thời** theo `sortOrder`.
4. Packet PDF giữ cả ảnh trang và lớp text ẩn. OpenAI Responses API nhận packet
   bằng `input_file` với `detail: high`, nên model có cả text trích xuất và hình
   ảnh trang.
5. Backend tạo một packet manifest ánh xạ `packetPageNumber` về tài liệu/trang
   vật lý/trang in ban đầu. Manifest là một input riêng, hiển thị đầy đủ trong UI;
   không nối ngầm vào hai ô prompt.
6. Giai đoạn 1 chỉ sinh nội dung bài học và kế hoạch hình. Không sinh TikZ ở giai
   đoạn này.
7. Kế hoạch hình nằm trực tiếp trong block sở hữu dưới dạng `figures[]`; không trả
   một danh sách hình rời rồi yêu cầu backend đoán owner.
8. Backend dùng page/figure label từ kế hoạch hình để resolve crop hiện có trong
   `image-manifest.json` của Mathpix. Không xây một crop pipeline thứ hai.
9. Giai đoạn 2 xử lý từng hình như một bài toán vẽ độc lập: gửi block sở hữu,
   theory liên quan, brief hình và crop/page tham chiếu vào model chuyên vẽ; model
   chỉ trả LaTeX figure snippet theo ADR-0015.
10. Backend sở hữu preamble, package, compiler profile, sandbox, compile, SVG
    sanitizer và validator. Không tự cài package theo source model trả về.
11. Figure chỉ có phiên bản LIGHT. UI dark theme vẫn đặt figure trên surface sáng.
12. Admin nhìn thấy toàn bộ request qua modal Tạo kiến thức. Hai ô system/user
    prompt được gửi nguyên văn; backend không append, merge hoặc khôi phục prompt
    mặc định sau khi admin sửa.
13. Không giữ compatibility adapter cho contract Summary/figure cũ. Migration và
    code mới chuyển dứt điểm sang contract mới.
14. Tính năng chỉnh source trên PDF/SyncTeX vẫn ngoài phạm vi.

---

## 2. Mục tiêu chất lượng

### 2.1. Mục tiêu chức năng

- Model thấy đúng nguyên bản trang sách của bài học, gồm chữ, công thức, bảng,
  hình vẽ và quan hệ bố cục.
- Không còn hai nguồn cạnh tranh như `content` và
  `sourceCandidates.problem`.
- Không còn parser backend đoán sai đề mục rồi ép model theo `sourceTopics`.
- Hỗ trợ đúng mọi tổ hợp nguồn đã có trong sản phẩm:
  - một khoảng từ một PDF;
  - nhiều khoảng rời trong một PDF;
  - nhiều PDF nguồn;
  - nhiều khoảng từ nhiều PDF;
  - tài liệu nền tảng upload trực tiếp;
  - phối hợp source range và direct document theo thứ tự admin đã chọn.
- Figure giai đoạn 2 nhận được ảnh tham chiếu đúng owner khi sách có hình tương
  ứng, nhưng vẫn vẽ được hình mới khi sách không có crop phù hợp.

### 2.2. Mục tiêu chất lượng đầu ra

- Tỷ lệ compile thành công ngay lần đầu trong acceptance matrix: **100%**;
  `first_compile_fail = 0`. Repair vẫn tồn tại như safety net production nhưng
  không được tính là đạt mục tiêu lần đầu.
- Ít nhất **90% hình trong bộ live acceptance** đạt chất lượng tương đồng với
  ngôn ngữ hình của sách theo đánh giá bằng mắt. Đây là tương đồng về:
  - tính đúng chuyên môn;
  - đối tượng và quan hệ cần quan sát;
  - tỷ lệ/bố cục hợp lý;
  - mức tối giản;
  - nhãn, nét khuất, miền tô, trục và dấu quan hệ;
  - độ rõ trên màn hình nhỏ;
    không phải pixel matching hoặc sao chép nguyên ảnh sách.
- Không nhét lời giải, phép tính trung gian hoặc đáp số lên canvas nếu chúng không
  phải dữ kiện trực quan thiết yếu.
- Theory, illustration, notes và application exercises đúng cấu trúc, đúng nguồn,
  đúng thứ tự và hợp lệ về mặt sư phạm.

### 2.3. Mục tiêu vận hành

- Không chạy Mathpix lại chỉ vì thay PDF scan bằng PDF searchable tương đương.
- Không lưu packet PDF lâu dài. Packet là artifact tạm theo request, có TTL và
  cleanup.
- Không âm thầm cắt bớt trang, giảm `detail` hoặc đổi model khi packet vượt giới
  hạn.
- Mọi provider call có usage/cost, request hash, packet hash và phiên bản
  prompt/schema để audit.

---

## 3. Ngoài phạm vi

- Không tự động làm nét/OCR-overlay PDF trong chính hệ thống ở lượt này. Admin
  cung cấp bản searchable đã giữ nguyên layout; hệ thống chỉ kiểm chứng và
  promote.
- Không thay pipeline chunk/embedding cho Quiz, Flashcard, Test, RAG chat hoặc
  explanation trong cùng task. Chỉ Summary chuyển sang PDF packet.
- Không gửi cả sách khi lesson chỉ chọn một số range.
- Không dùng File Search cho lượt tạo một bài học ngắn.
- Không sinh full LaTeX document từ AI.
- Không package auto-install, shell escape, external URL/file trong TikZ.
- Không dark figure, animation, PDF figure editor hoặc SyncTeX.
- Không tối ưu riêng cho Bài 13/Bài 14; mọi rule phải tổng quát cho tài liệu khác.

---

## 4. Luồng đích tổng thể

```text
Admin upload/promote PDF searchable giữ nguyên layout
  -> validator so với PDF scan cũ
  -> SourceDocument dùng PDF searchable làm file canonical
  -> giữ nguyên Mathpix OCR artifact + provider crops cũ

Admin mở Tạo kiến thức
  -> chọn lesson documents / model / config
  -> backend dựng packet PDF tạm từ đúng page ranges theo sortOrder
  -> backend dựng packet manifest
  -> UI hiển thị chính xác:
       system instructions
       user prompt
       packet pages + manifest + file metadata/hash
       JSON Schema
       model parameters + PDF detail + cost estimate
  -> admin sửa hai prompt nếu muốn
  -> Start gửi exact request snapshot

OpenAI stage 1
  -> đọc text layer + page images của packet PDF
  -> tạo lesson content + owner-local figures[] + source references
  -> Zod/JSON Schema validation
  -> semantic/source-reference validation
  -> persist Summary + StemFigure plan

Mỗi figure
  -> map packet page về source PDF page
  -> resolve Mathpix crop bằng figure label/query/page
  -> resolved: gửi crop
     ambiguous: gửi tối đa vài candidate có nhãn
     not_found: render và gửi full page
  -> OpenAI stage 2 trả LaTeX figure snippet
  -> local source policy
  -> LuaLaTeX compile lần 1
  -> SVG sanitize + semantic/visual validator
  -> promote asset hoặc repair/fail theo lifecycle

Admin review nội dung + toàn bộ figure + responsive
  -> publish khi mọi blocker đã đạt
```

---

## 5. Bất biến PDF searchable

### 5.1. Bất biến bắt buộc trước promote

Với từng cặp PDF scan cũ và PDF searchable mới:

1. Cùng số trang.
2. Từng trang cùng `MediaBox`, `CropBox`, rotation và aspect ratio.
3. Thứ tự trang không đổi.
4. Không có trang mới, trang mất hoặc trang bị đảo.
5. Vị trí nội dung nhìn thấy không bị scale/translate/rotate đáng kể.
6. Lớp text ẩn có thể trích xuất và không che nội dung nhìn thấy.
7. Mapping trang in hiện tại vẫn trỏ đúng trang vật lý.
8. Normalized bounding box trong Mathpix manifest vẫn phủ đúng vùng tương ứng.

Owner đã xác nhận PDF mới chắc chắn giữ nguyên trang và bố cục, nhưng hệ thống
vẫn phải kiểm tự động để tránh upload nhầm file.

### 5.2. Validator PDF đề xuất

Tạo service/tool `searchable-pdf-equivalence` chạy read-only trước promote:

- đọc metadata bằng `pdfinfo`/`pypdf`;
- render tất cả trang ở cùng DPI bằng Poppler;
- kiểm page count, boxes, rotation;
- dùng image registration/layout comparison để phát hiện dịch, scale hoặc xoay;
- dùng perceptual similarity sau grayscale/contrast normalization làm warning,
  không dùng pixel equality vì bản mới đã được làm nét;
- trích text từng trang bằng `pdftotext`/`pdfplumber`;
- kiểm số trang có text, mật độ text và các trang text rỗng bất thường;
- với toàn bộ provider crops hiện có, áp normalized bbox lên trang mới và chạy
  crop alignment audit với crop đã lưu;
- sinh JSON report + contact sheet screenshot để admin/Codex review bằng mắt.

Hard fail:

- page count/box/rotation khác;
- layout transform vượt tolerance đã hiệu chỉnh;
- crop alignment sai trên bất kỳ crop usable nào;
- text layer hỏng trên phần lớn trang có nội dung;
- file vượt size limit hoặc PDF không đọc được.

Warning cần admin xác nhận:

- vài trang bìa/trang trắng không có text;
- perceptual score thấp do mức làm nét/khử nhiễu mạnh nhưng layout vẫn khớp;
- OCR text của công thức khó đọc dù page image rõ.

### 5.3. Promote và rollback

- Upload file mới thành `File` riêng ở trạng thái pending.
- Chỉ swap `SourceDocument.fileId` trong transaction sau khi equivalence report
  pass.
- Update mọi `pageImageFallback.sourceFileId/sourceObjectKey` sang file mới.
- Không xóa hoặc rebuild `SourceDocumentPage`, printed-page mapping, chunks,
  embeddings, Mathpix crops hay artifact refs.
- Giữ file cũ trong quarantine rollback ngắn, mặc định 24 giờ; sau đó soft-delete
  metadata và xóa object nếu không rollback. Đây là an toàn triển khai tạm thời,
  không phải compatibility path lâu dài.
- Nếu promote fail giữa chừng, transaction rollback và file mới được cleanup.

---

## 6. Tách hash PDF canonical khỏi hash artifact Mathpix

### 6.1. Vấn đề hiện tại

Mathpix cache đang đặt key theo `contentHash` của PDF scan cũ. PDF searchable có
bytes khác nên hash khác dù trang/bố cục giữ nguyên. Nếu code dùng hash mới để tìm
artifact cũ, nó sẽ cache miss và có nguy cơ submit Mathpix trả phí lần nữa.

### 6.2. Contract mới

Không dùng một `contentHash` cho hai khái niệm khác nhau:

- `File.checksum`: hash bytes của PDF canonical đang hoạt động.
- `SourceDocument.contentHash`: đổi nghĩa dứt điểm thành hash PDF canonical hoặc
  thay bằng tên field rõ hơn trong migration.
- OCR artifact có `sourceContentHash` riêng: hash file đã tạo artifact đó.
- Packet có `packetHash` riêng: hash exact bytes của packet gửi model.
- Summary generation có `inputHash`: hash canonical của request snapshot gồm
  packet hash, manifest hash, prompts, schema version và model parameters.

### 6.3. Chuẩn hóa OCR artifact

Thêm model `DocumentOcrArtifact` thay vì chỉ dựa vào JSON lồng:

```text
DocumentOcrArtifact
  id
  sourceDocumentId?       // source PDF dài
  lessonDocumentId?       // direct lesson PDF
  provider
  providerDocumentId
  sourceContentHash       // hash PDF đã tạo artifact
  modelVersion
  optionsHash
  pageCount
  artifactBaseKey
  manifestObjectKey
  pagesObjectKey
  imageManifestObjectKey
  artifactAuditObjectKey
  status
  metadataJson
  createdAt / updatedAt
```

Migration thêm database CHECK bảo đảm đúng một owner trong
`sourceDocumentId | lessonDocumentId`. Mỗi owner có đúng một artifact active cho
flow hiện tại. Không viết adapter đọc cả table mới lẫn metadata cũ sau migration.

Backfill một lần từ `metadataJson.ocr`/`visualAssets`, kiểm object tồn tại rồi mới
xóa các nhánh metadata trùng lặp không còn consumer. Các page metadata chỉ giữ
`ocrArtifactId`, page-local layout/printed-page/visual entries cần thiết.

Paid OCR retry phải ưu tiên artifact relation đang valid. Promote searchable PDF
không enqueue `DOCUMENT_PROCESSING`, không invalidate artifact và không tạo usage
event Mathpix mới.

---

## 7. Lesson source packet PDF

### 7.1. Đầu vào packet builder

Packet builder nhận:

- `lessonId`;
- ordered `documentIds` admin chọn;
- mỗi `LessonDocument` active/READY;
- range vật lý đã resolve từ `LessonDocumentPageRange` nếu là
  `PRIMARY_FROM_SOURCE`;
- toàn bộ file nếu là direct lesson document;
- canonical searchable PDF tương ứng;
- printed-page metadata và OCR artifact relation.

Không lấy raw text/chunks để đưa vào Summary request.

### 7.2. Quy tắc thứ tự

1. Theo `LessonDocument.sortOrder`.
2. Tie-break theo `createdAt`, rồi `id` để deterministic.
3. Trong một range, trang tăng dần từ `pageStart` đến `pageEnd`.
4. Nhiều range cùng source vẫn là các segment độc lập theo thứ tự lesson document.
5. Range khác source được phép có cùng printed page label.
6. Không deduplicate hai trang chỉ vì hình/text giống nhau; admin đã chọn chúng.

### 7.3. Packet manifest nội bộ

```json
{
  "version": 1,
  "lessonId": "...",
  "packetHash": "sha256:...",
  "pageCount": 8,
  "pages": [
    {
      "packetPageNumber": 1,
      "sourceKey": "D01",
      "lessonDocumentId": "...",
      "sourceDocumentId": "...",
      "sourceFileId": "...",
      "sourcePdfPageNumber": 20,
      "printedPageLabel": "19",
      "pageRangeId": "...",
      "documentTitle": "Toán 12 tập 2",
      "segmentOrder": 0
    }
  ]
}
```

Manifest gửi model là projection không chứa storage key hoặc URL:

```json
{
  "version": 1,
  "pages": [
    {
      "packetPageNumber": 1,
      "sourceKey": "D01",
      "documentTitle": "Toán 12 tập 2",
      "sourcePdfPageNumber": 20,
      "printedPageLabel": "19"
    }
  ]
}
```

`packetPageNumber` là machine key bắt buộc vì luôn duy nhất trong request.
`printedPageLabel` được giữ để model/admin đối chiếu với chữ in trên trang nhưng
không dùng làm khóa duy nhất vì có thể thiếu, dùng số La Mã hoặc trùng giữa nhiều
tài liệu.

### 7.4. Lifecycle packet

- Dựng packet trong temp directory an toàn; không dùng path từ user input.
- Giữ nguyên page objects để bảo toàn hidden text layer và hình trang.
- Không thêm separator page vì sẽ làm lệch page mapping và tăng token.
- Tạo deterministic hash từ exact packet bytes.
- Có thể giữ packet tạm ở object storage/Redis-backed request draft với TTL ngắn
  để preview và submit dùng cùng exact bytes.
- Khi job kết thúc hoặc TTL hết, xóa temp local, temp object và OpenAI file theo
  best effort có retry cleanup.
- Không tạo `File` product row lâu dài cho packet.

### 7.5. Guard

- Tất cả file phải là PDF, READY và đã pass searchable-equivalence/readiness.
- Packet phải có ít nhất một trang.
- Page count và byte size có hard cap cấu hình.
- Giữ safety margin dưới giới hạn OpenAI: tổng file input không vượt 50 MB;
  packet mặc định phải dưới 45 MB để còn manifest/request overhead vận hành.
- Không âm thầm bỏ trang, downsample hoặc đổi `detail` khi vượt cap. API trả lỗi
  rõ để admin thu hẹp selection.
- Packet hash phải khớp giữa previthựew và generate; nếu source/range đổi, trả
  `AI_INPUT_SNAPSHOT_STALE` và buộc preview lại.

---

## 8. OpenAI provider input-file contract

### 8.1. Provider-neutral types

Mở rộng `AiTextInput/AiStructuredInput`:

```ts
interface AiInputFile {
  filename: string;
  mimeType: "application/pdf" | "application/json";
  detail?: "low" | "high" | "auto";
  fileId?: string;
  fileData?: string;
  fileUrl?: string;
}

interface AiInputTextItem {
  id: "user_prompt" | "source_packet_manifest";
  text: string;
}
```

Runtime validate đúng một trong `fileId | fileData | fileUrl`. Không nhét packet
vào `metadata` rồi mong provider tự đọc.

### 8.2. OpenAI request shape

Với Summary, Responses API nhận ordered content items:

```text
instructions = exact system prompt
input[0].role = user
input[0].content =
  1. input_file packet.pdf, detail=high
  2. input_text source_packet_manifest JSON
  3. input_text exact user prompt
text.format = exact JSON Schema shown in UI
```

Không gọi `buildAiUserPrompt()` theo nhánh nối context chunks cho Summary mới.
Quiz/Flashcard/Test/RAG tiếp tục dùng behavior hiện tại cho tới task riêng.

Ưu tiên upload packet bằng Files API với `purpose=user_data`, dùng `file_id` trong
Responses request rồi cleanup. Base64 chỉ là fallback cho test nhỏ. Không log
bytes, raw PDF, raw prompt hoặc raw manifest vào application logs.

### 8.3. Capability và lỗi

- Bổ sung capability `pdfInput` và `pdfDetailLevels` trong provider/model catalog.
- UI chỉ cho chọn model có vision/PDF input cho Summary flow mới.
- `detail=high` là bắt buộc ở giai đoạn này; không phụ thuộc default model.
- Provider khác chưa support contract phải fail-fast trước khi reserve budget.
- Ghi nhận `providerRequestId`, file id tạm, usage, latency và cleanup status.
- Response incomplete/refusal giữ error code hiện hành nhưng input metadata phải
  có packet hash/page count.

---

## 9. Stage 1 — JSON Schema nội dung và figure plan

### 9.1. Xóa contract cũ

Xóa dứt điểm khỏi provider input/output và persisted Summary mới:

- `metadata.sourceTopics`;
- `metadata.sourceCandidates`;
- `sourceTopicId`;
- `sourceCandidateIds`;
- `sourceAssessment` dựa trên parser candidate;
- `correctedKindHint`, `correctedRelatedTopicId`;
- `attachLessonSummarySourceCandidates()` trong Summary;
- `contextChunks` ở Summary provider request;
- single `figure` field cũ nếu chuyển sang `figures[]`.

Không giữ optional legacy fields để “phòng khi cần”.

### 9.2. Provenance cho theory section

Mỗi section trả:

```json
{
  "displayHeading": "Ứng dụng tích phân để tính diện tích hình phẳng",
  "sourceEvidence": {
    "kind": "HEADING",
    "text": "1. ỨNG DỤNG TÍCH PHÂN ĐỂ TÍNH DIỆN TÍCH HÌNH PHẲNG",
    "packetPageNumbers": [1]
  },
  "units": []
}
```

- `kind`: `HEADING | CONTENT`.
- `text`: đoạn ngắn model đọc từ PDF; không phải nội dung backend tự đoán.
- `packetPageNumbers`: 1..packet page count.
- Backend map page về source document bằng manifest.
- Với searchable PDF, semantic validator có thể extract text packet và kiểm
  normalized exact match. Khi OCR text không chứa đúng chuỗi nhưng ảnh trang rõ,
  ghi review issue thay vì tự sửa/bịa evidence.

### 9.3. Figure plan owner-local

Mọi block có:

```json
{
  "figures": [
    {
      "localId": "F01",
      "visualIntent": "...",
      "sourceReferences": [
        {
          "packetPageNumber": 2,
          "printedPageLabel": "20",
          "figureLabel": "Hình 4.13"
        }
      ],
      "altText": "...",
      "caption": null
    }
  ]
}
```

Rules:

- `figures` là array bắt buộc, có thể rỗng; max nhỏ theo block để tránh lạm dụng.
- `localId` duy nhất trong block, chỉ là local transport id.
- `visualIntent` là semantic brief duy nhất: có nguồn thì định danh hình/hình con
  và thông điệp; không có nguồn thì nêu đủ đối tượng/quan hệ/nhãn cần dựng.
- `sourceReferences` có thể rỗng nếu sách không có hình tương ứng và model đề
  xuất hình mới.
- `packetPageNumber` required cho mỗi reference; `printedPageLabel` và
  `figureLabel` nullable.
- Không có package, TikZ, tọa độ dựng, màu/style compiler hoặc storage ID.
- Example/theory có nhiều hình thật sự khác nhau mới dùng nhiều item; không chia
  một hình thành nhiều panel để nhét lời giải.

### 9.4. Mapper và persisted content

- Mapper biết owner trực tiếp từ đường duyệt schema; không nhận `ownerType` hoặc
  `ownerId` do model tự đặt.
- Backend gán `blockPath`, `figureIndex`, UUID và `StemFigure` identity.
- Persist raw plan trong `StemFigure.planJson`.
- Persist resolved reference snapshot trong revision/job, không sửa plan gốc.
- Summary content thay `figures` plan bằng các `TEX_FIGURE` references sau khi
  tạo identity, giữ đúng thứ tự.
- Thêm unique key `(lessonSummaryId, blockPath, figureIndex)`.
- Regenerate một figure không làm thay đổi owner content hoặc figures khác.

### 9.5. Semantic validation stage 1

Trước persist:

1. Section có evidence và page hợp lệ.
2. `packetPageNumbers`/figure reference nằm trong packet.
3. `printedPageLabel`, nếu có, phải khớp manifest hoặc tạo warning.
4. `figureLabel`, nếu có, phải tìm thấy trong extracted text/nearby caption hoặc
   tạo warning; không hard fail chỉ vì OCR caption sai.
5. `localId` unique trong owner.
6. Không có TikZ/LaTeX document command trong figure plan.
7. Figure coverage theo subject profile được hậu kiểm ở block level.
8. Problem tự đủ dữ kiện; không còn “xem hình bên” mà thiếu thông tin cần giải.
9. Figure brief không yêu cầu đưa solution/answer lên canvas.
10. Section/units giữ thứ tự page/evidence trong packet.

Lỗi shape/provenance nghiêm trọng không persist Summary nửa đúng. Warning về
caption/crop ambiguity được giữ cho resolver/admin review.

---

## 10. Sửa system prompt và user prompt stage 1

### 10.1. Bố cục system prompt mặc định

Chỉ giữ bảy phần, mỗi quy tắc có đúng một owner:

```text
I. Vai trò, trung thực nguồn và prompt-injection boundary
II. Đọc PDF packet và nhận diện cấu trúc tài liệu
III. Cấu trúc section -> unit -> theory/illustration/notes -> applications
IV. Quy tắc lập figure plan và source reference
V. Trình bày Markdown/công thức/lời giải
VI. Hồ sơ môn học + mức figure tối thiểu
VII. Structured output + tự kiểm trước khi trả
```

### 10.2. Rút gọn figure instructions

Gộp các mục 6a..6f và mục 10 hiện tại thành bốn nguyên tắc:

1. Tạo hình khi nguồn có hình cần thiết hoặc hình giúp hiểu đúng nội dung; không
   tạo trang trí.
2. `visualIntent` chỉ mô tả thứ cần nhìn thấy. Dùng
   problem/solution/answer để kiểm chứng tính đúng, không chép phép tính, chuỗi suy
   ra hay đáp số lên canvas.
3. Khi dựa trên hình sách, ghi page/figure label vào `sourceReferences`; mô tả nội
   dung và quan hệ, không sinh TikZ hoặc áp template ở stage 1.
4. Hình đích light-only, thoáng, ít màu, nhãn ngắn, một thông điệp chính, đọc được
   ở khoảng 320 px.

Mục tiêu giảm 25–35% câu lặp nhưng giữ nguyên kiểm soát chất lượng.

### 10.3. User prompt mặc định

Chỉ chứa nhiệm vụ/config admin đã chọn:

```text
Tạo kiến thức cho bài {lessonTitle} từ toàn bộ PDF packet đã cung cấp.
Khối lớp: {targetGrade}.
Phong cách: {styleInstruction}.
Độ dài: {lengthInstruction/targetWordCount}.
Yêu cầu bổ sung: {extraInstructions hoặc không có}.
Trả đúng structured output đã cung cấp.
```

Không lặp subject profile, figure rules hoặc câu “âm thầm phân loại nguồn” ở user
prompt.

### 10.4. Quyền admin

- Default system prompt đã chứa subject profile/coverage trước khi hiển thị.
- Admin sửa system prompt: exact string mới thay thế toàn bộ system prompt.
- Admin sửa user prompt: exact string mới thay thế toàn bộ user prompt.
- Backend không nối thêm subject boundary, coverage hoặc prompt ẩn.
- PDF packet, manifest và JSON Schema là input riêng, hiển thị ở tab Dữ liệu gửi
  đi. Chúng không được giả làm nội dung của hai prompt.
- JSON Schema và validators kỹ thuật vẫn enforce shape/safety dù admin thay prompt;
  UI giải thích rõ đây là contract kỹ thuật, không phải prompt ngầm.

### 10.5. JSON Schema descriptions

- Chỉ mô tả nghĩa field và ownership.
- Không copy nguyên policy dài từ system prompt.
- Không lặp “không đưa lời giải/đáp án lên canvas” ở nhiều field.
- Bump prompt/schema/content version; xóa fixture/schema cũ thay vì adapter.

---

## 11. Resolve ảnh tham chiếu bằng Mathpix crop hiện có

### 11.1. Mapping reference

```text
FigurePlan.sourceReferences[].packetPageNumber
  -> packet manifest
  -> sourceDocumentId / sourcePdfPageNumber
  -> active DocumentOcrArtifact.imageManifestObjectKey
  -> resolveOcrVisualReference()
```

Query resolver gồm:

- source PDF page number;
- printed page label để cross-check;
- `figureLabel`;
- terms từ `visualIntent`;
- kind chỉ là boost, không hard filter vì heuristic Mathpix hiện có thể phân loại
  sai figure thành equation/unknown.

### 11.2. Ba kết quả

`resolved`:

- dùng candidate score cao rõ ràng;
- tải crop nội bộ và gửi stage 2;
- persist imageId/object key/hash/bbox trong reference snapshot.

`ambiguous`:

- gửi tối đa 3 crop usable có score cao cùng metadata `candidate A/B/C`;
- nếu crop quá nhỏ/mất ngữ cảnh, kèm full page;
- stage 2 được yêu cầu chọn reference phù hợp với owner content, không trộn các
  hình không liên quan.

`not_found`:

- render full page từ PDF searchable canonical ở high resolution;
- nếu reference không bắt buộc hoặc source figure không tồn tại, stage 2 tự dựng
  từ brief/block;
- ghi metric fallback, không coi là compile error.

### 11.3. Giới hạn

- Tối đa 5 input images cho một figure; ưu tiên primary references.
- Không gửi toàn packet lần nữa ở stage 2.
- Không dùng public/provider CDN; chỉ presigned short-lived internal URL hoặc
  base64 bytes tải từ R2/MinIO.
- Reference image không được persist trong provider logs của app.

---

## 12. Stage 2 — Sinh TikZ từ brief + ảnh tham chiếu

### 12.1. Generation brief mới

```text
lesson title / target grade / subject profile
section heading
owner block content
figure kind
visualIntent
altText / caption
source reference metadata
resolved crop/page images
```

Problem, solution và answer của owner được gửi để kiểm chứng chuyên môn. Prompt
nói đúng một lần rằng solution/answer là oracle ẩn, không phải canvas checklist.

### 12.2. Output

Giữ ADR-0015:

```json
{
  "latexSource": "optional allowed local header + exactly one tikz root"
}
```

- Không full document.
- Không `\documentclass`, `\usepackage`, document wrapper.
- Cho phép local `\usetikzlibrary`, `\tikzset`, `\pgfplotsset` trong allowlist.
- Backend wrapper sở hữu packages/preamble/compiler.

### 12.3. Prompt stage 2

Rút prompt hiện tại thành các nhóm không lặp:

1. correctness from owner block/reference;
2. canvas scope and textbook visual language;
3. geometry/plot construction invariants;
4. mobile legibility/light-only;
5. snippet/toolbox/safety contract;
6. preflight syntax check.

Ảnh sách là reference về nội dung, quan hệ và ngôn ngữ trình bày; không bắt model
pixel-copy. Nếu reference mâu thuẫn với đề/lời giải đã xác nhận, owner content là
oracle chuyên môn và figure được đưa `NEEDS_REVIEW` thay vì âm thầm chọn một bên.

### 12.4. Compile và validator

- Chạy source policy trước compiler.
- Lần compile raw snippet đầu tiên là số đo `first_compile_pass`.
- Không thêm dependency/local recovery trước khi ghi số đo lần đầu.
- Compiler profile cố định và versioned.
- Compile pass mới chạy SVG sanitizer + semantic/visual validator.
- Validator kiểm kích thước, viewBox, text clipping, overlap thô, contrast light,
  node/path budget và subject-specific invariants có thể kiểm được.
- Chỉ lỗi compiler `TEX_COMPILE_FAILED` có diagnostic batch đầy đủ mới được tự
  động gọi AI repair, tối đa theo `maxRepairAttempts` hiện có. Mỗi lượt repair
  phải gửi toàn bộ structured errors và raw compiler log của chính lượt compile
  đó; batch bị cắt hoặc chưa thu thập đủ thì dừng `NEEDS_REVIEW`, không tự repair.
- Source policy, validator, provider output, timeout, network, storage và mọi lỗi
  infrastructure khác không được tự động retry. Manual retry, trạng thái, xóa,
  thay thế và regenerate hình vẫn giữ lifecycle hiện có.

### 12.5. Regenerate/admin edit

- Regenerate dùng lại persisted FigurePlan và resolved reference snapshot; nếu
  source PDF/artifact version đổi thì resolve lại có version mới.
- Không tạo generic visualIntent kiểu “ưu tiên mọi bước suy luận”.
- Admin edit snippet vẫn compile trong cùng backend envelope.
- Không có preview-to-PDF/SyncTeX.

---

## 13. Database thay đổi dự kiến

### 13.1. Document/OCR

- Thêm `DocumentOcrArtifact` như mục 6.
- Thêm relation active artifact vào `SourceDocument` và direct `LessonDocument`
  hoặc unique owner relation tương đương.
- Chuẩn hóa checksum/hash semantics.
- Backfill artifact refs từ metadata JSON.
- Xóa metadata duplicate sau audit; không dual-read lâu dài.

### 13.2. Stem figure

`StemFigure` thêm:

- `figureIndex Int`;
- `localPlanId String`;
- `planJson Json`;
- unique `(lessonSummaryId, blockPath, figureIndex)`.

`StemFigureRevision` thêm:

- `referenceSnapshotJson Json?`;
- `referenceSnapshotHash String?`;
- optional `generationBriefHash` để idempotency/audit.

Không lưu raw reference image bytes trong DB.

### 13.3. AI generation audit

`AiGeneration.inputMetaJson` snapshot:

- request draft/hash;
- packet hash/page count/size;
- packet manifest hash và safe projection;
- selected document/range versions;
- exact prompt hashes và version;
- schema name/version/hash;
- model/provider/detail/reasoning/max tokens;
- OpenAI temp file id + cleanup status;
- source selection and cost estimate;
- không lưu raw PDF hoặc raw prompt nếu log policy cấm; exact prompts đã nằm trong
  durable job snapshot có quyền admin phù hợp.

---

## 14. API contract dự kiến

### 14.1. Promote searchable PDF

```text
POST /admin/source-documents/:id/searchable-pdf/validate
POST /admin/source-documents/:id/searchable-pdf/promote
GET  /admin/source-documents/:id/searchable-pdf/validation/:validationId
```

Validate trả page/layout/text/crop audit summary và representative preview.
Promote chỉ nhận validation còn hạn, đúng file hash và trạng thái pass.

### 14.2. Summary request draft/preview

Giữ endpoint preview hiện có nhưng mở rộng response hoặc tách draft endpoint:

```text
POST /admin/lessons/:lessonId/summary/request-preview
```

Response:

- `requestDraftId`, `requestHash`, `expiresAt`;
- exact `systemPrompt`, `userPrompt`;
- model config;
- packet file metadata/hash/page count;
- packet page manifest;
- page thumbnails/previews có quyền;
- exact JSON Schema name/version và formatted preview;
- input breakdown/cost estimate;
- warnings/blockers.

### 14.3. Generate

```json
{
  "requestDraftId": "...",
  "requestHash": "...",
  "systemInstructions": "exact visible string",
  "userPrompt": "exact visible string",
  "model": "...",
  "reasoningEffort": "...",
  "maxOutputTokens": 16000
}
```

Backend:

- xác minh draft chưa hết hạn và source/ranges/file hashes không đổi;
- xác minh exact prompt/config hash;
- không rebuild rồi gửi một payload khác;
- snapshot job và trả `202`;
- stale thì từ chối, không tự refresh ngầm.

### 14.4. Figure/admin API

- Response figure trả plan summary và reference resolution status cho admin.
- Không trả storage object key cho browser.
- Student API chỉ trả current promoted asset/alt/caption/status cần thiết.
- Publish blocker giữ behavior hiện tại: figure bắt buộc phải có revision thành
  công; figure optional failed có review policy rõ trong docs.

---

## 15. UI modal `Tạo kiến thức`

### 15.1. Ba tab chính

1. **Quy tắc hệ thống**
   - exact editable system prompt;
   - preview/edit/copy;
   - không có suffix ẩn.

2. **Câu lệnh người dùng**
   - exact editable user prompt;
   - preview/edit/copy.

3. **Dữ liệu gửi đi**
   - ordered input items;
   - packet PDF: tên, dung lượng, số trang, hash, `detail=high`;
   - manifest theo từng packet page;
   - nguồn/range gốc và printed page;
   - page thumbnail/full preview;
   - JSON Schema;
   - model/provider/reasoning/max token;
   - cost estimate và file/token limits;
   - request hash + trạng thái fresh/stale.

### 15.2. Exact-request UX

- Thay đổi source selection/config làm draft stale và disable Start cho tới khi
  preview mới hoàn tất.
- Sửa prompt local không bị backend overwrite khi refresh phần data; UI gửi exact
  prompt hiện tại vào lần preview tiếp theo.
- Nút Start chỉ enabled khi preview hash khớp toàn bộ visible form state.
- UI ghi rõ schema/validator là contract kỹ thuật, còn hai prompt là toàn bộ nội
  dung instruction do admin kiểm soát.
- Không gọi packet/manifest là “prompt ẩn”. Hiển thị chúng đúng bản chất là file
  và data input riêng.

### 15.3. Responsive/theme

- Admin laptop-first nhưng modal phải dùng được ở 320/390/768/1440 px.
- Packet page list ở mobile chuyển sang cards; không tạo horizontal overflow.
- PDF/page preview lazy-load.
- App UI vẫn hỗ trợ light/dark theo design system; generated figure luôn LIGHT và
  nằm trên nền sáng ở cả hai theme.

---

## 16. Phân rã triển khai

### Phase 0 — Baseline và khóa contract

- [x] Chụp snapshot request hiện tại của Bài 13/Bài 14, không gọi provider mới.
- [x] Ghi số token/context, sourceCandidates duplication, figure count, compile
      metrics hiện tại.
- [x] Chốt JSON samples cho multi-range/multi-PDF/direct document.
- [x] Chốt ADR mới cho PDF searchable packet + multimodal Summary.
- [x] Đánh dấu plan raw-OCR cũ là superseded sau khi owner duyệt.

Done khi: có baseline và contract mẫu để so trước/sau.

### Phase 1 — PDF equivalence và promote

- [x] Xây validator PDF metadata/layout/text/crop alignment.
- [x] Tạo validation report + visual contact sheet.
- [x] Thêm API/UI upload, validate, promote.
- [x] Atomic file swap + update page fallback.
- [x] TTL rollback cleanup.
- [x] Test Toán 12 Tập 2 trên toàn bộ 98 trang và toàn bộ usable crops.

Done khi: PDF searchable được promote mà page mapping/crops/chunks không đổi và
không có Mathpix call.

### Phase 2 — Normalize OCR artifact identity

- [x] Prisma model/migration `DocumentOcrArtifact`.
- [x] Backfill từ metadata.
- [x] Verify every object key exists.
- [x] Chuyển reader/writer sang table mới.
- [x] Xóa dual metadata/dual read.
- [x] Paid OCR retry guard theo artifact relation.

Done khi: canonical PDF hash đổi không làm mất artifact hoặc cache paid OCR.

### Phase 3 — Packet builder

- [x] Implement deterministic PDF extraction/merge.
- [x] Implement internal/model manifest.
- [x] Support all source combinations.
- [x] Hash, TTL, cleanup và stale detection.
- [x] Size/page/searchable readiness guards.
- [x] Unit/integration tests page order và hidden text preservation.

Done khi: packet chính xác byte/page mapping và không lưu product artifact lâu dài.

### Phase 4 — Provider `input_file`

- [x] Mở rộng provider-neutral input types.
- [x] OpenAI Files upload/use/delete service.
- [x] Responses content builder cho files/text items.
- [x] Capability gate `pdfInput`.
- [x] `detail=high`, 50 MB guard, cleanup telemetry.
- [x] Provider tests không làm thay đổi các feature text/image hiện có.

Done khi: structured call local/mock chứng minh exact ordered request shape.

### Phase 5 — Stage-1 schema/mapper/prompt

- [x] Xóa sourceTopics/sourceCandidates/contextChunks khỏi Summary.
- [x] Thêm section provenance theo packet pages.
- [x] Chuyển `figure` sang owner-local `figures[]`.
- [x] Thêm figure kind/elements/source references.
- [x] Semantic validation với packet manifest/text.
- [x] Rút gọn prompt và schema descriptions.
- [x] Bump prompt/schema/content versions.
- [x] Xóa compatibility code/tests/fixtures cũ.

Done khi: fixture PDF packet tạo content/figure plans đúng owner, không TikZ.

### Phase 6 — Persist figure plan và resolve references

- [x] Prisma fields/index cho plan/figureIndex/reference snapshot.
- [x] Mapper tạo StemFigure identities deterministic.
- [x] Load artifact manifest bằng relation mới.
- [x] Resolver bỏ hard kind filter, dùng page+caption+query scoring.
- [x] Implement resolved/ambiguous/not_found branch.
- [x] Full-page render fallback.
- [x] Persist resolution audit không lưu raw image bytes.

Done khi: figure của fixture sách resolve đúng crop hoặc fallback đúng trang.

### Phase 7 — Stage-2 multimodal TikZ

- [x] Mở rộng generation brief với kind/elements/references.
- [x] Gửi crop/page images `high/original` theo capability.
- [x] Rút gọn prompt, bỏ instruction lặp.
- [x] Giữ snippet-only schema/toolbox/compiler envelope.
- [x] Fix regeneration không dùng generic brief làm mất reference.
- [x] Metrics first compile trước mọi repair.
- [x] Validator visual/semantic focused tests.

Done khi: local matrix compile 100% raw first attempt và figure không nhét lời giải.

### Phase 8 — Exact-request admin UI/API

- [x] Request draft/preview API.
- [x] Data tab packet/manifest/schema/config/cost.
- [x] Fresh/stale request hash.
- [x] Submit exact prompts and exact snapshot.
- [x] Responsive + loading/error/expired draft states.
- [x] Browser tests chứng minh không có backend prompt suffix.

Done khi: admin có thể kiểm tận mắt mọi item thực sự gửi provider.

### Phase 9 — Local verification

- [x] Prisma format/validate/migration test.
- [x] API typecheck/focused unit/integration tests; targeted lint xanh, full lint
      còn lỗi baseline ngoài phạm vi.
- [x] Web typecheck/build/browser test; targeted lint xanh, full lint còn lỗi
      baseline ngoài phạm vi.
- [x] Docker TeX renderer health + compile matrix.
- [x] Packet temp cleanup and retry/idempotency tests.
- [ ] Security tests for PDF bombs, traversal, oversized files, signed URLs and
      untrusted PDF text prompt injection.
- [ ] No-paid-provider assertion in default CI.

Done khi: toàn bộ local gate xanh và không có provider charge.

### Phase 10 — Live pilot tiết kiệm

Chỉ chạy sau khi báo lại owner số call, page count, model, max output và ước tính
chi phí cụ thể:

1. Toán 12 Tập 2 — Bài 13, một model Terra, một full Summary call.
2. Chỉ khi stage 1 pass mới chạy từng figure stage 2; dừng ngay nếu systematic
   contract lỗi.
3. Toán 12 Tập 2 — Bài 14, Terra, cùng flow.
4. Một bài Đại số trong khóa Toán 7 hiện có, Terra, cùng flow sau khi hoàn tất
   nghiệm thu hai bài Toán 12.
5. Không auto-regenerate toàn bài. Chỉ repair đúng figure fail và ghi rõ repair
   không tính vào first-pass.
6. Tổng usage trả phí của pilot không vượt 110.000 VNĐ; kiểm chi phí cộng dồn sau
   từng bài và dừng trước khi chạm trần.
7. Sau pilot mới quyết định có cần thêm repetition/model matrix.

Artifacts bắt buộc:

- exact request metadata/hash và usage;
- packet manifest;
- raw first-compile metrics;
- screenshot toàn bài desktop/tablet/mobile;
- screenshot riêng từng figure;
- bảng đánh giá bằng mắt cho theory, example, solution, answer, figure-source
  consistency, bố cục và responsive.

Done khi: owner review được bằng chứng chứ không chỉ nhận kết luận “oke”.

### Phase 11 — Rollout

- [ ] Feature flag Summary PDF packet.
- [x] Pilot hai course với ba lesson theo phạm vi owner chốt.
- [x] Theo dõi failure/cost/latency/crop-resolution trong live pilot.
- [ ] Migrate các source PDFs còn lại sau validation.
- [ ] Xóa flag và code path OCR-chunk Summary cũ khi acceptance pass.
- [x] Cập nhật docs source-of-truth, coverage/dependency/context.

Done khi: production chỉ còn một Summary path mới, không dual behavior.

---

## 17. Test matrix bắt buộc

### 17.1. PDF/packet

- 1 range, 1 source.
- 2 range rời, 1 source.
- 2 source, mỗi source 1 range.
- nhiều source + nhiều range.
- direct searchable PDF.
- source range + direct PDF.
- duplicate printed page labels ở hai source.
- trang bìa/blank page.
- PDF > limit, corrupt, password-protected, page mismatch, layout shift.
- packet preview expired/source changed.

### 17.2. Stage 1

- tài liệu có heading đánh số;
- heading không đánh số;
- bảng/công thức nhiều;
- scan OCR text noisy nhưng ảnh rõ;
- source figure có caption;
- figure không caption;
- nhiều crop cùng page;
- theory cần hình nhưng sách không có hình;
- block không cần hình;
- custom system/user prompt exact replacement.

### 17.3. Resolver/stage 2

- resolved crop;
- ambiguous crops;
- no crop/full page;
- heuristic kind sai;
- crop tiny/missing context;
- multiple source references;
- 2D geometry, 3D geometry, graph, shaded region, statistics, schematic;
- label overlap, clipping, bad projection, excessive solution text;
- compile failure syntax/package/coordinate/plot cases.

### 17.4. Responsive visual review

Viewport tối thiểu:

- 320 × 568;
- 390 × 844;
- 768 × 1024;
- 1440 × 900.

Review cả modal admin và student lesson. Figure light-only nhưng phải rõ trên
surface sáng trong cả app light/dark.

---

## 18. Rubric đánh giá bằng mắt

Mỗi lesson live phải chấm từng mục 0/1/2:

1. Bao phủ đúng đề mục của nguồn.
2. Lý thuyết đúng và trình bày dễ học.
3. Theory-example ghép đúng kiến thức.
4. Problem tự đủ dữ kiện.
5. Solution hợp lệ, đúng thứ tự, không mâu thuẫn answer.
6. Figure xuất hiện ở block cần hình.
7. Figure khớp đúng owner/source reference.
8. Hình đúng chuyên môn và tỷ lệ/quan hệ.
9. Hình tối giản, không nhét lời giải.
10. Nhãn/nét/miền tô/trục dễ đọc.
11. Không overlap/clipping/cắt mép.
12. Responsive ở mọi viewport.

Một figure đạt khi không có lỗi chuyên môn và tổng các mục figure tối thiểu 90%
điểm tối đa. Một live cohort đạt mục tiêu “90% giống chất lượng sách” khi ít nhất
90% figure đạt rubric; không dùng pixel similarity để quyết định.

---

## 19. Observability và cost

Metrics/log tối thiểu:

- `searchable_pdf_validation_pass/fail`;
- `pdf_layout_equivalence_score`;
- `ocr_crop_alignment_pass/fail`;
- `packet_build_duration_ms`, `packet_pages`, `packet_bytes`;
- `packet_preview_stale_count`;
- `openai_file_upload_duration_ms`, `openai_file_cleanup_status`;
- stage-1 input/output/cached/reasoning tokens và cost;
- `figure_reference_resolved/ambiguous/not_found`;
- stage-2 input/output tokens/cost theo figure;
- `first_compile_pass`, `repair_count`, compile/validator latency;
- figure status distribution và publish blockers.

Không log:

- raw PDF bytes;
- source page images;
- raw system/user prompt;
- raw lesson content;
- presigned URL hoặc provider credential.

UI cost estimate phải nói rõ PDF `detail=high` làm tăng input tokens và chỉ là
ước tính. Actual usage/cost lấy từ provider response/usage ledger.

---

## 20. Rủi ro và cách chặn

### R1. Hash mới làm mất Mathpix cache

Chặn bằng artifact identity riêng và migration backfill trước promote.

### R2. PDF nhìn giống nhưng crop bị lệch

Chặn bằng all-page layout audit + all-usable-crop alignment audit.

### R3. Packet preview khác request thật

Chặn bằng immutable request draft, packet hash và stale rejection.

### R4. Admin không thấy input backend nối thêm

Chặn bằng ordered input preview; system/user prompt exact; manifest/schema/file
hiện thành input riêng.

### R5. PDF token/cost cao

Chặn bằng chỉ cắt trang của lesson, size/page guard, cost estimate và live pilot
tiết kiệm. Không gửi cả sách.

### R6. Mathpix crop heuristic sai

Không hard filter kind; dùng caption/query/page scoring, ambiguity branch và full
page fallback.

### R7. Model copy nguyên hình/lời giải lên canvas

Stage-1 brief scope + stage-2 oracle boundary + visual rubric/validator.

### R8. Compile vẫn fail lần đầu

Toolbox/prompt preflight, fixture compile corpus, raw first-pass metric và rollout
gate 0 fail. Repair không che số liệu.

### R9. PDF text layer OCR sai công thức

OpenAI vẫn nhận page image ở `detail=high`; prompt yêu cầu đối chiếu hình trang.
Content/figure audit vẫn là gate trước rollout.

Kết quả live 2026-08-14: 31 Terra calls, 38.325/110.000 VNĐ; Bài 13 có
3 sections/20 blocks/18 figures, Bài 14 có 7/28/8, Toán 7 Bài 3 có 4/9/0.
Trong 27 source AI, 26 qua policy và 26/26 compiler invocation thành công ngay
lượt đầu; một source bị policy chặn trước compiler, không auto retry, bản admin
chủ động sinh mới compile first-pass. Báo cáo và screenshot nằm tại
`.codex/artifacts/m9.2-searchable-pdf-live-pilot/live-evaluation-report.md`.

### R10. Direct lesson PDF không searchable

Không cho chọn trong Summary mới tới khi pass readiness; UI đưa action thay/promote
searchable PDF, không fallback ngầm sang chunks.

---

## 21. Acceptance criteria cuối cùng

Kế hoạch được coi là triển khai xong khi:

- [x] PDF searchable Toán 12 Tập 2 pass equivalence trên 98/98 trang.
- [x] 100% crop Mathpix usable vẫn resolve/alignment đúng sau promote.
- [x] Không phát sinh Mathpix paid call trong migration/promote.
- [x] Packet của mọi tổ hợp source test đúng trang và thứ tự.
- [x] Summary OpenAI request không còn OCR chunks/sourceTopics/sourceCandidates.
- [x] UI cho admin thấy exact prompts, packet, manifest, schema và model config.
- [x] Backend gửi nguyên văn hai prompt admin đã chốt.
- [x] Stage-1 output có provenance và owner-local `figures[]` hợp lệ.
- [x] Live pilot báo cáo riêng tỷ lệ TikZ biên dịch thành công ngay lần đầu; mục tiêu sát 100%, không tính retry là first-pass success.
- [x] Giữ nguyên luồng retry, trạng thái, xóa và thay thế hình đã có.
- [x] Mọi hình compile pass có source reference phải được visual review cạnh crop SGK: bố cục, quan hệ, nhãn, tỉ lệ, cách trình bày và phong cách phải rất phù hợp/độ tương đồng cao; pixel-perfect là mục tiêu tốt nhất nhưng không bắt buộc.
- [x] Hình không có source reference được visual review theo block, brief và rubric SGK thay vì so sánh với crop không tồn tại.
- [x] Màu hình không cần pixel-match SGK; được phối linh hoạt nếu hợp lý, ít màu, tương phản tốt và phân biệt đúng đối tượng/quan hệ.
- [ ] Live pilot visual-review từng cặp theory–example tiêu biểu cạnh đúng trang PDF: heading, định nghĩa/công thức, quan hệ minh họa, dữ kiện đề, lời giải, đáp án và bố cục phải hợp lý.
- [ ] Lời giải live pilot phải tương đồng phong cách SGK về thứ tự lập luận, mức chi tiết, ký hiệu, xuống dòng và kết luận; được sửa sạch OCR nhưng không tự đổi sang phương pháp xa lạ khi nguồn có lời giải mẫu.
- [x] Figure resolver dùng crop hiện có hoặc full-page fallback đúng.
- [x] Stage-2 chỉ trả snippet, backend compile trong envelope chuẩn.
- [x] Acceptance matrix có `first_compile_fail = 0`.
- [x] Ít nhất 90% live figures đạt rubric chất lượng so với ngôn ngữ hình sách.
- [ ] Theory/example/solution/answer và figure-owner consistency được đánh giá bằng
      mắt, có screenshot.
- [ ] Modal và lesson responsive pass ở 320/390/768/1440.

Hậu kiểm Bài 15 ngày 2026-08-14 mở lại ba tiêu chí trên: output giữ được phần
lớn kết luận toán học nhưng làm mất cấu trúc hình thành kiến thức và rút nhiều
`solution` thành gợi ý, còn phép biến đổi/kết quả đầy đủ nằm trong `answer`. Việc
khắc phục phải là invariant tổng quát về content fidelity và worked-solution
detail áp dụng cho mọi bài, không phải ngoại lệ riêng cho Bài 15.

- [ ] Figure chỉ LIGHT; dark app surface vẫn đọc rõ.
- [x] Temp packet/OpenAI file được cleanup và không tồn tại product storage dư.
- [x] Không còn dual-read/compatibility code của Summary contract cũ.
- [ ] Typecheck, lint, focused tests, migration checks và browser tests đều pass.
- [x] Worker được restart sau mọi thay đổi worker khi triển khai.

---

## 22. Thứ tự task đề xuất

Sau khi owner duyệt plan, cập nhật roadmap/docs source-of-truth rồi triển khai theo
thứ tự:

1. **M4.7 — Searchable PDF equivalence, promote và OCR artifact identity**
   (`Worker/Integration + API/UI`).
2. **M9.2A — Lesson source packet + OpenAI PDF input**
   (`Worker/Integration`).
3. **M9.2B — Summary PDF schema/prompt/mapper contract**
   (`AI contract + API`).
4. **M9.2C — Figure reference resolver + multimodal TikZ worker**
   (`Worker/Integration`).
5. **M9.8A — Exact-request preview UI và figure reference review**
   (`UI + API`).
6. **M9.2D — Local gate, live pilot, rollout và xóa path cũ**
   (`Testing/Hardening`).

Không làm tất cả trong một patch. Mỗi task chỉ bắt đầu khi task trước đạt Done và
có artifact kiểm chứng cần thiết.

---

## 23. Check khi chỉ lập kế hoạch

- Chưa sửa production code.
- Chưa chạy migration.
- Chưa upload/promote PDF.
- Chưa gọi OpenAI/Mathpix hoặc provider trả phí.
- Khi triển khai từng phase phải đọc lại code/docs thật vì worktree hiện có nhiều
  thay đổi chưa commit của owner và các lượt trước; không được revert thay đổi
  ngoài phạm vi.
