# M9.2 — Kế hoạch tối giản context nguồn và prompt hình minh họa

Trạng thái: **Superseded bởi `m9-2-searchable-pdf-multimodal-lesson-generation-plan.md`**

Ngày lập: 2026-08-13

Task sở hữu: **M9.2**

Mode khi triển khai: **Full-stack có trọng tâm Worker/Integration + AI contract**

## 1. Quyết định chốt

Summary gửi OpenAI đúng các OCR chunk đã được retrieval chọn, giữ nguyên mạch
`content` của từng chunk và chỉ kèm metadata khách quan tối thiểu.

Backend không chia `content` thành nhiều source block nhỏ và không gửi bất kỳ lớp
suy luận tiền xử lý nào như:

- `sourceTopics`;
- `sourceCandidates`;
- `sourceTopicId`;
- `relatedTopicIdHint`;
- `kindHint`, `pedagogyHint`, `completenessHint`;
- `recommendedIllustrationCandidateIds`, `visualDependencyHint`.

OpenAI tự nhận diện cấu trúc ngữ nghĩa từ OCR. Backend chỉ kiểm chứng các bằng
chứng khách quan mà model trả về trước khi persist.

```text
OCR chunks nguyên vẹn + metadata khách quan
  -> OpenAI tự nhận diện đề mục/tiểu mục/ví dụ/bài tập
  -> structured output kèm source evidence + source chunk IDs
  -> Zod/JSON Schema kiểm shape
  -> semantic validator kiểm evidence/tính duy nhất/thứ tự
  -> post-output figure coverage review
  -> persist Summary + enqueue figure jobs
```

## 2. Vì sao thay kế hoạch cũ

### 2.1. `sourceTopics` hiện truyền lỗi parser vào model

Payload thật đã biến `Trang sách 19 (PDF page 20)` thành T01 vì parser không nhận
heading dạng `1.`/`2.` rồi fallback lấy dòng đầu tiên. Nếu backend tiếp tục dựng
blueprint, enum động hoặc block index từ cùng parser, hệ thống chỉ chuyển lỗi sang
một hình thức phức tạp hơn và còn ép model tuân theo kết luận sai.

### 2.2. `sourceCandidates.problem` tạo hai nguồn cạnh tranh

Payload thật có 13 candidate chép lại 3.159 ký tự, xấp xỉ 790 token:

- 7/13 trùng byte-for-byte với `content`;
- 6/13 lấy từ cùng OCR nhưng đã bị parser/sanitize biến đổi.

Model phải tự chọn giữa OCR gốc và bản do preprocessing tạo. Bỏ hoàn toàn
candidate metadata khỏi provider input vừa giảm token vừa loại error propagation.

### 2.3. Source blocks nhỏ không tổng quát

Chia theo paragraph/LaTeX/item có thể làm tài liệu ít xuống dòng, bảng, công thức
nhiều dòng hoặc OCR vỡ cấu trúc trở nên lặt vặt. Chunk hiện tại đã là đơn vị
retrieval có giới hạn token; không tạo thêm một tầng phân mảnh mới chỉ để citation.

### 2.4. Ranh giới trách nhiệm mới

- Backend làm điều chắc chắn: retrieval, giới hạn context, thứ tự chunk, metadata
  tài liệu, schema, kiểm chuỗi nguồn và lifecycle.
- Model làm việc cần hiểu ngữ nghĩa: đề mục lớn, tiểu mục, theory, example, note,
  bài thường/bài thực tế và nhu cầu hình.
- OCR là bản nội dung có thẩm quyền duy nhất **trong request**, không phải chân lý
  tuyệt đối so với sách; lỗi OCR vẫn được model sửa khi có bằng chứng nội tại.

## 3. Mục tiêu và ngoài phạm vi

### Mục tiêu

- Mỗi chunk retrieval đã chọn chỉ được serialize một lần; backend không tạo thêm
  bản sao topic/candidate của nội dung đó.
- Không còn metadata suy đoán khiến model bị neo vào kết luận backend sai.
- Model xác định đúng các đề mục lớn từ nhiều kiểu tài liệu khác nhau.
- Backend xác minh được đoạn nguồn model dùng để neo section có thật trong chunk
  được trích dẫn, kể cả khi tài liệu không có heading rõ ràng.
- Prompt ngắn hơn, rõ hơn và không còn tham chiếu tới metadata đã xóa.
- Quy tắc figure giảm lặp 25–35% mà không mất coverage hay quality gate.
- Preview UI phản ánh chính xác prompt, context và schema cuối gửi provider.

### Không làm

- Không vá riêng Bài 13, Toán 12 hoặc một mẫu heading cụ thể.
- Không thay OCR engine, không reprocess tài liệu và không migration database chỉ
  cho thay đổi context dẫn xuất.
- Không gửi ảnh OCR/ảnh sách lên provider.
- Không tạo dark figure, PDF/SyncTeX editor hoặc tương thích ngược source LaTeX
  standalone.
- Không tự động cắt nhỏ `content` thành source blocks.
- Không thêm prompt ngầm sau hai ô admin nhìn thấy và chỉnh sửa.

## 4. Provider input contract mới

### 4.1. Chỉ cho phép metadata khách quan

Summary context serializer phải dùng allowlist thay vì truyền nguyên
`chunk.metadata`, nhằm ngăn field suy đoán cũ hoặc metadata nội bộ vô tình lọt vào
request:

```json
{
  "id": "392c44cd-...",
  "metadata": {
    "documentId": "8971d8ab-...",
    "documentTitle": "Toán 12 tập 2",
    "pageRange": {
      "pageStart": 20,
      "pageEnd": 22
    },
    "chunkIndex": 0
  },
  "content": "Trang sách 19 ... 1. ỨNG DỤNG TÍCH PHÂN..."
}
```

Không gửi `score`, `tokenCount`, storage URL, parser diagnostics hoặc field suy
luận nếu model không cần chúng để biên soạn.

### 4.2. Không chỉnh sửa ngữ nghĩa của `content`

- Giữ nguyên nội dung chunk đã được retrieval trả về.
- Serializer chỉ JSON-escape theo chuẩn, không sửa heading, `\item`, công thức,
  figure caption hoặc ví dụ.
- Không tách candidate, không copy đoạn con và không loại phần chỉ vì backend cho
  rằng đó là ví dụ/bài tập.
- Nếu các chunk gốc vốn overlap do chiến lược chunking, giữ nguyên để không làm
  hỏng ngữ cảnh. Overlap tự nhiên này không được tính là candidate duplication và
  phải có metric riêng thay vì tự deduplicate theo chuỗi.
- Thứ tự array phải theo `chunkIndex`, sau đó dùng thứ tự retrieval ổn định nếu
  thiếu `chunkIndex`.

### 4.3. Guard trước provider chỉ kiểm dữ liệu khách quan

- Có ít nhất một chunk và mỗi chunk có `id`, `content` không rỗng.
- Chunk ID duy nhất; `documentId/pageRange/chunkIndex` hợp lệ nếu có.
- Tổng context nằm trong budget hiện hành.
- Không kiểm “đã tìm được topic hay chưa” trước provider.
- Không fail tài liệu chỉ vì cấu trúc heading lạ.

## 5. Provider output và JSON Schema mới

### 5.1. Thay `sourceTopicId` bằng neo nguồn kiểm chứng được

Mỗi theory section trả:

```json
{
  "sourceEvidenceKind": "HEADING",
  "sourceEvidenceText": "1. ỨNG DỤNG TÍCH PHÂN ĐỂ TÍNH DIỆN TÍCH HÎNH PHẲNG",
  "displayHeading": "Ứng dụng tích phân để tính diện tích hình phẳng",
  "sourceChunkIds": ["392c44cd-..."],
  "units": []
}
```

- `sourceEvidenceKind = HEADING`: `sourceEvidenceText` là đoạn tiêu đề ngắn được
  chép nguyên văn từ OCR trong một chunk được trích dẫn, chưa sửa chính tả và
  chưa bỏ số đầu dòng.
- `sourceEvidenceKind = CONTENT`: chỉ dùng khi nguồn thực sự không có đề mục lớn
  rõ ràng; `sourceEvidenceText` là một đoạn mở đầu ngắn, nguyên văn, đại diện cho
  nội dung của section. Đây là neo provenance, không được giả làm heading nguồn.
- `displayHeading`: tên section dùng trên UI. Với `HEADING`, chỉ sửa lỗi OCR rõ
  ràng và bỏ số thứ tự đầu tiêu đề. Với `CONTENT`, model đặt một nhãn ngắn mô tả
  đúng phần kiến thức được neo, không thêm kiến thức ngoài nguồn.
- `sourceChunkIds`: các chunk thực sự hỗ trợ section; ít nhất một ID.
- Bỏ hoàn toàn `sourceTopicId` khỏi provider schema. Nếu cần T01/T02 cho log nội
  bộ, backend gán sau validation theo thứ tự section; ID đó không quay lại prompt.

Không dùng field nullable kiểu “có thể có heading, có thể không”. Hai field
`sourceEvidenceKind` và `sourceEvidenceText` tạo một contract thống nhất, buộc mọi
section đều có provenance nhưng không ép model bịa tiêu đề cho tài liệu phi cấu
trúc.

### 5.2. Điều chỉnh Zod/JSON Schema

- `theorySections`: `.min(1)` và giữ giới hạn trên hợp lý.
- `sourceEvidenceKind`: required enum `HEADING | CONTENT`.
- `sourceEvidenceText`: required, trim, giới hạn 500 ký tự.
- `displayHeading`: required, trim, giới hạn 240 ký tự.
- `sourceChunkIds`: required, unique sau normalize, 1–20 UUID.
- Bỏ descriptions và field liên quan `metadata.sourceTopics`/candidate hints.
- Giữ schema figure, theory, illustration và application exercises hiện hành,
  chỉ compact description bị lặp với system prompt. Mọi field `figure` dùng shape
  nullable thống nhất; schema không ép toàn bài có hình dựa trên một kết luận
  `ALL_REQUIRED` do backend suy ra trước khi gọi model.
- Bump `LESSON_SUMMARY_SCHEMA_VERSION` vì provider output contract thay đổi.

Persisted Summary cũng đổi dứt điểm, không giữ field cũ chỉ để tương thích:

```json
{
  "sectionOrigin": "SOURCE_HEADING",
  "sourceEvidence": {
    "kind": "HEADING",
    "text": "1. ỨNG DỤNG TÍCH PHÂN..."
  },
  "displayHeading": "Ứng dụng tích phân..."
}
```

- Theory section dùng `sectionOrigin = SOURCE_HEADING | SOURCE_CONTENT` và luôn
  có `sourceEvidence` tương ứng.
- Section “Bài tập vận dụng” do hệ thống tạo dùng
  `sectionOrigin = GENERATED_APPLICATIONS`, `sourceEvidence = null`; không gắn
  nhãn `EXACT` như thể tên section đó đã xuất hiện trong sách.
- Xóa `sourceHeading`, `headingDecision`, `headingRepairReason` khỏi contract mới
  nếu không còn consumer thực sự. `displayHeading` chỉ phục vụ trình bày;
  provenance nằm riêng ở `sourceEvidence`.
- Bump content contract/version và cập nhật serializer, web type, fixture/test
  liên quan trong cùng lượt triển khai. Không viết compatibility adapter theo
  quyết định của owner.

JSON Schema kiểm shape chứ không tự chứng minh evidence có trong OCR. Việc này
thuộc semantic validator vì nó cần context của request.

## 6. Semantic validation sau provider

Chạy trước mapper, persist và enqueue figure:

1. Mọi `sourceChunkIds` phải tồn tại trong request.
2. `sourceEvidenceText` phải xuất hiện trong ít nhất một chunk được trích dẫn:
   - ưu tiên exact trimmed substring;
   - nếu OCR/JSON whitespace khác, cho phép canonical match chỉ với Unicode NFKC,
     chuẩn hóa newline và collapse whitespace;
   - không fuzzy sửa chữ hoặc số ở gate này vì có thể hợp thức hóa evidence bịa.
3. Với `HEADING`, evidence không được là marker trang, tên file, header/footer,
   `THUẬT NGỮ`, `KIẾN THỨC KĨ NĂNG`, lesson title toàn bài, Ví dụ, Luyện tập,
   Vận dụng, Bài tập hoặc caption hình.
4. Với `CONTENT`, evidence được là câu/đoạn kiến thức bình thường nhưng không được
   chỉ là marker trang, header/footer, caption hoặc nhãn rỗng nghĩa. `CONTENT`
   không phải lối thoát khi tài liệu đã có heading lớn rõ ràng; trường hợp đáng
   ngờ tạo review issue để audit, không tự đổi kind.
5. Các evidence không được lặp sau canonicalization.
6. Thứ tự section phải tăng theo `(chunkIndex, vị trí evidence trong content)`.
7. `displayHeading` không rỗng, không còn số thứ tự đầu dòng và phải tương ứng
   về nghĩa với evidence. Phần tương ứng ngữ nghĩa do model chịu trách nhiệm;
   backend chỉ tự động kiểm các biến đổi chắc chắn, còn mismatch đáng ngờ tạo
   review issue thay vì tự sửa nội dung.
8. Section fail evidence/order/duplicate là lỗi cấu trúc: không persist Summary
   nửa đúng và không enqueue figure.

Không tự động gọi lại cùng paid request khi semantic gate fail. UI trả lỗi rõ,
giữ payload validation để admin xem và chỉ regenerate khi admin chủ động.

### Giới hạn được thừa nhận

Khi không có parser topic đứng trước, backend không thể chứng minh tuyệt đối model
đã tìm đủ mọi đề mục ngữ nghĩa. Để giảm rủi ro mà không biến parser thành nguồn
chân lý:

- prompt bắt model tự kiểm coverage trước khi trả;
- test trên nhiều cấu trúc tài liệu;
- có thể chạy một detector bảo thủ cho heading đánh số rõ ràng **chỉ để phát
  warning/telemetry**, không gửi hint cho model và không ép schema/output;
- live visual/content audit kiểm việc bỏ sót đề mục trước khi chấp nhận rollout.

Coverage ở đây chỉ có thể đầy đủ đối với tập chunk được đưa vào request. Baseline
phải ghi manifest trang/chunk đã chọn và cảnh báo khi source selection không phủ
được toàn lesson trong token budget; prompt không thể khôi phục phần nguồn chưa
được gửi. Việc thay thuật toán retrieval/chunking nằm ngoài corrective pass này,
nhưng thiếu coverage nguồn là blocker của live acceptance chứ không được quy lỗi
cho prompt.

## 7. Kế hoạch sửa system prompt

### 7.1. Xóa hoàn toàn các khái niệm cũ

Prompt mặc định không còn các từ/ý:

- `metadata.sourceTopics`, `sourceTopicId`;
- `metadata.sourceCandidates`, candidate ID hoặc mọi hint của parser;
- “mỗi sourceTopicId chỉ xuất hiện đúng một lần”;
- giả định backend đã phân loại trước đề mục/ví dụ/bài tập.

### 7.2. Mục `XỬ LÝ DỮ LIỆU NGUỒN VÀ ĐỀ MỤC` mới

Dự thảo nội dung canonical đặt đúng một lần trong system prompt:

```text
### II. XỬ LÝ DỮ LIỆU NGUỒN VÀ ĐỀ MỤC
1. Đọc toàn bộ OCR chunks theo metadata.chunkIndex. Tự xác định các đề mục kiến
   thức lớn thực sự xuất hiện trong nguồn dựa trên tiêu đề, thứ tự, cấu trúc và
   ngữ nghĩa của phần nội dung đi sau.
2. Phân biệt đề mục lớn với tên bài học, marker trang, tên tài liệu, header/footer,
   thuật ngữ, mục tiêu/kiến thức-kĩ năng, tiểu mục a)/b), hoạt động, ví dụ, chú ý,
   luyện tập, vận dụng, bài tập và caption hình. Các phần này không tự trở thành
   theory section.
3. Khi nguồn có đề mục lớn rõ ràng, mỗi theorySections item tương ứng đúng một đề
   mục, giữ thứ tự xuất hiện và dùng sourceEvidenceKind=HEADING. Trong mỗi section,
   chia các tiểu chủ đề thành unit vừa đọc.
4. Khi nguồn thực sự không có đề mục lớn rõ ràng, được nhóm các đoạn liên tiếp
   thành section kiến thức mạch lạc và dùng sourceEvidenceKind=CONTENT. Không bịa
   rằng displayHeading là heading của sách.
5. sourceEvidenceText phải chép nguyên văn một đoạn ngắn từ một sourceChunkIds
   được trích dẫn. Với HEADING, displayHeading chỉ sửa lỗi OCR/chính tả rõ ràng và
   bỏ số thứ tự đầu dòng. Với CONTENT, displayHeading là nhãn ngắn, trung thực,
   được suy ra từ chính phần nội dung đó.
6. Tự nhận diện knowledge, theorem, property, procedure, note, example, luyện tập,
   vận dụng và bài toán thực tế từ content. Không coi nhãn OCR hoặc cách xuống dòng
   là đúng tuyệt đối; dùng ngữ nghĩa của toàn đoạn để quyết định.
7. Nếu cấu trúc OCR mơ hồ, chỉ chọn cấu trúc có bằng chứng trực tiếp trong nguồn;
   ưu tiên HEADING khi có tiêu đề thật và dùng CONTENT thay vì bịa heading.
```

### 7.3. Mục cấu trúc chỉ giữ invariant đầu ra

Thay dòng đang phụ thuộc `sourceTopics` bằng:

```text
Mỗi theory section phải có source evidence hợp lệ, sau đó gồm các unit theo thứ
tự theory → illustration → notes. Illustration phải áp dụng trực tiếp theory của
cùng unit; không gom nhiều theory rồi mới gom nhiều ví dụ.
```

Các quy tắc problem tự đủ dữ kiện, application exercises, solution/answer và
Markdown tiếp tục giữ nhưng mỗi ý chỉ xuất hiện ở một mục sở hữu rõ ràng.

### 7.4. User prompt được rút về nhiệm vụ và cấu hình

User prompt chỉ chứa:

- lesson title và grade; subject đã nằm đúng một lần trong system profile;
- style/length/target word count;
- yêu cầu bổ sung của admin;
- nhiệm vụ sinh nội dung theo structured output.

Xóa câu “âm thầm phân loại nguồn...” khỏi user prompt vì system prompt đã sở hữu
đúng một lần. Không lặp subject boundary nếu system prompt/profile đã thể hiện và
đã được đưa đầy đủ lên UI trước khi admin chỉnh.

### 7.5. Quyền kiểm soát prompt của admin

- Preview API dựng toàn bộ default system/user prompt, gồm subject profile và
  coverage requirement, trước khi hiển thị modal.
- Khi admin sửa, đúng hai string trong hai ô được snapshot vào job và gửi nguyên
  văn; backend/worker không append, restore hoặc merge thêm prompt.
- Context JSON, JSON Schema, model config và token estimate hiển thị trong tab
  **Dữ liệu gửi đi** vì chúng cũng là thành phần request, nhưng không được giả làm
  prompt ẩn.
- Nếu admin xóa quy tắc evidence/coverage trong custom prompt, đó là lựa chọn của
  admin; schema và semantic/sandbox validation kỹ thuật vẫn được enforce.

### 7.6. Bố cục prompt mặc định sau khi sửa

System prompt chỉ còn các owner rõ ràng theo thứ tự:

```text
I. Vai trò, trung thực nguồn và an toàn dữ liệu tham khảo
II. Xử lý OCR chunks và nhận diện đề mục
III. Cấu trúc section → unit → theory/illustration/notes → application exercises
IV. Quy tắc lập figure plan
V. Định dạng Markdown/công thức/lời giải
VI. Hồ sơ chuyên môn duy nhất của môn hiện tại
VII. Yêu cầu structured output và tự kiểm tra trước khi trả
```

User prompt mặc định:

```text
Nhiệm vụ: Tạo kiến thức cho bài {lessonTitle}.
Khối lớp: {targetGrade hoặc chưa xác định}.
Phong cách: {styleInstruction}.
Độ dài: {lengthInstruction/targetWordCount}.
Yêu cầu bổ sung của admin: {extraInstructions hoặc không có}.
Trả đúng structured output đã cung cấp.
```

Không lặp subject ở ba nơi, không lặp “âm thầm phân loại”, không lặp figure rules
trong structure. Subject profile và mọi coverage instruction mặc định đều nằm
trong system prompt hoàn chỉnh được preview trước khi admin chỉnh.

### 7.7. Ma trận thay thế prompt hiện tại

| Vị trí hiện tại | Vấn đề | Thay đổi bắt buộc |
| --- | --- | --- |
| `CẤU TRÚC NỘI DUNG` dòng 1 | Ép theo `metadata.sourceTopics` và `sourceTopicId` | Thay bằng invariant `sourceEvidenceKind` + `sourceEvidenceText` + `sourceChunkIds` + section theo thứ tự nguồn |
| `XỬ LÝ ĐỀ MỤC` dòng 1 | Giả định backend đã tìm đúng topic | Thay bằng bảy quy tắc tự nhận diện từ OCR ở mục 7.2 |
| User prompt “âm thầm phân loại...” | Lặp nhiệm vụ system prompt | Xóa |
| Subject boundary trong user prompt | Lặp subject profile | Xóa; giữ subject đúng một lần trong system profile hiển thị cho admin |
| Figure rules ở structure 3/4/6a–6f/10 | Cùng ý rải nhiều dòng | Structure chỉ giữ cardinality; nội dung chuyển về canonical block mục 8.1 |
| Figure coverage policy riêng | Lặp với profile và figure block | Hợp nhất coverage chung vào mục 8.1; profile chỉ giữ trường hợp đặc thù môn |
| Dynamic `HÌNH MINH HỌA CẦN CÓ...` | Backend suy luận và có nguy cơ append ngầm | Xóa khỏi builder/provider path |
| Schema descriptions dài | Biến schema thành prompt thứ hai | Chỉ mô tả field ngắn, không lặp instruction sư phạm/canvas |

### 7.8. Prompt assembly invariant

Builder mặc định tạo prompt theo một lần assembly duy nhất:

```ts
defaultSystemPrompt = [
  sourceAndSectionRules,
  structureRules,
  canonicalFigureRules,
  formattingRules,
  subjectProfile,
  outputRules,
].join("\n\n");

defaultUserPrompt = buildTaskConfigurationPrompt(configuration);
```

Sau preview:

```ts
request.systemPrompt = form.systemInstructions;
request.userPrompt = form.userPrompt;
```

Không còn `appendSubjectBoundary()`, `figureRequirementPrompt`, merge preference
hoặc fallback khôi phục một phần prompt ở API/worker. Context wrapper chống prompt
injection và JSON chunks thuộc transport input, không phải nội dung nối vào hai
prompt; toàn bộ wrapper/context thực tế phải hiện trong tab **Dữ liệu gửi đi**.

## 8. Kế hoạch compact prompt figure

### 8.1. Một block canonical duy nhất

Gộp nội dung figure ở các mục 3/4/6a–6f/10, coverage policy, subject profile và
dynamic requirement thành một mục `QUY TẮC LẬP FIGURE PLAN` với bảy bất biến:

1. Tạo figure cho coverage bắt buộc và chủ động thêm khi hình giúp hiểu đúng;
   không tạo hình trang trí hoặc cho phép hình làm thay nhiệm vụ lời giải.
2. `visualIntent` chỉ nêu đối tượng, quan hệ, miền/đường biên, nhãn và dữ kiện
   trực quan học sinh thật sự cần nhìn.
3. Problem/solution/answer chỉ dùng để kiểm chứng tính đúng; không đưa phép tính
   trung gian, chuỗi suy luận, kết luận hay đáp số lên canvas trừ khi chính nó là
   dữ kiện trực quan đầu vào.
4. Brief không chứa TikZ, package, template, tọa độ triển khai hoặc cách dựng;
   worker được chọn giải pháp hình phù hợp.
5. Hình light-only, một bố cục kiểu sách giáo khoa, thoáng, ít màu/nhãn, đọc rõ ở
   chiều rộng khoảng 320 px; không panel giải thích, không nhãn che nét.
6. Chỉ dùng hệ trục khi trục/tọa độ là thông tin cần đọc; quan hệ 2D/3D, mặt,
   miền, đoạn, mũi tên, giao điểm và dấu góc phải nhìn rõ sau phép chiếu.
7. Mỗi example tối đa một figure dùng chung; hình phải trung thực với block và
   không được đổi kiến thức/ví dụ chỉ để dễ vẽ.

### 8.2. Phân trách nhiệm để không lặp

- Structure chỉ quy định field `figure` và cardinality.
- Subject profile chỉ thêm notation/coverage thật sự đặc thù môn.
- Không còn dynamic requirement dựng từ title/OCR; coverage mặc định nằm trong
  canonical figure block và profile môn đang hiển thị cho admin.
- JSON Schema description chỉ mô tả shape/ý nghĩa field.
- Figure worker prompt tiếp tục là prompt chuyên vẽ riêng; Summary prompt chỉ lập
  visual brief, không dạy model viết TikZ.

### 8.3. Bỏ global `ALL_REQUIRED` suy ra trước provider

`resolveLessonSummaryFigureRequirement()` hiện đọc lesson title/OCR rồi phân loại
toàn bài. Kết luận quá rộng có thể ép schema và prompt tạo hình cho cả block thuần
đại số, đúng lỗi đã thấy ở Bài 14. Hướng mới:

- không dùng lesson title/context để chọn một provider schema `ALL_REQUIRED`;
- không append động mục `HÌNH MINH HỌA CẦN CÓ TRONG BÀI NÀY` sau prompt preview;
- dùng một provider schema có `figure` nullable;
- system prompt hiển thị đầy đủ coverage theo môn và yêu cầu model quyết định ở
  cấp block;
- sau output, coverage checker chỉ tạo review issue cho trường hợp bắt buộc bị
  thiếu theo contract M9.2 hiện hành; không tự thêm figure, không sửa nội dung và
  không gọi paid retry;
- audit lại checker để không dùng một từ khóa yếu hoặc một section hình học làm
  lý do ép mọi section/block khác.

Đây là đổi cơ chế enforcement, không phải hạ mục tiêu coverage: nội dung thật sự
cần hình vẫn phải có hình, còn block không mang thông tin trực quan không bị ép.

Mục tiêu: giảm 25–35% phần instruction figure, semantic inventory 7/7 vẫn pass.

## 9. Code map dự kiến khi triển khai

### API/AI contract

- `lesson-summary-prompt.ts`
  - bỏ `attachLessonSummarySourceCandidates()`;
  - serialize raw chunks bằng metadata allowlist;
  - thay prompt sections theo mục 7 và compact figure theo mục 8.
- `lesson-summary-source-candidates.ts`
  - xóa toàn bộ file và exports/tests nếu không còn consumer;
  - không giữ legacy path hoặc fallback.
- `lesson-summary.types.ts`
  - thay `sourceTopicId` bằng `sourceEvidenceKind` + `sourceEvidenceText` ở mọi
    subject schema;
  - hợp nhất provider schema figure về nullable, không chọn schema từ
    `ALL_REQUIRED`;
  - bump schema/prompt version và cập nhật descriptions.
- `lesson-summary-mapper.ts`
  - persist `sectionOrigin` và provenance dưới shape
    `sourceEvidence: { kind, text } | null` đã validate;
  - persist `displayHeading` từ field riêng, không dùng display làm evidence;
  - xóa `sourceHeading/headingDecision/headingRepairReason`; đánh dấu section bài
    tập do hệ thống tạo là `GENERATED_APPLICATIONS`;
  - giữ `sourceChunkIds` đã kiểm.
- Thêm semantic validator dùng chung trước mapper/figure coverage persist.
- `lesson-summary-figure-requirement.ts`
  - bỏ resolver global dùng title/raw context trên provider path;
  - giữ/refactor post-output checker theo từng block, trả review issue và không
    ép hình từ từ khóa yếu.
- `lesson-summary-review-copy.ts`: đổi copy kỹ thuật liên quan source topic ID.
- Shared/web Summary type, renderer fixture và admin/student tests:
  - đọc `sectionOrigin/sourceEvidence` mới;
  - không hiển thị provenance trong student UI mặc định;
  - chỉ hiển thị trong editorial/debug view khi cần audit.

### Job/cache/preview

- Snapshot prompt cuối, source hash, prompt/schema/context-contract version.
- Preview và worker dùng chung serializer allowlist.
- Request/cache fingerprint phải bao gồm source hash + các version liên quan.
- Tab dữ liệu gửi đi không còn `sourceTopics/sourceCandidates` và hiển thị đúng
  raw chunks + schema mới.

### Tài liệu

- Cập nhật `docs/06-ai-rag-spec.md`, API contract M9.2 và test cases khi bắt đầu
  implementation; chưa thay source-of-truth runtime trước khi owner duyệt plan.

## 10. Kế hoạch triển khai theo phase

### Phase 0 — Baseline

- Đưa payload lỗi thành fixture regression tối giản trong repo.
- Đo input chars/tokens, số metadata suy đoán và prompt figure hiện tại.
- Snapshot đúng request đang hiển thị trong modal.

### Phase 1 — Minimal context transport

- Tạo serializer allowlist metadata khách quan.
- Bỏ attach/parser candidate khỏi provider path và xóa code không còn dùng.
- Test content giữ nguyên và không duplicate.

### Phase 2 — Output evidence/schema/validator

- Thay schema `sourceTopicId` bằng `sourceEvidenceKind` + `sourceEvidenceText`.
- Implement exact/canonical evidence validation, exclusion, uniqueness và order.
- Sửa mapper/review errors; bảo đảm fail trước persist/figure enqueue.

### Phase 3 — Prompt rewrite

- Thay toàn bộ section/topic instruction theo raw OCR contract.
- Loại mọi nhắc tới metadata suy đoán.
- Compact figure instruction theo semantic inventory.
- Bỏ dynamic `ALL_REQUIRED` prompt/schema; chuyển coverage về visible canonical
  prompt + post-output review.
- Bump prompt/schema/context-contract version và snapshots.

### Phase 4 — Preview/UI/observability

- Hiển thị đúng raw context/schema/prompt cuối.
- Log số chunk, context tokens, evidence validation code và section count; không
  log raw OCR.
- Lỗi semantic hiển thị rõ, không tự paid retry.

### Phase 5 — Local verification

- Unit/schema/prompt/mapper/semantic tests.
- Request replay từ fixture, không gọi provider.
- Fake-provider integration preview → enqueue → worker.
- Shared/API/web typecheck, focused lint/build.
- Restart worker sau thay đổi.

### Phase 6 — Live test tiết kiệm sau khi owner duyệt chi phí

- Chỉ chạy khi toàn bộ local gates pass.
- Lượt đầu dùng đúng bài có payload lỗi, Terra, một Summary generation.
- Nếu pass mới mở rộng tối đa hai bài có cấu trúc OCR khác.
- Không retry mù; báo trước request count và ước tính chi phí.
- Chụp light-theme desktop/tablet/mobile và đánh giá toàn bài: đề mục, theory,
  illustration, bài tập, figure-content alignment, độ gọn, nhãn và responsive.

## 11. Ma trận test bắt buộc

### Context transport

- Mỗi chunk chỉ có `id`, metadata allowlist và `content`.
- `content` byte-for-byte giữ nguyên qua serializer ngoài JSON escaping.
- Không có `sourceTopics`, `sourceCandidates` hoặc các hint liên quan ở bất kỳ
  chunk nào.
- Mỗi chunk ID xuất hiện đúng một lần trong context array; fixture không overlap
  dùng sentinel để chứng minh backend không tạo bản copy candidate/topic.
- Fixture có overlap chứng minh serializer giữ nguyên hai chunk và telemetry báo
  overlap, không tự cắt hoặc nhập nội dung.
- Payload fixture giảm ít nhất 3.159 ký tự candidate text trước khi tính phần
  metadata suy đoán khác; token thực tế đo bằng tokenizer dùng trong app.

### Prompt

- Không còn chuỗi `metadata.sourceTopics`, `sourceTopicId`, `sourceCandidates`.
- Prompt nói rõ phân biệt đề mục lớn với lesson title/page marker/a-b/example/
  exercise/caption.
- `sourceEvidenceKind/sourceEvidenceText` và quy tắc chép nguyên văn xuất hiện
  đúng một nơi.
- User prompt không lặp nhiệm vụ phân loại đã có trong system prompt.
- Hai prompt admin chỉnh được gửi nguyên văn; không append ngầm.
- Figure semantic inventory 7/7 và giảm tối thiểu 25% instruction liên quan.
- Không còn dynamic prompt/schema `ALL_REQUIRED` dựa trên lesson title/OCR.

### Schema/semantic gate

- Schema bắt buộc `sourceEvidenceKind`, `sourceEvidenceText`, `displayHeading`,
  `sourceChunkIds` và không nhận `sourceTopicId`.
- Persisted theory section có `sectionOrigin/sourceEvidence`; generated application
  section có origin riêng và evidence null; không còn field heading legacy.
- Exact và whitespace-canonical evidence hợp lệ pass.
- Evidence sửa chữ/số, không thuộc cited chunk, marker trang hoặc caption fail.
- Duplicate và đảo thứ tự section fail.
- Tài liệu có heading dùng `HEADING`; tài liệu prose liên tục dùng `CONTENT` mà
  không bịa heading nguồn; cả hai đều pass khi evidence hợp lệ.
- Lỗi semantic tạo 0 persisted Summary và 0 figure job.
- Custom prompt không bỏ qua schema/semantic validator.
- Figure field nullable ở provider schema; post-output coverage checker gắn đúng
  review issue ở block bắt buộc và không ép block thuần ký hiệu.

### Regression cấu trúc tài liệu

- Heading `1.`, `1)`, Roman numeral, LaTeX section và heading chữ không đánh số.
- Tài liệu không có heading lớn: section được nhóm theo mạch nội dung liên tiếp,
  evidence kind `CONTENT`, không tạo provenance giả.
- Tài liệu paragraph dài, ít dòng trống.
- Công thức/bảng/list nhiều dòng và OCR vỡ wrapper.
- Tài liệu có lesson title, page marker, glossary, objective, example và exercise
  trước heading lớn.
- Toán, Lý, Hóa và một bài General để tránh tối ưu riêng sách Toán.

## 12. Acceptance gates

- Request input chỉ còn raw chunks + metadata khách quan; không duplicate source.
- Manifest source của live case phủ đủ phần lesson cần biên soạn; nếu không, dừng
  acceptance và sửa source selection ở task riêng thay vì vá prompt.
- Fixture hiện tại không còn `Trang sách 19` được dùng làm heading section.
- Model trả đúng hai section diện tích/thể tích theo đúng thứ tự trong live gate.
- 100% section có evidence tồn tại trong cited chunk.
- 0 evidence marker/header/example/exercise được nhận làm `HEADING`; `CONTENT`
  không được dùng để che một heading lớn có sẵn trong ca acceptance.
- 0 Summary/figure job được persist từ output sai evidence/order.
- Prompt không còn dependency metadata cũ và figure rules giảm ít nhất 25%.
- Không còn global figure requirement suy ra từ title/raw context trước provider.
- Local focused tests, shared/API/web typecheck và scoped lint/build pass.
- Live raw generation không sai cấu trúc section; figure first-compile không cần
  AI repair và visual audit không còn nhét lời giải/đáp số lên canvas.

## 13. Version, rollout và rollback

- Tạo/bump context-contract, prompt và schema version cùng lượt deploy.
- Không giữ dual path hay compatibility adapter cho `sourceTopics/sourceCandidates`.
- Job queued với version cũ bị đánh dấu stale và admin chủ động tạo lại; không
  chạy worker mới trên snapshot cũ.
- Summary cũ không tự regenerate để tránh phát sinh chi phí.
- Deploy API + worker cùng version, restart worker bắt buộc rồi chạy smoke trước
  khi mở generation.
- Rollback bằng commit/version đồng bộ, không khôi phục parser fallback dòng đầu.

## 14. Rủi ro còn lại

- Model có thể bỏ sót heading: giảm bằng prompt, schema evidence, regression đa
  dạng và live audit; detector backend nếu có chỉ cảnh báo, không làm authority.
- Model có thể copy evidence không nguyên văn: prompt + exact/canonical gate sẽ
  fail rõ; không fuzzy hợp thức hóa.
- Model có thể bỏ sót figure khi schema không còn ép `ALL_REQUIRED`: subject
  coverage vẫn hiện rõ trong prompt và post-output checker gắn review issue; live
  gate đo cả thiếu hình lẫn thừa hình.
- Metadata chunk có thể thiếu: serializer dùng fallback thứ tự ổn định và chỉ
  gửi field tồn tại hợp lệ.
- Bỏ candidate hint làm model tốn thêm reasoning: đổi lại giảm token, giảm neo
  sai và giao phân loại ngữ nghĩa cho đúng thành phần mạnh hơn.
- Admin custom prompt có thể bỏ quy tắc nguồn/figure: đây là quyền đã chốt; lớp
  schema, semantic validation, sandbox và cost guard vẫn luôn hoạt động.

## 15. Thứ tự ưu tiên

1. Minimal raw context transport.
2. Evidence-based output schema + semantic validator.
3. Mapper/job/cache/version consistency.
4. System/user prompt rewrite và figure compaction.
5. Preview/telemetry.
6. Local regression rồi mới live test.

Không dựng lại source topic/candidate parser dưới tên mới. Mọi preprocessing được
gửi provider phải là dữ kiện khách quan, không phải kết luận ngữ nghĩa cạnh tranh
với OCR.
